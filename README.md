# WebForge AI — Lovable-Style AI Website Builder

An agentic AI system that generates complete React websites from natural language descriptions. Describe your website in chat, and watch it appear in a live sandbox preview — with iterative editing support.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              React Frontend (Vite + TS)                      │
│  ┌────────────┬──────────────────────────────┬─────────────────────────────┐ │
│  │  ChatPanel │  SandboxPreview (iframe)     │  Token Dashboard (modal)     │ │
│  │  + Voice   │  live reload on WS event     │  context/token observability │ │
│  └─────┬──────┴──────────────┬───────────────┴──────────────┬──────────────┘ │
│        │ REST / WebSocket    │                              │                │
└────────┼────────────────────┼──────────────────────────────┼────────────────┘
         │                    │                              │
┌────────▼────────────────────▼──────────────────────────────▼────────────────┐
│                            Node.js Backend (Express + ws)                   │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       Agent Controller (orchestrator)                │  │
│  │   session → context → LLM → codegen → validate/repair → build → WS   │  │
│  └──────┬───────────────┬──────────────────────┬───────────────────────┘  │
│         │               │                      │                           │
│  ┌──────▼──────┐ ┌──────▼──────────┐  ┌───────▼────────┐  ┌────────────┐ │
│  │ LLM Registry│ │ Context Builder  │  │ Code Validator │  │ Build      │ │
│  │ Ollama      │ │ recursive /      │  │ self-healing   │  │ Engine     │ │
│  │ OpenAI      │ │ sliding /        │  │ (≤3 repairs)   │  │ (sandbox)  │ │
│  │ Gemini      │ │ selective        │  └────────────────┘  └────────────┘ │
│  │ Claude      │ └──────┬──────────┘                                     │
│  └─────────────┘        │                                                │
│                  ┌──────▼──────────┐  ┌─────────────────┐                  │
│                  │ Conversation    │  │ Token Monitor   │                  │
│                  │ Buffer +        │  │ (estimation)    │                  │
│                  │ Summarization   │  └─────────────────┘                  │
│                  └─────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Agent Loop

```
User Message → Session → Context Builder → LLM → Code Generator → Validate/Repair → Build → WebSocket → Preview Reload
```

1. User sends a message via chat (optionally by voice)
2. Agent controller updates conversation buffer
3. Context builder checks token limits, applies the configured strategy if needed
4. LLM generates structured JSON response with file contents
5. Code generator writes only changed files (incremental)
6. Code validator validates output; self-healing loop repairs up to 3 attempts
7. Build engine processes JSX and prepares sandbox
8. WebSocket pushes `reload` event to frontend
9. Sandbox iframe auto-refreshes

---

## Quick Start

### Prerequisites

- **Node.js 18+**
- **Ollama** installed and running (default LLM provider)
  - Install from https://ollama.com
  - Pull a model: `ollama pull qwen2.5-coder:7b`
  - Start: `ollama serve`

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # Edit if needed
npm run dev
```

Backend runs on **http://localhost:3001**

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:5173**

### 3. Use It

1. Open http://localhost:5173
2. Type: *"Create a modern portfolio website with dark theme"*
3. Watch the AI generate the code
4. See it rendered live in the right panel
5. Iterate: *"Add a contact form with validation"*
6. Open the Token Dashboard for context/token observability

---

## Configuration

Edit `backend/.env` to switch providers:

```env
# Primary provider
LLM_PROVIDER=ollama          # ollama | openai | gemini | claude

# Ollama (default — free, local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:7b

# OpenAI (optional)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Google Gemini (optional)
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash

# Anthropic Claude (optional)
CLAUDE_API_KEY=...
CLAUDE_MODEL=claude-sonnet-4-20250514

# Context management
CONTEXT_STRATEGY=selective_summarization   # recursive_summarization | sliding_window | selective_summarization
CONTEXT_MAX_TOKENS=1000
CONTEXT_SUMMARY_THRESHOLD=6
```

---

## Project Structure

```
major_project/
├── backend/
│   ├── server.js              # Express + WebSocket entry point
│   ├── agent/
│   │   ├── controller.js      # Agent loop orchestrator (incl. self-healing)
│   │   ├── codeGenerator.js   # LLM response → files
│   │   └── codeValidator.js   # Validation + repair prompts
│   ├── llm/
│   │   ├── BaseLLMProvider.js  # Provider interface
│   │   ├── OllamaProvider.js   # PRIMARY
│   │   ├── OpenAIProvider.js
│   │   ├── GeminiProvider.js
│   │   ├── ClaudeProvider.js
│   │   └── registry.js        # Selection + fallback
│   ├── context/
│   │   ├── ContextStrategy.js  # Strategy interface
│   │   ├── RecursiveSummarization.js
│   │   ├── SlidingWindow.js
│   │   ├── SelectiveSummarization.js  # Custom high-density blueprint
│   │   ├── ConversationBuffer.js
│   │   ├── TokenMonitor.js
│   │   └── ContextBuilder.js   # Pipeline orchestrator
│   ├── builder/
│   │   ├── BuildEngine.js      # Processes sandbox projects
│   │   ├── ProjectManager.js   # File CRUD
│   │   └── templateFiles.js    # React project scaffold
│   ├── utils/
│   │   ├── logger.js           # Structured logging + metrics
│   │   └── tokenizer.js        # Real tiktoken (cl100k_base) token counting
│   └── sandbox/                # Generated apps (gitignored)
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── SandboxPreview.tsx
│   │   │   ├── SplitLayout.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   ├── ContextPanel.tsx
│   │   │   ├── TokenDashboard.tsx
│   │   │   ├── AgentProgress.tsx
│   │   │   ├── ConfigIndicator.tsx
│   │   │   └── VoiceInput.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   └── useChat.ts
│   │   └── types/
│   │       └── index.ts
│   └── index.html
│
└── README.md
```

---

## Key Features

- **Iterative editing** — only changed files are regenerated
- **Context management strategies** — recursive summarization, sliding window, selective semantic (custom, recommended)
- **Selective semantic summarization** — extracts high-density architectural blueprints with ~4.5–7.0x compression
- **Self-healing code generation** — validates output and auto-repairs up to 3 attempts
- **Token dashboard** — real-time context window, token distribution, strategy benchmark, provider status
- **Pluggable LLM providers** — switch between Ollama, OpenAI, Gemini, Claude with runtime fallback
- **Voice input** — speech-to-text in chat
- **Real-time WebSocket updates** — build status, reload, agent progress, context compression events
- **Live sandbox preview** — iframe-based rendering of generated React apps
- **Real token counting** — tiktoken `cl100k_base` for context estimates; Ollama `prompt_eval_count`/`eval_count` and OpenAI `usage` for actual prompt/completion tokens
- **Structured logging** — token usage, response time, context size, build time

---

## Major Design Decisions

1. **Ollama as default provider** — free, local, no API keys; OpenAI/Gemini/Claude optional via env.
2. **Strategy pattern for context** — `ContextStrategy` interface with swappable implementations; default `selective_summarization`.
3. **Heuristic token estimation** — word-based `words * 1.3` for fast, dependency-free monitoring.
4. **Self-healing loop** — `codeValidator` feeds issues back to LLM; caps at 3 repair attempts to bound cost.
5. **Incremental file writes** — generator emits only changed files; project manager merges into existing project.
6. **WebSocket broadcast** — single channel for build, reload, progress, and compression events.
7. **Observability-first frontend** — Token Dashboard surfaces context hit, compression savings, and provider health.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send message to AI agent |
| `GET`  | `/api/status` | Health check + provider status + metrics |
| `GET`  | `/api/providers` | List available LLM providers |
| `GET`  | `/api/config` | Current provider, strategy, available options |
| `POST` | `/api/provider` | Switch active LLM provider at runtime |
| `POST` | `/api/strategy` | Switch context strategy at runtime |
| `GET`  | `/api/project/:id/files` | Get generated project files |
| `GET`  | `/api/project/:id/status` | Get build status |
| `GET`  | `/api/session/:id` | Get session info |
| `GET`  | `/api/metrics` | Get logging metrics |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, ES Modules |
| Realtime | WebSocket (ws) |
| LLM | Ollama (default), OpenAI, Gemini, Claude |
| Tokenizer | tiktoken `cl100k_base` (@dqbd/tiktoken) with heuristic fallback |
| Preview | iframe + CDN React/Babel |

---

Built for the "Optimize context management for agentic AI" research project.
