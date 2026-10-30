/**
 * TokenMonitor — estimates token counts and checks context limits.
 * Uses a word-based heuristic (words * 1.3) for fast estimation.
 */

import logger from '../utils/logger.js';
import { countTokens, countMessagesTokens } from '../utils/tokenizer.js';

class TokenMonitor {
  constructor() {
    this.maxTokens = parseInt(process.env.CONTEXT_MAX_TOKENS || '1500', 10);
    this.summaryThreshold = parseInt(process.env.CONTEXT_SUMMARY_THRESHOLD || '6', 10);
    this.triggerThresholdPercent = parseInt(process.env.CONTEXT_TRIGGER_THRESHOLD_PERCENT || '70', 10);
  }

  get triggerThresholdPercentValue() {
    return this.triggerThresholdPercent;
  }

  get thresholdTokens() {
    return Math.round(this.maxTokens * (this.triggerThresholdPercent / 100));
  }

  /**
   * Count tokens for a string using a real subword tokenizer (cl100k_base).
   * @param {string} text
   * @returns {number}
   */
  estimateTokens(text) {
    return countTokens(text);
  }

  /**
   * Count total tokens for a message array (includes per-message overhead).
   * @param {Array<{role: string, content: string}>} messages
   * @returns {number}
   */
  estimateMessagesTokens(messages) {
    return countMessagesTokens(messages);
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
