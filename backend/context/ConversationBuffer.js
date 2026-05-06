/**
 * ConversationBuffer — stores all user + AI messages per session.
 * Provides methods for message management and retrieval.
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

class Session {
  constructor(id) {
    this.id = id;
    this.messages = [];        // {role, content, timestamp}
    this.summary = '';         // Accumulated summary of older turns
    this.turnCount = 0;
    this.createdAt = Date.now();
    this.projectId = null;     // Associated sandbox project
    this.metadata = {};        // Arbitrary session metadata
  }
}

class ConversationBuffer {
  constructor() {
    /** @type {Map<string, Session>} */
    this._sessions = new Map();
  }

  /**
   * Create a new conversation session.
   * @returns {string} Session ID
   */
  createSession() {
    const id = uuidv4().slice(0, 12);
    this._sessions.set(id, new Session(id));
    logger.info('Buffer', `Session created: ${id}`);
    return id;
  }

  /**
   * Get a session by ID. Creates one if not found.
   * @param {string} sessionId
   * @returns {Session}
   */
  getOrCreateSession(sessionId) {
    if (sessionId && this._sessions.has(sessionId)) {
      return this._sessions.get(sessionId);
    }
    const id = this.createSession();
    return this._sessions.get(id);
  }

  /**
   * Add a message to a session.
   * @param {string} sessionId
   * @param {string} role - 'user' | 'assistant' | 'system'
   * @param {string} content
   */
  addMessage(sessionId, role, content) {
    const session = this._sessions.get(sessionId);
    if (!session) {
      logger.warn('Buffer', `Session ${sessionId} not found`);
      return;
    }

    session.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });

    if (role === 'user') {
      session.turnCount++;
    }

    logger.debug('Buffer', `Added ${role} message to session ${sessionId} (turn ${session.turnCount})`);
  }

  /**
   * Get all messages for a session.
   * @param {string} sessionId
   * @returns {Array<{role: string, content: string, timestamp: number}>}
   */
  getMessages(sessionId) {
    const session = this._sessions.get(sessionId);
    return session ? [...session.messages] : [];
  }

  /**
   * Get the N most recent messages.
   * @param {string} sessionId
   * @param {number} n
   * @returns {Array}
   */
  getRecentMessages(sessionId, n) {
    const session = this._sessions.get(sessionId);
    if (!session) return [];
    return session.messages.slice(-n);
  }

  /**
   * Replace all messages with a new set (after summarization).
   * @param {string} sessionId
   * @param {Array} messages
   */
  setMessages(sessionId, messages) {
    const session = this._sessions.get(sessionId);
    if (session) {
      session.messages = messages;
    }
  }

  /**
   * Get/set the accumulated summary for a session.
   */
  getSummary(sessionId) {
    return this._sessions.get(sessionId)?.summary || '';
  }

  setSummary(sessionId, summary) {
    const session = this._sessions.get(sessionId);
    if (session) {
      session.summary = summary;
    }
  }

  /**
   * Get session metadata.
   */
  getSessionInfo(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return null;
    return {
      id: session.id,
      turnCount: session.turnCount,
      messageCount: session.messages.length,
      hasSummary: !!session.summary,
      projectId: session.projectId,
      createdAt: session.createdAt,
    };
  }

  /**
   * Associate a project with a session.
   */
  setProjectId(sessionId, projectId) {
    const session = this._sessions.get(sessionId);
    if (session) session.projectId = projectId;
  }

  getProjectId(sessionId) {
    return this._sessions.get(sessionId)?.projectId || null;
  }

  /**
   * Reset turn count after summarization.
   */
  resetTurnCount(sessionId) {
    const session = this._sessions.get(sessionId);
    if (session) session.turnCount = 1;
  }

  getTurnCount(sessionId) {
    return this._sessions.get(sessionId)?.turnCount || 0;
  }

  /**
   * Delete a session.
   */
  deleteSession(sessionId) {
    this._sessions.delete(sessionId);
  }
}

const conversationBuffer = new ConversationBuffer();
export default conversationBuffer;
