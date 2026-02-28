# SEC Research Assistant

**Live Demo:** [https://sec-research-assistant-eorhmybiu-yoginoit39s-projects.vercel.app](https://sec-research-assistant-eorhmybiu-yoginoit39s-projects.vercel.app)

An AI-powered research assistant that lets you ask natural language questions about any public company's SEC filings (10-K annual reports). Built with RAG (Retrieval-Augmented Generation) — the same architecture used by Morgan Stanley's internal AI assistant.

## What it does

1. Search any public company by ticker symbol (AAPL, MSFT, JPM, etc.)
2. Load their latest 10-K annual report directly from SEC EDGAR (free, no API key)
3. Ask questions in plain English and get AI-powered answers with citations

**Example questions:**
- "What are the main risk factors?"
- "How did revenue change year over year?"
- "What markets does the company operate in?"
- "Describe their debt and liquidity position."
- "What is their AI or technology strategy?"

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | Groq (LLaMA 3.3 70B) — free API |
| Embeddings | HuggingFace sentence-transformers — runs locally, no cost |
| Vector DB | ChromaDB — local persistent storage |
| RAG Framework | LangChain |
| Backend | FastAPI |
| Frontend | React + Vite |
| Data Source | SEC EDGAR API — free, no key required |

## Setup

### 1. Get a free Groq API key
Sign up at [console.groq.com](https://console.groq.com) — completely free.

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Add your GROQ_API_KEY to .env

uvicorn main:app --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Architecture

```
User Query
    │
    ▼
React Frontend  ──────────────►  FastAPI Backend
                                      │
                        ┌─────────────┼─────────────┐
                        ▼             ▼             ▼
                   SEC EDGAR     ChromaDB      Groq LLM
                   (fetch        (vector       (LLaMA 3.3
                   filings)      search)       70B)
                        │             │             │
                        └─────────────┴─────────────┘
                                      │
                                  Answer +
                                  Citations
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/company/{ticker}` | Look up company info |
| POST | `/load` | Fetch and index a filing |
| POST | `/ask` | Ask a question |
| GET | `/status/{ticker}` | Check if filing is loaded |
