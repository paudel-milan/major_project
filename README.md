# WebForge AI — Lovable-Style AI Website Builder

An agentic AI system that generates complete React websites from natural language descriptions. Describe your website in chat, and watch it appear in a live sandbox preview — with iterative editing support.

---

## Architecture

```
┌─────────────────┐     REST/WS      ┌────────────────────────────────┐
│                  │ ◄──────────────► │       Node.js Backend          │
│  React Frontend  │                  │                                │
│  (Vite + TS)     │                  │  ┌──────────────────────────┐  │
│                  │                  │  │    Agent Controller       │  │
│  ┌─────┬───────┐ │                  │  │  (orchestrates the loop)  │  │
│  │Chat │Preview│ │                  │  └──────┬───────────────────┘  │
│  │Panel│Sandbox│ │                  │         │                      │
│  │ 40% │  60%  │ │                  │  ┌──────▼───────────────────┐  │
│  └─────┴───────┘ │                  │  │   LLM Provider Registry   │  │
└─────────────────┘                  │  │  Ollama│OpenAI│Gemini│Claude│
                                     │  └──────┬───────────────────┘  │
                                     │         │                      │
                                     │  ┌──────▼──────┐ ┌──────────┐  │
                                     │  │Context Mgmt │ │Build     │  │
                                     │  │(Recursive   │ │Engine    │  │
                                     │  │ Summarize)  │ │(Sandbox) │  │
                                     │  └─────────────┘ └──────────┘  │
                                     └────────────────────────────────┘
```

## Agent Loop

```
User Message → Session → Context Builder → LLM → Code Generator → Build → WebSocket → Preview Reload
```

1. User sends a message via chat
2. Agent controller updates conversation buffer
3. Context builder checks token limits, applies recursive summarization if needed
4. LLM generates structured JSON response with file contents
5. Code generator writes only changed files (incremental)
6. Build engine processes JSX and prepares sandbox
7. WebSocket pushes `reload` event to frontend
8. Sandbox iframe auto-refreshes

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
CONTEXT_STRATEGY=recursive_summarization   # or sliding_window
CONTEXT_MAX_TOKENS=4000
CONTEXT_SUMMARY_THRESHOLD=6
```

---

## Project Structure

```
major_project/
├── backend/
│   ├── server.js              # Express + WebSocket entry point
│   ├── agent/
│   │   ├── controller.js      # Agent loop orchestrator
│   │   └── codeGenerator.js   # LLM response → files
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
│   │   ├── ConversationBuffer.js
│   │   ├── TokenMonitor.js
│   │   └── ContextBuilder.js   # Pipeline orchestrator
│   ├── builder/
│   │   ├── BuildEngine.js      # Processes sandbox projects
│   │   ├── ProjectManager.js   # File CRUD
│   │   └── templateFiles.js    # React project scaffold
│   ├── utils/
│   │   └── logger.js           # Structured logging
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
│   │   │   └── StatusBar.tsx
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
- **Recursive summarization** — compresses conversation history to stay within token limits
- **Pluggable LLM providers** — switch between Ollama, OpenAI, Gemini, Claude
- **Modular context strategies** — swap summarization approaches via config
- **Real-time WebSocket updates** — build status, reload events
- **Live sandbox preview** — iframe-based rendering of generated React apps
- **Structured logging** — token usage, response time, context size, build time

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send message to AI agent |
| `GET`  | `/api/status` | Health check + provider status |
| `GET`  | `/api/providers` | List available LLM providers |
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
| Preview | iframe + CDN React/Babel |

---

Built for the "Optimize context management for agentic AI" research project.
