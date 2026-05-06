/**
 * LLM Provider Registry — manages provider selection, fallback, and health checks.
 * Environment-based switching via LLM_PROVIDER env var.
 */

import { OllamaProvider } from './OllamaProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { ClaudeProvider } from './ClaudeProvider.js';
import logger from '../utils/logger.js';

class ProviderRegistry {
  constructor() {
    this._providers = new Map();
    this._defaultProvider = process.env.LLM_PROVIDER || 'ollama';
    this._initialize();
  }

  _initialize() {
    // Register all providers
    const providers = [
      new OllamaProvider(),
      new OpenAIProvider(),
      new GeminiProvider(),
      new ClaudeProvider(),
    ];

    for (const provider of providers) {
      this._providers.set(provider.name, provider);
    }

    logger.info('Registry', `Registered ${this._providers.size} providers, default: ${this._defaultProvider}`);
  }

  /**
   * Get a specific provider by name.
   * @param {string} name
   * @returns {import('./BaseLLMProvider.js').BaseLLMProvider}
   */
  getProvider(name) {
    const provider = this._providers.get(name);
    if (!provider) {
      throw new Error(`Unknown LLM provider: ${name}. Available: ${[...this._providers.keys()].join(', ')}`);
    }
    return provider;
  }

  /**
   * Get the default provider or first available if default isn't configured.
   * @returns {import('./BaseLLMProvider.js').BaseLLMProvider}
   */
  getDefaultProvider() {
    const defaultP = this._providers.get(this._defaultProvider);
    if (defaultP && defaultP.isConfigured()) {
      return defaultP;
    }

    // Fallback: find first configured provider
    for (const [name, provider] of this._providers) {
      if (provider.isConfigured()) {
        logger.warn('Registry', `Default provider ${this._defaultProvider} not configured, falling back to ${name}`);
        return provider;
      }
    }

    throw new Error('No LLM providers are configured. Set up at least one provider in .env');
  }

  /**
   * Generate a response with automatic fallback.
   * Tries the specified provider first, then falls back to others.
   * @param {string} prompt
   * @param {Array} context
   * @param {string} [preferredProvider]
   * @returns {Promise<{response: string, provider: string}>}
   */
  async generateWithFallback(prompt, context = [], preferredProvider = null) {
    const providerOrder = this._getFallbackOrder(preferredProvider);

    for (const providerName of providerOrder) {
      const provider = this._providers.get(providerName);
      if (!provider || !provider.isConfigured()) continue;

      try {
        logger.info('Registry', `Attempting generation with ${providerName}`);
        const response = await provider.generateResponse(prompt, context);
        return { response, provider: providerName };
      } catch (error) {
        logger.warn('Registry', `Provider ${providerName} failed: ${error.message}`);
        continue;
      }
    }

    throw new Error('All LLM providers failed. Check your configuration and provider availability.');
  }

  /**
   * Get fallback order starting from preferred provider.
   */
  _getFallbackOrder(preferred) {
    const allNames = [...this._providers.keys()];
    if (!preferred) preferred = this._defaultProvider;

    // Move preferred to front
    const order = [preferred, ...allNames.filter(n => n !== preferred)];
    return order;
  }

  /**
   * Get status of all providers.
   * @returns {Promise<Array<{name: string, displayName: string, configured: boolean, healthy: boolean}>>}
   */
  async getStatus() {
    const status = [];
    for (const [name, provider] of this._providers) {
      const configured = provider.isConfigured();
      let healthy = false;
      if (configured) {
        try {
          healthy = await provider.healthCheck();
        } catch {
          healthy = false;
        }
      }
      status.push({
        name,
        displayName: provider.displayName,
        configured,
        healthy,
        isDefault: name === this._defaultProvider,
      });
    }
    return status;
  }

  /**
   * List all available (configured) providers.
   */
  getAvailableProviders() {
    return [...this._providers.entries()]
      .filter(([, p]) => p.isConfigured())
      .map(([name, p]) => ({ name, displayName: p.displayName }));
  }
}

const registry = new ProviderRegistry();
export default registry;
