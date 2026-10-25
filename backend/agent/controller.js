/**
 * Agent Controller — the brain of the system.
 * Orchestrates the full agent loop: prompt → context → LLM → code → validate → build → notify.
 * Includes a SELF-HEALING LOOP: if generated code has issues, it automatically sends
 * the errors back to the LLM for repair (up to MAX_REPAIR_ATTEMPTS times).
 */

import conversationBuffer from '../context/ConversationBuffer.js';
import contextBuilder from '../context/ContextBuilder.js';
import registry from '../llm/registry.js';
import codeGenerator from './codeGenerator.js';
import codeValidator from './codeValidator.js';
import projectManager from '../builder/ProjectManager.js';
import buildEngine from '../builder/BuildEngine.js';
import logger from '../utils/logger.js';

const MAX_REPAIR_ATTEMPTS = 3;

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
   * Includes self-healing: validate → repair → rebuild retry loop.
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
      this._broadcast('agent_progress', { step: 'understanding', status: 'active', sessionId });
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
      this._broadcast('agent_progress', { step: 'understanding', status: 'complete', sessionId });

      // Step 4: Build context
      logger.logAgentStep('3-Context', 'Building context');
      this._broadcast('agent_progress', { step: 'context', status: 'active', sessionId });
      const existingFiles = projectManager.getProjectFiles(projectId);
      const llmCallForSummary = async (prompt) => {
        const { response } = await registry.generateWithFallback(prompt, [], provider);
        return response;
      };

      const { prompt, context, metrics, wasCompressed, previousTokens } = await contextBuilder.buildContext(
        sessionId, userMessage, { existingFiles }, llmCallForSummary
      );

      if (wasCompressed) {
        this._broadcast('context_compressed', { sessionId, metrics });
      }
      this._broadcast('agent_progress', {
        step: 'context', status: 'complete', sessionId,
        contextMetrics: { ...metrics, previousTokens, wasCompressed, strategy: contextBuilder.getStrategyName() },
      });

      // Step 5: Call LLM
      logger.logAgentStep('4-LLM', 'Calling LLM provider');
      this._broadcast('agent_progress', { step: 'planning', status: 'active', sessionId });

      const { response: llmResponse, provider: usedProvider, usage } = await registry.generateWithFallback(
        prompt, context, provider
      );

      // Update metrics with provider-reported token count if available
      if (usage && usage.providerReported) {
        metrics.totalTokens = usage.promptTokens;
        metrics.messageTokens = usage.promptTokens - (metrics.summaryTokens || 0);
        metrics.providerReported = true;
        metrics.estimatedTokens = metrics.totalTokens;
      }

      this._broadcast('agent_progress', { step: 'planning', status: 'complete', sessionId });
      // ... rest of code ...

      // Step 6: Parse and write files
      logger.logAgentStep('5-CodeGen', 'Processing LLM response');
      this._broadcast('agent_progress', { step: 'generating', status: 'active', sessionId });
      let { updatedFiles, description } = await codeGenerator.processResponse(projectId, llmResponse);
      this._broadcast('agent_progress', { step: 'generating', status: 'complete', sessionId });

      // ═══ Step 7: SELF-HEALING LOOP — validate and auto-repair ═══
      let repairAttempt = 0;
      let currentFiles = projectManager.getProjectFiles(projectId);
      let validation = codeValidator.validate(currentFiles);

      if (validation.valid) {
        // Validation passed first try — mark step as complete
        logger.logAgentStep('7-Validate', 'Code validation passed');
        this._broadcast('agent_progress', { step: 'validating', status: 'active', sessionId });
        this._broadcast('agent_progress', { step: 'validating', status: 'complete', sessionId });
      }

      while (!validation.valid && repairAttempt < MAX_REPAIR_ATTEMPTS) {
        repairAttempt++;
        logger.logAgentStep('7-Repair', `Attempt ${repairAttempt}/${MAX_REPAIR_ATTEMPTS}: ${validation.issues.length} issue(s)`);

        // Notify frontend about the repair attempt
        this._broadcast('agent_progress', {
          step: 'validating',
          status: 'active',
          sessionId,
          repairAttempt,
          maxAttempts: MAX_REPAIR_ATTEMPTS,
          issues: validation.issues,
        });

        // Build a repair prompt with the issues and current code
        const repairPrompt = codeValidator.buildRepairPrompt(validation.issues, currentFiles);

        // Call LLM again with the repair prompt
        logger.logAgentStep('7-Repair-LLM', `Sending repair prompt to ${usedProvider}`);
        const { response: repairResponse } = await registry.generateWithFallback(
          repairPrompt, context, provider
        );

        // Parse and write the repaired files
        try {
          const repairResult = await codeGenerator.processResponse(projectId, repairResponse);
          updatedFiles = [...new Set([...updatedFiles, ...repairResult.updatedFiles])];
          description = repairResult.description || description;
          logger.logAgentStep('7-Repair-Write', `Wrote ${repairResult.updatedFiles.length} repaired files`);
        } catch (parseError) {
          logger.warn('Repair', `Failed to parse repair response: ${parseError.message}`);
          // Continue — we'll try again or give up
        }

        // Re-validate after repair
        currentFiles = projectManager.getProjectFiles(projectId);
        validation = codeValidator.validate(currentFiles);

        if (validation.valid) {
          logger.logAgentStep('7-Repair', `✓ Fixed after ${repairAttempt} attempt(s)`);
          this._broadcast('agent_progress', {
            step: 'validating',
            status: 'complete',
            sessionId,
            repairAttempt,
            message: `Fixed after ${repairAttempt} repair attempt(s)`,
          });
        }
      }

      if (!validation.valid) {
        logger.warn('Repair', `Gave up after ${MAX_REPAIR_ATTEMPTS} attempts. Remaining issues: ${validation.issues.join(' | ')}`);
        this._broadcast('agent_progress', {
          step: 'validating',
          status: 'complete',
          sessionId,
          message: `Could not auto-fix all issues after ${MAX_REPAIR_ATTEMPTS} attempts`,
          remainingIssues: validation.issues,
        });
      }

      // Step 8: Add AI response to buffer
      conversationBuffer.addMessage(sessionId, 'assistant', description);

      // Step 9: Build the project
      logger.logAgentStep('8-Build', 'Building project');
      this._broadcast('agent_progress', { step: 'building', status: 'active', sessionId });
      this._broadcast('build_start', { projectId });

      const buildResult = await buildEngine.build(projectId, (status) => {
        this._broadcast('build_progress', status);
      });

      // Step 10: Notify frontend
      if (buildResult.success) {
        this._broadcast('build_complete', { projectId, duration: buildResult.duration });
        this._broadcast('reload', { projectId });
        this._broadcast('agent_progress', { step: 'building', status: 'complete', sessionId });
        this._broadcast('agent_progress', { step: 'complete', status: 'complete', sessionId });
      } else {
        this._broadcast('build_error', { projectId, error: buildResult.error });
        this._broadcast('agent_progress', { step: 'building', status: 'error', sessionId, error: buildResult.error });
      }

      const totalDuration = Date.now() - startTime;
      logger.logAgentStep('Complete', `Total: ${totalDuration}ms`, {
        sessionId, projectId, filesUpdated: updatedFiles.length, provider: usedProvider,
        repairAttempts: repairAttempt,
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
        repairAttempts: repairAttempt,
        contextMetrics: { ...metrics, previousTokens, wasCompressed, strategy: contextBuilder.getStrategyName(), sessionId },
      };
    } catch (error) {
      logger.error('Agent', `Agent loop failed: ${error.message}`);
      this._broadcast('error', { message: error.message, sessionId });
      this._broadcast('agent_progress', { step: 'error', status: 'error', sessionId, error: error.message });
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
