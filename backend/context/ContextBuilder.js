/**
 * ContextBuilder — orchestrates the full context pipeline.
 * 1. Gets messages from ConversationBuffer
 * 2. Checks TokenMonitor
 * 3. Applies ContextStrategy if needed
 * 4. Builds final prompt: system prompt + summarized history + recent messages
 */

import conversationBuffer from './ConversationBuffer.js';
import tokenMonitor from './TokenMonitor.js';
import { RecursiveSummarization } from './RecursiveSummarization.js';
import { SlidingWindow } from './SlidingWindow.js';
import { SelectiveSummarization } from './SelectiveSummarization.js';
import logger from '../utils/logger.js';

// Strategy registry
const STRATEGIES = {
  recursive_summarization: new RecursiveSummarization(),
  sliding_window: new SlidingWindow(),
  selective_summarization: new SelectiveSummarization(),
};

class ContextBuilder {
  constructor() {
    const strategyName = process.env.CONTEXT_STRATEGY || 'recursive_summarization';
    this._strategy = STRATEGIES[strategyName] || STRATEGIES.recursive_summarization;
    logger.info('ContextBuilder', `Using strategy: ${this._strategy.name}`);
  }

  /**
   * Build the complete prompt for the LLM.
   * @param {string} sessionId
   * @param {string} userMessage - The current user message
   * @param {Object} [projectContext] - Current project state
   * @param {Function} [llmCall] - LLM function for summarization
   * @returns {Promise<{prompt: string, context: Array, metrics: Object}>}
   */
  async buildContext(sessionId, userMessage, projectContext = null, llmCall = null) {
    const messages = conversationBuffer.getMessages(sessionId);
    const existingSummary = conversationBuffer.getSummary(sessionId);
    const turnCount = conversationBuffer.getTurnCount(sessionId);

    // Capture original token count before any compression
    const previousTokens = tokenMonitor.estimateMessagesTokens(messages);

    // Check if we need to compress
    let processedMessages = messages;
    let currentSummary = existingSummary;
    let wasCompressed = false;

    const shouldCompress = tokenMonitor.needsSummarization(turnCount) ||
      tokenMonitor.isOverLimit(messages);

    if (shouldCompress && messages.length >= 4) {
      logger.info('ContextBuilder', `Compressing context for session ${sessionId} (${messages.length} messages, turn ${turnCount})`);

      const result = await this._strategy.process(messages, {
        maxTokens: tokenMonitor.maxTokens,
        existingSummary,
        llmCall,
      });

      processedMessages = result.messages;
      currentSummary = result.summary;
      wasCompressed = result.wasCompressed;

      if (wasCompressed) {
        // Update the buffer with compressed state
        conversationBuffer.setMessages(sessionId, processedMessages);
        conversationBuffer.setSummary(sessionId, currentSummary);
        conversationBuffer.resetTurnCount(sessionId);
      }
    }

    // Build the final prompt
    const systemPrompt = this._buildSystemPrompt(projectContext);
    const context = this._assembleContext(systemPrompt, currentSummary, processedMessages);

    // Determine context hit & metrics
    const contextHit = messages.length > 1 || !!currentSummary;
    const thresholdHit = !!shouldCompress;

    // Get metrics for logging
    const rawMetrics = tokenMonitor.getMetrics(processedMessages, currentSummary);
    logger.logContextSize(sessionId, processedMessages.length, rawMetrics.totalTokens, !!currentSummary);

    const metrics = {
      ...rawMetrics,
      contextHit,
      thresholdHit,
      summaryContent: currentSummary || '',
      turnCount,
      strategy: this._strategy.name,
      previousTokens,
      wasCompressed,
    };

    return {
      prompt: userMessage,
      context,
      metrics,
      wasCompressed,
      previousTokens,
    };
  }

  /**
   * Build the system prompt with instructions for the LLM.
   */
  _buildSystemPrompt(projectContext) {
    let prompt = `You are an expert React developer AI. Your job is to generate complete, functional React applications.

CRITICAL RULES:
1. Generate a complete React app using functional components and hooks.
2. Return ONLY valid JSON with a "files" object and a "description" string.
3. Each key in "files" is a file path, and each value is the FULL source code for that file.
4. You MUST write real, complete, working code for every file. Never use placeholder comments.
5. Do NOT include explanations outside the JSON.
6. Use Tailwind CSS classes for styling (it is loaded via CDN).
7. Do NOT use import statements for React — React, useState, useEffect, etc. are available globally via window.
8. Instead of importing components, access them via window. Example: const Navbar = window.Navbar;
9. Every component file must assign itself to window. Example: window.Navbar = Navbar;
10. The main App component must assign: window.AppComponent = App;
11. When updating an existing app, include ONLY the files that changed.
12. Make the UI beautiful, modern, and responsive with gradients, shadows, and animations.

EXAMPLE RESPONSE FORMAT:
{
  "files": {
    "src/App.jsx": "function App() {\\n  return (\\n    <div className=\\"min-h-screen bg-gray-900 text-white\\">\\n      <h1 className=\\"text-4xl font-bold p-8\\">Hello World</h1>\\n    </div>\\n  );\\n}\\n\\nwindow.AppComponent = App;",
    "src/index.css": "body { margin: 0; font-family: 'Inter', sans-serif; }"
  },
  "description": "Created a simple hello world page"
}`;

    if (projectContext?.existingFiles) {
      prompt += `\n\nCURRENT PROJECT FILES:\n`;
      for (const [filename, content] of Object.entries(projectContext.existingFiles)) {
        // Include truncated content so LLM knows what exists
        const truncated = content.length > 300 ? content.slice(0, 300) + '\n// ... (truncated)' : content;
        prompt += `\n--- ${filename} ---\n${truncated}\n`;
      }
    }

    return prompt;
  }

  /**
   * Assemble the full context array for the LLM.
   */
  _assembleContext(systemPrompt, summary, messages) {
    const context = [];

    // System prompt
    context.push({ role: 'system', content: systemPrompt });

    // Summarized history (if any)
    if (summary) {
      context.push({
        role: 'system',
        content: `Previous conversation summary:\n${summary}`,
      });
    }

    // Recent messages (skip very long assistant responses in context)
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.content.length > 1000) {
        context.push({
          role: 'assistant',
          content: msg.content.slice(0, 500) + '\n... [response truncated for context]',
        });
      } else {
        context.push({ role: msg.role, content: msg.content });
      }
    }

    return context;
  }

  /**
   * Get all registered strategy names.
   */
  getAvailableStrategies() {
    return Object.keys(STRATEGIES);
  }

  /**
   * Get the current strategy name.
   */
  getStrategyName() {
    return this._strategy.name;
  }

  /**
   * Switch strategy at runtime.
   */
  setStrategy(name) {
    if (STRATEGIES[name]) {
      this._strategy = STRATEGIES[name];
      logger.info('ContextBuilder', `Switched to strategy: ${name}`);
    } else {
      logger.warn('ContextBuilder', `Unknown strategy: ${name}`);
    }
  }
}

const contextBuilder = new ContextBuilder();
export default contextBuilder;
