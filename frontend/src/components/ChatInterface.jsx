import { useState, useEffect, useRef } from "react";

export default function ChatInterface({ messages, onQuestion, disabled, companyName, cooldown }) {
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || disabled || asking) return;
    const q = input.trim();
    setInput("");
    setAsking(true);
    await onQuestion(q);
    setAsking(false);
  }

  return (
    <div style={styles.wrapper}>
      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            {disabled ? (
              <>
                <span style={styles.emptyIcon}>📂</span>
                <p>Search for a company and load their 10-K filing to get started.</p>
              </>
            ) : (
              <>
                <span style={styles.emptyIcon}>💬</span>
                <p>Ask anything about {companyName}'s SEC filing.</p>
              </>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={msg.role === "user" ? styles.userRow : styles.assistantRow}>
            <div style={msg.role === "user" ? styles.userBubble : styles.assistantBubble}>
              <p style={styles.msgText}>{msg.text}</p>
              {msg.sources && msg.sources.length > 0 && (
                <details style={styles.sources}>
                  <summary style={styles.sourcesSummary}>
                    {msg.sources.length} source{msg.sources.length > 1 ? "s" : ""} from filing
                  </summary>
                  {msg.sources.map((src, j) => (
                    <div key={j} style={styles.sourceItem}>
                      <span style={styles.sourceNum}>#{j + 1}</span>
                      <p style={styles.sourceText}>{src}…</p>
                    </div>
                  ))}
                </details>
              )}
            </div>
          </div>
        ))}

        {asking && (
          <div style={styles.assistantRow}>
            <div style={styles.assistantBubble}>
              <div style={styles.typing}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={styles.inputArea}>
        <input
          style={disabled ? styles.inputDisabled : styles.input}
          placeholder={
            cooldown > 0
              ? `Cooling down… retrying in ${cooldown}s`
              : disabled
              ? "Load a filing first…"
              : "Ask about this company's filing…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || asking}
        />
        <button
          style={disabled || asking ? styles.sendBtnDisabled : styles.sendBtn}
          type="submit"
          disabled={disabled || asking}
        >
          ↑
        </button>
      </form>

      <style>{`
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; }
      `}</style>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "#0f1117",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "32px 40px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: "100%",
    color: "#4b5563",
    textAlign: "center",
    fontSize: 15,
  },
  emptyIcon: { fontSize: 48 },
  userRow: {
    display: "flex",
    justifyContent: "flex-end",
  },
  assistantRow: {
    display: "flex",
    justifyContent: "flex-start",
  },
  userBubble: {
    background: "#3b82f6",
    color: "#fff",
    borderRadius: "16px 16px 4px 16px",
    padding: "12px 16px",
    maxWidth: "70%",
  },
  assistantBubble: {
    background: "#1e2130",
    border: "1px solid #2a2d3e",
    color: "#e2e8f0",
    borderRadius: "16px 16px 16px 4px",
    padding: "12px 16px",
    maxWidth: "75%",
  },
  msgText: {
    fontSize: 14,
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
  },
  sources: {
    marginTop: 10,
    borderTop: "1px solid #2a2d3e",
    paddingTop: 8,
  },
  sourcesSummary: {
    fontSize: 11,
    color: "#6b7280",
    cursor: "pointer",
    userSelect: "none",
  },
  sourceItem: {
    display: "flex",
    gap: 6,
    marginTop: 6,
  },
  sourceNum: {
    fontSize: 10,
    color: "#3b82f6",
    fontWeight: 700,
    minWidth: 18,
    paddingTop: 2,
  },
  sourceText: {
    fontSize: 11,
    color: "#6b7280",
    lineHeight: 1.5,
    fontStyle: "italic",
  },
  typing: {
    display: "flex",
    gap: 4,
    padding: "2px 0",
    "& span": {
      width: 6,
      height: 6,
      background: "#6b7280",
      borderRadius: "50%",
      animation: "typing 1.2s infinite",
    },
  },
  inputArea: {
    display: "flex",
    gap: 8,
    padding: "16px 40px 24px",
    borderTop: "1px solid #1e2130",
    background: "#0f1117",
  },
  input: {
    flex: 1,
    padding: "12px 16px",
    background: "#161920",
    border: "1px solid #2a2d3e",
    borderRadius: 12,
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
  },
  inputDisabled: {
    flex: 1,
    padding: "12px 16px",
    background: "#111318",
    border: "1px solid #1e2130",
    borderRadius: 12,
    color: "#374151",
    fontSize: 14,
    outline: "none",
    cursor: "not-allowed",
  },
  sendBtn: {
    width: 44,
    height: 44,
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    fontSize: 18,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    width: 44,
    height: 44,
    background: "#1e2130",
    color: "#374151",
    border: "none",
    borderRadius: 12,
    cursor: "not-allowed",
    fontSize: 18,
    fontWeight: 700,
  },
};
