/**
 * Structured Logger — tracks token usage, response time, context size, build time.
 * Supports the "Optimize context management for agentic AI" research goal.
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  constructor() {
    this.level = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] || 1;
    this.metrics = {
      totalRequests: 0,
      totalTokensEstimated: 0,
      totalBuildTime: 0,
      totalLLMTime: 0,
      summarizations: 0,
    };
  }

  _timestamp() {
    return new Date().toISOString();
  }

  _format(level, category, message, data = {}) {
    const entry = {
      timestamp: this._timestamp(),
      level,
      category,
      message,
      ...data,
    };
    return entry;
  }

  debug(category, message, data) {
    if (this.level <= LOG_LEVELS.debug) {
      const entry = this._format('DEBUG', category, message, data);
      console.log(`\x1b[90m[${entry.timestamp}] [DEBUG] [${category}] ${message}\x1b[0m`, data || '');
    }
  }

  info(category, message, data) {
    if (this.level <= LOG_LEVELS.info) {
      const entry = this._format('INFO', category, message, data);
      console.log(`\x1b[36m[${entry.timestamp}] [INFO] [${category}]\x1b[0m ${message}`, data ? JSON.stringify(data) : '');
    }
  }

  warn(category, message, data) {
    if (this.level <= LOG_LEVELS.warn) {
      const entry = this._format('WARN', category, message, data);
      console.warn(`\x1b[33m[${entry.timestamp}] [WARN] [${category}]\x1b[0m ${message}`, data ? JSON.stringify(data) : '');
    }
  }

  error(category, message, data) {
    const entry = this._format('ERROR', category, message, data);
    console.error(`\x1b[31m[${entry.timestamp}] [ERROR] [${category}]\x1b[0m ${message}`, data ? JSON.stringify(data) : '');
  }

  // ─── Specialized logging for benchmarking ───

  logLLMCall(provider, promptTokens, responseTokens, durationMs) {
    this.metrics.totalRequests++;
    this.metrics.totalTokensEstimated += (promptTokens + responseTokens);
    this.metrics.totalLLMTime += durationMs;

    this.info('LLM', `${provider} call completed`, {
      provider,
      promptTokens,
      responseTokens,
      totalTokens: promptTokens + responseTokens,
      durationMs,
      avgTokensPerRequest: Math.round(this.metrics.totalTokensEstimated / this.metrics.totalRequests),
    });
  }

  logContextSize(sessionId, messageCount, tokenEstimate, hasSummary) {
    this.info('Context', `Session ${sessionId} context`, {
      sessionId,
      messageCount,
      tokenEstimate,
      hasSummary,
    });
  }

  logSummarization(sessionId, originalMessages, afterMessages, durationMs) {
    this.metrics.summarizations++;
    this.info('Context', `Summarization performed`, {
      sessionId,
      originalMessages,
      afterMessages,
      compressed: originalMessages - afterMessages,
      durationMs,
      totalSummarizations: this.metrics.summarizations,
    });
  }

  logBuildTime(projectId, durationMs, success) {
    this.metrics.totalBuildTime += durationMs;
    this.info('Build', `Build ${success ? 'completed' : 'failed'}`, {
      projectId,
      durationMs,
      success,
    });
  }

  logAgentStep(step, message, data) {
    this.info('Agent', `[${step}] ${message}`, data);
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

const logger = new Logger();
export default logger;
