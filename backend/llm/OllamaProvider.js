/**
 * Ollama LLM Provider — PRIMARY provider.
 * Connects to local Ollama instance for code generation.
 */

import { BaseLLMProvider } from './BaseLLMProvider.js';
import logger from '../utils/logger.js';
import { countTokens } from '../utils/tokenizer.js';

export class OllamaProvider extends BaseLLMProvider {
  constructor() {
    super();
    this._baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this._model = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
    logger.info('Ollama', `Initialized: ${this._baseUrl}, model: ${this._model}`);
  }

  get name() { return 'ollama'; }
  get displayName() { return `Ollama Local (${this._model})`; }

  isConfigured() {
    return true; // Ollama is always "configured" — it just may not be running
  }

  async generateResponse(prompt, context = []) {
    const messages = [
      ...context.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: prompt },
    ];

    const startTime = Date.now();

    logger.debug('Ollama', `Sending prompt (${prompt.length} chars) to ${this._model}`);

    try {
      const response = await fetch(`${this._baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this._model,
          messages,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 16384,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama HTTP ${response.status}: ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();
      const assistantMessage = data?.message?.content || '';

      if (!assistantMessage) {
        throw new Error('Ollama returned empty response');
      }

      const durationMs = Date.now() - startTime;
      // Use real token counts reported by Ollama when available.
      const promptTokens = data.prompt_eval_count ?? countTokens(prompt);
      const responseTokens = data.eval_count ?? countTokens(assistantMessage);
      logger.logLLMCall('ollama', promptTokens, responseTokens, durationMs);

      return assistantMessage.trim();
    } catch (error) {
      if (error.cause?.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
        throw new Error(
          `Cannot connect to Ollama at ${this._baseUrl}. Is Ollama running? Start it with: ollama serve`
        );
      }
      throw error;
    }
  }

  async healthCheck() {
    try {
      const response = await fetch(`${this._baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return false;
      const data = await response.json();
      const models = data.models?.map(m => m.name) || [];
      const hasModel = models.some(m => m.includes(this._model.split(':')[0]));
      if (!hasModel) {
        logger.warn('Ollama', `Model ${this._model} not found. Available: ${models.join(', ')}`);
      }
      return true;
    } catch {
      return false;
    }
  }
}
