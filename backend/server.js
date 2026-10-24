/**
 * Server — Express + WebSocket entry point.
 * REST API for chat, status, and file management.
 * WebSocket for real-time build/reload events.
 * Static file serving for sandbox previews.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

import agentController from './agent/controller.js';
import registry from './llm/registry.js';
import projectManager from './builder/ProjectManager.js';
import buildEngine from './builder/BuildEngine.js';
import conversationBuffer from './context/ConversationBuffer.js';
import contextBuilder from './context/ContextBuilder.js';
import logger from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Express App ───
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Serve sandbox projects statically ───
// Set correct MIME types for JSX/JS files before static middleware
app.use('/sandbox', (req, res, next) => {
  if (req.path.endsWith('.jsx')) {
    res.setHeader('Content-Type', 'text/babel');
  } else if (req.path.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript');
  } else if (req.path.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css');
  }
  next();
});

app.use('/sandbox', express.static(path.join(__dirname, 'sandbox')));

// ─── REST API Routes ───

/**
 * POST /api/chat — Main endpoint. Sends a message to the AI agent.
 * Body: { message: string, sessionId?: string, provider?: string }
 */
app.post('/api/chat', async (req, res) => {
  const { message, sessionId, provider } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const result = await agentController.handleMessage(
      message.trim(), sessionId, provider
    );
    res.json(result);
  } catch (error) {
    logger.error('API', `/api/chat error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/status — Health check + provider status.
 */
app.get('/api/status', async (req, res) => {
  try {
    const providers = await registry.getStatus();
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      providers,
      contextStrategy: contextBuilder.getStrategyName(),
      metrics: logger.getMetrics(),
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

/**
 * GET /api/providers — List available providers.
 */
app.get('/api/providers', (req, res) => {
  res.json({ providers: registry.getAvailableProviders() });
});

/**
 * GET /api/project/:id/files — Get files for a project.
 */
app.get('/api/project/:id/files', (req, res) => {
  const { id } = req.params;
  if (!projectManager.hasProject(id)) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json({
    projectId: id,
    files: projectManager.getProjectFiles(id),
  });
});

/**
 * GET /api/project/:id/status — Get build status.
 */
app.get('/api/project/:id/status', (req, res) => {
  res.json(buildEngine.getStatus(req.params.id));
});

/**
 * GET /api/session/:id — Get session info.
 */
app.get('/api/session/:id', (req, res) => {
  const info = conversationBuffer.getSessionInfo(req.params.id);
  if (!info) return res.status(404).json({ error: 'Session not found' });
  res.json(info);
});

/**
 * GET /api/metrics — Get logging metrics.
 */
app.get('/api/metrics', (req, res) => {
  res.json(logger.getMetrics());
});

/**
 * GET /api/config — Get current LLM provider, model, and context strategy.
 */
app.get('/api/config', async (req, res) => {
  try {
    const providers = await registry.getStatus();
    const currentDefault = registry.getDefaultProviderName();
    const activeProvider = providers.find(p => p.name === currentDefault)
      || providers.find(p => p.isDefault && p.healthy)
      || providers.find(p => p.healthy)
      || providers[0];
    res.json({
      provider: activeProvider?.name || 'none',
      displayName: activeProvider?.displayName || 'No Provider',
      availableProviders: providers,
      strategy: contextBuilder.getStrategyName(),
      availableStrategies: contextBuilder.getAvailableStrategies(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/provider — Switch active LLM provider at runtime.
 * Body: { provider: 'ollama' | 'openai' | 'gemini' | 'claude' }
 */
app.post('/api/provider', (req, res) => {
  const { provider } = req.body;
  if (!provider) {
    return res.status(400).json({ error: 'Provider name is required' });
  }
  try {
    const selected = registry.setDefaultProvider(provider);
    res.json({
      success: true,
      provider: selected.name,
      displayName: selected.displayName,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/strategy — Switch context management strategy at runtime.
 * Body: { strategy: 'recursive_summarization' | 'sliding_window' | 'selective_summarization' }
 */
app.post('/api/strategy', (req, res) => {
  const { strategy } = req.body;
  if (!strategy) {
    return res.status(400).json({ error: 'Strategy name is required' });
  }
  const validStrategies = contextBuilder.getAvailableStrategies();
  if (!validStrategies.includes(strategy)) {
    return res.status(400).json({ error: `Invalid strategy. Valid: ${validStrategies.join(', ')}` });
  }
  contextBuilder.setStrategy(strategy);
  res.json({ success: true, strategy: contextBuilder.getStrategyName() });
});

// ─── HTTP + WebSocket Server ───
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  logger.info('WebSocket', 'Client connected');
  agentController.addClient(ws);

  ws.on('close', () => {
    logger.info('WebSocket', 'Client disconnected');
    agentController.removeClient(ws);
  });

  ws.on('error', (err) => {
    logger.error('WebSocket', `Error: ${err.message}`);
    agentController.removeClient(ws);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    event: 'connected',
    data: { message: 'Connected to AI Website Builder' },
    timestamp: Date.now(),
  }));
});

// ─── Start Server ───
server.listen(PORT, () => {
  logger.info('Server', `Backend running on http://localhost:${PORT}`);
  logger.info('Server', `Sandbox served at http://localhost:${PORT}/sandbox/`);
  logger.info('Server', `WebSocket on ws://localhost:${PORT}`);
});
