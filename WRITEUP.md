# Orderly AI — Implementation Write-up

### 1. Architecture

Orderly AI is an end-to-end e-commerce order assistant deployed as a unified single-origin service:
- **Backend:** Node.js + Express (ES Modules) serving REST endpoints (`POST /api/chat`, `GET /api/health`, `GET /api/orders/summary`, `GET /api/orders`).
- **Data Engine:** Loads and parses the supplied 60-row `data/orders.csv` on server startup via `csv-parse`. Validated with a strict Zod order schema to ensure data integrity, field types, and price calculations (`total_inr = quantity * unit_price_inr`) before accepting requests.
- **AI Agent Integration:** Powered by Google Gemini via the official `@google/genai` JavaScript SDK using the **Interactions API** and multi-turn tool calling.
- **Frontend Dashboard:** React 19, TypeScript, Vite, and Tailwind CSS v4. Designed as an operations workspace featuring real-time chat, tool execution badges, live KPI metrics with skeleton loaders, and an interactive catalog explorer with client-side search and filtering.
- **Production Serving:** In production, Express statically serves the optimized Vite `dist/` bundle while routing `/api/*` requests on the same origin, avoiding CORS complexity.

---

### 2. How the Agent Decides When to Use Tools

The agent provides Gemini with three strongly typed function declarations:
1. `lookup_order`: Called when the query specifies an order ID (e.g. `ORD-1025`) to retrieve customer, product, date, amount, and shipping status.
2. `search_orders`: Called for multi-attribute filtering (by city, customer, product category, status, payment method, or date range).
3. `calculate_order_metrics`: Called when the user asks for aggregations, such as counting orders by status, calculating gross or category revenue, or identifying the top spending customer.

**Tool Execution Loop:**
- Gemini evaluates the prompt and returns a structured `function_call` step when real data is needed.
- The Node.js backend intercepts the function call, verifies allowlisted tools, and executes the query against the validated in-memory CSV dataset.
- The function result is sent back to Gemini via `previous_interaction_id` (`function_result`), prompting the model to synthesize a grounded, natural-language markdown response.
- If a query is out-of-scope (e.g. general trivia), the model detects no tool is relevant and triggers a polite refusal guardrail without calling tools or hallucinating.

---

### 3. Guardrails Implemented

- **Grounding in Deterministic Data:** The system prompt explicitly forbids hallucinating order IDs, customer names, or dates. Arithmetic is strictly delegated to `calculate_order_metrics` rather than LLM mental math.
- **Graceful Tool Handling:** Non-existent order IDs (e.g. `ORD-9999`) or empty search filters return structured empty responses (`found: false`), prompting the agent to state clearly that no records matched.
- **Domain Business Rules:** 
  - All financial metrics are rendered in Indian Rupees (₹).
  - Revenue aggregations and top-customer spend calculations exclude cancelled orders by default.
  - Returned orders remain included in calculations unless explicitly filtered out.
- **Request & Iteration Limits:** 
  - Chat inputs are validated with Zod (1 to 2,000 characters, trimmed).
  - The multi-turn tool calling loop is capped at a maximum of 4 rounds to prevent infinite loops.
- **Security & Privacy:** 
  - API keys (`GEMINI_API_KEY`) are handled purely on the backend via environment variables and never exposed to the frontend.
  - Upstream errors are sanitized to prevent internal stack trace leakage.

---

### 4. Deployment & Environment Configuration

- **Hosting Platform:** Deployed on **Render** as a Web Service using a blueprint configuration (`render.yaml`).
- **Unified Build:** The build command executes `npm ci --include=dev && npm run build && npm prune --omit=dev`, producing the production Vite assets and running Node in production mode.
- **Secrets:** `GEMINI_API_KEY` is configured as a protected environment variable in Render's dashboard.
- **Keep-Alive:** Because Render's free tier spins down after 15 minutes of inactivity, the React frontend includes a background 4-minute keep-alive ping to `/api/health` to keep the container warm during active browser sessions.
- **Live URL:** [https://orderly-ai.onrender.com](https://orderly-ai.onrender.com)
- **Repository:** [https://github.com/Febinabey/TORCUE_TASK](https://github.com/Febinabey/TORCUE_TASK)

---

### 5. Future Improvements (With More Time)

1. **Server-Sent Events (SSE) Streaming:** Stream tool execution tokens and response text incrementally to eliminate perceived latency during multi-turn LLM hops.
2. **Deterministic In-Memory Caching:** Add a lightweight LRU cache for frequent statistical queries (e.g. total cancellation counts) to respond in under 10ms without calling Gemini.
3. **Multi-Store & CSV Upload:** Enable store managers to upload custom CSV/Excel order exports dynamically.
4. **Export Actions:** Provide one-click CSV and PDF export buttons for assistant-generated order tables and audit summaries.
5. **CI/CD Pipeline:** Add GitHub Actions workflow for automatic linting, type-checking, and test verification on pull requests.

---

### 6. AI Tools Used During Development

- **Google Antigravity:** Used as the primary agentic pair programmer for inspecting the CSV dataset, developing the backend services and tools, crafting the React 19 UI, and running the automated Vitest test suite.
- **Google Gemini API:** Utilized via `@google/genai` (Interactions API) at runtime for natural language understanding and function calling.