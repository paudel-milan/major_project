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
import contextEventLog from './ContextEventLog.js';

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

    // Capture original token count before any compression (messages + system prompt estimate)
    const previousTokens = tokenMonitor.estimateMessagesTokens(messages) + tokenMonitor.estimateTokens(this._buildSystemPrompt(projectContext));

    // Check if we need to compress
    let processedMessages = messages;
    let currentSummary = existingSummary;
    let wasCompressed = false;

    // Estimate full context including system prompt for limit checking
    const systemPromptTokensEstimate = tokenMonitor.estimateTokens(this._buildSystemPrompt(projectContext));
    const fullContextTokens = tokenMonitor.estimateMessagesTokens(messages) + systemPromptTokensEstimate + tokenMonitor.estimateTokens(existingSummary || '');

    const thresholdTokens = tokenMonitor.thresholdTokens;
    const shouldCompress = tokenMonitor.needsSummarization(turnCount) ||
      fullContextTokens >= thresholdTokens;

    // Record context assembly start event
    contextEventLog.record(sessionId, {
      type: 'CONTEXT_ASSEMBLED',
      status: 'info',
      trigger: 'User prompt received',
      tokensBefore: previousTokens,
      tokensAfter: previousTokens,
      details: { messageCount: messages.length, hasSummary: !!existingSummary },
    });

    // Determine threshold crossing
    if (fullContextTokens >= thresholdTokens && fullContextTokens < tokenMonitor.maxTokens) {
      contextEventLog.record(sessionId, {
        type: 'APPROACHING_THRESHOLD',
        status: 'warning',
        trigger: `Context at ${fullContextTokens} tokens, threshold ${thresholdTokens}`,
        tokensBefore: fullContextTokens,
        tokensAfter: fullContextTokens,
        details: { threshold: thresholdTokens, maxTokens: tokenMonitor.maxTokens },
      });
    }

    if (shouldCompress && messages.length >= 3) {
      logger.info('ContextBuilder', `Compressing context for session ${sessionId} (${messages.length} messages, turn ${turnCount})`);

      let compressionAttempts = 0;
      const MAX_COMPRESSION_ATTEMPTS = 3;

      while (compressionAttempts < MAX_COMPRESSION_ATTEMPTS) {
        compressionAttempts++;
        const summarizationTokensBefore = fullContextTokens;

        if (compressionAttempts === 1) {
          contextEventLog.record(sessionId, {
            type: 'SUMMARIZATION_REQUIRED',
            status: 'warning',
            trigger: tokenMonitor.needsSummarization(turnCount) ? 'Turn threshold reached' : 'Token threshold exceeded',
            tokensBefore: fullContextTokens,
            tokensAfter: null,
            details: { turnCount, threshold: tokenMonitor.summaryThreshold, maxTokens: tokenMonitor.maxTokens, attempt: compressionAttempts },
          });
        }

        contextEventLog.record(sessionId, {
          type: 'SUMMARIZATION_IN_PROGRESS',
          status: 'info',
          trigger: `Recursive summarization started (attempt ${compressionAttempts})`,
          tokensBefore: fullContextTokens,
          tokensAfter: null,
        });

        const summarizationStart = Date.now();
        const result = await this._strategy.process(processedMessages, {
          maxTokens: tokenMonitor.maxTokens,
          thresholdTokens: tokenMonitor.thresholdTokens,
          existingSummary: currentSummary,
          llmCall,
        });
        const summarizationDurationMs = Date.now() - summarizationStart;

        processedMessages = result.messages;
        currentSummary = result.summary;
        wasCompressed = result.wasCompressed;

        if (wasCompressed) {
          // Update the buffer with compressed state
          conversationBuffer.setMessages(sessionId, processedMessages);
          conversationBuffer.setSummary(sessionId, currentSummary);
          conversationBuffer.resetTurnCount(sessionId);

          // Recount after compression
          const systemPromptTokensEst = tokenMonitor.estimateTokens(this._buildSystemPrompt(projectContext));
          const afterTokens = tokenMonitor.estimateMessagesTokens(processedMessages) + tokenMonitor.estimateTokens(currentSummary || '') + systemPromptTokensEst;

          contextEventLog.record(sessionId, {
            type: 'SUMMARIZATION_COMPLETED',
            status: 'success',
            trigger: 'Recursive summarization finished',
            tokensBefore: summarizationTokensBefore,
            tokensAfter: afterTokens,
            durationMs: summarizationDurationMs,
            details: { messagesBefore: messages.length, messagesAfter: processedMessages.length, attempt: compressionAttempts },
          });

          contextEventLog.record(sessionId, {
            type: 'CONTEXT_REBUILT',
            status: 'success',
            trigger: 'Context rebuilt after summarization',
            tokensBefore: summarizationTokensBefore,
            tokensAfter: afterTokens,
            details: { strategy: this._strategy.name },
          });

          // Check if still over threshold
          if (afterTokens < thresholdTokens) {
            break; // Compression sufficient
          } else if (compressionAttempts < MAX_COMPRESSION_ATTEMPTS) {
            contextEventLog.record(sessionId, {
              type: 'SUMMARIZATION_REQUIRED',
              status: 'warning',
              trigger: `Still over threshold after attempt ${compressionAttempts}: ${afterTokens} >= ${thresholdTokens}`,
              tokensBefore: afterTokens,
              tokensAfter: null,
              details: { attempt: compressionAttempts + 1, maxAttempts: MAX_COMPRESSION_ATTEMPTS },
            });
            fullContextTokens = afterTokens;
            continue;
          } else {
            contextEventLog.record(sessionId, {
              type: 'BUDGET_EXCEEDED',
              status: 'error',
              trigger: `After ${MAX_COMPRESSION_ATTEMPTS} compression attempts: ${afterTokens} >= ${thresholdTokens}`,
              tokensBefore: afterTokens,
              tokensAfter: afterTokens,
              details: { maxTokens: tokenMonitor.maxTokens, attempts: MAX_COMPRESSION_ATTEMPTS },
            });
          }
        } else {
          break; // No compression happened
        }
      }
    } else if (shouldCompress && messages.length < 3) {
      // Too few messages to summarize — record event
      contextEventLog.record(sessionId, {
        type: 'BUDGET_EXCEEDED',
        status: 'warning',
        trigger: `Context at ${fullContextTokens} tokens exceeds threshold but only ${messages.length} messages (need >= 3)`,
        tokensBefore: fullContextTokens,
        tokensAfter: fullContextTokens,
        details: { messageCount: messages.length, threshold: thresholdTokens },
      });
    }

    // Build the final prompt
    const systemPrompt = this._buildSystemPrompt(projectContext);
    const context = this._assembleContext(systemPrompt, currentSummary, processedMessages);

    // Determine context hit & metrics
    const contextHit = messages.length > 1 || !!currentSummary;
    const thresholdHit = !!shouldCompress;

    // Count tokens per category using real tokenizer
    const systemPromptTokens = tokenMonitor.estimateTokens(systemPrompt);
    // Calculate code context tokens (project files portion)
    let codeContextTokens = 0;
    if (projectContext?.existingFiles) {
      let codePrompt = '\n\nCURRENT PROJECT FILES:\n';
      for (const [filename, content] of Object.entries(projectContext.existingFiles)) {
        const truncated = content.length > 300 ? content.slice(0, 300) + '\n// ... (truncated)' : content;
        codePrompt += `\n--- ${filename} ---\n${truncated}\n`;
      }
      codeContextTokens = tokenMonitor.estimateTokens(codePrompt);
    }
    const baseSystemTokens = systemPromptTokens - codeContextTokens;
    const summaryTokenCount = tokenMonitor.estimateTokens(currentSummary || '');
    const conversationTokens = tokenMonitor.estimateMessagesTokens(processedMessages);
    const userPromptTokens = tokenMonitor.estimateTokens(userMessage);

    // Get metrics for logging (full assembled context)
    const rawMetrics = tokenMonitor.getMetrics(processedMessages, currentSummary);
    // Override total to include system prompt
    const totalTokens = systemPromptTokens + conversationTokens + summaryTokenCount;
    logger.logContextSize(sessionId, processedMessages.length, totalTokens, !!currentSummary);

    const metrics = {
      messageTokens: conversationTokens,
      summaryTokens: summaryTokenCount,
      totalTokens,
      maxTokens: tokenMonitor.maxTokens,
      utilization: ((totalTokens / tokenMonitor.maxTokens) * 100).toFixed(1) + '%',
      isOverLimit: totalTokens > tokenMonitor.maxTokens,
      contextHit,
      thresholdHit,
      summaryContent: currentSummary || '',
      turnCount,
      strategy: this._strategy.name,
      previousTokens,
      wasCompressed,
      categoryBreakdown: {
        systemPrompt: baseSystemTokens,
        conversationHistory: conversationTokens,
        summaryMemory: summaryTokenCount,
        userPrompt: userPromptTokens,
        codeContext: codeContextTokens,
        toolDefinitions: 0,
        other: 0,
      },
      providerReported: false,
      estimatedTokens: totalTokens,
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
