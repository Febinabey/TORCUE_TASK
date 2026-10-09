# Orderly AI — Intelligent Order Assistant

Orderly AI is a full-stack web chat application that answers questions about a supplied e-commerce orders dataset using a Gemini AI agent and real backend function calling.

**Live demo:** [https://orderly-ai.onrender.com](https://orderly-ai.onrender.com)

## Features

- Natural-language order questions through a React chat UI.
- Real Gemini function calling using the official `@google/genai` SDK and Interactions API.
- Three deterministic tools: `lookup_order`, `search_orders`, and `calculate_order_metrics`.
- CSV validation, bounded tool results, validated tool arguments, limited agent tool rounds, and sanitized API errors.
- Loading, tool-activity, retry/error and chat-reset states in the frontend.
- Responsive interface and health endpoint.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, lucide-react
- **Backend:** Node.js, Express
- **AI:** Gemini API via `@google/genai`
- **Validation/data:** Zod, csv-parse
- **Tests:** Vitest, Supertest, React Testing Library
- **Hosting configuration:** Render Blueprint (`render.yaml`)

## Dataset

The supplied `data/orders.csv` contains 60 orders from June to September 2026. The server parses and validates the real file at startup; it does not substitute synthetic order data. Startup fails with a clear error if the file is missing or invalid.

The current dataset inspection reported 60 rows, 11 columns, no empty fields or duplicate order IDs, valid ISO dates, and agreement between `total_inr` and `quantity * unit_price_inr`.

## Run locally

### Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### Install and configure

```bash
npm install
```

Copy `.env.example` to `.env`, then set your own key:

```dotenv
PORT=3001
NODE_ENV=development
DATA_FILE_PATH=data/orders.csv
GEMINI_API_KEY=your_actual_key
GEMINI_MODEL=gemini-2.5-flash
```

Never commit `.env` or put the key in frontend code. In production, configure secrets through the hosting provider's environment-variable settings.

### Start development servers

Open two terminals from the repository root.

Terminal 1 — backend:

```bash
npm run dev:server
```

Terminal 2 — frontend:

```bash
npm run dev:client
```

Open [http://localhost:5173](http://localhost:5173). The Vite development server proxies `/api` requests to the Express server on port 3001.

### Test and build

```bash
npm test
npm run build
```

The tests mock Gemini where needed, so the test suite does not require a live API call or consume model quota. A real chat request requires a valid API key and available model quota.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service, dataset and AI configuration health |
| `GET` | `/api/orders` | List orders with supported filters |
| `GET` | `/api/orders/summary` | Dataset summary metrics |
| `POST` | `/api/chat` | Send a chat message to the AI agent |

Example chat request:

```json
{
  "message": "What is the status of order ORD-1025?"
}
```

The chat endpoint returns an assistant `reply` and sanitized `toolEvents` metadata.

## Tool calling and business rules

Gemini chooses which declared tool to call. The backend validates tool arguments and executes allowlisted JavaScript functions against the parsed CSV. The actual order details and monetary calculations come from tool results, not from model memory.

- `lookup_order`: exact order ID lookup.
- `search_orders`: bounded search using optional order/customer/product/category/city/status/date filters.
- `calculate_order_metrics`: order counts, counts by status, revenue totals, and top-customer spending.

Order counts include all statuses unless filtered. Revenue and customer-spending metrics exclude cancelled orders by default; returned orders remain included unless excluded by a status filter. Monetary aggregations use `total_inr`.

## Deploy to Render

This repository includes `render.yaml` for a single Node web service that serves the built Vite frontend and Express API from the same origin.

1. In Render, create a **Blueprint** from this public repository: [Febinabey/TORCUE_TASK](https://github.com/Febinabey/TORCUE_TASK).
2. Review the service settings from `render.yaml`.
3. Set `GEMINI_API_KEY` in Render's environment settings; keep it secret.
4. Deploy and inspect the build/start logs.
5. Verify `https://YOUR-SERVICE.onrender.com/api/health` and send a real question in the deployed chat UI.
6. Replace the live-demo note at the top of this README with the actual public URL only after verification.

Render free services may spin down after inactivity, and a first request can take longer while the service wakes. Keep the app available through the review period.

## Implementation write-up

See [WRITEUP.md](./WRITEUP.md) for the architecture, tool-call flow, guardrails, deployment plan, possible improvements, and AI tools used.
