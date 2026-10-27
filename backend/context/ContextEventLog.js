/**
 * ContextEventLog — tracks context lifecycle events per session.
 * Persisted in memory (per session) so dashboard refreshes retain history.
 */

const MAX_EVENTS_PER_SESSION = 200;

class ContextEventLog {
  constructor() {
    this._sessions = new Map();
  }

  _get(sessionId) {
    if (!this._sessions.has(sessionId)) {
      this._sessions.set(sessionId, []);
    }
    return this._sessions.get(sessionId);
  }

  /**
   * Record a context event.
   * @param {string} sessionId
   * @param {Object} event
   * @param {string} event.type - Event type (INITIAL, NORMAL, APPROACHING_THRESHOLD, etc.)
   * @param {string} [event.status] - 'info' | 'warning' | 'success' | 'error'
   * @param {string} [event.trigger] - Why this event was triggered
   * @param {number} [event.tokensBefore] - Tokens before operation
   * @param {number} [event.tokensAfter] - Tokens after operation
   * @param {number} [event.durationMs] - Duration in ms
   * @param {string} [event.requestId] - Request/operation identifier
   * @param {Object} [event.details] - Additional details
   */
  record(sessionId, event) {
    const log = this._get(sessionId);
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      type: event.type || 'UNKNOWN',
      status: event.status || 'info',
      trigger: event.trigger || '',
      tokensBefore: event.tokensBefore ?? null,
      tokensAfter: event.tokensAfter ?? null,
      tokensSaved: (event.tokensBefore != null && event.tokensAfter != null)
        ? Math.max(0, event.tokensBefore - event.tokensAfter)
        : (event.tokensSaved ?? null),
      reductionPercent: (event.tokensBefore != null && event.tokensAfter != null && event.tokensBefore > 0)
        ? Math.round(((event.tokensBefore - event.tokensAfter) / event.tokensBefore) * 100)
        : (event.reductionPercent ?? null),
      durationMs: event.durationMs ?? null,
      requestId: event.requestId || null,
      details: event.details || {},
    };
    log.push(entry);
    if (log.length > MAX_EVENTS_PER_SESSION) {
      log.splice(0, log.length - MAX_EVENTS_PER_SESSION);
    }
    return entry;
  }

  /**
   * Get all events for a session.
   */
  getEvents(sessionId) {
    return this._get(sessionId);
  }

  /**
   * Clear events for a session.
   */
  clear(sessionId) {
    this._sessions.delete(sessionId);
  }

  /**
   * Get the latest event of a given type for a session.
   */
  getLatest(sessionId, type) {
    const log = this._get(sessionId);
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].type === type) return log[i];
    }
    return null;
  }

  /**
   * Get current context state for a session.
   */
  getState(sessionId) {
    const log = this._get(sessionId);
    if (log.length === 0) return 'INITIAL';
    return log[log.length - 1].type || 'NORMAL';
  }
}

const contextEventLog = new ContextEventLog();
export default contextEventLog;
export { ContextEventLog };
