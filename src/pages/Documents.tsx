
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { FamilyDocument, DocumentCategory } from '../types';
import { FolderOpen, Plus, X, AlertTriangle, CheckCircle2, Trash2, Calendar, Search, Sparkles, Upload, Loader2, AlertCircle, ScanLine, FileText, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFamily } from '../FamilyContext';

/** Reject non-http(s) URLs to prevent javascript: XSS attacks */
function sanitizeUrl(url: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}

interface DocumentsProps {
  documents: FamilyDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<FamilyDocument[]>>;
  /** When false (default), Magic Scan still auto-fills fields but does NOT persist extractedText. */
  aiDocAccess?: boolean;
}

const ALL_CATEGORIES: DocumentCategory[] = ['Insurance', 'Medical', 'School', 'Legal', 'Financial', 'Other'];

const CATEGORY_CONFIG: Record<DocumentCategory, { color: string; bg: string; icon: string }> = {
  Insurance: { color: 'text-blue-600',   bg: 'bg-blue-50',   icon: '🛡️' },
  Medical:   { color: 'text-red-600',    bg: 'bg-red-50',    icon: '🏥' },
  School:    { color: 'text-amber-600',  bg: 'bg-amber-50',  icon: '🎒' },
  Legal:     { color: 'text-purple-600', bg: 'bg-purple-50', icon: '⚖️' },
  Financial: { color: 'text-green-600',  bg: 'bg-green-50',  icon: '💼' },
  Other:     { color: 'text-slate-600',  bg: 'bg-slate-50',  icon: '📄' },
};

function daysUntilExpiry(dateStr?: string): number | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const expiry = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const MAX_SCAN_SIZE_MB = 5;
const MAX_EXTRACTED_TEXT_LENGTH = 20_000; // keep localStorage footprint sane

const Documents: React.FC<DocumentsProps> = ({ documents, setDocuments, aiDocAccess = false }) => {
  const { state } = useFamily();
  const familyId = (state as any).family?.id ?? 'fam-1';
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanFileInputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  const [form, setForm] = useState<{
    name: string;
    category: DocumentCategory;
    expiryDate: string;
    notes: string;
    fileUrl: string;
    extractedText?: string;
    source: 'manual' | 'scan';
  }>({ name: '', category: 'Other', expiryDate: '', notes: '', fileUrl: '', source: 'manual' });

  const filtered = useMemo(() => documents.filter(doc => {
    const matchCat = activeCategory === 'All' || doc.category === activeCategory;
    const haystack = `${doc.name} ${doc.notes ?? ''} ${doc.extractedText ?? ''}`.toLowerCase();
    const matchSearch = !search || haystack.includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [documents, activeCategory, search]);

  const resetForm = () => setForm({ name: '', category: 'Other', expiryDate: '', notes: '', fileUrl: '', source: 'manual' });

  const handleAdd = () => {
    if (!form.name) return;
    setDocuments(prev => [{
      id: `d-${Date.now()}`,
      familyId,
      name: form.name,
      category: form.category,
      expiryDate: form.expiryDate || undefined,
      notes: form.notes || undefined,
      fileUrl: sanitizeUrl(form.fileUrl),
      extractedText: form.extractedText,
      source: form.source,
      createdAt: new Date().toISOString().split('T')[0],
    }, ...prev]);
    setAddOpen(false);
    resetForm();
  };

  const deleteDoc = (id: string) => {
    setDeletingId(id);
    deleteTimeoutRef.current = setTimeout(() => {
      setDocuments(prev => prev.filter(d => d.id !== id));
      setDeletingId(null);
    }, 300);
  };

  // ── Scan flow ─────────────────────────────────────────────────────────
  const handleScanFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // allow re-selecting same file after error

    if (file.size > MAX_SCAN_SIZE_MB * 1024 * 1024) {
      setScanError(`File exceeds ${MAX_SCAN_SIZE_MB}MB limit.`);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setScanError('Failed to read file. Please try again.');
    reader.onloadend = () => {
      const base64Data = (reader.result as string).split(',')[1];
      scanWithGemini({ data: base64Data, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const scanWithGemini = async (content: { data: string; mimeType: string }) => {
    setIsScanning(true);
    setScanError(null);

    try {
      const apiKey = import.meta.env.VITE_API_KEY;
      if (!apiKey) {
        setScanError('Gemini API key is not configured. Add VITE_API_KEY to your .env file.');
        setIsScanning(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const today = new Date().toISOString().split('T')[0];

      const systemInstruction =
        `Today's date is ${today}. You are a family document organizer. ` +
        `Given an image or PDF of a family document (insurance card, policy, school form, medical record, legal doc, receipt, etc.), extract: ` +
        `(1) a short descriptive name (e.g. "State Farm Auto Policy"); ` +
        `(2) a category — one of Insurance, Medical, School, Legal, Financial, Other; ` +
        `(3) an expiryDate in YYYY-MM-DD format if one is visible (renewal date, expiration, valid-until), otherwise omit; ` +
        `(4) brief notes summarizing key fields (policy #, account #, contact info) in one or two short lines; ` +
        `(5) extractedText — the full plain-text content of the document, suitable for later question-answering. Keep extractedText under ~15,000 characters; if the document is longer, summarize the rest.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          name:          { type: Type.STRING },
          category:      { type: Type.STRING },
          expiryDate:    { type: Type.STRING },
          notes:         { type: Type.STRING },
          extractedText: { type: Type.STRING },
        },
        required: ['name', 'category', 'extractedText'],
      };

      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ parts: [
          { inlineData: content },
          { text: 'Extract structured family-document data from this image. Return JSON.' },
        ] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          systemInstruction,
        },
      });

      const parsed = JSON.parse(result.text || '{}') as {
        name?: string;
        category?: string;
        expiryDate?: string;
        notes?: string;
        extractedText?: string;
      };

      const normalizedCategory: DocumentCategory =
        (ALL_CATEGORIES as string[]).includes(parsed.category ?? '')
          ? (parsed.category as DocumentCategory)
          : 'Other';

      const truncatedText = (parsed.extractedText ?? '').slice(0, MAX_EXTRACTED_TEXT_LENGTH);

      // Privacy: only persist OCR'd text when the user has opted in to AI Document Access.
      // Without consent, scan results are still used to auto-fill the form fields, but the
      // raw text isn't retained — so the Family Coach can't see this document.
      setForm({
        name: parsed.name ?? 'Scanned Document',
        category: normalizedCategory,
        expiryDate: parsed.expiryDate ?? '',
        notes: parsed.notes ?? '',
        fileUrl: '',
        extractedText: aiDocAccess && truncatedText ? truncatedText : undefined,
        source: 'scan',
      });

      setScanOpen(false);
      setAddOpen(true);
      setScanSuccess(
        aiDocAccess
          ? 'Scan complete — review the fields below and save.'
          : 'Scan complete. Fields auto-filled — text was not stored (AI access is off).'
      );
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => setScanSuccess(null), 4000);
    } catch (err) {
      console.error(err);
      setScanError('Could not read this document. Try a clearer photo or a different file.');
    } finally {
      setIsScanning(false);
    }
  };

  const expiringCount = documents.filter(d => { const days = daysUntilExpiry(d.expiryDate); return days !== null && days <= 60; }).length;
  const scannedCount = documents.filter(d => d.extractedText && d.extractedText.length > 0).length;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Document Vault</h1>
          <p className="text-slate-500 mt-1">Track important family documents and expiration dates.</p>
          {aiDocAccess && scannedCount > 0 && (
            <p className="text-xs text-indigo-600 mt-1 font-semibold flex items-center gap-1">
              <Sparkles size={12} /> {scannedCount} doc{scannedCount > 1 ? 's' : ''} readable by Family Coach
            </p>
          )}
          {!aiDocAccess && (
            <p className="text-xs text-slate-500 mt-1 font-semibold flex items-center gap-1">
              <Lock size={12} /> AI Document Access is off —{' '}
              <Link to="/settings" className="text-indigo-600 hover:underline">enable in Settings</Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setScanError(null); setScanOpen(true); }}
            className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-700 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-colors shadow-sm text-sm"
          >
            <ScanLine size={18} /> Magic Scan
          </button>
          <button onClick={() => { resetForm(); setAddOpen(true); }} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm text-sm">
            <Plus size={18} /> Add Document
          </button>
        </div>
      </header>

      {/* Success toast */}
      {scanSuccess && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">{scanSuccess}</p>
        </div>
      )}

      {/* Expiry alert */}
      {expiringCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {expiringCount} document{expiringCount > 1 ? 's' : ''} expiring within 60 days — review them below.
          </p>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents (name, notes, scanned text)..."
            className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['All', ...ALL_CATEGORIES] as (DocumentCategory | 'All')[]).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeCategory === cat ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}
            >
              {cat !== 'All' && <span className="mr-1">{CATEGORY_CONFIG[cat as DocumentCategory].icon}</span>}
              {cat}
              <span className="ml-1.5 text-[10px] opacity-60">
                {cat === 'All' ? documents.length : documents.filter(d => d.category === cat).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border-2 border-dashed rounded-2xl p-16 text-center">
          <FolderOpen size={40} className="text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">No documents found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => {
            const config = CATEGORY_CONFIG[doc.category];
            const days = daysUntilExpiry(doc.expiryDate);
            const isExpired = days !== null && days < 0;
            const isWarning = days !== null && days >= 0 && days <= 60;
            const isScanned = doc.source === 'scan' || (doc.extractedText && doc.extractedText.length > 0);
            return (
              <div key={doc.id} className={`group bg-white border rounded-2xl p-5 notion-shadow transition-all duration-300 hover:border-indigo-200 ${deletingId === doc.id ? 'scale-95 opacity-0' : ''}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${config.bg}`}>{config.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm leading-tight truncate">{doc.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${config.color}`}>{doc.category}</span>
                      {isScanned && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                          <Sparkles size={9} /> AI-readable
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteDoc(doc.id)} className="opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-500 transition-all flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
                {doc.notes && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{doc.notes}</p>}
                {doc.fileUrl && (
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 font-semibold hover:underline mb-3 block truncate">
                    🔗 View File
                  </a>
                )}
                {doc.expiryDate ? (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${isExpired ? 'bg-red-50 text-red-600' : isWarning ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'}`}>
                    {isExpired || isWarning ? <AlertTriangle size={12} /> : <Calendar size={12} />}
                    {isExpired ? `Expired ${Math.abs(days!)} days ago` : isWarning ? `Expires in ${days} days` : `Expires ${formatDate(doc.expiryDate)}`}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <CheckCircle2 size={12} className="text-green-400" /> No expiry
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Scan Modal */}
      {scanOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between bg-indigo-50/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                  <Sparkles size={18} />
                </div>
                <h2 className="text-lg font-bold">Magic Scan</h2>
              </div>
              <button onClick={() => { if (!isScanning) setScanOpen(false); }} className="text-slate-400 hover:text-slate-600 disabled:opacity-40" disabled={isScanning}>
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {isScanning ? (
                <div className="py-10 flex flex-col items-center justify-center text-center">
                  <div className="relative">
                    <Loader2 size={44} className="text-indigo-600 animate-spin" />
                    <Sparkles size={18} className="text-indigo-400 absolute -top-2 -right-2 animate-bounce" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-5">Reading your document…</h3>
                  <p className="text-slate-500 text-xs mt-2 max-w-xs">Gemini is extracting the text, category, and key dates so the Family Coach can answer questions about it later.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-sm text-slate-600">
                    Snap a photo or upload an image of a document. We'll pull out the name, category, and expiry date to auto-fill the form.
                  </p>
                  {aiDocAccess ? (
                    <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex items-start gap-2 text-xs text-indigo-900">
                      <Sparkles size={14} className="flex-shrink-0 mt-0.5 text-indigo-600" />
                      <span><strong>AI Document Access is on.</strong> Extracted text will be stored so the Family Coach can answer questions about this document later.</span>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border rounded-xl p-3 flex items-start gap-2 text-xs text-slate-700">
                      <Lock size={14} className="flex-shrink-0 mt-0.5 text-slate-500" />
                      <span><strong>AI Document Access is off.</strong> Scanned fields will be used to auto-fill the form, but the text will NOT be stored or sent to the Family Coach. <Link to="/settings" className="text-indigo-600 font-semibold hover:underline">Enable in Settings</Link> to let the Coach read your docs.</span>
                    </div>
                  )}
                  <div
                    onClick={() => scanFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
                  >
                    <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <Upload size={28} className="text-slate-300 group-hover:text-indigo-500" />
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Upload or take a photo</p>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG, or PDF (Max {MAX_SCAN_SIZE_MB}MB)</p>
                    <input
                      type="file"
                      className="hidden"
                      ref={scanFileInputRef}
                      accept="image/*,application/pdf"
                      onChange={handleScanFile}
                    />
                  </div>
                  {scanError && (
                    <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-2 text-red-600 text-xs">
                      <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                      <span>{scanError}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
                    <FileText size={12} className="flex-shrink-0 mt-0.5" />
                    Scanned text stays in your browser's local storage. Nothing is uploaded except the one-time call to Gemini for OCR.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{form.source === 'scan' ? 'Review Scanned Document' : 'Add Document'}</h2>
                {form.source === 'scan' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                    <Sparkles size={10} /> AI-extracted
                  </span>
                )}
              </div>
              <button onClick={() => { setAddOpen(false); resetForm(); }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Document Name *</label>
                <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Home Insurance Policy" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as DocumentCategory }))} className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_CONFIG[c].icon} {c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Expiry Date (optional)</label>
                <input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Policy number, location, etc." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">File Link (optional)</label>
                <input value={form.fileUrl} onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))} className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="https://drive.google.com/..." />
              </div>
              {form.extractedText && (
                <details className="bg-slate-50 border rounded-xl p-3">
                  <summary className="text-xs font-bold text-slate-600 uppercase tracking-widest cursor-pointer flex items-center gap-1.5">
                    <FileText size={12} /> Extracted text ({form.extractedText.length.toLocaleString()} chars)
                  </summary>
                  <pre className="mt-3 text-[11px] text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto font-sans">{form.extractedText}</pre>
                  <p className="mt-2 text-[10px] text-slate-400">This text powers Family Coach answers about this document.</p>
                </details>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setAddOpen(false); resetForm(); }} className="flex-1 border rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleAdd} disabled={!form.name} className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">Save Document</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;
