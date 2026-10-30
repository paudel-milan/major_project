/**
 * SlidingWindow — keeps the most recent messages within the token budget.
 */

import { ContextStrategy } from './ContextStrategy.js';
import logger from '../utils/logger.js';
import { countMessagesTokens } from '../utils/tokenizer.js';

export class SlidingWindow extends ContextStrategy {
  get name() { return 'sliding_window'; }

  async process(messages, options = {}) {
    const { maxTokens = 1500, thresholdTokens, existingSummary = '' } = options;
    const trigger = thresholdTokens || Math.round(maxTokens * 0.7);
    const windowSize = 10;

    // If already within window and under threshold, nothing to do
    const currentTokens = countMessagesTokens(messages);
    if (messages.length <= windowSize && currentTokens < trigger) {
      return {
        messages,
        summary: existingSummary,
        wasCompressed: false,
      };
    }

    // Determine how many to keep: at least 4 recent messages, drop oldest until under trigger
    let keepCount = Math.min(messages.length, windowSize);
    // Ensure we don't keep so few that context is empty
    const minKeep = Math.min(2, messages.length);
    while (keepCount > minKeep) {
      const candidate = messages.slice(-keepCount);
      if (countMessagesTokens(candidate) < trigger) break;
      keepCount--;
    }

    if (keepCount >= messages.length) {
      // No reduction possible
      return {
        messages,
        summary: existingSummary,
        wasCompressed: false,
      };
    }

    const keptMessages = messages.slice(-keepCount);
    const droppedCount = messages.length - keepCount;

    logger.info('SlidingWindow', `Dropped ${droppedCount} old messages, keeping ${keepCount}`);

    return {
      messages: keptMessages,
      summary: existingSummary,
      wasCompressed: true,
    };
  }
}