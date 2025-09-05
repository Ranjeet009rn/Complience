import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { chat, health, type ChatMessage } from '../lib/openaiClient';

type AppSettings = {
  openaiKey?: string;
  autoAnalyze: boolean;
};

const SETTINGS_KEY = 'app_settings';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { autoAnalyze: true };
    const parsed = JSON.parse(raw);
    return { autoAnalyze: true, ...parsed } as AppSettings;
  } catch {
    return { autoAnalyze: true };
  }
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

const Settings: React.FC = () => {
  const [openaiKey, setOpenaiKey] = useState<string>('');
  const [autoAnalyze, setAutoAnalyze] = useState<boolean>(true);
  const [saved, setSaved] = useState<string>('');
  const [aiPrompt, setAiPrompt] = useState<string>('Say hello from the compliance dashboard.');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [apiHealth, setApiHealth] = useState<string>('unknown');

  useEffect(() => {
    const s = loadSettings();
    setOpenaiKey(s.openaiKey || '');
    setAutoAnalyze(s.autoAnalyze);
  }, []);

  const maskedKey = useMemo(() => {
    if (!openaiKey) return '';
    if (openaiKey.length <= 8) return '*'.repeat(openaiKey.length);
    return openaiKey.slice(0, 4) + '****' + openaiKey.slice(-4);
  }, [openaiKey]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({ openaiKey, autoAnalyze });
    setSaved('Saved!');
    setTimeout(() => setSaved(''), 1500);
  };

  const checkHealth = async () => {
    try {
      setApiHealth('checking...');
      const h = await health();
      setApiHealth(h?.ok ? 'ok' : 'error');
    } catch (e) {
      setApiHealth('error');
    }
  };

  const runAiTest = async () => {
    setAiLoading(true);
    setAiResponse('');
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a concise compliance assistant.' },
        { role: 'user', content: aiPrompt || 'Hello' },
      ];
      const res = await chat(messages, { model: 'gpt-4o-mini', temperature: 0.2 });
      const content = res?.message?.content || '[no content]';
      setAiResponse(typeof content === 'string' ? content : JSON.stringify(content));
    } catch (e: any) {
      setAiResponse(e?.message || 'Request failed');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-2" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1">
          <li>
            <Link to="/" className="hover:text-gray-700">Dashboard</Link>
          </li>
          <li className="px-1 text-gray-400">&gt;</li>
          <li className="text-gray-700 font-medium">Settings</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold mb-4">Settings</h1>

      <form onSubmit={handleSave} className="max-w-xl bg-white rounded-lg border border-gray-100 shadow-sm p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">OpenAI API Key</label>
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder={maskedKey || 'sk-...'}
            className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-gray-500">Stored locally in your browser (localStorage). For production, use server-side secrets.</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="autoAnalyze"
            type="checkbox"
            checked={autoAnalyze}
            onChange={(e) => setAutoAnalyze(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="autoAnalyze" className="text-sm text-gray-700">Auto-analyze immediately after extracting PDF text</label>
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">Save</button>
          {saved && <span className="text-sm text-green-700">{saved}</span>}
        </div>
      </form>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">AI Test</h2>
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={checkHealth}
            className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded text-sm hover:bg-gray-200"
          >
            Check API Health
          </button>
          <span className={`text-sm ${apiHealth === 'ok' ? 'text-green-600' : apiHealth === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
            {apiHealth}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 space-y-3 max-w-2xl">
          <label className="block text-sm font-medium text-gray-700">Prompt</label>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="w-full min-h-[90px] rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={runAiTest}
            disabled={aiLoading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {aiLoading ? 'Running...' : 'Run AI Test'}
          </button>
          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">Response</div>
            <pre className="text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200">{aiResponse || '—'}</pre>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500 max-w-2xl">
          The AI test calls the backend at <code>/api/openai/chat</code>. Ensure the Node server is running and the <code>OPENAI_API_KEY</code> is set in your <code>.env</code> (server-side).
        </p>
      </div>
    </div>
  );
};

export default Settings;
