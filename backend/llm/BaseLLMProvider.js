/**
 * BaseLLMProvider — Abstract interface for all LLM providers.
 * Each provider must implement: name, displayName, generateResponse, healthCheck, isConfigured.
 */

export class BaseLLMProvider {
  /** @returns {string} Provider identifier (e.g., 'ollama', 'openai') */
  get name() {
    throw new Error('BaseLLMProvider.name not implemented');
  }

  /** @returns {string} Human-readable display name */
  get displayName() {
    throw new Error('BaseLLMProvider.displayName not implemented');
  }

  /**
   * Generate a response from the LLM.
   * @param {string} prompt - The user prompt
   * @param {Array<{role: string, content: string}>} context - Conversation context
   * @returns {Promise<string>} The LLM response text
   */
  async generateResponse(prompt, context = []) {
    throw new Error('BaseLLMProvider.generateResponse not implemented');
  }

  /**
   * Check if the provider is available and responding.
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    throw new Error('BaseLLMProvider.healthCheck not implemented');
  }

  /**
   * Check if the provider has the necessary configuration.
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('BaseLLMProvider.isConfigured not implemented');
  }
}
