
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Link } from 'react-router-dom';
import { FamilyDocument } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import {
  Sparkles, Send, Loader2, Bot, User as UserIcon, MessagesSquare,
  FileText, ScanLine, AlertCircle, Trash2, Lock, ShieldCheck,
} from 'lucide-react';

interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** IDs of documents the AI used to answer (assistant messages only). */
  sourceDocIds?: string[];
  createdAt: string;
}

interface FamilyCoachProps {
  documents: FamilyDocument[];
  /** Whether the user has opted in to AI access of document text. Defaults false. */
  aiDocAccess?: boolean;
  /** Inline-enable handler so the Coach can flip the toggle from its own gate screen. */
  onEnableAiDocAccess?: () => void;
}

const SUGGESTED_PROMPTS = [
  '📅 Which documents are expiring soon?',
  '🛡️ What\'s our auto insurance deductible?',
  '🏥 Summarize our medical records on file.',
  '🎒 Are there any school forms I need to sign?',
];

/** Build the system prompt grounding context from the docs. */
function buildDocContext(docs: FamilyDocument[]): string {
  const usable = docs.filter(d => d.extractedText && d.extractedText.trim().length > 0);
  if (usable.length === 0) return '';

  return usable.map((d, i) => {
    const expiry = d.expiryDate ? ` (expires ${d.expiryDate})` : '';
    const notes = d.notes ? `\nNotes: ${d.notes}` : '';
    // Cap each doc to keep total prompt size reasonable
    const text = (d.extractedText ?? '').slice(0, 6000);
    return `--- DOCUMENT ${i + 1} ---\nID: ${d.id}\nName: ${d.name}\nCategory: ${d.category}${expiry}${notes}\nText:\n${text}`;
  }).join('\n\n');
}

const FamilyCoach: React.FC<FamilyCoachProps> = ({ documents, aiDocAccess = false, onEnableAiDocAccess }) => {
  const [messages, setMessages] = useLocalStorage<CoachMessage[]>('family_os_coach_chat', []);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const readableDocs = useMemo(
    () => documents.filter(d => d.extractedText && d.extractedText.trim().length > 0),
    [documents],
  );

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const sendMessage = async (prompt: string) => {
    const text = prompt.trim();
    if (!text || isThinking) return;
    if (!aiDocAccess) {
      setError('Enable AI Document Access to start chatting.');
      return;
    }

    const userMsg: CoachMessage = {
      id: `m-${Date.now()}-u`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setError(null);
    setIsThinking(true);

    try {
      const apiKey = import.meta.env.VITE_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key is not configured. Add VITE_API_KEY to your .env file.');
      }

      const ai = new GoogleGenAI({ apiKey });
      const docContext = buildDocContext(documents);

      const today = new Date().toISOString().split('T')[0];
      const systemInstruction = [
        `Today's date is ${today}.`,
        'You are Family Coach, an AI assistant grounded in the family\'s saved documents.',
        'Answer questions clearly and concisely. When you reference a specific document, mention it by name.',
        'If the answer is not in the documents below, say so plainly rather than guessing.',
        'Be warm but factual. Use plain prose — no bullet lists unless the user asks for one.',
        '',
        docContext
          ? `=== FAMILY DOCUMENTS (${readableDocs.length}) ===\n${docContext}\n=== END DOCUMENTS ===`
          : 'NO DOCUMENTS HAVE BEEN SCANNED YET. Tell the user to use Magic Scan in the Document Vault to add documents you can read.',
      ].join('\n');

      // Build a short chat history (last 6 turns) so the model has continuity
      const history = messages.slice(-6).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          ...history,
          { role: 'user', parts: [{ text }] },
        ],
        config: { systemInstruction },
      });

      const answer = (result.text ?? '').trim() || 'I wasn\'t able to come up with an answer for that one.';

      // Heuristic: detect which docs got referenced by name in the response
      const referencedIds = readableDocs
        .filter(d => answer.toLowerCase().includes(d.name.toLowerCase()))
        .map(d => d.id);

      const assistantMsg: CoachMessage = {
        id: `m-${Date.now()}-a`,
        role: 'assistant',
        content: answer,
        sourceDocIds: referencedIds.length > 0 ? referencedIds : undefined,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Something went wrong talking to Gemini.';
      setError(msg);
      // Roll back the user message? No — keep it visible so user can retry.
    } finally {
      setIsThinking(false);
    }
  };

  const clearChat = () => {
    if (messages.length === 0) return;
    if (confirm('Clear the entire chat history?')) {
      setMessages([]);
      setError(null);
    }
  };

  const docById = (id: string) => documents.find(d => d.id === id);

  // ── Gate screen ─────────────────────────────────────────────────────
  if (!aiDocAccess) {
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <MessagesSquare size={28} className="text-indigo-600" />
            Family Coach
          </h1>
          <p className="text-slate-500 mt-1">
            An AI assistant grounded in your saved family documents.
          </p>
        </header>

        <div className="bg-white border rounded-2xl notion-shadow p-8 max-w-2xl">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
            <Lock size={28} className="text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Turn on AI Document Access</h2>
          <p className="text-sm text-slate-600 mt-2">
            For your privacy, the Family Coach is <strong>off by default</strong>. Enabling it allows Gemini to read the text from documents you scan into the vault so it can answer questions about them.
          </p>

          <div className="mt-6 space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900">What gets sent</p>
                <p className="text-slate-600 text-xs mt-0.5">Only the OCR'd text of documents you've explicitly scanned with Magic Scan. Other Family OS data (calendar, finance, chores) is not included.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900">Where it goes</p>
                <p className="text-slate-600 text-xs mt-0.5">Each chat turn is sent to Google's Gemini API. Document text is stored locally in your browser, not on a server.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900">How to turn it off</p>
                <p className="text-slate-600 text-xs mt-0.5">Flip this toggle off any time in Settings → Privacy. You can also wipe all stored document text in one click.</p>
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            {onEnableAiDocAccess && (
              <button
                onClick={onEnableAiDocAccess}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors text-sm shadow-sm"
              >
                <Sparkles size={16} /> Enable AI Document Access
              </button>
            )}
            <Link
              to="/settings"
              className="flex items-center gap-2 bg-white border text-slate-700 px-5 py-2.5 rounded-xl font-semibold hover:border-slate-300 transition-colors text-sm"
            >
              Manage in Settings
            </Link>
          </div>

          <p className="text-[11px] text-slate-400 mt-5 leading-relaxed">
            By enabling, you agree to Google's Gemini API terms for the content sent during chat. Family OS does not train any model on your documents.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <MessagesSquare size={28} className="text-indigo-600" />
            Family Coach
          </h1>
          <p className="text-slate-500 mt-1">
            Ask questions about your scanned documents — policies, forms, records, expiry dates.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/documents"
            className="flex items-center gap-2 bg-white border text-slate-600 px-3 py-2 rounded-lg font-semibold hover:border-indigo-300 hover:text-indigo-600 transition-colors text-xs"
          >
            <ScanLine size={14} /> Scan more docs
          </Link>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-2 bg-white border text-slate-500 px-3 py-2 rounded-lg font-semibold hover:border-red-200 hover:text-red-600 transition-colors text-xs"
            >
              <Trash2 size={14} /> Clear chat
            </button>
          )}
        </div>
      </header>

      {/* Context summary */}
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
        <Sparkles size={20} className="text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          {readableDocs.length === 0 ? (
            <div>
              <p className="font-semibold text-slate-900">No readable documents yet.</p>
              <p className="text-slate-600 mt-0.5">
                The Coach grounds answers in your scanned documents. Head to{' '}
                <Link to="/documents" className="text-indigo-600 font-semibold underline">Document Vault</Link>{' '}
                and use <strong>Magic Scan</strong> to add one.
              </p>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-slate-900">
                Reading {readableDocs.length} document{readableDocs.length > 1 ? 's' : ''}
              </p>
              <p className="text-slate-600 mt-0.5 line-clamp-2">
                {readableDocs.map(d => d.name).join(' · ')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chat surface */}
      <div className="bg-white border rounded-2xl notion-shadow overflow-hidden flex flex-col" style={{ minHeight: '520px' }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5" style={{ maxHeight: '60vh' }}>
          {messages.length === 0 && !isThinking && (
            <div className="text-center py-10">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bot size={28} className="text-indigo-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Ask me anything about your documents</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                I've read everything you've scanned into the vault. Try one of these to start:
              </p>
              <div className="mt-5 flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                {SUGGESTED_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p.replace(/^[^\s]+\s/, ''))}
                    className="bg-slate-50 hover:bg-indigo-50 border text-slate-700 hover:text-indigo-700 hover:border-indigo-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-slate-200' : 'bg-indigo-600'}`}>
                {m.role === 'user'
                  ? <UserIcon size={16} className="text-slate-600" />
                  : <Bot size={16} className="text-white" />}
              </div>
              <div className={`max-w-[80%] ${m.role === 'user' ? 'items-end' : ''}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-900 rounded-tl-sm'}`}>
                  {m.content}
                </div>
                {m.role === 'assistant' && m.sourceDocIds && m.sourceDocIds.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.sourceDocIds.map(id => {
                      const doc = docById(id);
                      if (!doc) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full"
                        >
                          <FileText size={10} /> {doc.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-white" />
              </div>
              <div className="bg-slate-100 px-4 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-2 text-sm text-slate-600">
                <Loader2 size={14} className="animate-spin" /> Reading your docs…
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-100 flex items-center gap-2 text-red-600 text-xs">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={e => { e.preventDefault(); sendMessage(input); }}
          className="border-t p-4 flex gap-2 bg-slate-50/40"
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={readableDocs.length === 0 ? 'Scan a document first to start chatting…' : 'Ask about a document…'}
            className="flex-1 px-4 py-2.5 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isThinking}
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            className="bg-indigo-600 text-white rounded-xl px-4 py-2.5 font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
          >
            <Send size={16} />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default FamilyCoach;
