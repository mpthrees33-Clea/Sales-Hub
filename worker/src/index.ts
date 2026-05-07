/// <reference types="@cloudflare/workers-types" />

export interface Env {
  GEMINI_API_KEY: string;
}

const SYSTEM_PROMPT = `You are the Sales Assistant for Trinity Surfaces, a flooring distributor based in Georgia. You help sales reps with their day — answering questions about their pipeline, customers, products, and sample orders.

Behavior:
- Keep responses short. 1–3 sentences, casual tone.
- The rep's live data is provided to you in JSON below. Use it to answer specific questions.
- If the data doesn't show the answer, say so plainly — do not invent customers, prices, or order statuses.
- Actions like creating projects or sample orders are handled separately. If the user asks to do one, tell them to say "new project" or "new sample order" and the system will walk them through it.`;

const ALLOWED_ORIGINS = [
  'https://mpthrees33-clea.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  snapshot?: unknown;
  knowledge?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405, headers: cors });
    }
    if (!env.GEMINI_API_KEY) {
      return jsonError('GEMINI_API_KEY not configured on the worker', 500, cors);
    }

    let body: ChatRequest;
    try {
      body = (await request.json()) as ChatRequest;
    } catch {
      return jsonError('Invalid JSON', 400, cors);
    }

    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    if (!messages.length) {
      return jsonError('messages array is required', 400, cors);
    }

    const systemBlocks = [SYSTEM_PROMPT];
    if (body.knowledge) systemBlocks.push(`Reference notes:\n${body.knowledge}`);
    if (body.snapshot)
      systemBlocks.push(`Live store data (JSON):\n${JSON.stringify(body.snapshot)}`);

    const contents = messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    const geminiUrl =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' +
      encodeURIComponent(env.GEMINI_API_KEY);

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemBlocks.join('\n\n') }] },
        contents,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 300,
        },
      }),
    });

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      return jsonError(`Gemini API ${geminiRes.status}`, 502, cors, detail);
    }

    const data = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';

    return new Response(JSON.stringify({ text: text || '(no response)' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};

function jsonError(
  message: string,
  status: number,
  cors: Record<string, string>,
  detail?: string,
): Response {
  return new Response(JSON.stringify({ error: message, detail }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
