/**
 * RecursiveSummarization — Default ContextStrategy implementation.
 * When context is too large:
 *   1. Takes older messages (all except last 2 exchanges)
 *   2. Sends them to LLM with a summarization prompt
 *   3. Replaces old messages with the summary
 *   4. Keeps recent messages intact
 *   5. Preserves key instructions
 */

import { ContextStrategy } from './ContextStrategy.js';
import logger from '../utils/logger.js';

export class RecursiveSummarization extends ContextStrategy {
  get name() { return 'recursive_summarization'; }

  /**
   * Process messages by summarizing older ones when over the token limit.
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} options
   * @param {number} options.maxTokens
   * @param {string} [options.existingSummary]
   * @param {Function} options.llmCall - async (prompt) => string
   * @returns {Promise<{messages: Array, summary: string, wasCompressed: boolean}>}
   */
  async process(messages, options = {}) {
    const { maxTokens = 4000, existingSummary = '', llmCall } = options;

    // If fewer than 4 messages (2 exchanges), nothing to summarize
    if (messages.length < 4) {
      return {
        messages,
        summary: existingSummary,
        wasCompressed: false,
      };
    }

    // Keep the last 4 messages (2 complete exchanges) intact
    const recentCount = 4;
    const messagesToSummarize = messages.slice(0, -recentCount);
    const recentMessages = messages.slice(-recentCount);

    if (messagesToSummarize.length === 0) {
      return {
        messages,
        summary: existingSummary,
        wasCompressed: false,
      };
    }

    // Build the summarization prompt
    const conversationText = messagesToSummarize
      .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
      .join('\n\n');

    const summaryPrompt = this._buildSummaryPrompt(existingSummary, conversationText);

    const startTime = Date.now();

    try {
      if (!llmCall) {
        // No LLM available — fall back to simple truncation
        logger.warn('RecursiveSummarization', 'No LLM call function provided, using truncation fallback');
        const truncatedSummary = this._truncationFallback(existingSummary, messagesToSummarize);
        return {
          messages: recentMessages,
          summary: truncatedSummary,
          wasCompressed: true,
        };
      }

      const newSummary = await llmCall(summaryPrompt);
      const durationMs = Date.now() - startTime;

      logger.logSummarization(
        'session',
        messages.length,
        recentMessages.length,
        durationMs
      );

      return {
        messages: recentMessages,
        summary: newSummary.trim(),
        wasCompressed: true,
      };
    } catch (error) {
      logger.error('RecursiveSummarization', `Summarization failed: ${error.message}`);
      // Fallback: just keep recent messages with a basic summary
      return {
        messages: recentMessages,
        summary: this._truncationFallback(existingSummary, messagesToSummarize),
        wasCompressed: true,
      };
    }
  }

  /**
   * Build the prompt to ask the LLM to summarize the conversation.
   */
  _buildSummaryPrompt(existingSummary, conversationText) {
    let prompt = `You are a conversation summarizer. Summarize the following conversation into a concise paragraph that preserves:
1. Key decisions and requirements discussed
2. What was built or modified (file names, components)
3. Any important constraints or preferences mentioned
4. The current state of the project

Keep the summary under 200 words. Focus on facts, not pleasantries.

`;

    if (existingSummary) {
      prompt += `Previous summary of earlier conversation:\n${existingSummary}\n\n`;
    }

    prompt += `New conversation to incorporate:\n${conversationText}\n\nProvide a unified summary:`;

    return prompt;
  }

  /**
   * Fallback when LLM is unavailable — simple extraction of key points.
   */
  _truncationFallback(existingSummary, messages) {
    const userMessages = messages
      .filter(m => m.role === 'user')
      .map(m => m.content.slice(0, 100))
      .join(' | ');

    const summary = existingSummary
      ? `${existingSummary}\n\nAdditional requests: ${userMessages}`
      : `User requests: ${userMessages}`;

    return summary.slice(0, 500);
  }
}
