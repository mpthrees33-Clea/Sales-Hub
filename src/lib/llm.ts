import type { Message } from './assistant';
import type { Customer, Product, SampleOrder, Project } from '../types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are the Sales Assistant for Trinity Surfaces, a flooring distributor based in Georgia. You help sales reps with their day — answering questions about their pipeline, customers, products, and sample orders.

Behavior:
- Keep responses short. 1–3 sentences, casual tone.
- The rep's live data is provided to you below as JSON. Use it to answer specific questions.
- If the data doesn't show the answer, say so plainly — do not invent customers, prices, or order statuses.
- Actions like creating projects or sample orders are handled by a separate flow. If the user asks to do one, tell them to say "new project" or "new sample order" and the system will walk them through it.`;

export interface LLMSnapshot {
  customers: Customer[];
  products: Product[];
  sampleOrders: SampleOrder[];
  projects: Project[];
}

export function isLLMConfigured(): boolean {
  return Boolean(GEMINI_API_KEY);
}

export async function askLLM(
  messages: Message[],
  snapshot: LLMSnapshot,
  signal?: AbortSignal,
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY not configured');
  }

  const history = messages.slice(-10).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));

  const systemText = `${SYSTEM_PROMPT}\n\nLive store data (JSON):\n${JSON.stringify(trimSnapshot(snapshot))}`;

  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: history,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 300,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  return text.trim() || '(no response)';
}

function trimSnapshot(s: LLMSnapshot): LLMSnapshot {
  return {
    customers: s.customers.slice(0, 50),
    products: s.products.slice(0, 50),
    sampleOrders: s.sampleOrders.slice(0, 30),
    projects: s.projects.slice(0, 30),
  };
}
