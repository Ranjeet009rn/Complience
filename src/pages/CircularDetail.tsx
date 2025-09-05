import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { useNotifications } from '../context/NotificationsContext';
import { banks as banksData } from '../data/banks';

// Set worker source for PDF.js (match installed version)
const pdfWorkerUrl = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Types
interface Bank {
  id: string | number;
  name: string;
  type?: string;
}

interface CircularDetailProps {
  // Add any props here if needed
}

declare global {
  interface Window {
    Tesseract: any;
    pdfjsLib: any;
  }
}

// Tesseract is available globally through CDN

// Utility: trim text length to control token usage
function prepareTextForAI(text: string, maxChars = 8000): string {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

function isWordFile(f: File): boolean {
  const t = (f.type || '').toLowerCase();
  const n = (f.name || '').toLowerCase();
  return (
    t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    t === 'application/msword' ||
    n.endsWith('.docx') ||
    n.endsWith('.doc')
  );
}

const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || '';

async function extractTextFromPdfViaOCR(file: File): Promise<string> {
  try {
    const pdf = await getDocument(await file.arrayBuffer()).promise;
    const textParts: string[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Could not create canvas context');
      }
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      const ocrText = await ocrCanvas(canvas, 'eng');
      if (ocrText) {
        textParts.push(ocrText);
      }
    }
    
    return textParts.join('\n\n').trim();
  } catch (error) {
    console.error('Error in extractTextFromPdfViaOCR:', error);
    return '';
  }
}

async function extractWordViaServer(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_BASE}/api/upload/extract`, { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(data?.error || `Upload extract failed (${res.status})`);
  }
  return (data?.text || '').trim();
}

// Utility: wait until a condition is true or timeout
async function waitFor(condition: () => boolean, timeoutMs = 6000, intervalMs = 150) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) break;
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

// PDF.js types
type PDFDocumentLoadingTask = any; // Placeholder type for PDF.js loading task

// PDF.js and Tesseract are loaded via CDN

async function ocrImageBlob(blob: Blob, lang = 'eng'): Promise<string> {
  const w = (window as any);
  if (!w.Tesseract) throw new Error('OCR engine not ready');
  const imageUrl = URL.createObjectURL(blob);
  try {
    const result = await w.Tesseract.recognize(imageUrl, lang, { logger: () => {} });
    return (result?.data?.text || '').trim();
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function ocrCanvas(canvas: HTMLCanvasElement, lang = 'eng'): Promise<string> {
  const w = (window as any);
  if (!w.Tesseract) throw new Error('OCR engine not ready');
  const dataUrl = canvas.toDataURL('image/png');
  const result = await w.Tesseract.recognize(dataUrl, lang, { logger: () => {} });
  return (result?.data?.text || '').trim();
}

async function extractPdfText(data: ArrayBuffer | Uint8Array): Promise<string> {
  try {
    // Always provide a fresh Uint8Array to avoid detached ArrayBuffer issues inside pdf.js
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const task: PDFDocumentLoadingTask = getDocument({ 
      data: bytes,
      // Enable enhanced text extraction
      cMapUrl: 'https://unpkg.com/pdfjs-dist@3.4.120/cmaps/',
      cMapPacked: true,
    });
    
    const pdf = await task.promise;
    let fullText = '';
    let isScanned = false;
    
    // First pass: Try to extract text directly
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const strings = content.items.map((it: any) => ('str' in it ? it.str : (it?.unicode || '')));
      const pageText = strings.join(' ').trim();
      
      // If we get very little text, the page might be scanned
      if (pageText.length < 50) {
        isScanned = true;
        break;
      }
      fullText += pageText + '\n\n';
    }
    
    // If we have enough text, return it
    if (!isScanned && fullText.trim().length > 0) {
      return fullText.trim();
    }
    
    // Second pass: Use OCR for scanned PDFs
    console.log('PDF appears to be scanned, attempting OCR...');
    fullText = '';
    const scale = 2; // Higher scale for better OCR accuracy
    
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        console.error('Could not create canvas context');
        continue;
      }
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Render PDF page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      await page.render(renderContext).promise;
      
      // Use OCR to extract text from the canvas
      const pageText = await ocrCanvas(canvas);
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error('Failed to extract text from PDF. The file might be corrupted or password protected.');
  }
}

const CircularDetail: React.FC<CircularDetailProps> = (): JSX.Element => {
  // Hooks
  const { id } = useParams<{ id: string }>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [applicable, setApplicable] = useState<boolean | null>(null);
  const [defaultBank, setDefaultBank] = useState<Bank | null>(null);
  const { addNotification } = useNotifications();
  const seedBanks = banksData;
  
    // State
  const [extracted, setExtracted] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [error, setError] = useState('');
  const [analysisJson, setAnalysisJson] = useState<Record<string, any> | null>(null);
  const [fileName, setFileName] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pdfReady, setPdfReady] = useState<boolean>(false);
  const [ocrReady, setOcrReady] = useState<boolean>(false);

  // Tasks state (minimal client-side management)
  type CircularTask = {
    id: string;
    title: string;
    description: string;
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
    due_date: string; // ISO date string
    status: 'Pending' | 'In Progress' | 'Completed' | 'Rejected';
  };
  const [circularTasks, setCircularTasks] = useState<CircularTask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Low');
  const [newDue, setNewDue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  
  // Memoized values
  const sessionHasInput = useMemo(() => {
    return extracted.trim().length > 0 || (aiResult || '').trim().length > 0;
  }, [extracted, aiResult]);

  // Tasks: handlers used by JSX
  const addManualTask = useCallback(() => {
    const title = newTitle.trim();
    if (!title) return;
    const t: CircularTask = {
      id: crypto.randomUUID(),
      title,
      description: newDesc.trim(),
      priority: newPriority,
      due_date: newDue || new Date().toISOString().slice(0, 10),
      status: 'Pending',
    };
    setCircularTasks(prev => [t, ...prev]);
    setNewTitle('');
    setNewDesc('');
    setNewPriority('Low');
    setNewDue('');
    try { addNotification({ title: 'Task added', message: `Created task: ${t.title}` }); } catch {}
  }, [newTitle, newDesc, newPriority, newDue, setCircularTasks, setNewTitle, setNewDesc, setNewPriority, setNewDue, addNotification]);

  const updateCircularTask = useCallback((taskId: string, patch: Partial<CircularTask>) => {
    setCircularTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t));
  }, []);

  const acceptTaskAndGo = useCallback((taskId: string) => {
    updateCircularTask(taskId, { status: 'In Progress' });
  }, [updateCircularTask]);

  const deleteCircularTask = useCallback((taskId: string) => {
    setCircularTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  // Initialize default bank
  useEffect(() => {
    // Set a default bank if needed
    const defaultBank: Bank = {
      id: 'default',
      name: 'Default Bank',
      type: 'commercial'
    };
    setDefaultBank(defaultBank);
    
    // Cleanup function
    return () => {
      // Any cleanup if needed
    };
  }, []);

  // Library readiness
  useEffect(() => {
    try {
      setPdfReady(!!(window as any).pdfjsLib);
    } catch {}
    try {
      setOcrReady(!!(window as any).Tesseract);
    } catch {}
  }, []);
  
  // Helper function to build analysis prompts
  const buildAnalysisPrompts = (text: string) => {
    return {
      system: 'You are an AI assistant that analyzes regulatory circulars.',
      userMsg: `Analyze this circular and extract key information: ${text.substring(0, 1000)}...`
    };
  };
  
  // Handle file processing (old simple stub removed)

  // Helper function to parse JSON safely
  const parseJsonStrict = (jsonString: string) => {
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      return null;
    }
  };

  // Handle AI analysis
  const handleAnalyze = useCallback(async (text?: string): Promise<string> => {
    try {
      const contentToAnalyze = (text ?? extracted ?? '').trim();
      if (!contentToAnalyze) {
        setError('No text to analyze');
        return '';
      }

      setError('');
      setAiResult('');
      setAiLoading(true);

      const prepared = prepareTextForAI(contentToAnalyze);
      const { system, userMsg } = buildAnalysisPrompts(prepared);

      const payload = {
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg },
        ],
      } as const;

      const res = await fetch(`${API_BASE || ''}/api/openai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({} as any));
      if (res.status === 429) {
        const msg = data?.error || 'OpenAI rate limit or quota exceeded (429). Please check your OpenAI plan/billing or try again later.';
        addNotification({ type: 'error', title: 'OpenAI rate limit', message: msg });
        throw new Error(msg);
      }
      if (!res.ok) {
        throw new Error(data?.error || `AI analyze failed (${res.status})`);
      }

      const content = (data?.message && data.message.content) ? String(data.message.content) : '';
      const trimmed = content.trim();

      // Strictly reject any stubbed/dev content
      if (/stub on error|development stub|dev stub/i.test(trimmed)) {
        throw new Error('AI returned stubbed content. Please ensure OPENAI_API_KEY is set on the server.');
      }

      const parsed = parseJsonStrict(trimmed);
      if (parsed) {
        setAnalysisJson(parsed);
        setApplicable(parsed?.meta?.bank_context?.applicable ?? null);
        return parsed.summary || 'Analysis complete';
      }

      // Fallback to raw content if JSON parsing failed
      setAnalysisJson(null);
      setAiResult(trimmed);
      return trimmed || 'Analysis complete (unstructured)';
    } catch (err) {
      console.error('Analysis error:', err);
      setAnalysisJson(null);
      setApplicable(null);
      const msg = (err as any)?.message || 'Failed to analyze document';
      setError(msg);
      try {
        addNotification({ title: 'AI analysis failed', message: msg });
      } catch {}
      return 'Analysis failed';
    } finally {
      setAiLoading(false);
    }
  }, [extracted, setError, setAiResult, setAnalysisJson, setAiLoading, setApplicable, addNotification]);
  
  // Removed unused run() helper that previously auto-analyzed after extraction. Analysis is now strictly user-triggered.

  // Initialize PDF.js worker
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.pdfjsLib = window.pdfjsLib || {};
      window.pdfjsLib.workerSrc = pdfWorkerUrl;
    }
  }, []);

  // Derived state
  const title = useMemo(() => (id ? id.toUpperCase() : 'CIRCULAR'), [id]);
  // Utility: clear input and UI
  const resetInput = useCallback(() => {
    try { if (inputRef.current) inputRef.current.value = ''; } catch {}
    setPendingFile(null);
    setFileName('');
  }, []);

  const clearInputAndState = useCallback(() => {
    resetInput();
    setError('');
    setExtracted('');
    setAiResult('');
    setAnalysisJson(null);
  }, [resetInput]);

  // If there is no session input, clear the extracted text and AI result
  useEffect(() => {
    if (!sessionHasInput) {
      setExtracted('');
      setAiResult('');
      setAnalysisJson(null);
    }
  }, [sessionHasInput, id]);

  // Load default bank from localStorage (applicability is decided after analysis)
  useEffect(() => {
    try {
      const defId = localStorage.getItem('bank_setup_default_bank_id');
      let list: Bank[] = [];
      try {
        const raw = localStorage.getItem('bank_setup_banks');
        const parsed = raw ? JSON.parse(raw) : [];
        list = Array.isArray(parsed) && parsed.length ? parsed : seedBanks;
      } catch {
        list = seedBanks;
      }
      const def = list.find((b: any) => String(b?.id) === String(defId)) || null;
      setDefaultBank(def);
      setApplicable(null);
    } catch {
      setDefaultBank(null);
      setApplicable(null);
    }
}, [id]);

// ...

// Function to check if text contains circular indicators
const isLikelyCircular = (text: string): boolean => {
  if (!text) return false;
  const circularIndicators = [
    /circular/i,
    /reference no\.?/i,
    /rbi|sebi|irdai|pfrda|nbfc|banking|regulation|compliance/i,
    /dear sir.?madam/i,
    /all scheduled commercial banks|all banks|all nbfcs?/i,
    /master circular|master direction|regulatory framework/i,
    /[A-Z]{2,4}\/\d{2,4}[-/]\d{2,4}/ // Matches patterns like RBI/2025/01
  ];
  
  // Check first 2000 characters for better performance
  const sampleText = text.slice(0, 2000).toLowerCase();
  return circularIndicators.some(pattern => pattern.test(sampleText));
};

// Handle file change (validation + set pending)
const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
  const f = e.target.files?.[0];
  if (!f) {
    setError('No file selected');
    return;
  }
  const validTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp'
  ];
  if (!validTypes.includes(f.type) && !/\.(pdf|docx?|png|jpe?g|webp)$/i.test(f.name)) {
    setError('Please upload a valid PDF, Word document, or image file');
    return;
  }
  setLoading(true);
  setFileName(f.name);
  try {
    let extractedText = '';
    if (f.type === 'application/pdf') {
      const arrayBuffer = await f.arrayBuffer();
      extractedText = await extractPdfText(new Uint8Array(arrayBuffer));
    } else if (isWordFile(f)) {
      extractedText = await extractWordViaServer(f);
    } else if (f.type.startsWith('image/')) {
      extractedText = await ocrImageBlob(f);
    }
    if (!isLikelyCircular(extractedText)) {
      const errorMsg = 'The uploaded document does not appear to be a circular. Please upload a valid circular document.';
      setError(errorMsg);
      try { addNotification({ title: 'Invalid Circular Document', message: errorMsg }); } catch {}
      return;
    }
    setPendingFile(f);
    try { addNotification({ title: 'Circular Detected', message: 'Processing circular document...' }); } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (err) {
    console.error('Error during file validation:', err);
    setError(`Error processing file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    resetInput();
  } finally {
    setLoading(false);
  }
}, [addNotification, resetInput]);

  // "Re-run (ignore cache)" handler used in JSX
  const rerunAnalysisFresh = useCallback(async () => {
    if (!extracted.trim()) return;
    await handleAnalyze(extracted);
  }, [extracted, handleAnalyze]);

  // Effect to handle file processing when pendingFile changes
  useEffect(() => {
    if (!pendingFile) return;
    
    const processFile = async () => {
      const file = pendingFile;
      if (!file) return;
      
      try {
        setLoading(true);
        setError('');
        // Clear any previous analysis/results so a new upload starts clean
        setAiResult('');
        setAnalysisJson(null);
        setApplicable(null);
        
        let text = '';
        
        if (isWordFile(file)) {
          text = await extractWordViaServer(file);
        } else if (file.type === 'application/pdf') {
          text = await extractPdfText(await file.arrayBuffer());
          
          // If text extraction from PDF yields very little text, try OCR
          if (text.trim().length < 100) {
            text = await extractTextFromPdfViaOCR(file);
          }
        }
        
        setExtracted(text);
        // Do not auto-analyze; require clicking the Action button
      } catch (err) {
        console.error('Error processing file:', err);
        setError('Failed to process document');
      } finally {
        setLoading(false);
      }
    };
    
    processFile();
  }, [pendingFile]);

  // Clean up effect
  useEffect(() => {
    return () => {
      // Cleanup function if needed
    };
  }, []);

  // Explicit task creation from the current analysis
  const createAiTasksNow = useCallback(async () => {
    // Require prior analysis
    if (!analysisJson) {
      try { addNotification({ title: 'Run analysis first', message: 'Click Action to analyze the document before creating tasks.' }); } catch {}
      return;
    }
    if (applicable !== true) {
      try { addNotification({ title: 'Not Applicable', message: 'Tasks will not be created.' }); } catch {}
      return;
    }
    // At this point, you would POST tasks to your backend based on analysisJson.actions
    try {
      addNotification({ title: 'Ready to create tasks', message: 'Use the analysis output to create tasks for the correct bank.' });
    } catch {}
  }, [analysisJson, applicable, addNotification]);


  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-2" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1">
          <li>
            <Link to="/" className="hover:text-gray-700">Dashboard</Link>
          </li>
          <li className="px-1 text-gray-400">&gt;</li>
          <li>
            <Link to="/circular-archive" className="hover:text-gray-700">Circular</Link>
          </li>
          <li className="px-1 text-gray-400">&gt;</li>
          <li className="text-gray-700 font-medium">{title}</li>
        </ol>
      </nav>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold mr-3">{title} Circular</h1>
        <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
          Default Bank: {defaultBank?.name ?? 'Not set'}
        </span>
        {applicable !== null && (
          <span
            className={(() => {
              if (applicable === true) return 'px-2 py-1 text-xs rounded bg-green-100 text-green-700';
              return 'px-2 py-1 text-xs rounded bg-gray-200 text-gray-600';
            })()}
          >
            {applicable ? 'Applicable' : 'Not Applicable'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Upload */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Upload Document</h2>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/jpg,image/webp,.doc,.docx"
            onClick={clearInputAndState}
            onChange={onFileChange}
            className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          {fileName && (
            <p className="mt-2 text-xs text-gray-500">Selected: {fileName}</p>
          )}
          {(!pdfReady) && (
            <p className="mt-2 text-xs text-amber-600">Loading PDF engine… please wait a moment.</p>
          )}
          {(!ocrReady) && (
            <p className="mt-1 text-xs text-amber-600">Loading OCR engine…</p>
          )}
        </div>

        {/* Middle column: Extracted text */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Extracted Text</h2>
            {loading && <span className="text-xs text-gray-500">Extracting…</span>}
          </div>
          <textarea
            value={extracted}
            onChange={(e) => {
              const val = e.target.value;
              setExtracted(val);
            }}
            placeholder="Extracted text from the uploaded PDF will appear here."
            className="w-full h-64 text-sm p-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAnalyze()}
              disabled={aiLoading}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-60"
            >
              {aiLoading ? 'Analyzing…' : 'Action'}
            </button>
            <button
              type="button"
              onClick={rerunAnalysisFresh}
              disabled={aiLoading}
              className="px-4 py-2 bg-gray-100 text-gray-800 text-sm rounded-md hover:bg-gray-200 disabled:opacity-60"
              title="Re-run analysis ignoring cache"
            >
              Re-run (ignore cache)
            </button>
          </div>
        </div>
      </div>

      {(!import.meta.env.DEV && error) && (
        <div className="mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-md">{error}</div>
      )}

      {/* Client-side key prompt removed. Keys are managed on the server only. */}

      {analysisJson && applicable !== null && (
        <div className="mt-6 bg-white rounded-lg border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Compliance Circular Analysis</h2>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                {applicable ? 'Applicable' : 'Not Applicable'}
              </span>
              {applicable === true && (
                <button
                  type="button"
                  onClick={createAiTasksNow}
                  disabled={!analysisJson}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-60"
                  title={!analysisJson ? 'Run analysis first' : 'Create tasks from analysis'}
                >
                  Create Compliance Task
                </button>
              )}
            </div>
          </div>
          
          {/* Circular Header */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            {analysisJson ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Circular Reference</h3>
                  <p className="mt-1 text-gray-900">{analysisJson?.meta?.reference_no || analysisJson?.meta?.circular_id || '—'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Issue Date</h3>
                  <p className="mt-1 text-gray-900">{analysisJson?.meta?.date || '—'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Subject / Regulation</h3>
                  <p className="mt-1 text-gray-900">{analysisJson?.meta?.subject || analysisJson?.meta?.regulation || '—'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Default Bank</h3>
                  <p className="mt-1 text-gray-900">{defaultBank?.name || 'Not set'}</p>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600">Run analysis to populate circular details.</div>
            )}
          </div>

          {/* Analysis Results */}
          <div className="space-y-6">
            {/* 1. Applicability */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">1. Applicability</h3>
              <div className="flex items-center">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  applicable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {applicable ? 'Yes' : 'No'}
                </span>
                {applicable && (
                  <span className="ml-3 text-sm text-gray-600">
                    This circular is applicable to all RBI-regulated entities
                  </span>
                )}
              </div>
            </div>
            {/* 2. Summary */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">2. Summary</h3>
              {analysisJson ? (
                <div className="prose prose-sm max-w-none text-gray-700">
                  {analysisJson?.summary && (<p>{analysisJson.summary}</p>)}
                  {Array.isArray(analysisJson?.key_points) && analysisJson.key_points.length > 0 && (
                    <ul className="list-disc pl-5 space-y-1 mt-2">
                      {analysisJson.key_points.map((kp: any, idx: number) => (
                        <li key={idx}>{String(kp)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-600">No summary yet. Click "Action" to analyze the uploaded file.</div>
              )}
            </div>
            {/* 3. Required Actions */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">3. Required Actions</h3>
              {Array.isArray(analysisJson?.actions) && analysisJson.actions.length > 0 ? (
                <div className="space-y-2">
                  {analysisJson.actions.map((a: any, idx: number) => (
                    <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <div className="flex items-start">
                        <input type="checkbox" className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                        <div className="ml-2">
                          <div className="font-medium text-gray-900">{a?.title || `Action ${idx + 1}`}</div>
                          {a?.description && <div className="text-sm text-gray-700">{a.description}</div>}
                          <div className="text-xs text-gray-500 mt-1">
                            {a?.priority ? `Priority: ${a.priority}` : ''}
                            {a?.department ? ` • Dept: ${a.department}` : ''}
                            {a?.due_in_days ? ` • Due in: ${a.due_in_days} days` : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600">No actions yet. Run analysis to generate proposed actions.</div>
              )}
            </div>
          </div>

        </div>
      )}
      {(!analysisJson && aiResult && applicable !== null) && (
        <div className="mt-6 bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900">Result (Compact — Fallback)</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => { try { await navigator.clipboard.writeText(aiResult); } catch {} }}
                className="px-3 py-1.5 bg-gray-100 text-gray-800 text-xs rounded hover:bg-gray-200"
              >Copy</button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const blob = new Blob([aiResult], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${title}-analysis.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch {}
                }}
                className="px-3 py-1.5 bg-gray-100 text-gray-800 text-xs rounded hover:bg-gray-200"
              >Download</button>
              {applicable === true && (
                <button
                  type="button"
                  onClick={createAiTasksNow}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
                >Create AI Task(s)</button>
              )}
            </div>
          </div>

          {/* Parse fallback text into sections */}
          {(() => {
            const text = String(aiResult || '');
            // Extract bullet lines after headers "Key Points:" and "Action Points:" if present
            const splitOn = (label: string) => {
              const i = text.indexOf(label);
              if (i === -1) return '';
              return text.slice(i + label.length).trim();
            };
            const keyPart = splitOn('Key Points:');
            const actPart = splitOn('Action Points:');
            const toBullets = (s: string) => s
              .split(/\n+/)
              .map(x => x.trim())
              .filter(Boolean)
              .map(x => x.replace(/^•\s*/, '').replace(/^-\s*/, ''))
              .filter(x => x.length > 2);
            const keyBullets = keyPart ? toBullets(keyPart).slice(0, 8) : [];
            const actBullets = actPart ? toBullets(actPart).slice(0, 8) : [];

            return (
              <div className="space-y-3 text-sm text-gray-800">
                {/* 1) Applicability */}
                {applicable === false ? (
                  <div>
                    <span className="font-semibold">1) Is Applicable:</span>
                    <span className="ml-2">No</span>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="font-semibold">1) Is Applicable:</span>
                      <span className="ml-2">Yes</span>
                    </div>
                    {/* 2) Summary (simple synthesis from key points) */}
                    <div>
                      <div className="font-semibold text-gray-900">2) Summary:</div>
                      {/* Dev-stub explanation if applicable (fallback text) */}
                      {(() => {
                        const isStub = /stub on error|development fallback|dev stub/i.test(text);
                        return isStub ? (
                          <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                            Showing development stub because OpenAI is not configured or returned an error.
                          </p>
                        ) : null;
                      })()}
                      {keyBullets.length > 0 ? (
                        <ul className="list-disc pl-5 mt-1 text-base md:text-lg font-medium text-gray-900">
                          {keyBullets.slice(0, 3).map((b, i) => (<li key={`fk-${i}`}>{b}</li>))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-gray-600">No summary.</p>
                      )}
                    </div>
                    {/* 3) Action Points (from parsed bullets) */}
                    <div>
                      <div className="font-semibold text-gray-900 text-lg">3) Action Points:</div>
                      {actBullets.length > 0 ? (
                        <ol className="list-decimal pl-5 mt-1 text-lg">
                          {actBullets.map((b, i) => (<li key={`fa-${i}`} className="mb-2">{b}</li>))}
                        </ol>
                      ) : (
                        <p className="mt-1 text-gray-600">No actions generated.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}
      {/* Tasks for this Circular */}
      <div className="mt-6 bg-white rounded-lg border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Tasks for this Circular</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{sessionHasInput ? circularTasks.length : 0} task(s)</span>
            {applicable === true && (analysisJson || aiResult) && (
              <button
                type="button"
                onClick={createAiTasksNow}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
              >Create AI Task(s)</button>
            )}
          </div>
        </div>
        {!sessionHasInput ? (
          <p className="text-sm text-gray-500">Upload a document or run analysis to view or propose tasks for this circular.</p>
        ) : (
          <>
            {/* Add new task inline */}
            <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                value={newTitle}
                onChange={(e)=>setNewTitle(e.target.value)}
                placeholder="Task title"
                className="px-3 py-2 border border-gray-300 rounded"
              />
              <input
                value={newDesc}
                onChange={(e)=>setNewDesc(e.target.value)}
                placeholder="Description"
                className="px-3 py-2 border border-gray-300 rounded"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newPriority}
                  onChange={(e)=>setNewPriority(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded bg-white"
                >
                  {['Low','Medium','High','Critical'].map(p => (<option key={p} value={p}>{p}</option>))}
                </select>
                <input type="date" value={newDue} onChange={(e)=>setNewDue(e.target.value)} className="px-3 py-2 border border-gray-300 rounded" />
              </div>
              <button
                type="button"
                onClick={addManualTask}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >Add Task</button>
            </div>

            {/* Card list */}
            {circularTasks.length === 0 ? (
              <p className="text-sm text-gray-500">No tasks yet. Click “Create AI Task(s)” above or add one manually.</p>
            ) : (
              <div className="space-y-4">
                {circularTasks.map(t => (
                  <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {editingId === t.id ? (
                          <>
                            <input
                              value={editTitle}
                              onChange={(e)=>setEditTitle(e.target.value)}
                              className="w-full mb-2 px-3 py-2 border border-gray-300 rounded"
                            />
                            <textarea
                              value={editDesc}
                              onChange={(e)=>setEditDesc(e.target.value)}
                              className="w-full mb-2 px-3 py-2 border border-gray-300 rounded"
                              rows={3}
                            />
                            <div className="flex items-center gap-2">
                              <button
                                className="px-3 py-1.5 bg-green-600 text-white rounded"
                                onClick={() => { updateCircularTask(t.id, { title: editTitle.trim(), description: editDesc.trim() }); setEditingId(null); }}
                              >Save</button>
                              <button className="px-3 py-1.5 border border-gray-300 rounded" onClick={() => setEditingId(null)}>Cancel</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-base font-semibold text-gray-900">{t.title}</h3>
                              <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700">{t.priority}</span>
                              <span className="text-xs text-gray-500">Due: {new Date(t.due_date).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{t.description}</p>
                          </>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <label className="text-gray-600">Status:</label>
                          <select
                            value={t.status}
                            onChange={(e)=>updateCircularTask(t.id, { status: e.target.value as CircularTask['status'] })}
                            className="px-2 py-1 border border-gray-300 rounded bg-white"
                          >
                            {['Pending','In Progress','Completed','Rejected'].map(s => (<option key={s} value={s}>{s}</option>))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded"
                          onClick={() => acceptTaskAndGo(t.id)}
                        >Accept</button>
                        {editingId === t.id ? null : (
                          <button
                            className="px-3 py-1.5 border border-gray-300 rounded"
                            onClick={() => { setEditingId(t.id); setEditTitle(t.title || ''); setEditDesc(t.description || ''); }}
                          >Edit</button>
                        )}
                        <button
                          className="px-3 py-1.5 border border-red-300 text-red-700 rounded"
                          onClick={() => deleteCircularTask(t.id)}
                        >Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">Tip: ensure the Node server is running and OPENAI_API_KEY is set in your server-side .env, then click Action.</p>
    </div>
  );
};

export default CircularDetail;
