# Claude Chatbot App

A full-stack, web-based AI chatbot built with React, Vite, Tailwind CSS, Node.js, Express, and the Anthropic Claude API. The client keeps conversation history in memory and sends it to the server for every request, while the server streams Claude's response back token-by-token using server-sent events.

## Project structure

```text
.
├── client/              # React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── main.jsx     # Chat UI, frontend state, and streaming parser
│   │   └── styles.css   # Tailwind entrypoint and dark color scheme
│   └── vite.config.js
├── server/              # Express API server
│   └── index.js         # /api/chat endpoint and Claude streaming logic
├── .env.example         # Environment variable template
└── package.json         # Workspace scripts for running client and server
```

## Prerequisites

- Node.js 20 or newer recommended
- An Anthropic API key

## Setup

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Add your Anthropic API key to `.env`:

   ```bash
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   PORT=3001
   ```

   The API key is read only from environment variables and should never be committed.

4. Start both the frontend and backend:

   ```bash
   npm run dev
   ```

5. Open the app at [http://localhost:5173](http://localhost:5173). The Express server runs at [http://localhost:3001](http://localhost:3001).

## Available scripts

- `npm run dev` - run both the Vite dev server and Express API server with `concurrently`
- `npm run build` - build the React frontend
- `npm run start` - start the Express API server
- `npm run dev --workspace client` - run only the frontend
- `npm run dev --workspace server` - run only the backend

## Configuration

| Variable | Description | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Required Anthropic API key used by the backend | none |
| `ANTHROPIC_MODEL` | Optional Claude model override | `claude-3-5-sonnet-latest` |
| `PORT` | Backend server port | `3001` |
| `CLIENT_ORIGIN` | CORS origin allowed by Express | `http://localhost:5173` |
| `VITE_API_URL` | Optional frontend API URL override | `http://localhost:3001/api/chat` |

## How streaming works

The frontend posts the full in-memory conversation to `POST /api/chat`. The Express server validates the message array, opens an Anthropic streaming request, and forwards each `text_delta` event as an SSE `token` event. The React client reads the response stream, parses SSE frames, and appends each token to the latest assistant message so the response appears live.

## Error handling

The app shows friendly errors for invalid input, missing API keys, failed Anthropic requests, rate limits, and network issues. Empty messages are ignored in the UI and rejected by the backend; long messages are capped at 8,000 characters.
