import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useRef, useCallback, useEffect } from "react";
import { Square, Send, Plus, MessageSquare, Bot, X, Check, Pencil, Copy, RotateCcw, ThumbsUp, ThumbsDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
function useKodexChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef(null);
  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);
  const restoreMessages = useCallback((msgs) => {
    setMessages(msgs);
  }, []);
  const setFeedback = useCallback((id, feedback) => {
    setMessages(
      (prev) => prev.map(
        (m) => m.id === id ? { ...m, feedback: m.feedback === feedback ? null : feedback } : m
      )
    );
  }, []);
  const sendMessage = useCallback(
    async (text, historyOverride) => {
      const userMsg = {
        id: crypto.randomUUID(),
        role: "user",
        content: text
      };
      const assistantId = crypto.randomUUID();
      const assistantMsg = {
        id: assistantId,
        role: "assistant",
        content: ""
      };
      const baseHistory = historyOverride ?? messages;
      setMessages([...baseHistory, userMsg, assistantMsg]);
      setIsLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const history = [...baseHistory, userMsg].map((m) => ({
          role: m.role,
          content: m.content
        }));
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") break;
            try {
              const chunk = JSON.parse(payload);
              const delta = chunk?.choices?.[0]?.delta?.content;
              if (delta) {
                setMessages(
                  (prev) => prev.map(
                    (m) => m.id === assistantId ? { ...m, content: m.content + delta } : m
                  )
                );
              }
            } catch {
            }
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setMessages(
            (prev) => prev.map(
              (m) => m.id === assistantId ? { ...m, content: "An error occurred while processing your request. Please try again." } : m
            )
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );
  const editAndResend = useCallback(
    (id, newText) => {
      const idx = messages.findIndex((m) => m.id === id);
      if (idx === -1) return;
      const trimmedHistory = messages.slice(0, idx);
      sendMessage(newText, trimmedHistory);
    },
    [messages, sendMessage]
  );
  return { messages, sendMessage, editAndResend, setFeedback, isLoading, stop, clearMessages, restoreMessages };
}
function TypingIndicator() {
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 px-1 py-2", children: [
    /* @__PURE__ */ jsx("span", { className: "typing-dot", style: {
      animationDelay: "0ms"
    } }),
    /* @__PURE__ */ jsx("span", { className: "typing-dot", style: {
      animationDelay: "160ms"
    } }),
    /* @__PURE__ */ jsx("span", { className: "typing-dot", style: {
      animationDelay: "320ms"
    } })
  ] });
}
function MessageBubble({
  message,
  isStreaming,
  isLoading,
  onFeedback,
  onEdit
}) {
  const isUser = message.role === "user";
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const textareaRef = useRef(null);
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editing]);
  const handleConfirmEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.content) {
      onEdit(message.id, trimmed);
    }
    setEditing(false);
  };
  const handleCancelEdit = () => {
    setEditText(message.content);
    setEditing(false);
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleConfirmEdit();
    }
    if (e.key === "Escape") handleCancelEdit();
  };
  return /* @__PURE__ */ jsxs("div", { className: `flex gap-3 items-start group ${isUser ? "flex-row-reverse" : "flex-row"}`, children: [
    !isUser && /* @__PURE__ */ jsx("div", { className: "assistant-avatar flex-shrink-0", children: /* @__PURE__ */ jsx(Bot, { className: "w-3.5 h-3.5 text-white" }) }),
    /* @__PURE__ */ jsxs("div", { className: `flex flex-col gap-1 ${isUser ? "items-end" : "items-start"} max-w-[80%]`, children: [
      isUser && editing ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-end gap-2", style: {
        width: "60%",
        minWidth: "400px"
      }, children: [
        /* @__PURE__ */ jsx("textarea", { ref: textareaRef, value: editText, onChange: (e) => {
          setEditText(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = e.target.scrollHeight + "px";
        }, onKeyDown: handleKeyDown, className: "w-full resize-none px-4 py-3 text-sm leading-relaxed focus:outline-none", style: {
          background: "#0D1B3E",
          color: "#f1f5f9",
          borderRadius: "18px 18px 4px 18px",
          border: "2px solid #00C9C8",
          minHeight: "48px",
          width: "100%",
          minWidth: "400px",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
          lineHeight: "1.6"
        }, rows: Math.max(2, editText.split("\n").length) }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsxs("button", { onClick: handleCancelEdit, className: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors", children: [
            /* @__PURE__ */ jsx(X, { className: "w-3 h-3" }),
            "Cancelar"
          ] }),
          /* @__PURE__ */ jsxs("button", { onClick: handleConfirmEdit, className: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0D1B3E] text-white hover:bg-[#00C9C8] transition-colors", children: [
            /* @__PURE__ */ jsx(Check, { className: "w-3 h-3" }),
            "Enviar"
          ] })
        ] })
      ] }) : isUser ? /* @__PURE__ */ jsx("div", { className: "user-bubble", children: /* @__PURE__ */ jsx("span", { className: "whitespace-pre-wrap text-sm leading-relaxed", children: message.content }) }) : /* @__PURE__ */ jsx("div", { className: "assistant-bubble", children: !message.content && isStreaming ? /* @__PURE__ */ jsx(TypingIndicator, {}) : /* @__PURE__ */ jsx("div", { className: "markdown", children: /* @__PURE__ */ jsx(ReactMarkdown, { children: message.content }) }) }),
      !editing && /* @__PURE__ */ jsxs("div", { className: `flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? "flex-row-reverse" : "flex-row"}`, children: [
        isUser && !isLoading && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("button", { onClick: () => setEditing(true), className: "p-1.5 rounded-md text-gray-400 hover:text-[#0D1B3E] hover:bg-gray-100 transition-colors", title: "Editar mensaje", children: /* @__PURE__ */ jsx(Pencil, { className: "w-3.5 h-3.5" }) }),
          /* @__PURE__ */ jsx("button", { onClick: () => navigator.clipboard.writeText(message.content), className: "p-1.5 rounded-md text-gray-400 hover:text-[#0D1B3E] hover:bg-gray-100 transition-colors", title: "Copiar mensaje", children: /* @__PURE__ */ jsx(Copy, { className: "w-3.5 h-3.5" }) }),
          /* @__PURE__ */ jsx("button", { onClick: () => onRegenerate(message.id), className: "p-1.5 rounded-md text-gray-400 hover:text-[#0D1B3E] hover:bg-gray-100 transition-colors", title: "Regenerar respuesta", children: /* @__PURE__ */ jsx(RotateCcw, { className: "w-3.5 h-3.5" }) })
        ] }),
        !isUser && !isStreaming && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("button", { onClick: () => navigator.clipboard.writeText(message.content), className: "p-1.5 rounded-md text-gray-400 hover:text-[#0D1B3E] hover:bg-gray-100 transition-colors", title: "Copiar respuesta", children: /* @__PURE__ */ jsx(Copy, { className: "w-3.5 h-3.5" }) }),
          /* @__PURE__ */ jsx("button", { onClick: () => onFeedback(message.id, "like"), className: `p-1.5 rounded-md transition-colors ${message.feedback === "like" ? "text-[#00C9C8] bg-[#00C9C8]/10" : "text-gray-400 hover:text-[#00C9C8] hover:bg-gray-100"}`, title: "Buena respuesta", children: /* @__PURE__ */ jsx(ThumbsUp, { className: "w-3.5 h-3.5" }) }),
          /* @__PURE__ */ jsx("button", { onClick: () => onFeedback(message.id, "dislike"), className: `p-1.5 rounded-md transition-colors ${message.feedback === "dislike" ? "text-red-400 bg-red-50" : "text-gray-400 hover:text-red-400 hover:bg-gray-100"}`, title: "Mala respuesta", children: /* @__PURE__ */ jsx(ThumbsDown, { className: "w-3.5 h-3.5" }) })
        ] })
      ] })
    ] })
  ] });
}
function WelcomeScreen() {
  return /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center px-4 text-center", children: /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
    /* @__PURE__ */ jsx("div", { className: "w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mx-auto mb-4 shadow-sm", children: /* @__PURE__ */ jsx(Bot, { className: "w-7 h-7 text-[#0D1B3E]" }) }),
    /* @__PURE__ */ jsx("h2", { className: "welcome-title", children: "¿En qué puedo ayudarte?" }),
    /* @__PURE__ */ jsx("p", { className: "welcome-subtitle", children: "Asistente inteligente de Kodex Tech Solutions" })
  ] }) });
}
function Sidebar({
  sessions,
  activeId,
  onSelect,
  onNew
}) {
  return /* @__PURE__ */ jsxs("aside", { className: "sidebar", children: [
    /* @__PURE__ */ jsx("div", { className: "px-4 py-5", children: /* @__PURE__ */ jsx("span", { className: "sidebar-logo", children: "KODEX IA" }) }),
    /* @__PURE__ */ jsx("div", { className: "px-3 mb-4", children: /* @__PURE__ */ jsxs("button", { className: "sidebar-new-chat", onClick: onNew, children: [
      /* @__PURE__ */ jsx(Plus, { className: "w-4 h-4" }),
      "Nuevo chat"
    ] }) }),
    /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto px-3", children: sessions.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("p", { className: "sidebar-section-title mb-2", children: "Recientes" }),
      sessions.map((s) => /* @__PURE__ */ jsxs("button", { onClick: () => onSelect(s.id), className: `chat-history-item w-full text-left ${s.id === activeId ? "active" : ""}`, children: [
        /* @__PURE__ */ jsx(MessageSquare, { className: "w-3.5 h-3.5 flex-shrink-0 opacity-50" }),
        /* @__PURE__ */ jsx("span", { className: "truncate", children: s.title })
      ] }, s.id))
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "sidebar-user", children: [
      /* @__PURE__ */ jsx("div", { className: "sidebar-avatar", children: "KT" }),
      /* @__PURE__ */ jsx("span", { className: "sidebar-username", children: "Kodex Tech" })
    ] })
  ] });
}
function Home() {
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(() => crypto.randomUUID());
  const {
    messages,
    sendMessage,
    editAndResend,
    setFeedback,
    isLoading,
    stop,
    clearMessages,
    restoreMessages
  } = useKodexChat();
  const bottomRef = useRef(null);
  const savingRef = useRef(false);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages, isLoading]);
  useEffect(() => {
    if (messages.length === 0) return;
    if (savingRef.current) return;
    const title = messages[0]?.content?.slice(0, 40) || "Nueva conversación";
    setSessions((prev) => {
      const exists = prev.find((s) => s.id === activeSessionId);
      if (exists) {
        return prev.map((s) => s.id === activeSessionId ? {
          ...s,
          messages: [...messages],
          title
        } : s);
      }
      return [{
        id: activeSessionId,
        title,
        messages: [...messages],
        createdAt: /* @__PURE__ */ new Date()
      }, ...prev];
    });
  }, [messages, activeSessionId]);
  const handleNew = () => {
    const newId = crypto.randomUUID();
    setActiveSessionId(newId);
    clearMessages();
    setInput("");
  };
  const handleSelect = (id) => {
    if (id === activeSessionId) return;
    if (messages.length > 0) {
      const title = messages[0]?.content?.slice(0, 40) || "Nueva conversación";
      setSessions((prev) => {
        const exists = prev.find((s) => s.id === activeSessionId);
        if (exists) {
          return prev.map((s) => s.id === activeSessionId ? {
            ...s,
            messages: [...messages],
            title
          } : s);
        }
        return [{
          id: activeSessionId,
          title,
          messages: [...messages],
          createdAt: /* @__PURE__ */ new Date()
        }, ...prev];
      });
    }
    const session = sessions.find((s) => s.id === id);
    savingRef.current = true;
    setActiveSessionId(id);
    if (session) {
      restoreMessages(session.messages);
    } else {
      clearMessages();
    }
    savingRef.current = false;
  };
  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage(text);
    setInput("");
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  const handleEdit = (id, newText) => {
    editAndResend(id, newText);
  };
  const handleRegenerate = (id) => {
    const idx = messages.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const userMsg = messages.slice(0, idx).reverse().find((m) => m.role === "user");
    if (!userMsg) return;
    const history = messages.slice(0, idx - 1);
    sendMessage(userMsg.content, history);
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex h-screen overflow-hidden", children: [
    /* @__PURE__ */ jsx(Sidebar, { sessions, activeId: activeSessionId, onSelect: handleSelect, onNew: handleNew }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col flex-1 min-w-0", children: [
      /* @__PURE__ */ jsxs("header", { className: "main-header", children: [
        /* @__PURE__ */ jsx("span", { className: "text-sm font-semibold text-[#0D1B3E]", children: "KODEX IA" }),
        /* @__PURE__ */ jsx("span", { className: "header-model-badge", children: "mistral-small" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "chat-area flex flex-col flex-1 min-h-0 overflow-y-auto", children: messages.length === 0 ? /* @__PURE__ */ jsx(WelcomeScreen, {}) : /* @__PURE__ */ jsxs("div", { className: "messages-container", children: [
        messages.map((msg, i) => /* @__PURE__ */ jsx(MessageBubble, { message: msg, isStreaming: isLoading && i === messages.length - 1, isLoading, onFeedback: setFeedback, onEdit: handleEdit, onRegenerate: handleRegenerate }, msg.id)),
        /* @__PURE__ */ jsx("div", { ref: bottomRef })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "input-area", children: [
        isLoading && /* @__PURE__ */ jsx("div", { className: "flex justify-center mb-3 max-w-[720px] mx-auto", children: /* @__PURE__ */ jsxs("button", { onClick: stop, className: "stop-btn", children: [
          /* @__PURE__ */ jsx(Square, { className: "w-3 h-3 fill-current" }),
          "Detener generación"
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "input-wrapper", children: [
          /* @__PURE__ */ jsx("textarea", { value: input, onChange: (e) => setInput(e.target.value), onKeyDown: handleKeyDown, placeholder: "Escribe un mensaje...", rows: 1, disabled: isLoading, className: "input-field disabled:opacity-50", style: {
            maxHeight: "160px",
            overflowY: "auto"
          }, onInput: (e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = Math.min(t.scrollHeight, 160) + "px";
          } }),
          /* @__PURE__ */ jsx("button", { onClick: handleSubmit, disabled: !input.trim() || isLoading, className: "send-btn", children: /* @__PURE__ */ jsx(Send, { className: "w-3.5 h-3.5" }) })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "input-disclaimer", children: "KODEX IA puede cometer errores. Verificá las respuestas importantes." })
      ] })
    ] })
  ] });
}
export {
  Home as component
};
