import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { API } from '../lib/api';
import { CHAT_WIDGET } from '../constants/testIds';

function getSessionId() {
  let id = localStorage.getItem('chatbot_session_id');
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem('chatbot_session_id', id);
  }
  return id;
}

export const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [storeName, setStoreName] = useState('Store');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm here to help with products, MOQ, tier pricing, shipping and returns. What would you like to know?" },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef(null);
  const sessionIdRef = useRef(getSessionId());

  useEffect(() => {
    fetch(`${API}/settings/public`)
      .then((r) => r.json())
      .then((d) => { if (d?.storeName) setStoreName(d.storeName); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }, { role: 'assistant', text: '', pending: true }]);
    setStreaming(true);

    try {
      const res = await fetch(`${API}/chatbot/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: sessionIdRef.current }),
      });
      if (!res.ok || !res.body) throw new Error('Chat request failed.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop();
        for (const evt of events) {
          const line = evt.replace(/^data:\s*/, '').trim();
          if (!line) continue;
          const parsed = JSON.parse(line);
          if (parsed.delta) {
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, text: (last.text || '') + parsed.delta, pending: false };
              return next;
            });
          } else if (parsed.done) {
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              next[next.length - 1] = {
                ...last, pending: false,
                lowConfidence: parsed.lowConfidence, whatsappNumber: parsed.whatsappNumber, lastQuestion: text,
              };
              return next;
            });
          }
        }
      }
    } catch (e) {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: 'assistant', text: 'Sorry, something went wrong reaching our assistant. Please try again in a moment.', pending: false };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }, [input, streaming]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            data-testid={CHAT_WIDGET.panel}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-24 right-6 z-50 flex h-[70vh] max-h-[560px] w-[92vw] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-white/40 bg-white/90 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between bg-[#0B132B] px-5 py-4">
              <div>
                <p className="font-display text-lg leading-tight text-[#F9F8F6]">{storeName}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#F9F8F6]/60">AI Assistant</p>
              </div>
              <button
                data-testid={CHAT_WIDGET.closeButton}
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-[#F9F8F6]/80 transition-colors hover:bg-white/10 hover:text-[#F9F8F6]"
              >
                <X size={18} />
              </button>
            </div>

            <div ref={scrollRef} data-testid={CHAT_WIDGET.messageList} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m, i) => (
                <div key={i} data-testid={CHAT_WIDGET.message(i)} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%]">
                    <div
                      className={
                        m.role === 'user'
                          ? 'rounded-2xl rounded-br-sm bg-[#0B132B] px-4 py-2 text-sm text-[#F9F8F6]'
                          : 'rounded-2xl rounded-bl-sm border border-black/5 bg-[#F3F1EC] px-4 py-2 text-sm text-[#121826]'
                      }
                    >
                      {m.pending ? (
                        <span data-testid={CHAT_WIDGET.typingIndicator} className="flex gap-1 py-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5E6A7D] [animation-delay:-0.2s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5E6A7D] [animation-delay:-0.1s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5E6A7D]" />
                        </span>
                      ) : (
                        <span className="whitespace-pre-wrap">{m.text}</span>
                      )}
                    </div>
                    {m.lowConfidence && m.whatsappNumber && (
                      <a
                        data-testid={CHAT_WIDGET.whatsappCta}
                        href={`https://wa.me/${m.whatsappNumber}?text=${encodeURIComponent(m.lastQuestion || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#FF4500] px-3 py-1.5 text-xs font-medium text-white transition-transform hover:scale-105"
                      >
                        Continue on WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 border-t border-black/5 bg-white p-3">
              <input
                data-testid={CHAT_WIDGET.input}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about products, MOQ, shipping..."
                className="flex-1 rounded-full border border-black/10 bg-[#F9F8F6] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0B132B]/20"
              />
              <Button
                data-testid={CHAT_WIDGET.sendButton}
                onClick={send}
                disabled={streaming || !input.trim()}
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full bg-[#FF4500] text-white hover:bg-[#FF4500]/90"
              >
                {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        data-testid={CHAT_WIDGET.fabButton}
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#0B132B] text-[#F9F8F6] shadow-[0_8px_24px_rgba(11,19,43,0.4)] transition-colors hover:bg-[#0B132B]/90"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </motion.button>
    </>
  );
};
