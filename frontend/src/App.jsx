import { useState, useEffect, useRef } from "react";
import axios from "axios";
import CompanySearch from "./components/CompanySearch.jsx";
import ChatInterface from "./components/ChatInterface.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0); // seconds remaining
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const cooldownRef = useRef(null);

  // Tick down the cooldown every second
  useEffect(() => {
    if (cooldown <= 0) {
      clearInterval(cooldownRef.current);
      // Auto-retry the pending question when cooldown ends
      if (pendingQuestion) {
        const q = pendingQuestion;
        setPendingQuestion(null);
        handleQuestion(q);
      }
      return;
    }
    cooldownRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) { clearInterval(cooldownRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(cooldownRef.current);
  }, [cooldown]);

  async function handleSearch(ticker) {
    setError("");
    setLoading(true);
    setCompany(null);
    setMessages([]);
    try {
      const res = await axios.get(`${API}/company/${ticker}`);
      setCompany(res.data);
    } catch {
      setError(`Company with ticker "${ticker}" not found.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadFiling() {
    if (!company) return;
    setIndexing(true);
    setError("");
    try {
      const res = await axios.post(`${API}/load`, {
        ticker: company.ticker,
        form_type: "10-K",
      });
      setCompany((prev) => ({ ...prev, loaded: true, filing_date: res.data.filing_date }));
      setMessages([
        {
          role: "assistant",
          text: `I've loaded ${company.company_name}'s latest 10-K filing (${res.data.filing_date}). Ask me anything about their business, financials, risks, or strategy.`,
        },
      ]);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load filing.");
    } finally {
      setIndexing(false);
    }
  }

  async function handleQuestion(question) {
    if (!company?.loaded || cooldown > 0) return;
    const userMsg = { role: "user", text: question };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await axios.post(`${API}/ask`, {
        ticker: company.ticker,
        question,
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: res.data.answer, sources: res.data.sources },
      ]);
    } catch (e) {
      if (e.response?.status === 429) {
        const retryAfter = parseInt(e.response.headers["retry-after"] || "60");
        setCooldown(retryAfter);
        setPendingQuestion(question);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `⏳ Rate limit reached. I'll automatically retry your question in ${retryAfter} seconds when the limit resets.`,
            isCooldown: true,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Sorry, something went wrong. Please try again.", sources: [] },
        ]);
      }
    }
  }

  return (
    <div style={styles.root}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>📊</span>
          <span style={styles.logoText}>SEC Research<br />Assistant</span>
        </div>
        <p style={styles.tagline}>
          Ask questions about any public company's SEC filings — powered by AI.
        </p>
        <div style={styles.divider} />
        <CompanySearch onSearch={handleSearch} loading={loading} />
        {error && <p style={styles.error}>{error}</p>}
        {company && (
          <div style={styles.companyCard}>
            <div style={styles.ticker}>{company.ticker}</div>
            <div style={styles.companyName}>{company.company_name}</div>
            <div style={styles.meta}>{company.sic_description}</div>
            <div style={styles.meta}>State: {company.state || "N/A"}</div>
            {company.filing_date && (
              <div style={styles.meta}>Filing: {company.filing_date}</div>
            )}
            {!company.loaded ? (
              <button
                style={indexing ? styles.btnLoading : styles.btn}
                onClick={handleLoadFiling}
                disabled={indexing}
              >
                {indexing ? "Indexing filing…" : "Load 10-K Filing"}
              </button>
            ) : (
              <div style={styles.loadedBadge}>✓ Filing loaded</div>
            )}
          </div>
        )}
        <div style={styles.divider} />
        <div style={styles.examples}>
          <p style={styles.examplesTitle}>Example questions</p>
          {[
            "What are the main risk factors?",
            "How did revenue change year over year?",
            "What is their competitive strategy?",
            "Describe their debt and liquidity position.",
            "What markets do they operate in?",
          ].map((q) => (
            <button
              key={q}
              style={styles.exampleBtn}
              onClick={() => company?.loaded && handleQuestion(q)}
              disabled={!company?.loaded}
            >
              {q}
            </button>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        {cooldown > 0 && (
          <div style={styles.cooldownBanner}>
            <span>⏳</span>
            <span>Rate limit cooldown — resuming in <strong>{cooldown}s</strong>. Your question will auto-retry.</span>
            <div style={styles.cooldownBar}>
              <div style={{ ...styles.cooldownFill, width: `${(cooldown / 60) * 100}%` }} />
            </div>
          </div>
        )}
        <ChatInterface
          messages={messages}
          onQuestion={handleQuestion}
          disabled={!company?.loaded || cooldown > 0}
          companyName={company?.company_name}
          cooldown={cooldown}
        />
      </main>
    </div>
  );
}

const styles = {
  root: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
  },
  sidebar: {
    width: 300,
    minWidth: 300,
    background: "#161920",
    borderRight: "1px solid #2a2d3e",
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflowY: "auto",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: { fontSize: 28 },
  logoText: {
    fontSize: 15,
    fontWeight: 700,
    color: "#e2e8f0",
    lineHeight: 1.3,
  },
  tagline: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 1.5,
  },
  divider: {
    height: 1,
    background: "#2a2d3e",
    margin: "4px 0",
  },
  error: {
    color: "#f87171",
    fontSize: 12,
    background: "#1f1215",
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #4a1a1a",
  },
  companyCard: {
    background: "#1e2130",
    border: "1px solid #2a2d3e",
    borderRadius: 10,
    padding: "14px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  ticker: {
    fontSize: 20,
    fontWeight: 700,
    color: "#60a5fa",
  },
  companyName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#e2e8f0",
  },
  meta: {
    fontSize: 11,
    color: "#6b7280",
  },
  btn: {
    marginTop: 8,
    padding: "8px 12px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  btnLoading: {
    marginTop: 8,
    padding: "8px 12px",
    background: "#1d4ed8",
    color: "#93c5fd",
    border: "none",
    borderRadius: 7,
    cursor: "not-allowed",
    fontSize: 13,
    fontWeight: 600,
  },
  loadedBadge: {
    marginTop: 8,
    fontSize: 12,
    color: "#4ade80",
    fontWeight: 600,
  },
  cooldownBanner: {
    background: "#1c1a10",
    border: "1px solid #854d0e",
    borderRadius: 0,
    padding: "10px 40px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "#fbbf24",
    flexWrap: "wrap",
  },
  cooldownBar: {
    width: "100%",
    height: 3,
    background: "#292107",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 4,
  },
  cooldownFill: {
    height: "100%",
    background: "#fbbf24",
    transition: "width 1s linear",
  },
  examples: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  examplesTitle: {
    fontSize: 11,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 600,
  },
  exampleBtn: {
    background: "transparent",
    border: "1px solid #2a2d3e",
    color: "#9ca3af",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 11,
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s",
  },
};
