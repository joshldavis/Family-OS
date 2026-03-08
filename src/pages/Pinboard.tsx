
import React, { useState } from 'react';
import { PinboardNote, NoteColor, User } from '../types';
import { Pin, PinOff, Plus, Trash2, X } from 'lucide-react';

interface PinboardProps {
  notes: PinboardNote[];
  setNotes: React.Dispatch<React.SetStateAction<PinboardNote[]>>;
  users: User[];
  currentUser: User;
}

const NOTE_COLORS: NoteColor[] = ['yellow', 'blue', 'green', 'pink'];

const COLOR_CLASSES: Record<NoteColor, { bg: string; border: string; dot: string }> = {
  yellow: { bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-400'  },
  blue:   { bg: 'bg-sky-50',    border: 'border-sky-200',    dot: 'bg-sky-400'    },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-400'  },
  pink:   { bg: 'bg-pink-50',   border: 'border-pink-200',   dot: 'bg-pink-400'   },
};

const COLOR_SWATCH: Record<NoteColor, string> = {
  yellow: 'bg-amber-400', blue: 'bg-sky-400', green: 'bg-green-400', pink: 'bg-pink-400',
};

const Pinboard: React.FC<PinboardProps> = ({ notes, setNotes, users, currentUser }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newColor, setNewColor] = useState<NoteColor>('yellow');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getAuthor = (authorId: string) => users.find(u => u.id === authorId);

  const addNote = () => {
    if (!newContent.trim()) return;
    setNotes(prev => [{
      id: `n-${Date.now()}`,
      familyId: 'fam-1',
      authorId: currentUser.id,
      content: newContent.trim(),
      color: newColor,
      pinned: false,
      createdAt: new Date().toISOString().split('T')[0],
    }, ...prev]);
    setNewContent('');
    setNewColor('yellow');
    setIsAdding(false);
  };

  const togglePin = (id: string) =>
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));

  const deleteNote = (id: string) => {
    setDeletingId(id);
    setTimeout(() => { setNotes(prev => prev.filter(n => n.id !== id)); setDeletingId(null); }, 300);
  };

  const pinned = notes.filter(n => n.pinned);
  const unpinned = notes.filter(n => !n.pinned);

  const NoteCard = ({ note }: { note: PinboardNote }) => {
    const { bg, border, dot } = COLOR_CLASSES[note.color];
    const author = getAuthor(note.authorId);
    return (
      <div className={`group relative rounded-2xl border-2 p-5 transition-all duration-300 ${bg} ${border} ${deletingId === note.id ? 'scale-90 opacity-0' : 'scale-100 opacity-100'}`}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
          <div className="flex-1" />
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => togglePin(note.id)} title={note.pinned ? 'Unpin' : 'Pin'} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-white/60 transition-colors">
              {note.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
            <button onClick={() => deleteNote(note.id)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-white/60 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
          {note.pinned && <Pin size={14} className="text-slate-400 flex-shrink-0" />}
        </div>
        <p className="text-slate-800 text-sm leading-relaxed">{note.content}</p>
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-black/5">
          {author?.avatar && <img src={author.avatar} className="w-5 h-5 rounded-full" alt={author.name} />}
          <p className="text-[10px] text-slate-400 font-medium">{author?.name?.split(' ')[0]} · {note.createdAt}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Family Pinboard</h1>
          <p className="text-slate-500 mt-1">Leave notes, reminders, and announcements for the whole family.</p>
        </div>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm text-sm">
            <Plus size={18} /> Add Note
          </button>
        )}
      </header>

      {/* Inline add form */}
      {isAdding && (
        <div className="bg-white border-2 border-indigo-200 rounded-2xl p-6 animate-in slide-in-from-top-4 duration-200 notion-shadow">
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-slate-900">New Note</p>
            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <textarea
            autoFocus
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addNote(); }}
            rows={3}
            className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-4"
            placeholder="What's on your mind? (⌘+Enter to save)"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-400 font-medium mr-1">Color:</p>
              {NOTE_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${COLOR_SWATCH[c]} ${newColor === c ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : 'hover:scale-110'}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm font-semibold border rounded-xl hover:bg-slate-50 text-slate-600">Cancel</button>
              <button onClick={addNote} disabled={!newContent.trim()} className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">Post Note</button>
            </div>
          </div>
        </div>
      )}

      {/* Pinned */}
      {pinned.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Pin size={14} className="text-slate-400" />
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pinned</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinned.map(note => <NoteCard key={note.id} note={note} />)}
          </div>
        </section>
      )}

      {/* Unpinned */}
      {unpinned.length > 0 && (
        <section>
          {pinned.length > 0 && <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">All Notes</h3>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unpinned.map(note => <NoteCard key={note.id} note={note} />)}
          </div>
        </section>
      )}

      {notes.length === 0 && !isAdding && (
        <div className="bg-white border-2 border-dashed rounded-2xl p-16 text-center">
          <p className="text-4xl mb-4">📌</p>
          <p className="font-bold text-slate-700 text-lg">The board is empty</p>
          <p className="text-slate-400 text-sm mt-2">Add a note to get started.</p>
          <button onClick={() => setIsAdding(true)} className="mt-6 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors text-sm">
            Add First Note
          </button>
        </div>
      )}
    </div>
  );
};

export default Pinboard;
