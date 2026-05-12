import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Mic, MicOff, Send, X, Bot, Volume2, VolumeX, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import { processMessage, type Message, type FlowState } from '../../lib/assistant';
import { askLLM, isLLMConfigured } from '../../lib/llm';
import { useSpeechInput, speak, stopSpeaking } from '../../hooks/useSpeech';
import { tryPageVoiceCommand } from '../../lib/voiceCommands';

// Global voice button. Floats bottom-right on every page. Tap to open a
// slide-up sheet that talks to the same assistant engine as AssistantPage.
//
// Slice 0 wires the existing intents (new project, pipeline, lookup, etc.)
// plus generic Gemini fallback. Slice 1 will extend this with page-aware
// commands ("send", "edit reply to say X", "update [project] [field]").

const QUICK_ACTIONS = [
  { label: 'My pipeline',   text: 'show my pipeline' },
  { label: 'Track orders',  text: 'track my orders' },
  { label: 'New project',   text: 'new project' },
  { label: 'New sample',    text: 'new sample order' },
];

export default function VoiceButton() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [flow, setFlow]         = useState<FlowState | null>(null);
  const [input, setInput]       = useState('');
  const [tts, setTts]           = useState(true);
  const [thinking, setThinking] = useState(false);
  const store = useAppStore();
  const location = useLocation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const llmEnabled = isLLMConfigured();

  const handleText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;

      const userMsg: Message = { id: `u${Date.now()}`, role: 'user', text, ts: Date.now() };

      // 1. Page-aware commands (e.g. /email "send", "regenerate", "attach …
      //    brochure") get first crack. If a page handler claims the input we
      //    skip the default assistant entirely.
      setMessages((prev) => [...prev, userMsg]);
      setInput('');

      const pageResponse = await tryPageVoiceCommand(text, { pathname: location.pathname });
      if (pageResponse !== null) {
        const botMsg: Message = { id: `b${Date.now()}`, role: 'assistant', text: pageResponse, ts: Date.now() };
        setMessages((prev) => [...prev, botMsg]);
        if (tts) speak(pageResponse);
        return;
      }

      // 2. Default assistant flow (intents + Gemini fallback).
      const snap = {
        customers:    store.customers,
        products:     store.products,
        sampleOrders: store.sampleOrders,
        projects:     store.projects,
      };
      const result = processMessage(text, flow, snap);
      setFlow(result.nextFlow);

      if (result.action) {
        if (result.action.type === 'add-project') {
          const { customerId, name, value } = result.action;
          store.addProject({
            id: `pr-${Date.now()}`,
            customerId, name, value,
            description: '',
            status: 'Lead',
            productIds: [],
            sampleOrderIds: [],
            notes: [],
            createdDate: new Date().toISOString().slice(0, 10),
          });
        } else if (result.action.type === 'add-sample') {
          const a = result.action;
          store.addSampleOrder({
            id: `so-${Date.now()}`,
            customerId:      a.customerId,
            projectId:       '',
            items:           [{ productId: a.productId, productName: a.productName, quantity: 1 }],
            status:          'Pending',
            orderedDate:     new Date().toISOString().slice(0, 10),
            shippingName:    a.customerName,
            shippingAddress: a.shippingAddress,
            shippingCity:    a.shippingCity,
            shippingState:   a.shippingState,
            shippingZip:     a.shippingZip,
          });
        }
      }

      let reply = result.response;
      if (result.unknown && llmEnabled) {
        setThinking(true);
        try {
          reply = await askLLM([...messages, userMsg], snap);
        } catch (err) {
          console.error('LLM call failed', err);
        } finally {
          setThinking(false);
        }
      }

      const botMsg: Message = { id: `b${Date.now()}`, role: 'assistant', text: reply, ts: Date.now() };
      setMessages((prev) => [...prev, botMsg]);
      if (tts) speak(reply);
    },
    [flow, store, tts, messages, llmEnabled, location.pathname],
  );

  const { listening, supported, start, stop } = useSpeechInput(handleText);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking, open]);

  useEffect(() => {
    if (!open) {
      stop();
      stopSpeaking();
    }
  }, [open, stop]);

  const toggleMic = () => (listening ? stop() : start());

  return (
    <>
      {/* ── Floating button ────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className={clsx(
          'fixed z-40 bottom-5 right-5 md:bottom-6 md:right-6',
          'w-14 h-14 rounded-full shadow-lg',
          'bg-accent text-white border border-accent-dim',
          'flex items-center justify-center',
          'hover:bg-accent-light hover:scale-105 active:scale-95 transition-all',
          open && 'opacity-0 pointer-events-none',
        )}
        aria-label="Open voice assistant"
        title="Voice assistant"
      >
        <Mic size={22} />
      </button>

      {/* ── Sheet ──────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end"
          onClick={() => setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm" />

          {/* Sheet body — bottom-sheet on mobile, side-panel on desktop */}
          <div
            className={clsx(
              'relative w-full md:w-[420px] md:h-full',
              'h-[80dvh] max-h-[80dvh]',
              'bg-surface border-t md:border-t-0 md:border-l border-divider',
              'rounded-t-2xl md:rounded-t-none',
              'flex flex-col overflow-hidden shadow-2xl',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-divider bg-surface-1 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center">
                  <Bot size={18} className="text-accent-light" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight text-fg">Voice Assistant</p>
                  <p className="text-xs text-fg-muted">
                    {thinking ? (
                      <span className="text-accent-light">Thinking…</span>
                    ) : listening ? (
                      <span className="text-danger">● Listening</span>
                    ) : flow ? (
                      <>Step: {flow.type.replace('-', ' ')}</>
                    ) : llmEnabled ? (
                      <>Ready · <span className="text-accent-light">Gemini-backed</span></>
                    ) : (
                      <>Ready — regex mode</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setTts((v) => !v); stopSpeaking(); }}
                  className="p-2 rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors"
                  title={tts ? 'Mute voice responses' : 'Unmute voice responses'}
                >
                  {tts ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && !flow && (
                <div className="flex gap-2 items-end justify-start">
                  <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                    <Bot size={13} className="text-accent-light" />
                  </div>
                  <div className="bg-surface-1 text-fg max-w-[78%] px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm leading-relaxed">
                    Tap the mic and tell me what you need — pipeline status, a new project, look up a product, or anything else.
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={clsx('flex gap-2 items-end', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                      <Bot size={13} className="text-accent-light" />
                    </div>
                  )}
                  <div className={clsx(
                    'max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'bg-accent text-white rounded-br-sm'
                      : 'bg-surface-1 text-fg rounded-bl-sm',
                  )}>
                    {m.text}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex gap-2 items-end justify-start">
                  <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                    <Bot size={13} className="text-accent-light" />
                  </div>
                  <div className="bg-surface-1 text-fg-muted italic px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm">
                    Thinking…
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick actions (until user engages) */}
            {messages.length === 0 && !flow && (
              <div className="px-4 py-3 border-t border-divider shrink-0">
                <p className="text-xs text-fg-faint mb-2 flex items-center gap-1"><Zap size={11} /> Quick actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map((q) => (
                    <button key={q.label} onClick={() => handleText(q.text)}
                      className="text-sm font-medium px-3 py-2.5 bg-bg text-fg rounded-xl border border-divider hover:bg-accent/10 hover:border-accent/40 hover:text-accent-light active:scale-95 transition-all text-left">
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input bar */}
            <div className="px-4 py-3 border-t border-divider flex items-center gap-2 shrink-0 bg-bg">
              <input
                className="flex-1 min-w-0 px-4 py-3 text-base border border-divider rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-fg-faint"
                placeholder={listening ? 'Listening…' : 'Type or tap mic…'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleText(input); }}
                autoFocus
              />
              <button
                onClick={() => handleText(input)}
                disabled={!input.trim()}
                className="p-3 bg-accent text-white rounded-xl hover:bg-accent-dim active:scale-95 disabled:opacity-30 transition-all shrink-0"
              >
                <Send size={18} />
              </button>
              {supported && (
                <button
                  onClick={toggleMic}
                  className={clsx(
                    'p-4 rounded-2xl transition-all active:scale-95 shrink-0',
                    listening
                      ? 'bg-danger text-white animate-pulse shadow-lg'
                      : 'bg-surface-2 text-fg border border-divider hover:bg-surface-2 hover:border-accent/40 hover:text-accent-light',
                  )}
                  aria-label={listening ? 'Stop listening' : 'Start voice input'}
                >
                  {listening ? <MicOff size={22} /> : <Mic size={22} />}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
