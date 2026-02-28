import { useState } from "react";

export default function CompanySearch({ onSearch, loading }) {
  const [ticker, setTicker] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (ticker.trim()) onSearch(ticker.trim().toUpperCase());
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <input
        style={styles.input}
        type="text"
        placeholder="Enter ticker (e.g. AAPL, MSFT)"
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        maxLength={10}
      />
      <button style={loading ? styles.btnLoading : styles.btn} type="submit" disabled={loading}>
        {loading ? "…" : "Search"}
      </button>
    </form>
  );
}

const styles = {
  form: {
    display: "flex",
    gap: 6,
  },
  input: {
    flex: 1,
    padding: "8px 10px",
    background: "#0f1117",
    border: "1px solid #2a2d3e",
    borderRadius: 7,
    color: "#e2e8f0",
    fontSize: 13,
    outline: "none",
  },
  btn: {
    padding: "8px 14px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  btnLoading: {
    padding: "8px 14px",
    background: "#1d4ed8",
    color: "#93c5fd",
    border: "none",
    borderRadius: 7,
    cursor: "not-allowed",
    fontSize: 13,
    fontWeight: 600,
  },
};
