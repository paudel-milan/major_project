/**
 * ContextStrategy — Abstract interface for context processing strategies.
 * Implementations: RecursiveSummarization, SlidingWindow, etc.
 */

export class ContextStrategy {
  /**
   * Process messages to fit within context limits.
   * @param {Array<{role: string, content: string}>} messages - All conversation messages
   * @param {Object} options - Strategy-specific options
   * @param {number} options.maxTokens - Maximum token budget
   * @param {string} [options.existingSummary] - Previously generated summary
   * @param {Function} [options.llmCall] - Function to call LLM for summarization
   * @returns {Promise<{messages: Array, summary: string, wasCompressed: boolean}>}
   */
  async process(messages, options = {}) {
    throw new Error('ContextStrategy.process not implemented');
  }

  /** @returns {string} Strategy identifier */
  get name() {
    throw new Error('ContextStrategy.name not implemented');
  }
}
