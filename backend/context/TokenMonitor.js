/**
 * TokenMonitor — estimates token counts and checks context limits.
 * Uses a word-based heuristic (words * 1.3) for fast estimation.
 */

import logger from '../utils/logger.js';

class TokenMonitor {
  constructor() {
    this.maxTokens = parseInt(process.env.CONTEXT_MAX_TOKENS || '4000', 10);
    this.summaryThreshold = parseInt(process.env.CONTEXT_SUMMARY_THRESHOLD || '6', 10);
  }

  /**
   * Estimate token count for a string.
   * Heuristic: ~1.3 tokens per word (accounts for subword tokenization).
   * @param {string} text
   * @returns {number}
   */
  estimateTokens(text) {
    if (!text) return 0;
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    return Math.ceil(words * 1.3);
  }

  /**
   * Estimate total tokens for a message array.
   * @param {Array<{role: string, content: string}>} messages
   * @returns {number}
   */
  estimateMessagesTokens(messages) {
    let total = 0;
    for (const msg of messages) {
      total += this.estimateTokens(msg.content);
      total += 4; // Role overhead (~4 tokens per message for formatting)
    }
    return total;
  }

  /**
   * Check if messages exceed the token limit.
   * @param {Array<{role: string, content: string}>} messages
   * @param {number} [maxTokens] - Override default max
   * @returns {boolean}
   */
  isOverLimit(messages, maxTokens = null) {
    const limit = maxTokens || this.maxTokens;
    const estimated = this.estimateMessagesTokens(messages);
    return estimated > limit;
  }

  /**
   * Check if turn count has reached the summarization threshold.
   * @param {number} turnCount
   * @returns {boolean}
   */
  needsSummarization(turnCount) {
    return turnCount >= this.summaryThreshold;
  }

  /**
   * Get detailed token metrics for a session.
   * @param {Array} messages
   * @param {string} summary
   * @returns {Object}
   */
  getMetrics(messages, summary = '') {
    const messageTokens = this.estimateMessagesTokens(messages);
    const summaryTokens = this.estimateTokens(summary);
    return {
      messageTokens,
      summaryTokens,
      totalTokens: messageTokens + summaryTokens,
      maxTokens: this.maxTokens,
      utilization: ((messageTokens + summaryTokens) / this.maxTokens * 100).toFixed(1) + '%',
      isOverLimit: (messageTokens + summaryTokens) > this.maxTokens,
    };
  }
}

const tokenMonitor = new TokenMonitor();
export default tokenMonitor;
