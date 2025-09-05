import { useMemo, useState } from 'react';
import { Wrench, Upload, FileText, ListPlus, Loader2 } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';

function KeyToolsPage() {
  const { addNotification } = useNotifications();
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState('');

  const words = useMemo(() => extractedText.trim().split(/\s+/).filter(Boolean).length, [extractedText]);

  async function handleExtract() {
    if (!file) {
      addNotification({ title: 'Select a file', message: 'Please choose a PDF/DOCX file first.' });
      return;
    }
    try {
      setExtracting(true);
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload/extract', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to extract');
      setExtractedText(data.text || '');
      addNotification({ title: 'Extracted', message: `${(data.text || '').length} chars` });
    } catch (err: any) {
      addNotification({ title: 'Extract failed', message: err.message || String(err) });
    } finally {
      setExtracting(false);
    }
  }

  async function handleCreateSampleTasks() {
    try {
      const now = new Date();
      const payloads = [
        {
          title: 'Follow-up on RBI Circular',
          description: 'Prepare short compliance note and list impacted processes.',
          status: 'Pending',
          priority: 'High',
          due_date: new Date(now.getTime() + 5 * 86400000).toISOString(),
          created_at: now.toISOString(),
          assigned_to: 'nilesh-1',
          assigned_by: 'system',
          type: 'Maker',
          circular_id: 'rbi',
          source: 'key_tools',
        },
        {
          title: 'Draft Implementation Plan',
          description: 'Define milestones and owners for new obligations.',
          status: 'Pending',
          priority: 'Medium',
          due_date: new Date(now.getTime() + 10 * 86400000).toISOString(),
          created_at: now.toISOString(),
          assigned_to: 'nilesh-1',
          assigned_by: 'system',
          type: 'Checker',
          circular_id: 'rbi',
          source: 'key_tools',
        },
      ];
      for (const p of payloads) {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to create task');
      }
      addNotification({ title: 'Tasks created', message: 'Sample tasks added.' });
    } catch (err: any) {
      addNotification({ title: 'Create tasks failed', message: err.message || String(err) });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-amber-600 rounded-md flex items-center justify-center">
          <Wrench className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Key Tools</h1>
          <p className="text-sm text-gray-500">Quick utilities to speed up your workflow</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4 border-b flex items-center space-x-2">
            <Upload className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Extract text from document (Server)</h3>
          </div>
          <div className="p-4 space-y-3">
            <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => setFile(e.target.files?.[0] || null)} />
            <div className="flex items-center gap-3">
              <button
                onClick={handleExtract}
                disabled={extracting}
                className="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 inline-flex items-center"
              >
                {extracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />} Extract
              </button>
              <span className="text-sm text-gray-500">{words} words</span>
            </div>
            <textarea className="w-full h-48 border rounded-md p-2 text-sm" value={extractedText} readOnly />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4 border-b flex items-center space-x-2">
            <ListPlus className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Bulk create sample tasks</h3>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-600">Adds a couple of example tasks to help you get started.</p>
            <button onClick={handleCreateSampleTasks} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">Create Sample Tasks</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KeyToolsPage;
