/**
 * Anthropic Claude LLM Provider — uses @anthropic-ai/sdk package.
 * Supports Claude 3.5 Sonnet, Claude 3 Opus, etc.
 */

import { BaseLLMProvider } from './BaseLLMProvider.js';
import logger from '../utils/logger.js';

export class ClaudeProvider extends BaseLLMProvider {
  constructor() {
    super();
    this._apiKey = process.env.CLAUDE_API_KEY || '';
    this._model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
    this._client = null;

    if (this._apiKey) {
      logger.info('Claude', `Initialized with model: ${this._model}`);
    }
  }

  get name() { return 'claude'; }
  get displayName() { return `Anthropic Claude (${this._model})`; }

  isConfigured() {
    return !!this._apiKey;
  }

  async _getClient() {
    if (!this._client) {
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        this._client = new Anthropic({ apiKey: this._apiKey });
      } catch {
        throw new Error('@anthropic-ai/sdk package not installed. Run: npm install @anthropic-ai/sdk');
      }
    }
    return this._client;
  }

  async generateResponse(prompt, context = []) {
    if (!this.isConfigured()) throw new Error('Claude not configured — set CLAUDE_API_KEY');

    const client = await this._getClient();

    // Claude uses a system prompt + messages format
    const systemPrompt = context.find(m => m.role === 'system')?.content || '';
    const messages = context
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));
    messages.push({ role: 'user', content: prompt });

    const startTime = Date.now();
    const estimatedPromptTokens = Math.ceil(prompt.split(/\s+/).length * 1.3);

    try {
      const response = await client.messages.create({
        model: this._model,
        max_tokens: 16384,
        temperature: 0.7,
        system: systemPrompt || 'You are a React code generation AI. Always respond with valid JSON.',
        messages,
      });

      const content = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

      const durationMs = Date.now() - startTime;
      const reportedPromptTokens = response.usage?.input_tokens || estimatedPromptTokens;
      const responseTokens = response.usage?.output_tokens || Math.ceil(content.split(/\s+/).length * 1.3);
      logger.logLLMCall('claude', reportedPromptTokens, responseTokens, durationMs);

      return {
        text: content.trim(),
        usage: {
          promptTokens: reportedPromptTokens,
          completionTokens: responseTokens,
          totalTokens: reportedPromptTokens + responseTokens,
          providerReported: !!response.usage?.input_tokens,
        },
      };
    } catch (error) {
      logger.error('Claude', `API error: ${error.message}`);
      throw error;
    }
  }

  async healthCheck() {
    if (!this.isConfigured()) return false;
    try {
      const client = await this._getClient();
      await client.messages.create({
        model: this._model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
