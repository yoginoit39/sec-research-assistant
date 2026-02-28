import os
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import RateLimitError

from sec_fetcher import get_cik_from_ticker, get_latest_filing_url, download_and_parse_filing, get_company_info
from rag_engine import index_document, ask_question, collection_exists

# Tracks when the rate limit resets (unix timestamp)
_rate_limit_reset_at: float = 0

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

app = FastAPI(title="SEC Research Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request / Response models ────────────────────────────────────────────────

class LoadFilingRequest(BaseModel):
    ticker: str
    form_type: str = "10-K"

class QuestionRequest(BaseModel):
    ticker: str
    question: str

# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "SEC Research Assistant API"}

@app.get("/company/{ticker}")
def get_company(ticker: str):
    cik = get_cik_from_ticker(ticker)
    if not cik:
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found.")
    info = get_company_info(cik)
    return {
        "ticker": ticker.upper(),
        "company_name": info.get("name"),
        "cik": cik,
        "sic_description": info.get("sicDescription"),
        "state": info.get("stateOfIncorporation"),
    }

@app.post("/load")
def load_filing(req: LoadFilingRequest):
    ticker = req.ticker.upper()
    collection_name = f"{ticker}_{req.form_type}".replace("-", "_")

    if collection_exists(collection_name):
        return {"message": f"{req.form_type} for {ticker} already indexed.", "already_loaded": True}

    cik = get_cik_from_ticker(ticker)
    if not cik:
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found.")

    filing = get_latest_filing_url(cik, req.form_type)
    if not filing:
        raise HTTPException(status_code=404, detail=f"No {req.form_type} found for {ticker}.")

    text = download_and_parse_filing(filing["url"])
    if not text.strip():
        raise HTTPException(status_code=500, detail="Failed to extract text from filing.")

    index_document(text, collection_name)

    return {
        "message": f"Successfully indexed {req.form_type} for {ticker}.",
        "company": filing["company"],
        "filing_date": filing["date"],
        "filing_url": filing["url"],
        "already_loaded": False,
    }

@app.get("/rate-limit-status")
def rate_limit_status():
    global _rate_limit_reset_at
    now = time.time()
    if _rate_limit_reset_at > now:
        return {"rate_limited": True, "retry_after": int(_rate_limit_reset_at - now)}
    return {"rate_limited": False, "retry_after": 0}

@app.post("/ask")
def ask(req: QuestionRequest):
    global _rate_limit_reset_at

    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set.")

    # Check if still in cooldown
    now = time.time()
    if _rate_limit_reset_at > now:
        retry_after = int(_rate_limit_reset_at - now)
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit active. Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    ticker = req.ticker.upper()
    collection_name = f"{ticker}_10-K".replace("-", "_")

    if not collection_exists(collection_name):
        raise HTTPException(
            status_code=400,
            detail=f"No filing loaded for {ticker}. Call /load first.",
        )

    try:
        result = ask_question(req.question, collection_name, GROQ_API_KEY)
        return result
    except RateLimitError as e:
        # Groq free tier resets every minute
        retry_after = 60
        # Try to extract actual retry-after from the error if available
        try:
            msg = str(e)
            if "try again in" in msg.lower():
                import re
                match = re.search(r"try again in ([\d.]+)s", msg, re.IGNORECASE)
                if match:
                    retry_after = int(float(match.group(1))) + 2
        except Exception:
            pass

        _rate_limit_reset_at = time.time() + retry_after
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit reached. Cooling down for {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

@app.get("/status/{ticker}")
def status(ticker: str):
    ticker = ticker.upper()
    collection_name = f"{ticker}_10-K".replace("-", "_")
    loaded = collection_exists(collection_name)
    return {"ticker": ticker, "loaded": loaded}
