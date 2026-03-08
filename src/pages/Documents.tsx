
import React, { useState, useMemo } from 'react';
import { FamilyDocument, DocumentCategory } from '../types';
import { FolderOpen, Plus, X, AlertTriangle, CheckCircle2, Trash2, Calendar, Search } from 'lucide-react';

interface DocumentsProps {
  documents: FamilyDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<FamilyDocument[]>>;
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

const Documents: React.FC<DocumentsProps> = ({ documents, setDocuments }) => {
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: 'Other' as DocumentCategory, expiryDate: '', notes: '', fileUrl: '' });

  const filtered = useMemo(() => documents.filter(doc => {
    const matchCat = activeCategory === 'All' || doc.category === activeCategory;
    const matchSearch = !search || doc.name.toLowerCase().includes(search.toLowerCase()) || (doc.notes ?? '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [documents, activeCategory, search]);

  const handleAdd = () => {
    if (!form.name) return;
    setDocuments(prev => [{
      id: `d-${Date.now()}`,
      familyId: 'fam-1',
      name: form.name,
      category: form.category,
      expiryDate: form.expiryDate || undefined,
      notes: form.notes || undefined,
      fileUrl: form.fileUrl || undefined,
      createdAt: new Date().toISOString().split('T')[0],
    }, ...prev]);
    setAddOpen(false);
    setForm({ name: '', category: 'Other', expiryDate: '', notes: '', fileUrl: '' });
  };

  const deleteDoc = (id: string) => {
    setDeletingId(id);
    setTimeout(() => { setDocuments(prev => prev.filter(d => d.id !== id)); setDeletingId(null); }, 300);
  };

  const expiringCount = documents.filter(d => { const days = daysUntilExpiry(d.expiryDate); return days !== null && days <= 60; }).length;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Document Vault</h1>
          <p className="text-slate-500 mt-1">Track important family documents and expiration dates.</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm text-sm">
          <Plus size={18} /> Add Document
        </button>
      </header>

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
            placeholder="Search documents..."
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
            return (
              <div key={doc.id} className={`group bg-white border rounded-2xl p-5 notion-shadow transition-all duration-300 hover:border-indigo-200 ${deletingId === doc.id ? 'scale-95 opacity-0' : ''}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${config.bg}`}>{config.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm leading-tight truncate">{doc.name}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${config.color}`}>{doc.category}</span>
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

      {/* Add Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Document</h2>
              <button onClick={() => setAddOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
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
              <div className="flex gap-3 pt-2">
                <button onClick={() => setAddOpen(false)} className="flex-1 border rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
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
