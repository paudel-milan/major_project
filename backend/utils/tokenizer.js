/**
 * Tokenizer — real subword token counting using tiktoken (cl100k_base).
 * Falls back to a word heuristic if the encoder cannot be loaded.
 */

import tiktoken from '@dqbd/tiktoken';
const { getEncoding, encodingForModel } = tiktoken;

let _encoder = null;
let _loadError = null;

function _ensureEncoder() {
  if (_encoder) return _encoder;
  if (_loadError) return null;
  try {
    _encoder = getEncoding('cl100k_base');
  } catch (err) {
    _loadError = err;
    return null;
  }
  return _encoder;
}

/**
 * Count tokens for a string using cl100k_base (OpenAI-compatible).
 * Falls back to ~1.3 tokens/word if tiktoken is unavailable.
 * @param {string} text
 * @returns {number}
 */
export function countTokens(text) {
  if (!text) return 0;
  const enc = _ensureEncoder();
  if (enc) {
    try {
      return enc.encode(text).length;
    } catch {
      // fall through to heuristic
    }
  }
  return Math.ceil(text.split(/\s+/).filter(w => w.length > 0).length * 1.3);
}

/**
 * Count tokens for a message array (role + content).
 * @param {Array<{role: string, content: string}>} messages
 * @returns {number}
 */
export function countMessagesTokens(messages) {
  if (!Array.isArray(messages)) return 0;
  let total = 0;
  for (const msg of messages) {
    total += countTokens(msg.content || '');
    total += 4; // per-message formatting overhead
  }
  return total;
}

/**
 * Approximate tokens for a model-specific encoding when available.
 * @param {string} text
 * @param {string} [model]
 * @returns {number}
 */
export function countTokensForModel(text, model) {
  if (!text) return 0;
  try {
    const enc = encodingForModel(model || 'gpt-4o-mini');
    return enc.encode(text).length;
  } catch {
    return countTokens(text);
  }
}
