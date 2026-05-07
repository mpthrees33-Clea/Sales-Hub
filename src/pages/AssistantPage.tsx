import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Bot, Volume2, VolumeX, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../store/useAppStore';
import { processMessage, type Message, type FlowState } from '../lib/assistant';
import { useSpeechInput, speak, stopSpeaking } from '../hooks/useSpeech';

const QUICK_ACTIONS = [
  { label: '+ New Project',      text: 'new project' },
  { label: '+ Sample Order',     text: 'new sample order' },
  { label: 'My Pipeline',        text: 'show my pipeline' },
  { label: 'Track Orders',       text: 'track my orders' },
];

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  ts: 0,
  text: "Hi! I'm your hands-free sales assistant. I can add projects, create sample orders, look up products, and summarize your pipeline. Tap the mic or type a command — or use a quick action below.",
};

export default function AssistantPage() {
  const store = useAppStore();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [flow, setFlow]         = useState<FlowState | null>(null);
  const [input, setInput]       = useState('');
  const [tts, setTts]           = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleText = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;

      const userMsg: Message = { id: `u${Date.now()}`, role: 'user', text, ts: Date.now() };
      const snap = {
        customers:    store.customers,
        products:     store.products,
        sampleOrders: store.sampleOrders,
        projects:     store.projects,
      };
      const result = processMessage(text, flow, snap);
      const botMsg: Message = { id: `b${Date.now()}`, role: 'assistant', text: result.response, ts: Date.now() };

      setMessages((prev) => [...prev, userMsg, botMsg]);
      setFlow(result.nextFlow);
      setInput('');

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

      if (tts) speak(result.response);
    },
    [flow, store, tts],
  );

  const { listening, supported, start, stop } = useSpeechInput(handleText);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleMic = () => (listening ? stop() : start());

  return (
    <div className="flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden"
      style={{ height: 'calc(100dvh - 7rem)' }}>

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-blue-700 to-blue-600 text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Sales Assistant</p>
            <p className="text-xs text-blue-200">
              {listening ? '🎤 Listening…' : flow ? `Step: ${flow.type.replace('-', ' ')}` : 'Ready — speak or type'}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setTts((v) => !v); stopSpeaking(); }}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          title={tts ? 'Mute voice responses' : 'Unmute voice responses'}
        >
          {tts ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

      {/* ── Messages ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={clsx('flex gap-2 items-end', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Bot size={13} className="text-blue-600" />
              </div>
            )}
            <div className={clsx(
              'max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-slate-100 text-slate-800 rounded-bl-sm',
            )}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Quick actions (shown until user engages) ──────── */}
      {messages.length <= 3 && !flow && (
        <div className="px-4 py-3 border-t border-slate-100 shrink-0">
          <p className="text-xs text-slate-400 mb-2 flex items-center gap-1"><Zap size={11} /> Quick actions</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((q) => (
              <button key={q.label} onClick={() => handleText(q.text)}
                className="text-sm font-medium px-3 py-2.5 bg-slate-50 text-slate-700 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 active:scale-95 transition-all text-left">
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input bar ─────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-slate-200 flex items-center gap-2 shrink-0 bg-slate-50">
        <input
          className="flex-1 min-w-0 px-4 py-3 text-base border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
          placeholder={listening ? 'Listening…' : 'Type a command…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleText(input); }}
        />
        <button
          onClick={() => handleText(input)}
          disabled={!input.trim()}
          className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 disabled:opacity-30 transition-all shrink-0"
        >
          <Send size={18} />
        </button>
        {supported && (
          <button
            onClick={toggleMic}
            className={clsx(
              'p-4 rounded-2xl transition-all active:scale-95 shrink-0',
              listening
                ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse'
                : 'bg-slate-800 text-white hover:bg-slate-700 shadow-md',
            )}
            aria-label={listening ? 'Stop listening' : 'Start voice input'}
          >
            {listening ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
        )}
      </div>
    </div>
  );
}
