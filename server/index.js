import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import multer from 'multer';
import mammoth from 'mammoth';
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.entry.js';
import fs from 'fs';
import path from 'path';

const { getDocument, GlobalWorkerOptions, version: pdfjsVersion } = pdfjsLib;

// Configure PDF.js worker
GlobalWorkerOptions.workerSrc = pdfjsWorker;

// PDF text extraction function
async function extractPdfText(pdfData) {
  try {
    const loadingTask = getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    let text = '';
    
    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      text += strings.join(' ') + '\n\n';
    }
    
    return text.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Persistence helpers (JSON files in server/data) ---
const dataDir = path.join(process.cwd(), 'server', 'data');
function ensureDataDir() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) {
    console.error('Failed to ensure data directory:', e?.message || e);
  }
}
function readJson(fileName, fallback) {
  try {
    ensureDataDir();
    const fp = path.join(dataDir, fileName);
    if (!fs.existsSync(fp)) return fallback;
    const raw = fs.readFileSync(fp, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) || (parsed && typeof parsed === 'object') ? parsed : fallback;
  } catch (e) {
    console.warn(`Failed to read ${fileName}:`, e?.message || e);
    return fallback;
  }
}
function writeJson(fileName, data) {
  try {
    ensureDataDir();
    const fp = path.join(dataDir, fileName);
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Failed to write ${fileName}:`, e?.message || e);
  }
}

// File upload middleware (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'node-backend', time: new Date().toISOString() });
});

// Initialize OpenAI only if key exists
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

app.get('/api/config/status', (req, res) => {
  res.json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.post('/api/openai/chat', async (req, res) => {
  // If no OpenAI key is configured, return a helpful error
  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({
      error: 'OpenAI API key is not configured',
      message: 'Please set the OPENAI_API_KEY environment variable in your .env file'
    });
  }
  try {
    // Late init: if server started without key and key was added later, initialize now
    if (!openai && process.env.OPENAI_API_KEY) {
      try {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        console.log('OpenAI client initialized (late init).');
      } catch (e) {
        console.error('Failed late init OpenAI:', e?.message || e);
      }
    }
    const { messages, model = 'gpt-4o-mini', temperature = 0.2 } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages must be a non-empty array' });
    }

    // Dev fallback removed by default: if no OpenAI client, return 500
    if (!openai) {
      return res.status(500).json({ error: 'OpenAI client not initialized' });
    }

    // Normal path: call OpenAI with small retry on 429
    async function callOpenAIWithRetry(maxRetries = 2) {
      let attempt = 0;
      let lastErr = null;
      while (attempt <= maxRetries) {
        try {
          const completion = await openai.chat.completions.create({
            model,
            messages,
            temperature,
          });
          return completion;
        } catch (e) {
          lastErr = e;
          const status = e && (e.status || e.code);
          const isRateLimit = status === 429 || /rate limit|quota/i.test(String(e?.message || ''));
          if (!isRateLimit || attempt === maxRetries) {
            throw e;
          }
          const delayMs = Math.min(2000 * Math.pow(2, attempt), 8000);
          await new Promise(r => setTimeout(r, delayMs));
          attempt += 1;
        }
      }
      throw lastErr || new Error('OpenAI request failed');
    }

    const completion = await callOpenAIWithRetry(2);
    const choice = completion.choices?.[0]?.message;
    res.json({ message: choice, usage: completion.usage || null, id: completion.id });
  } catch (err) {
    const details = (err && (err.error?.message || err.message)) || 'OpenAI request failed';
    console.error('OpenAI error:', details);
    const status = (err && err.status) || 500;
    // In development or when explicitly enabled, return a stubbed structured response instead of 500
    const allowStub = String(process.env.DEV_STUB_ON_ERROR).toLowerCase() === 'true';
    if (allowStub) {
      try {
        const userMsg = (req.body && Array.isArray(req.body.messages)) ? (req.body.messages.find((m) => m && m.role === 'user')?.content || '') : '';
        const circularIdMatch = String(userMsg).match(/Circular ID:\s*([^,\n]+)/i);
        const circular_id = circularIdMatch ? String(circularIdMatch[1]).trim() : 'unknown';
        const now = new Date().toISOString();
        const stubContent = {
          meta: {
            regulator: 'RBI',
            circular_id,
            reference_no: 'DEV-STUB-ON-ERROR',
            date: now.slice(0, 10),
            subject: `Dev stub (OpenAI error): ${details}`,
            bank_context: {
              bank_id: '',
              bank_name: '',
              bank_type: '',
              applicable: true,
              applicable_reason: 'Dev stub returned due to OpenAI error.',
            },
          },
          summary: 'Development fallback summary (stub on error).',
          key_points: [
            'Stubbed point — replace with real analysis once OpenAI is configured.',
          ],
          actions: [
            {
              title: 'Review circular and prepare compliance note',
              description: 'Create a short note summarizing obligations and proposed steps.',
              priority: 'Medium',
              department: 'Compliance',
              due_in_days: 7,
              owner_role: 'Maker',
              confidence: 0.5,
              citation: 'N/A',
            },
            {
              title: 'Identify applicable sections for the default bank',
              description: 'Map clauses to bank products/processes; mark not applicable items.',
              priority: 'High',
              department: 'Compliance',
              due_in_days: 5,
              owner_role: 'Maker',
              confidence: 0.6,
              citation: 'N/A',
            },
            {
              title: 'Draft implementation plan',
              description: 'List owners, milestones, and dependencies for each obligation.',
              priority: 'Medium',
              department: 'Operations',
              due_in_days: 10,
              owner_role: 'Maker',
              confidence: 0.6,
              citation: 'N/A',
            },
            {
              title: 'Update internal SOPs/Policies',
              description: 'Revise SOPs and policies impacted by this circular; route for approval.',
              priority: 'Medium',
              department: 'Policy',
              due_in_days: 14,
              owner_role: 'Checker',
              confidence: 0.5,
              citation: 'N/A',
            },
            {
              title: 'Train relevant staff',
              description: 'Conduct short training for impacted teams with examples and timelines.',
              priority: 'Low',
              department: 'HR/Training',
              due_in_days: 15,
              owner_role: 'Maker',
              confidence: 0.4,
              citation: 'N/A',
            },
            {
              title: 'Set up compliance monitoring',
              description: 'Define checks/alerts to monitor adherence and capture evidence.',
              priority: 'High',
              department: 'Compliance Monitoring',
              due_in_days: 12,
              owner_role: 'Checker',
              confidence: 0.5,
              citation: 'N/A',
            },
          ],
          risks: ['Potential non-compliance if ignored (dev-stub).'],
          notes: 'This payload is returned by the server when OpenAI fails in dev.',
        };
        return res.json({ message: { role: 'assistant', content: JSON.stringify(stubContent) }, usage: null, id: `stub-${Date.now()}` });
      } catch (_) {
        // fallthrough to error
      }
    }
    res.status(status).json({ error: details });
  }
});

// File upload endpoint for document processing
app.post('/api/upload/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, originalname, mimetype } = req.file;
    let text = '';

    if (mimetype === 'application/pdf') {
      console.log('Processing PDF file');
      text = await extractPdfText(buffer);
      console.log(`Extracted ${text.length} characters from PDF`);
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log('Processing Word document');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
      console.log(`Extracted ${text.length} characters from Word document`);
    } else if (mimetype.startsWith('image/')) {
      console.log('Processing image file (OCR not implemented)');
      text = 'Image OCR processing would happen here';
    } else {
      console.log(`Unsupported file type: ${mimetype}`);
      return res.status(400).json({ error: `Unsupported file type: ${mimetype}` });
    }

    res.json({
      ok: true,
      filename: originalname,
      text: text || 'No text could be extracted',
      mimetype
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to process file',
      details: error.message
    });
  }
});

// Lightweight debug endpoint (does not expose secrets)
app.get('/api/debug/status', (req, res) => {
  try {
    return res.json({
      ok: true,
      nodeEnv: process.env.NODE_ENV || 'development',
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      openaiClientReady: !!openai,
      time: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// --- Users API (JSON persisted) ---
// User shape: { id, name, email, role, avatar? }
const userSeed = [
  { id: 'u-1', name: 'Nilesh Patil', email: 'nilesh@patil.io', role: 'Admin' },
  { id: 'u-2', name: 'Maker One', email: 'maker1@example.com', role: 'Maker' },
  { id: 'u-3', name: 'Checker One', email: 'checker1@example.com', role: 'Checker' },
  { id: 'u-4', name: 'Manager One', email: 'manager1@example.com', role: 'Manager' },
];
let users = readJson('users.json', [...userSeed]);

function newUserId() { return newId('u'); }

// List users
app.get('/api/users', (req, res) => {
  try {
    const list = Array.isArray(users) ? [...users] : [];
    return res.json({ ok: true, users: list, total: list.length });
  } catch (err) {
    console.error('GET /api/users error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Failed to list users' });
  }
});

// Create user
app.post('/api/users', (req, res) => {
  try {
    const body = req.body || {};
    const name = safeString(body.name || '').trim();
    const email = safeString(body.email || '').trim();
    const role = safeString(body.role || 'Maker').trim();
    const avatar = safeString(body.avatar || '').trim();
    if (!name) return res.status(400).json({ ok: false, error: 'name is required' });
    if (!email) return res.status(400).json({ ok: false, error: 'email is required' });
    const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return res.status(409).json({ ok: false, error: 'email already exists' });
    const user = { id: newUserId(), name, email, role, avatar: avatar || undefined };
    users = [user, ...users];
    writeJson('users.json', users);
    return res.status(201).json({ ok: true, user });
  } catch (err) {
    console.error('POST /api/users error:', err?.message || err);
    return res.status(400).json({ ok: false, error: (err && err.message) || 'Invalid user' });
  }
});

// Update user
app.put('/api/users/:id', (req, res) => {
  try {
    const idx = users.findIndex(u => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Not found' });
    const body = req.body || {};
    const updated = {
      ...users[idx],
      name: body.name != null ? safeString(body.name) : users[idx].name,
      email: body.email != null ? safeString(body.email) : users[idx].email,
      role: body.role != null ? safeString(body.role) : users[idx].role,
      avatar: body.avatar != null ? safeString(body.avatar) : users[idx].avatar,
    };
    // If email changed, ensure uniqueness
    if (updated.email && updated.email !== users[idx].email) {
      const exists = users.some(u => u.email.toLowerCase() === updated.email.toLowerCase() && u.id !== users[idx].id);
      if (exists) return res.status(409).json({ ok: false, error: 'email already exists' });
    }
    users[idx] = updated;
    writeJson('users.json', users);
    return res.json({ ok: true, user: updated });
  } catch (err) {
    console.error('PUT /api/users/:id error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Failed to update user' });
  }
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
  try {
    const id = req.params.id;
    const before = users.length;
    users = users.filter(u => u.id !== id);
    if (users.length === before) return res.status(404).json({ ok: false, error: 'Not found' });
    writeJson('users.json', users);
    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/users/:id error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Failed to delete user' });
  }
});

// --- Tasks API (JSON persisted) ---
// Single in-memory store (initialized below)

function safeString(x, max = 4000) {
  const s = (x == null ? '' : String(x));
  return s.length > max ? s.slice(0, max) : s;
}

function newId(prefix = 't') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// In-memory task storage with sample data
const initialTasks = [
  {
    id: 't-1',
    title: 'Review Circular RBI/2023/01',
    description: 'Analyze and summarize key compliance requirements',
    status: 'In Progress',
    priority: 'High',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    assigned_to: 'nilesh-1',
    assigned_by: 'system',
    type: 'Maker',
    circular_id: 'rbi',
    source: 'system'
  },
  {
    id: 't-2',
    title: 'Update Compliance Checklist',
    description: 'Update internal compliance checklist with new RBI circular requirements',
    status: 'Pending',
    priority: 'Medium',
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    assigned_to: 'nilesh-1',
    assigned_by: 'system',
    type: 'Checker',
    circular_id: 'rbi',
    source: 'system'
  }
];

// Initialize tasks array from disk (fallback to seed)
let tasks = readJson('tasks.json', [...initialTasks]);

// List tasks (optionally filter by circular_id, assigned_to)
app.get('/api/tasks', (req, res) => {
  try {
    const { circular_id, assigned_to } = req.query || {};
    
    // Ensure tasks is an array before filtering
    if (!Array.isArray(tasks)) {
      tasks = [...initialTasks];
    }
    
    // Start with a fresh copy of tasks
    let filteredTasks = [...tasks];
    
    // Apply filters if provided
    if (circular_id) {
      filteredTasks = filteredTasks.filter(t => 
        t && t.circular_id && t.circular_id.toString() === circular_id.toString()
      );
    }
    
    if (assigned_to) {
      filteredTasks = filteredTasks.filter(t => 
        t && t.assigned_to && t.assigned_to.toString() === assigned_to.toString()
      );
    }
    
    // Sort by creation date (newest first)
    const sortedTasks = [...filteredTasks].sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    
    res.json({ 
      ok: true, 
      tasks: sortedTasks,
      total: sortedTasks.length
    });
    
  } catch (err) {
    console.error('GET /api/tasks error:', err);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch tasks',
      details: err.message 
    });
  }
});

// Create a task (status defaults to 'Proposed')
app.post('/api/tasks', (req, res) => {
  try {
    const body = req.body || {};
    const now = new Date();
    const task = {
      id: newId('t'),
      title: safeString(body.title || 'Task'),
      description: safeString(body.description || ''),
      status: safeString(body.status || 'Proposed'),
      priority: safeString(body.priority || 'Medium'),
      due_date: safeString(body.due_date || now.toISOString()),
      created_at: safeString(body.created_at || now.toISOString()),
      assigned_to: safeString(body.assigned_to || 'guest'),
      assigned_by: safeString(body.assigned_by || 'system'),
      type: safeString(body.type || 'Maker'),
      circular_id: safeString(body.circular_id || ''),
      trace_id: body.trace_id ? safeString(body.trace_id) : undefined,
      obligation_id: body.obligation_id ? safeString(body.obligation_id) : undefined,
      sla: body.sla && typeof body.sla === 'object' ? { deadline: safeString(body.sla.deadline || now.toISOString()) } : undefined,
      source: safeString(body.source || 'api'),
    };
    tasks.unshift(task);
    writeJson('tasks.json', tasks);
    res.status(201).json({ ok: true, task });
  } catch (err) {
    res.status(400).json({ ok: false, error: (err && err.message) || 'Invalid task' });
  }
});

// Get a task by id
app.get('/api/tasks/:id', (req, res) => {
  const t = tasks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, task: t });
});

// Patch a task (e.g., status)
app.patch('/api/tasks/:id', (req, res) => {
  const idx = tasks.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Not found' });
  const patch = req.body || {};
  const current = tasks[idx];
  const updated = { ...current, ...patch };
  tasks[idx] = updated;
  writeJson('tasks.json', tasks);
  res.json({ ok: true, task: updated });
});

// --- In-memory Banks API (demo) ---
// Bank shape: { id, name, type, state }
const bankSeed = [
  { id: 'b1', name: 'State Bank of India', type: 'Public', state: 'Maharashtra' },
  { id: 'b2', name: 'HDFC Bank', type: 'Private', state: 'Maharashtra' },
  { id: 'b3', name: 'DBS Bank', type: 'Foreign', state: 'Maharashtra' },
];

// --- Penalties API (JSON persisted) ---
// Penalty shape: { id, date, regulator, entity, description, section, amount, currency, severity, status?, reference? }
const penaltySeed = [
  {
    id: 'p-1',
    date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    regulator: 'RBI',
    entity: 'ABC Bank',
    description: 'Non-compliance with KYC norms',
    section: 'KYC-2016-Rule-9',
    amount: 2500000,
    currency: 'INR',
    severity: 'High',
    status: 'Closed',
    reference: 'RBI/2024/45'
  },
  {
    id: 'p-2',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    regulator: 'SEBI',
    entity: 'XYZ Securities',
    description: 'Disclosure delay in quarterly filings',
    section: 'LODR-Reg-33',
    amount: 750000,
    currency: 'INR',
    severity: 'Medium',
    status: 'Open',
    reference: 'SEBI/2025/12'
  }
];

let penalties = readJson('penalties.json', [...penaltySeed]);

function newPenaltyId() { return newId('p'); }

// List penalties with simple filters
app.get('/api/penalties', (req, res) => {
  try {
    const { regulator, entity, severity, from, to } = req.query || {};
    const f = Array.isArray(penalties) ? penalties.slice() : [];
    const out = f.filter(p => {
      if (regulator && String(p.regulator) !== String(regulator)) return false;
      if (entity && String(p.entity) !== String(entity)) return false;
      if (severity && String(p.severity) !== String(severity)) return false;
      if (from) {
        const d = new Date(p.date).getTime();
        const fs = new Date(String(from)).getTime();
        if (isFinite(d) && isFinite(fs) && d < fs) return false;
      }
      if (to) {
        const d = new Date(p.date).getTime();
        const te = new Date(String(to));
        te.setHours(23, 59, 59, 999);
        const ts = te.getTime();
        if (isFinite(d) && isFinite(ts) && d > ts) return false;
      }
      return true;
    });
    res.json({ ok: true, penalties: out, total: out.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to list penalties' });
  }
});

// Create a penalty
app.post('/api/penalties', (req, res) => {
  try {
    const b = req.body || {};
    const penalty = {
      id: newPenaltyId(),
      date: safeString(b.date || new Date().toISOString()),
      regulator: safeString(b.regulator || ''),
      entity: safeString(b.entity || ''),
      description: safeString(b.description || ''),
      section: safeString(b.section || ''),
      amount: Number.isFinite(Number(b.amount)) ? Number(b.amount) : 0,
      currency: safeString(b.currency || 'INR'),
      severity: safeString(b.severity || 'Low'),
      status: safeString(b.status || 'Open'),
      reference: b.reference ? safeString(b.reference) : undefined,
    };
    penalties.unshift(penalty);
    writeJson('penalties.json', penalties);
    res.status(201).json({ ok: true, penalty });
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid payload' });
  }
});

// Patch a penalty
app.patch('/api/penalties/:id', (req, res) => {
  const idx = penalties.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Not found' });
  const patch = req.body || {};
  const updated = { ...penalties[idx], ...patch };
  penalties[idx] = updated;
  writeJson('penalties.json', penalties);
  res.json({ ok: true, penalty: updated });
});

// Delete a penalty
app.delete('/api/penalties/:id', (req, res) => {
  const before = penalties.length;
  penalties = penalties.filter(p => p.id !== req.params.id);
  if (penalties.length === before) return res.status(404).json({ ok: false, error: 'Not found' });
  writeJson('penalties.json', penalties);
  res.json({ ok: true });
});
let banks = [...bankSeed];
let defaultBankId = null;

function newBankId() { return newId('b'); }

// (Removed duplicate /api/tasks GET route)

// List banks
app.get('/api/banks', (req, res) => {
  try {
    const list = Array.isArray(banks) ? [...banks] : [];
    return res.json({ ok: true, banks: list, defaultBankId });
  } catch (err) {
    console.error('GET /api/banks error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Failed to list banks' });
  }
});

// Create bank
app.post('/api/banks', (req, res) => {
  try {
    const body = req.body || {};
    const name = safeString(body.name || '').trim();
    const type = safeString(body.type || '').trim();
    const state = safeString(body.state || '').trim();
    if (!name) return res.status(400).json({ ok: false, error: 'name is required' });
    if (!type) return res.status(400).json({ ok: false, error: 'type is required' });
    if (!state) return res.status(400).json({ ok: false, error: 'state is required' });
    const bank = { id: newBankId(), name, type, state };
    banks = [bank, ...banks];
    return res.status(201).json({ ok: true, bank });
  } catch (err) {
    console.error('POST /api/banks error:', err?.message || err);
    return res.status(400).json({ ok: false, error: (err && err.message) || 'Invalid bank' });
  }
});

// Update bank
app.put('/api/banks/:id', (req, res) => {
  try {
    const idx = banks.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Not found' });
    const body = req.body || {};
    const updated = {
      ...banks[idx],
      name: body.name != null ? safeString(body.name) : banks[idx].name,
      type: body.type != null ? safeString(body.type) : banks[idx].type,
      state: body.state != null ? safeString(body.state) : banks[idx].state,
    };
    banks[idx] = updated;
    return res.json({ ok: true, bank: updated });
  } catch (err) {
    console.error('PUT /api/banks/:id error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Failed to update bank' });
  }
});

// Delete bank
app.delete('/api/banks/:id', (req, res) => {
  try {
    const id = req.params.id;
    const before = banks.length;
    banks = banks.filter(b => b.id !== id);
    if (banks.length === before) return res.status(404).json({ ok: false, error: 'Not found' });
    if (defaultBankId === id) defaultBankId = null;
    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/banks/:id error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Failed to delete bank' });
  }
});

// Set default bank
app.post('/api/banks/:id/default', (req, res) => {
  try {
    const id = req.params.id;
    const exists = banks.some(b => b.id === id);
    if (!exists) return res.status(404).json({ ok: false, error: 'Not found' });
    defaultBankId = id;
    return res.json({ ok: true, defaultBankId });
  } catch (err) {
    console.error('POST /api/banks/:id/default error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Failed to set default bank' });
  }
});

// Upload endpoint to extract text from Word documents
app.post('/api/upload/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const mime = req.file.mimetype || '';
    const name = req.file.originalname || '';
    const isDocx =
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      /\.docx$/i.test(name);
    const isDoc = mime === 'application/msword' || /\.doc$/i.test(name);

    if (isDocx) {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      const text = (result && result.value) ? String(result.value).trim() : '';
      return res.json({ ok: true, text });
    }
    if (isDoc) {
      return res.status(415).json({
        error: 'DOC format not supported on server. Please convert to DOCX and retry.',
      });
    }
    return res.status(415).json({ error: 'Unsupported file type for extraction' });
  } catch (err) {
    const details = (err && (err.message || String(err))) || 'Extraction failed';
    console.error('Upload extract error:', details);
    res.status(500).json({ error: details });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`OPENAI key detected: ${process.env.OPENAI_API_KEY ? 'yes' : 'no'}`);
});
