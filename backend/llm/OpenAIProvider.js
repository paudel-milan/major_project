/**
 * OpenAI LLM Provider — uses the openai npm package.
 * Supports GPT-4o, GPT-4, GPT-3.5-turbo.
 */

import { BaseLLMProvider } from './BaseLLMProvider.js';
import logger from '../utils/logger.js';

export class OpenAIProvider extends BaseLLMProvider {
  constructor() {
    super();
    this._apiKey = process.env.OPENAI_API_KEY || '';
    this._model = process.env.OPENAI_MODEL || 'gpt-4o';
    this._client = null;

    if (this._apiKey) {
      logger.info('OpenAI', `Initialized with model: ${this._model}`);
    }
  }

  get name() { return 'openai'; }
  get displayName() { return `OpenAI (${this._model})`; }

  isConfigured() {
    return !!this._apiKey;
  }

  async _getClient() {
    if (!this._client) {
      try {
        const { default: OpenAI } = await import('openai');
        this._client = new OpenAI({ apiKey: this._apiKey });
      } catch {
        throw new Error('openai package not installed. Run: npm install openai');
      }
    }
    return this._client;
  }

  async generateResponse(prompt, context = []) {
    if (!this.isConfigured()) throw new Error('OpenAI not configured — set OPENAI_API_KEY');

    const client = await this._getClient();
    const messages = [
      ...context.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: prompt },
    ];

    const startTime = Date.now();
    const promptTokens = Math.ceil(prompt.split(/\s+/).length * 1.3);

    try {
      const completion = await client.chat.completions.create({
        model: this._model,
        messages,
        temperature: 0.7,
        max_tokens: 16384,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content || '';
      const durationMs = Date.now() - startTime;
      const responseTokens = completion.usage?.completion_tokens || Math.ceil(content.split(/\s+/).length * 1.3);
      logger.logLLMCall('openai', completion.usage?.prompt_tokens || promptTokens, responseTokens, durationMs);

      return content.trim();
    } catch (error) {
      logger.error('OpenAI', `API error: ${error.message}`);
      throw error;
    }
  }

  async healthCheck() {
    if (!this.isConfigured()) return false;
    try {
      const client = await this._getClient();
      await client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
