/**
 * OpenAI LLM Provider — uses the openai npm package.
 * Supports standard OpenAI and Azure OpenAI endpoints via custom base URLs.
 */

import { BaseLLMProvider } from './BaseLLMProvider.js';
import logger from '../utils/logger.js';

export class OpenAIProvider extends BaseLLMProvider {
  constructor() {
    super();
    this._apiKey = process.env.OPENAI_API_KEY || '';
    this._model = process.env.OPENAI_MODEL || 'gpt-4o';
    this._baseUrl = process.env.OPENAI_BASE_URL || '';
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
        const options = { apiKey: this._apiKey };
        
        if (this._baseUrl) {
          options.baseURL = this._baseUrl;
          
          // If using an Azure backend, authenticate with the api-key header explicitly
          if (this._baseUrl.includes('azure')) {
            options.defaultHeaders = { 'api-key': this._apiKey };
          }
        }
        
        this._client = new OpenAI(options);
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

    // Ensure Azure-based JSON modes don't fail by injecting a system instruction if missing
    if (this._baseUrl.includes('azure') && !prompt.toLowerCase().includes('json')) {
      messages.unshift({ role: 'system', content: 'You must return your response as a valid JSON object.' });
    }

    const startTime = Date.now();
    const promptTokens = Math.ceil(prompt.split(/\s+/).length * 1.3);

    // Detect if this is a reasoning model (like gpt-5.4-mini or o-series)
    const isReasoningModel = this._model.includes('mini') || this._model.startsWith('o1') || this._model.startsWith('o3');
    
    // Prepare dynamic payload to protect against 400 Bad Request parameter rejections
    const apiOptions = {
      model: this._model,
      messages,
      response_format: { type: 'json_object' },
    };

    if (isReasoningModel) {
      apiOptions.max_completion_tokens = 16384; // Fixes your original error
      // Temperature is unsupported on reasoning models and omitted entirely
    } else {
      apiOptions.max_tokens = 16384;
      apiOptions.temperature = 0.7;
    }

    try {
      const completion = await client.chat.completions.create(apiOptions);

      const content = completion.choices[0]?.message?.content || '';
      const durationMs = Date.now() - startTime;
      const reportedPromptTokens = completion.usage?.prompt_tokens || promptTokens;
      const responseTokens = completion.usage?.completion_tokens || Math.ceil(content.split(/\s+/).length * 1.3);
      logger.logLLMCall('openai', reportedPromptTokens, responseTokens, durationMs);

      return {
        text: content.trim(),
        usage: {
          promptTokens: reportedPromptTokens,
          completionTokens: responseTokens,
          totalTokens: reportedPromptTokens + responseTokens,
          providerReported: !!completion.usage?.prompt_tokens,
        },
      };
    } catch (error) {
      logger.error('OpenAI', `API error: ${error.message}`);
      throw error;
    }
  }

  async healthCheck() {
    if (!this.isConfigured()) return false;
    try {
      const client = await this._getClient();
      
      // Azure environments often restrict model listing. A quick ping test is safer.
      if (this._baseUrl.includes('azure')) {
        const isReasoningModel = this._model.includes('mini') || this._model.startsWith('o1') || this._model.startsWith('o3');
        const tokenParam = isReasoningModel ? { max_completion_tokens: 5 } : { max_tokens: 5 };
        
        await client.chat.completions.create({
          model: this._model,
          messages: [{ role: 'user', content: 'ping' }],
          ...tokenParam
        });
      } else {
        await client.models.list();
      }
      return true;
    } catch {
      return false;
    }
  }
}
