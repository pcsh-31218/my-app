import { useState, useRef, useEffect } from "react";
import './App.css'
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

const ROLE_LABELS = { interviewer: "面試官", interviewee: "應試者" };
const ts = () => { const d = new Date(); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const LS_KEY = "mindmirror_v4";
const lsLoad = () => { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const lsSave = (data) => { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) { console.warn(e); } };

const DEFAULTS = { interviewerName: "", intervieweeName: "", messages: [] };
function initState() {
  const s = lsLoad();
  if (!s) return DEFAULTS;
  return { interviewerName: s.interviewerName ?? "", intervieweeName: s.intervieweeName ?? "", messages: Array.isArray(s.messages) ? s.messages : [] };
}

const createMessage = (data) => ({ id: uid(), timestamp: ts(), ...data });

function App() {
  const init = initState();
  const [interviewerName, setInterviewerName] = useState(init.interviewerName);
  const [intervieweeName, setIntervieweeName] = useState(init.intervieweeName);
  const [messages, setMessages] = useState(init.messages);
  const [activeRole, setActiveRole] = useState("interviewer");
  const [savedAt, setSavedAt] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const exportMenuRef = useRef(null);
  const [value, setValue] = useState("");
  const saveTimer = useRef(null);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      lsSave({ interviewerName, intervieweeName, messages });
      setSavedAt(ts());
    }, 300);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [interviewerName, intervieweeName, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: messages.length < 3 ? "auto" : "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current; if (!el) return;
    el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 100) + "px";
  }, [value]);

  // 點外面關閉匯出選單
  useEffect(() => {
    const handler = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Tab") { e.preventDefault(); setActiveRole(r => r === "interviewer" ? "interviewee" : "interviewer"); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSend = () => {
    if (!value.trim()) return;
    setMessages(prev => [...prev, createMessage({ role: activeRole, content: value.trim() })].slice(-200));
    setValue("");
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleClear = () => { if (!window.confirm("確定要清除所有對話記錄嗎？")) return; setMessages([]); };

  const getTextContent = () => {
    return messages.map(m => {
      const name = m.role === "interviewer" ? (interviewerName || "面試官") : (intervieweeName || "應試者");
      return `【${name} ${m.timestamp}】\n${m.content}`;
    }).join("\n\n");
  };

  // 匯出 Word
  const handleExportWord = async () => {
    if (messages.length === 0) { alert("尚無訊息"); return; }
    setShowExportMenu(false);
    const paragraphs = [];
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: "訪談紀錄", bold: true, size: 32 })],
      spacing: { after: 300 },
    }));
    messages.forEach(m => {
      const name = m.role === "interviewer" ? (interviewerName || "面試官") : (intervieweeName || "應試者");
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: `${name}  ${m.timestamp}`, bold: true, color: "7A4F1E" })],
        spacing: { before: 200 },
      }));
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: m.content })],
        spacing: { after: 100 },
      }));
    });
    const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, "訪談紀錄.docx");
  };

  // 原生分享（LINE 等）
  const handleShare = async () => {
    if (messages.length === 0) { alert("尚無訊息"); return; }
    setShowExportMenu(false);
    const text = getTextContent();
    if (navigator.share) {
      try { await navigator.share({ title: "訪談紀錄", text }); } catch (e) { console.log(e); }
    } else {
      await navigator.clipboard.writeText(text);
      alert("已複製到剪貼簿！");
    }
  };

  // 複製文字
  const handleCopy = async () => {
    if (messages.length === 0) { alert("尚無訊息"); return; }
    setShowExportMenu(false);
    await navigator.clipboard.writeText(getTextContent());
    alert("已複製到剪貼簿！");
  };

  const myName = activeRole === "interviewer" ? (interviewerName || "面試官") : (intervieweeName || "應試者");
  const otherRole = activeRole === "interviewer" ? "interviewee" : "interviewer";
  const otherName = otherRole === "interviewer" ? (interviewerName || "面試官") : (intervieweeName || "應試者");

  return (
    <div className="app-root">
      {/* Header */}
      <div className="line-header">
        <button className="header-icon" onClick={() => setShowInfo(s => !s)}>☰</button>
        <div className="header-center">
          <div className="header-name">{otherName}</div>
          <div className="header-sub">訪談紀錄 · {messages.length} 則</div>
        </div>
        <div className="header-actions">
          {/* 匯出／分享按鈕 */}
          <div className="export-wrap" ref={exportMenuRef}>
            <button className="header-icon" title="匯出／分享" onClick={() => setShowExportMenu(s => !s)}>↑</button>
            {showExportMenu && (
              <div className="export-menu">
                <button className="export-item" onClick={handleExportWord}>
                  <span className="export-icon">📄</span>匯出 Word 檔
                </button>
                <button className="export-item" onClick={handleShare}>
                  <span className="export-icon">🔗</span>分享（LINE 等）
                </button>
                <button className="export-item" onClick={handleCopy}>
                  <span className="export-icon">📋</span>複製文字
                </button>
              </div>
            )}
          </div>
          <button className="header-icon" onClick={handleClear}>✕</button>
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="info-panel">
          <div className="info-row">
            <label>面試官名稱</label>
            <input value={interviewerName} onChange={e => setInterviewerName(e.target.value)} placeholder="面試官" />
          </div>
          <div className="info-row">
            <label>應試者名稱</label>
            <input value={intervieweeName} onChange={e => setIntervieweeName(e.target.value)} placeholder="應試者" />
          </div>
          {savedAt && <div className="info-saved">✓ 已儲存 {savedAt}</div>}
          <div className="info-tip">💡 電腦版：輸入時按 <kbd>Tab</kbd> 切換發言角色</div>
        </div>
      )}

      {/* Role Switcher */}
      <div className="role-switcher">
        <span className="role-switch-label">發言：</span>
        <button className={`role-tab ${activeRole === "interviewer" ? "active" : ""}`} onClick={() => setActiveRole("interviewer")}>
          {interviewerName || "面試官"}
        </button>
        <button className={`role-tab ${activeRole === "interviewee" ? "active" : ""}`} onClick={() => setActiveRole("interviewee")}>
          {intervieweeName || "應試者"}
        </button>
        <span className="tab-hint">Tab 切換</span>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        {messages.length === 0 && (
          <div className="chat-empty">✦ 開始你的訪談對話 ✦</div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.role === activeRole;
          const name = msg.role === "interviewer" ? (interviewerName || "面試官") : (intervieweeName || "應試者");
          const prevMsg = messages[i - 1];
          const showName = !prevMsg || prevMsg.role !== msg.role;
          return (
            <div key={msg.id} className={`msg-row ${isMe ? "right" : "left"}`}>
              {!isMe && <div className="avatar">{name.slice(0, 1)}</div>}
              <div className="msg-body">
                {showName && !isMe && <div className="msg-name">{name}</div>}
                <div className={`bubble ${isMe ? "bubble-right" : "bubble-left"}`}>
                  {msg.content}
                </div>
                <div className={`msg-time ${isMe ? "time-right" : "time-left"}`}>{msg.timestamp}</div>
              </div>
              {isMe && <div className="avatar avatar-me">{name.slice(0, 1)}</div>}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="input-bar">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={`以「${myName}」身分輸入…`}
          className="chat-input"
        />
        <button onClick={handleSend} disabled={!value.trim()} className={`send-btn ${value.trim() ? "active" : ""}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default App