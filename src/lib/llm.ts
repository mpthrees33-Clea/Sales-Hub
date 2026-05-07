import type { Message } from './assistant';
import type { Customer, Product, SampleOrder, Project } from '../types';

const WORKER_URL = import.meta.env.VITE_ASSISTANT_API_URL ?? '';

export interface LLMSnapshot {
  customers: Customer[];
  products: Product[];
  sampleOrders: SampleOrder[];
  projects: Project[];
}

export function isLLMConfigured(): boolean {
  return Boolean(WORKER_URL);
}

export async function askLLM(
  messages: Message[],
  snapshot: LLMSnapshot,
  signal?: AbortSignal,
): Promise<string> {
  if (!WORKER_URL) {
    throw new Error('Assistant API URL not configured');
  }

  const trimmed = messages.slice(-10).map((m) => ({ role: m.role, text: m.text }));

  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: trimmed, snapshot: trimSnapshot(snapshot) }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Assistant API ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as { text?: string };
  return data.text?.trim() || '(no response)';
}

function trimSnapshot(s: LLMSnapshot): LLMSnapshot {
  return {
    customers: s.customers.slice(0, 50),
    products: s.products.slice(0, 50),
    sampleOrders: s.sampleOrders.slice(0, 30),
    projects: s.projects.slice(0, 30),
  };
}
