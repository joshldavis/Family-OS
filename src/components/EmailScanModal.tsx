
import React, { useState, useRef } from 'react';
import { X, Mail, Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface EmailScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (text: string, subject: string, from: string) => Promise<void>;
  isScanning: boolean;
}

const EXAMPLE_SNIPPETS = [
  {
    label: 'ClassDojo: Behavior update',
    subject: 'Emma earned 2 points in Ms. Johnson\'s class',
    from: 'noreply@classdojo.com',
    body: 'Hi! Emma earned 2 DoJo points today in Ms. Johnson\'s 4th Grade class for "Being Helpful". Keep up the great work!',
  },
  {
    label: 'School: Field trip permission slip',
    subject: 'Permission Slip Required – Science Museum Field Trip March 20',
    from: 'office@riverside.k12.us',
    body: 'Dear Parents, Our class will be visiting the Natural History Museum on Thursday, March 20th. Please sign and return the attached permission slip by March 15th. Payment of $12 can be submitted via ParentVue or cash to the office.',
  },
  {
    label: 'School: Assignment due',
    subject: 'Reminder: Book Report Due Friday',
    from: 'ms.johnson@riverside.k12.us',
    body: 'Hello families, just a reminder that the book report for our unit on ecosystems is due this Friday, March 8th. Students should have selected their book by now.',
  },
];

const EmailScanModal: React.FC<EmailScanModalProps> = ({ isOpen, onClose, onScan, isScanning }) => {
  const [emailText, setEmailText] = useState('');
  const [subject, setSubject] = useState('');
  const [from, setFrom] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!isOpen) return null;

  const handleScan = async () => {
    if (!emailText.trim()) return;
    setError(null);
    try {
      await onScan(emailText, subject || 'Pasted Email', from || 'school@school.edu');
      setEmailText('');
      setSubject('');
      setFrom('');
      onClose();
    } catch (err) {
      setError('Failed to classify email. Please check your API key and try again.');
    }
  };

  const loadExample = (ex: typeof EXAMPLE_SNIPPETS[0]) => {
    setEmailText(ex.body);
    setSubject(ex.subject);
    setFrom(ex.from);
    setShowExamples(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center bg-indigo-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Mail size={16} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Scan School Email</h2>
              <p className="text-xs text-slate-500">Paste any school or ClassDojo email</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {isScanning ? (
          <div className="py-16 flex flex-col items-center justify-center text-center px-8">
            <div className="relative">
              <Loader2 size={44} className="text-indigo-600 animate-spin" />
              <Sparkles size={18} className="text-indigo-400 absolute -top-2 -right-2 animate-bounce" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-6">Classifying…</h3>
            <p className="text-slate-500 text-sm mt-2 max-w-xs">Claude is reading this email and routing it to the right module.</p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Optional fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Subject (optional)</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Email subject line"
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">From (optional)</label>
                <input
                  type="text"
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  placeholder="sender@school.edu"
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Email body */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Email Body</label>
              <textarea
                ref={textareaRef}
                className="w-full h-40 p-3 bg-slate-50 border rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all resize-none text-sm"
                placeholder="Paste the email text here — ClassDojo notifications, teacher emails, school newsletters, permission slip reminders…"
                value={emailText}
                onChange={e => setEmailText(e.target.value)}
              />
            </div>

            {/* Try an example */}
            <div>
              <button
                onClick={() => setShowExamples(e => !e)}
                className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:text-indigo-700"
              >
                Try an example
                {showExamples ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showExamples && (
                <div className="mt-2 space-y-2">
                  {EXAMPLE_SNIPPETS.map(ex => (
                    <button
                      key={ex.label}
                      onClick={() => loadExample(ex)}
                      className="w-full text-left px-3 py-2 text-xs bg-slate-50 hover:bg-indigo-50 border rounded-xl text-slate-600 hover:text-indigo-700 transition-colors font-medium"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              disabled={!emailText.trim()}
              onClick={handleScan}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
            >
              <Sparkles size={18} />
              Classify with Claude
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailScanModal;
