# AGENTS.md

This document provides an overview of the KODEX IA project for developers and AI agents working on this codebase.

## Project Overview

KODEX IA is a production-ready AI chat assistant for Kodex Tech Solutions. It features a dark corporate UI with streaming AI responses via the Mistral API, built with TanStack Start and deployed on Netlify.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start |
| Frontend | React 19, TanStack Router v1 |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 + custom CSS design system |
| AI | Mistral API (direct fetch, SSE streaming) |
| Language | TypeScript 5.7 (strict mode) |
| Deployment | Netlify |

## Directory Structure

```
├── public/
│   └── favicon.ico
├── src/
│   ├── lib/
│   │   └── ai-hook.ts          # useKodexChat: custom SSE hook for Mistral streaming
│   ├── routes/
│   │   ├── __root.tsx          # Root layout: HTML shell, page title, global styles
│   │   ├── api.chat.ts         # POST /api/chat: proxies to Mistral API with SSE streaming
│   │   └── index.tsx           # Home route: full KODEX IA chat UI
│   ├── router.tsx              # TanStack Router setup
│   └── styles.css              # Tailwind + KODEX IA design system (CSS custom classes)
├── netlify.toml                # Netlify build config
├── package.json
├── tsconfig.json               # TypeScript config: ES2022, strict, @/* alias for src/*
└── vite.config.ts              # Vite: TanStack Start, Netlify plugin, Tailwind
```

## Key Concepts

### File-Based Routing (TanStack Router)

Routes are defined by files in `src/routes/`:

- `__root.tsx` — Root layout wrapping all pages
- `index.tsx` — Route for `/` (the chat UI)
- `api.chat.ts` — Server API endpoint at `/api/chat`

### AI Integration: Direct Mistral API

The project calls the Mistral API directly via `fetch` — not through TanStack AI adapters (no Mistral adapter exists in TanStack AI). The backend (`api.chat.ts`) forwards the Mistral SSE stream directly to the client. The frontend (`ai-hook.ts`) parses the OpenAI-compatible SSE chunks.

Key settings in `api.chat.ts`:
- Model: `mistral-small-latest`
- Temperature: `0.5`
- Max tokens: `800`
- System prompt: `SYSTEM_PROMPT` constant in the same file

### Custom Chat Hook

`src/lib/ai-hook.ts` exports `useKodexChat`:
- Maintains full conversation history in local React state
- POSTs the complete history to `/api/chat` each turn
- Reads streamed SSE deltas and appends to the last assistant message
- Exposes `{ messages, sendMessage, isLoading, stop }`

### Design System

Built without a component library. All styling uses Tailwind utilities plus named CSS classes in `styles.css`:
- Primary background: `#080f20`
- Accent / brand color: `#00C9C8` (cyan)
- Logo: CSS gradient text (`background-clip: text`)
- Typing indicator: `@keyframes typing-pulse` (subtle, fast)

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `MISTRAL_API_KEY` | Yes | Authenticates requests to `api.mistral.ai` |

## Conventions

### Naming
- Components: PascalCase
- Hooks/utilities: camelCase
- CSS utility classes: kebab-case in `styles.css`

### TypeScript
- Strict mode enabled
- `@/*` alias maps to `src/*`
- Type-only imports use the `type` keyword

### State Management
- Local React state only — no global store needed

## Development Commands

```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Production build
netlify dev      # Local dev with Netlify emulation (port 8888, recommended)
```
