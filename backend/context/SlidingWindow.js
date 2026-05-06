/**
 * SlidingWindow — Future context strategy stub.
 * Simply keeps the last N messages and drops older ones.
 */

import { ContextStrategy } from './ContextStrategy.js';
import logger from '../utils/logger.js';

export class SlidingWindow extends ContextStrategy {
  get name() { return 'sliding_window'; }

  /**
   * Keep only the most recent messages within the token budget.
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} options
   * @param {number} options.maxTokens
   * @param {string} [options.existingSummary]
   * @returns {Promise<{messages: Array, summary: string, wasCompressed: boolean}>}
   */
  async process(messages, options = {}) {
    const { maxTokens = 4000, existingSummary = '' } = options;
    const windowSize = 10; // Keep last 10 messages

    if (messages.length <= windowSize) {
      return {
        messages,
        summary: existingSummary,
        wasCompressed: false,
      };
    }

    const keptMessages = messages.slice(-windowSize);
    const droppedCount = messages.length - windowSize;

    logger.info('SlidingWindow', `Dropped ${droppedCount} old messages, keeping ${windowSize}`);

    return {
      messages: keptMessages,
      summary: existingSummary,
      wasCompressed: true,
    };
  }
}
