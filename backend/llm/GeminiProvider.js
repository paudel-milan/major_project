/**
 * Google Gemini LLM Provider — uses @google/generative-ai package.
 * Supports Gemini Pro, Flash models.
 */

import { BaseLLMProvider } from './BaseLLMProvider.js';
import logger from '../utils/logger.js';

export class GeminiProvider extends BaseLLMProvider {
  constructor() {
    super();
    this._apiKey = process.env.GEMINI_API_KEY || '';
    this._model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    this._client = null;

    if (this._apiKey) {
      logger.info('Gemini', `Initialized with model: ${this._model}`);
    }
  }

  get name() { return 'gemini'; }
  get displayName() { return `Google Gemini (${this._model})`; }

  isConfigured() {
    return !!this._apiKey;
  }

  async _getClient() {
    if (!this._client) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        this._client = new GoogleGenerativeAI(this._apiKey);
      } catch {
        throw new Error('@google/generative-ai package not installed. Run: npm install @google/generative-ai');
      }
    }
    return this._client;
  }

  async generateResponse(prompt, context = []) {
    if (!this.isConfigured()) throw new Error('Gemini not configured — set GEMINI_API_KEY');

    const client = await this._getClient();
    const model = client.getGenerativeModel({
      model: this._model,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
      },
    });

    // Build conversation history for Gemini format
    const history = context.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const startTime = Date.now();
    const estimatedPromptTokens = Math.ceil(prompt.split(/\s+/).length * 1.3);

    try {
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(prompt);
      const responseText = result.response.text();

      const durationMs = Date.now() - startTime;
      const reportedPromptTokens = result.response.usageMetadata?.promptTokenCount || estimatedPromptTokens;
      const responseTokens = result.response.usageMetadata?.candidatesTokenCount || Math.ceil(responseText.split(/\s+/).length * 1.3);
      logger.logLLMCall('gemini', reportedPromptTokens, responseTokens, durationMs);

      return {
        text: responseText.trim(),
        usage: {
          promptTokens: reportedPromptTokens,
          completionTokens: responseTokens,
          totalTokens: reportedPromptTokens + responseTokens,
          providerReported: !!result.response.usageMetadata?.promptTokenCount,
        },
      };
    } catch (error) {
      logger.error('Gemini', `API error: ${error.message}`);
      throw error;
    }
  }

  async healthCheck() {
    if (!this.isConfigured()) return false;
    try {
      const client = await this._getClient();
      const model = client.getGenerativeModel({ model: this._model });
      await model.generateContent('test');
      return true;
    } catch {
      return false;
    }
  }
}
