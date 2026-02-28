import httpx
import re
from typing import Optional, List
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "SEC Research Assistant contact@example.com"}

def get_cik_from_ticker(ticker: str) -> Optional[str]:
    url = "https://www.sec.gov/files/company_tickers.json"
    response = httpx.get(url, headers=HEADERS)
    data = response.json()
    for entry in data.values():
        if entry["ticker"].upper() == ticker.upper():
            return str(entry["cik_str"]).zfill(10)
    return None

def search_company_by_name(name: str) -> List[dict]:
    url = f"https://efts.sec.gov/LATEST/search-index?q=%22{name}%22&forms=10-K"
    response = httpx.get(url, headers=HEADERS)
    data = response.json()
    hits = data.get("hits", {}).get("hits", [])
    results = []
    for hit in hits[:5]:
        src = hit.get("_source", {})
        results.append({
            "company_name": src.get("entity_name", ""),
            "ticker": src.get("file_num", ""),
            "cik": src.get("entity_id", ""),
        })
    return results

def get_company_info(cik: str) -> dict:
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    response = httpx.get(url, headers=HEADERS)
    return response.json()

def get_latest_filing_url(cik: str, form_type: str = "10-K") -> Optional[dict]:
    info = get_company_info(cik)
    filings = info.get("filings", {}).get("recent", {})
    forms = filings.get("form", [])
    accessions = filings.get("accessionNumber", [])
    docs = filings.get("primaryDocument", [])
    dates = filings.get("filingDate", [])

    for i, form in enumerate(forms):
        if form == form_type:
            accession = accessions[i].replace("-", "")
            doc = docs[i]
            cik_int = int(cik)
            url = f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{accession}/{doc}"
            return {
                "url": url,
                "accession": accessions[i],
                "date": dates[i],
                "company": info.get("name", ""),
                "form_type": form_type,
            }
    return None

def download_and_parse_filing(url: str) -> str:
    response = httpx.get(url, headers=HEADERS, timeout=30)
    content_type = response.headers.get("content-type", "")

    if "html" in content_type or url.endswith(".htm") or url.endswith(".html"):
        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(["script", "style", "table"]):
            tag.decompose()
        text = soup.get_text(separator="\n")
    else:
        text = response.text

    # Clean up whitespace
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Limit to 500k characters to avoid memory issues
    return text[:500000]
