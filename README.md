# Orderly AI — Intelligent Order Assistant

A screening-task full-stack e-commerce order management system and AI assistant scaffold built for Torcue AI.

---

## 🚀 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS (modern `@tailwindcss/vite` integration)
- **Backend**: Node.js 22, Express (native JavaScript ES modules)
- **Validation**: Zod (strict schema & financial consistency validation)
- **Data Ingestion**: `csv-parse` for parsing and validation of `data/orders.csv`
- **AI SDK**: `@google/genai` (official Google Gen AI JavaScript SDK ready for Gemini 2.5 Flash agent integration)
- **Testing**: Vitest & Supertest
- **Deployment**: Render (`render.yaml` zero-configuration blueprint)

---

## 📊 Dataset Inspection & Integrity Verification

The dataset is ingested directly from `data/orders.csv` without substitution.

| Property | Value / Findings |
|---|---|
| **File Path** | `data/orders.csv` |
| **Total Rows** | 60 data rows (`ORD-1001` through `ORD-1060`) + 1 header row |
| **Headers (11 columns)** | `order_id`, `order_date`, `customer_name`, `city`, `product`, `category`, `quantity`, `unit_price_inr`, `total_inr`, `payment_method`, `status` |
| **Date Format** | Strict ISO `YYYY-MM-DD` (`2026-06-01` to `2026-09-28`). All valid calendar dates. |
| **Status Distribution** | `delivered` (48), `cancelled` (7), `returned` (3), `processing` (1), `shipped` (1) |
| **Payment Methods** | `UPI` (15), `Debit Card` (12), `Credit Card` (12), `Net Banking` (11), `Cash on Delivery` (10) |
| **Numeric Fields** | `quantity`: [1, 5] (positive integers)<br>`unit_price_inr`: [199, 21,999]<br>`total_inr`: [199, 65,997] |
| **Null / Empty Values** | **0** across all fields |
| **Duplicate Order IDs** | **0** duplicate IDs |
| **Financial Agreement** | **100% agreement** — every row satisfies `quantity * unit_price_inr === total_inr` |
| **Catalog Coverage** | 13 unique products across 4 categories (`Electronics`, `Accessories`, `Stationery`, `Furniture`) |
| **Geographic Coverage** | 6 cities (`Bengaluru`, `Chennai`, `Hyderabad`, `Kochi`, `Pune`, `Thiruvananthapuram`) |

---

## 📁 Repository Structure

```
orderly-ai/
├── data/
│   └── orders.csv              # Real dataset (60 orders)
├── server/
│   ├── app.js                  # Express application setup & static serving
│   ├── config.js               # Environment config & Zod validation
│   ├── index.js                # Server entry point with startup dataset validation
│   ├── routes/
│   │   └── api.js              # /api/health, /api/orders, /api/orders/summary
│   ├── schemas/
│   │   └── orderSchema.js      # Zod validation schemas
│   └── services/
│       └── dataService.js      # CSV ingestion, data validation & cache
├── src/
│   ├── App.tsx                 # Responsive Orderly AI dashboard UI
│   ├── index.css               # Tailwind CSS v4 entry
│   ├── main.tsx                # React 19 entry point
│   └── vite-env.d.ts           # Vite client type definitions
├── tests/
│   └── server/
│       ├── dataService.test.js # CSV loading & validation tests
│       ├── health.test.js      # Supertest health check tests
│       └── productionServe.test.js # Express static dist serving tests
├── .env.example                # Template for environment variables
├── .gitignore                  # Git ignore rules
├── index.html                  # HTML entry point
├── package.json                # Single root package configuration
├── render.yaml                 # Render cloud deployment blueprint
├── tsconfig.json               # TypeScript configuration
└── vite.config.ts              # Vite configuration with proxy and Tailwind
```

---

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js >= 20.x (tested on v22.13.1)
- npm >= 10.x

### 2. Installation
```bash
npm install
```

### 3. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key variables:
- `PORT`: Express server port (default: `3001`)
- `NODE_ENV`: `development` or `production`
- `DATA_FILE_PATH`: Path to CSV (default: `data/orders.csv`)
- `GEMINI_API_KEY`: API key for Gemini 2.5 Flash (for autonomous agent tasks)

---

## 💻 Available Commands

| Command | Description |
|---|---|
| `npm run dev:client` | Starts Vite React dev server with proxy at `http://localhost:5173` |
| `npm run dev:server` | Starts Express API server with file watch at `http://localhost:3001` |
| `npm run build` | Builds production client into `dist/` |
| `npm run start` | Starts Express production server (serves static UI & API from same origin) |
| `npm test` | Runs all Vitest and Supertest unit and integration tests |

---

## 🩺 Health Check & API Endpoints

- **`GET /api/health`**: Returns system status, uptime, dataset loading confirmation, and AI configuration.
- **`GET /api/orders/summary`**: Returns aggregated financial and distribution metrics.
- **`GET /api/orders`**: Returns orders with optional query filtering (`status`, `city`, `category`, `limit`).

---

## 🚀 Deployment (Render)

This repository includes a `render.yaml` blueprint. On Render:
1. Connect repository: `https://github.com/Febinabey/TORCUE_TASK.git`
2. Render uses `buildCommand`: `npm install && npm run build`
3. Render uses `startCommand`: `npm start`
4. Set `GEMINI_API_KEY` under Environment Variables in the Render dashboard.
