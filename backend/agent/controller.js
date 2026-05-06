/**
 * Agent Controller — the brain of the system.
 * Orchestrates the full agent loop: prompt → context → LLM → code → build → notify.
 */

import conversationBuffer from '../context/ConversationBuffer.js';
import contextBuilder from '../context/ContextBuilder.js';
import registry from '../llm/registry.js';
import codeGenerator from './codeGenerator.js';
import projectManager from '../builder/ProjectManager.js';
import buildEngine from '../builder/BuildEngine.js';
import logger from '../utils/logger.js';

class AgentController {
  constructor() {
    this._wsClients = new Set();
  }

  /**
   * Register a WebSocket client for push notifications.
   */
  addClient(ws) {
    this._wsClients.add(ws);
  }

  removeClient(ws) {
    this._wsClients.delete(ws);
  }

  /**
   * Broadcast a message to all connected WebSocket clients.
   */
  _broadcast(event, data) {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    for (const client of this._wsClients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }

  /**
   * Main agent loop — handles a user message end-to-end.
   * @param {string} userMessage
   * @param {string} [sessionId]
   * @param {string} [provider]
   * @returns {Promise<Object>} Result with response, project info, etc.
   */
  async handleMessage(userMessage, sessionId = null, provider = null) {
    const startTime = Date.now();

    try {
      // Step 1: Get or create session
      logger.logAgentStep('1-Session', 'Initializing session');
      const session = conversationBuffer.getOrCreateSession(sessionId);
      sessionId = session.id;

      // Step 2: Create project if needed
      let projectId = conversationBuffer.getProjectId(sessionId);
      if (!projectId) {
        projectId = await projectManager.createProject();
        conversationBuffer.setProjectId(sessionId, projectId);
        logger.logAgentStep('2-Project', `Created project ${projectId}`);
      }

      // Step 3: Add user message to buffer
      conversationBuffer.addMessage(sessionId, 'user', userMessage);
      this._broadcast('ai_thinking', {
        sessionId,
        detail: 'Analyzing your request and preparing context…',
      });

      // Step 4: Build context
      logger.logAgentStep('3-Context', 'Building context');
      const existingFiles = projectManager.getProjectFiles(projectId);
      const llmCallForSummary = async (prompt) => {
        const { response } = await registry.generateWithFallback(prompt, [], provider);
        return response;
      };

      const { prompt, context, metrics, wasCompressed } = await contextBuilder.buildContext(
        sessionId, userMessage, { existingFiles }, llmCallForSummary
      );

      if (wasCompressed) {
        this._broadcast('context_compressed', { sessionId, metrics });
      }

      // Step 5: Call LLM
      logger.logAgentStep('4-LLM', 'Calling LLM provider');
      this._broadcast('ai_generating', {
        sessionId,
        detail: 'AI is writing your website code…',
      });

      const { response: llmResponse, provider: usedProvider } = await registry.generateWithFallback(
        prompt, context, provider
      );

      // Step 6: Parse and write files
      logger.logAgentStep('5-CodeGen', 'Processing LLM response');
      this._broadcast('ai_generating', {
        sessionId,
        detail: `Processing generated files…`,
      });

      const { updatedFiles, description } = await codeGenerator.processResponse(projectId, llmResponse);

      // Step 7: Add AI response to buffer
      conversationBuffer.addMessage(sessionId, 'assistant', description);

      // Step 8: Build the project
      logger.logAgentStep('6-Build', 'Building project');
      this._broadcast('build_start', {
        projectId,
        detail: `Compiling ${updatedFiles.length} file(s)…`,
      });

      const buildResult = await buildEngine.build(projectId, (status) => {
        this._broadcast('build_progress', status);
      });

      // Step 9: Notify frontend
      if (buildResult.success) {
        this._broadcast('build_complete', { projectId, duration: buildResult.duration });
        this._broadcast('reload', { projectId });
      } else {
        this._broadcast('build_error', { projectId, error: buildResult.error });
      }

      const totalDuration = Date.now() - startTime;
      logger.logAgentStep('Complete', `Total: ${totalDuration}ms`, {
        sessionId, projectId, filesUpdated: updatedFiles.length, provider: usedProvider,
      });

      return {
        success: true,
        sessionId,
        projectId,
        description,
        updatedFiles,
        provider: usedProvider,
        buildSuccess: buildResult.success,
        duration: totalDuration,
        contextMetrics: metrics,
      };
    } catch (error) {
      logger.error('Agent', `Agent loop failed: ${error.message}`);
      this._broadcast('error', { message: error.message, sessionId });
      return {
        success: false,
        sessionId,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }
}

const agentController = new AgentController();
export default agentController;
