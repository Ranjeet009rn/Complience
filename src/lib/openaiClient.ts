export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chat(messages: ChatMessage[], options?: { model?: string; temperature?: number }) {
  const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || '';
  const FRONTEND_OPENAI_KEY = import.meta?.env?.VITE_OPENAI_API_KEY as string | undefined;

  const model = options?.model || 'gpt-4o-mini';
  const temperature = options?.temperature ?? 0.2;

  // If a frontend OpenAI key is deliberately provided, call OpenAI directly from the browser.
  // WARNING: This exposes the key to anyone who can access your app. Use only for personal/testing setups.
  if (FRONTEND_OPENAI_KEY) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FRONTEND_OPENAI_KEY}`,
      },
      body: JSON.stringify({ model, messages, temperature }),
    });
    if (!res.ok) {
      let msg = `OpenAI request failed: ${res.status}`;
      try {
        const err = await res.json();
        msg = err.error?.message || msg;
      } catch {
        void 0; // noop
      }
      const isProd = !!import.meta?.env?.PROD;
      throw new Error(isProd ? '' : msg);
    }
    const data = await res.json();
    const choice = data?.choices?.[0]?.message || null;
    return { message: choice, usage: data?.usage || null, id: data?.id };
  }

  // Default: call our backend API (recommended for production)
  const res = await fetch(`${API_BASE}/api/openai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, temperature }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error || `Request failed with ${res.status}`;
    const isProd = !!import.meta?.env?.PROD;
    throw new Error(isProd ? '' : msg);
  }
  return res.json();
}

export async function health() {
  const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || '';
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}
