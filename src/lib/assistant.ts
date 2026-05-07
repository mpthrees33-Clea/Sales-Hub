import type { Customer, Product, SampleOrder, Project } from '../types';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

export interface FlowState {
  type: 'new-project' | 'new-sample';
  step: number;
  data: Record<string, string>;
}

export interface StoreSnapshot {
  customers: Customer[];
  products: Product[];
  sampleOrders: SampleOrder[];
  projects: Project[];
}

export type AssistantAction =
  | { type: 'add-project'; customerId: string; name: string; value: number }
  | { type: 'add-sample'; customerId: string; customerName: string; productId: string; productName: string; shippingAddress: string; shippingCity: string; shippingState: string; shippingZip: string };

export interface ProcessResult {
  response: string;
  nextFlow: FlowState | null;
  action?: AssistantAction;
}

function findCustomer(q: string, customers: Customer[]): Customer | undefined {
  const lq = q.toLowerCase();
  return customers.find(
    (c) => c.name.toLowerCase().includes(lq) || c.company.toLowerCase().includes(lq),
  );
}

function findProduct(q: string, products: Product[]): Product | undefined {
  const lq = q.toLowerCase();
  return products.find(
    (p) =>
      p.trinityName.toLowerCase().includes(lq) ||
      p.trinitySku.toLowerCase().includes(lq) ||
      p.category.toLowerCase().includes(lq) ||
      p.privateLabels.some(
        (pl) =>
          pl.brand.toLowerCase().includes(lq) ||
          pl.productName.toLowerCase().includes(lq) ||
          pl.sku.toLowerCase().includes(lq),
      ),
  );
}

function parseAmount(text: string): number {
  const kMatch = text.replace(/[$,]/g, '').match(/([\d.]+)\s*k/i);
  if (kMatch) return parseFloat(kMatch[1]) * 1000;
  const numMatch = text.replace(/[$,]/g, '').match(/[\d.]+/);
  if (numMatch) return parseFloat(numMatch[0]);
  return 0;
}

function fmt$(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n.toFixed(0)}`;
}

function detectIntent(t: string): string {
  if (/(new|add|create|log).{0,10}(project|opportunity|lead)/.test(t)) return 'new-project';
  if (/(new|add|create|order).{0,10}sample|(sample).{0,10}(order|request)/.test(t)) return 'new-sample';
  if (/(track|status|where).{0,15}(order|sample)|(order|sample).{0,15}(status|where|tracking)/.test(t)) return 'track';
  if (/(pipeline|active project|my project|show project|list project|how many project|summary)/.test(t)) return 'pipeline';
  if (/(look up|find|price of|how much|what.{0,10}cost|search)/.test(t)) return 'lookup';
  if (/\bhelp\b/.test(t)) return 'help';
  return 'unknown';
}

export function processMessage(
  text: string,
  flow: FlowState | null,
  snap: StoreSnapshot,
): ProcessResult {
  const t = text.toLowerCase().trim();

  if (/^(cancel|stop|nevermind|never mind|quit|exit|abort)$/.test(t)) {
    return { response: 'No problem — cancelled. What can I help you with?', nextFlow: null };
  }

  // ── Active flow ───────────────────────────────────────────
  if (flow?.type === 'new-project') {
    const d = flow.data;
    if (flow.step === 0) {
      const cust = findCustomer(text, snap.customers);
      if (!cust) return { response: `Couldn't find a customer named "${text}". Try their company name or full name.`, nextFlow: flow };
      return { response: `Got it — ${cust.name} at ${cust.company}. What's the project name?`, nextFlow: { ...flow, step: 1, data: { ...d, customerId: cust.id, customerName: cust.name } } };
    }
    if (flow.step === 1) {
      return { response: `"${text}" — perfect. What's the estimated project value? Say a dollar amount.`, nextFlow: { ...flow, step: 2, data: { ...d, name: text } } };
    }
    if (flow.step === 2) {
      const value = parseAmount(text);
      if (!value) return { response: "Didn't catch that dollar amount. Try something like 50 thousand or $25,000.", nextFlow: flow };
      return {
        response: `Done! Created project "${d.name}" for ${d.customerName} — ${fmt$(value)}, status: Lead. Check your CRM.`,
        nextFlow: null,
        action: { type: 'add-project', customerId: d.customerId, name: d.name, value },
      };
    }
  }

  if (flow?.type === 'new-sample') {
    const d = flow.data;
    if (flow.step === 0) {
      const cust = findCustomer(text, snap.customers);
      if (!cust) return { response: `Couldn't find "${text}". Try a different name or company.`, nextFlow: flow };
      return { response: `${cust.name}. What product are you ordering? Say the Trinity name or any brand name.`, nextFlow: { ...flow, step: 1, data: { ...d, customerId: cust.id, customerName: cust.name } } };
    }
    if (flow.step === 1) {
      const prod = findProduct(text, snap.products);
      if (!prod) return { response: `Couldn't find "${text}". Try a different name or brand.`, nextFlow: flow };
      const addr = snap.customers.find((c) => c.id === d.customerId)?.shipToAddresses?.[0];
      return {
        response: `Sample order created for ${prod.trinityName}, shipping to ${d.customerName}. Status: Pending — check Sample Orders.`,
        nextFlow: null,
        action: {
          type: 'add-sample', customerId: d.customerId, customerName: d.customerName,
          productId: prod.id, productName: prod.trinityName,
          shippingAddress: addr?.address ?? '', shippingCity: addr?.city ?? '',
          shippingState: addr?.state ?? '', shippingZip: addr?.zip ?? '',
        },
      };
    }
  }

  // ── Intent detection ──────────────────────────────────────
  const intent = detectIntent(t);

  if (intent === 'new-project') return { response: "Let's add a project. Who's the customer?", nextFlow: { type: 'new-project', step: 0, data: {} } };
  if (intent === 'new-sample') return { response: "New sample order! Who is it for?", nextFlow: { type: 'new-sample', step: 0, data: {} } };

  if (intent === 'track') {
    const recent = [...snap.sampleOrders].sort((a, b) => b.orderedDate.localeCompare(a.orderedDate)).slice(0, 4);
    if (!recent.length) return { response: 'No sample orders on record yet.', nextFlow: null };
    const lines = recent.map((o) => {
      const cust = snap.customers.find((c) => c.id === o.customerId);
      return `${cust?.company ?? 'Unknown'}: ${o.status}${o.trackingNumber ? `, tracking ${o.trackingNumber}` : ''}`;
    });
    return { response: `Recent orders — ${lines.join('. ')}.`, nextFlow: null };
  }

  if (intent === 'pipeline') {
    const open = snap.projects.filter((p) => ['Lead', 'Active', 'Quoted'].includes(p.status));
    const total = open.reduce((s, p) => s + p.value, 0);
    const counts = { Lead: 0, Active: 0, Quoted: 0 };
    open.forEach((p) => { if (p.status in counts) counts[p.status as keyof typeof counts]++; });
    return { response: `Pipeline: ${open.length} open projects totaling ${fmt$(total)}. Leads: ${counts.Lead}, Active: ${counts.Active}, Quoted: ${counts.Quoted}.`, nextFlow: null };
  }

  if (intent === 'lookup') {
    const query = text.replace(/(look up|find|price of|how much is|what does|cost|search|for me)/gi, '').trim();
    const prod = findProduct(query || text, snap.products);
    if (!prod) return { response: `No product matched "${query}". Try a brand name, category, or product name.`, nextFlow: null };
    const aliases = prod.privateLabels.map((pl) => `${pl.brand} ${pl.productName}`).join(', ');
    return { response: `${prod.trinityName}: list $${prod.listPrice} per ${prod.unit}. Also known as: ${aliases}.`, nextFlow: null };
  }

  if (intent === 'help') {
    return { response: "I can help with: new project, new sample order, track orders, pipeline summary, or product price lookup. What do you need?", nextFlow: null };
  }

  return { response: "I didn't catch that. Try: new project, new sample order, track orders, my pipeline, or look up a product.", nextFlow: null };
}
