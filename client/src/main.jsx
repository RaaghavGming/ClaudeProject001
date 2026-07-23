import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/chat';

function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  // The frontend owns conversation state. Every request sends this full array so
  // Claude receives the complete chat context while the server stays stateless.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const nextMessages = [...messages, { role: 'user', content: trimmedInput }];
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages })
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'The chat service could not process that request.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Parse server-sent event frames as they arrive. Each token appends to the
      // placeholder assistant message for a typewriter-like streaming response.
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          const lines = frame.split('\n');
          const event = lines.find((line) => line.startsWith('event:'))?.replace('event:', '').trim();
          const dataLine = lines.find((line) => line.startsWith('data:'))?.replace('data:', '').trim();
          if (!event || !dataLine) continue;

          const data = JSON.parse(dataLine);
          if (event === 'token') {
            setMessages((currentMessages) => {
              const updated = [...currentMessages];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: updated[updated.length - 1].content + data.text
              };
              return updated;
            });
          }

          if (event === 'error') {
            throw new Error(data.message);
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Unable to reach the chat service. Please try again.');
      setMessages((currentMessages) => currentMessages.filter((message) => message.content.trim() !== ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setError('');
    setInput('');
  };

  return (
    <main className="flex min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 shadow-2xl shadow-black/20">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Claude Chat</p>
            <h1 className="text-xl font-semibold sm:text-2xl">AI assistant</h1>
          </div>
          <button
            onClick={startNewChat}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
          >
            New chat
          </button>
        </header>

        <div className="flex-1 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 shadow-2xl shadow-black/30">
          <div className="h-[calc(100vh-15rem)] overflow-y-auto px-4 py-6 sm:px-6">
            {messages.length === 0 && (
              <div className="mx-auto mt-16 max-w-xl text-center text-slate-400">
                <div className="mb-4 text-5xl">✦</div>
                <h2 className="mb-2 text-2xl font-semibold text-slate-100">Start a conversation</h2>
                <p>Ask Claude anything. Responses stream in live from the Express backend.</p>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 sm:text-base ${
                      message.role === 'user'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'border border-slate-700 bg-slate-800 text-slate-100'
                    }`}
                  >
                    {message.content || (isLoading ? <span className="animate-pulse text-slate-400">Claude is typing…</span> : null)}
                  </div>
                </div>
              ))}
            </div>
            <div ref={bottomRef} />
          </div>
        </div>

        {error && <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-100">{error}</div>}

        <form
          className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
        >
          <label htmlFor="message" className="sr-only">Message</label>
          <textarea
            id="message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows="3"
            maxLength="8000"
            placeholder="Type a message…"
            className="max-h-40 w-full resize-none bg-transparent px-2 py-2 text-slate-100 outline-none placeholder:text-slate-500"
          />
          <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-3 text-xs text-slate-500">
            <span>Enter to send · Shift+Enter for a new line</span>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isLoading ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<ChatApp />);
