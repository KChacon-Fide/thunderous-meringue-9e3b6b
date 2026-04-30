# KODEX IA

An enterprise-grade AI chat assistant built for Kodex Tech Solutions. Features a sleek dark-themed interface with streaming responses powered by the Mistral API, deployed on Netlify.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start (React 19 + TanStack Router v1) |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 + custom CSS design system |
| AI Backend | Mistral API (`mistral-small-latest`) |
| Deployment | Netlify (serverless functions via TanStack Start API routes) |
| Language | TypeScript 5.7 (strict mode) |

## Running Locally

### Prerequisites

- Node.js 22+
- A [Mistral API key](https://console.mistral.ai/)

### Setup

```bash
npm install
```

Create a `.env` file in the project root:

```
MISTRAL_API_KEY=your_mistral_api_key_here
```

### Development

```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000). When deployed to Netlify, use the Netlify CLI for local emulation:

```bash
netlify dev
```

This starts the dev server on port 8888 with full Netlify feature emulation.

### Production Build

```bash
npm run build
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MISTRAL_API_KEY` | Yes | Mistral API key for AI responses |

## Deployment

The app is configured for Netlify deployment via `netlify.toml`. Push to your connected repository branch to trigger an automatic deploy. Ensure `MISTRAL_API_KEY` is set in your Netlify site environment variables.
