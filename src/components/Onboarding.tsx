
import React, { useState, useEffect, useRef } from 'react';
import { Send, ArrowRight } from 'lucide-react';
import { OnboardingData } from '../types';

interface OnboardingProps {
  onComplete: (data: OnboardingData) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string; // full raw content (may include <family_data> tags for API history)
}

const SYSTEM_PROMPT = `You are the Family OS setup assistant. Your job is to have a warm, friendly conversation with a parent to set up their family profile. You're like a really organized friend helping them get settled in.

RULES:
- Be conversational and warm, never robotic
- Ask ONE question at a time
- Use the parent's name once you learn it
- Keep responses to 2-3 sentences max
- Use casual, friendly language — light humor is welcome
- Never use bullet points, numbered lists, or markdown formatting

ONBOARDING FLOW (gather naturally through conversation):
1. Parent's first name
2. Spouse, partner, or any other adults who'll use the app together (e.g. co-parent, grandparent) — optional, "Just me!" is a totally valid answer
3. Family last name
4. Children — for each: name, age, grade, school
5. MODULE SELECTION — ask conversationally which features they want to use. Present them as options:
   - Schoolwork tracking (assignments, due dates, grades per child)
   - Chore management (assign tasks, track completion)
   - Family calendar (events, schedule)
   - Budgets & finance (spending, savings goals)
   - Meal planning & shopping lists
   - Allowance & rewards for kids
   - Pinboard (family sticky notes)
   - Document vault (insurance, medical, school records)
   - Insights & analytics
   - Email intelligence (auto-classify school emails)
   If they say "all of it" or "everything" or show no strong preference, enable everything. Otherwise enable only what they mention.
   Set the "modules" JSON field accordingly (true/false per module id).
6. Biggest pain point or reason they want to get organized
7. EMAIL INTELLIGENCE SETUP (only if email-intelligence module is enabled):
   Ask: "One more thing — want me to keep an eye on your email for school stuff? I can automatically spot assignments, events, and teacher messages and add them to your family dashboard. Would you like to set that up?"
   If YES: Ask which email domain their school uses (e.g. "@riverside.k12.us") and whether they use ClassDojo. Set emailConfig.enabled to true.
   If NO or LATER: That's fine! Set emailConfig.enabled to false and move on. They can enable it in Settings.

STRUCTURED DATA:
After EVERY response, append a JSON block in <family_data> tags with ALL info gathered so far:

<family_data>
{
  "status": "gathering",
  "parent": { "name": "", "email": "" },
  "additionalAdults": [],
  "familyName": "",
  "children": [{ "name": "", "age": null, "grade": "", "school": "" }],
  "priorities": [],
  "painPoints": "",
  "modules": {
    "schoolwork": true,
    "chores": true,
    "calendar": true,
    "finance": true,
    "meal-planning": true,
    "shopping": true,
    "allowance": true,
    "pinboard": true,
    "documents": true,
    "insights": true,
    "email-intelligence": true,
    "ai-scan": true
  },
  "emailConfig": {
    "enabled": false,
    "schoolDomains": [],
    "includeClassDojo": true,
    "includeGoogleClassroom": false,
    "knownSenders": []
  },
  "readyToLaunch": false
}
</family_data>

The additionalAdults array holds objects like { "name": "Alex", "relationship": "spouse" }. If none, leave it [].
All module values default to true. Only set a module to false if the parent explicitly says they don't want it.

Set status to "complete" and readyToLaunch to true ONLY when you have: parent name, family name, at least one child with name+grade, at least one priority, AND you have asked about modules AND email (even if they declined). When ready, give an excited summary mentioning all family members by name and ask if they're ready to jump in.

Start by warmly introducing yourself and asking for their name.`;

const PRIORITY_LABELS: Record<string, string> = {
  schoolwork: '📚 Schoolwork',
  chores: '🧹 Chores',
  calendar: '📅 Calendar',
  finances: '💰 Finances',
};

// Parse <family_data> block from raw assistant content
const parseFamilyData = (raw: string): { display: string; data: OnboardingData | null } => {
  const match = raw.match(/<family_data>([\s\S]*?)<\/family_data>/);
  if (!match) return { display: raw.trim(), data: null };
  try {
    const data = JSON.parse(match[1].trim()) as OnboardingData;
    const display = raw.replace(/<family_data>[\s\S]*?<\/family_data>/, '').trim();
    return { display, data };
  } catch {
    return { display: raw.trim(), data: null };
  }
};

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [familyData, setFamilyData] = useState<OnboardingData | null>(null);
  const hasInitializedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  // Kick off the conversation on mount — use ref to survive React Strict Mode double-invoke
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      callClaude([{ role: 'user' as const, content: "Hi! I'd like to set up my family." }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const callClaude = async (history: { role: 'user' | 'assistant'; content: string }[]) => {
    setIsTyping(true);
    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: history,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const json = await res.json();
      const rawContent: string = json.content?.[0]?.text || '';

      const { display, data } = parseFamilyData(rawContent);

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: rawContent, // keep full for history
      };

      setMessages(prev => [...prev, assistantMsg]);
      if (data) setFamilyData(data);
    } catch (err) {
      console.error('Claude API error:', err);
      const errMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: "⚠️ I couldn't connect to the AI. Please check that VITE_ANTHROPIC_API_KEY is set in your .env file, then refresh.",
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    // Add user message to display + history
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: text.trim(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');

    // Build API history (full raw content including <family_data> tags)
    const history = updatedMessages.map(m => ({ role: m.role, content: m.content }));
    callClaude(history);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Progress segments
  const progress = {
    name:       !!(familyData?.parent?.name),
    family:     !!(familyData?.familyName),
    kids:       !!(familyData?.children?.some(c => c.name && c.grade)),
    priorities: !!(familyData?.priorities?.length),
  };
  const progressCount = Object.values(progress).filter(Boolean).length;

  // Display text — strip <family_data> for rendering
  const getDisplay = (msg: ChatMessage) =>
    msg.role === 'assistant' ? parseFamilyData(msg.content).display : msg.content;

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{ background: '#f7f6f3', fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b"
        style={{ background: 'rgba(247,246,243,0.92)', backdropFilter: 'blur(10px)', borderColor: '#e8e6e0' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
            F
          </div>
          <span className="font-bold text-slate-900 text-base tracking-tight">Family OS</span>
        </div>
        {isTyping && (
          <div className="flex items-center gap-2 text-xs font-medium text-indigo-500 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block"></span>
            Typing…
          </div>
        )}
      </header>

      {/* ── Progress Tracker (top-right, fixed) ── */}
      <div className="fixed top-16 right-4 z-30 hidden md:block">
        <div
          className="rounded-2xl px-4 py-3 text-xs font-semibold"
          style={{
            background: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          <p className="text-slate-400 uppercase tracking-widest text-[10px] font-bold mb-2">Setup Progress</p>
          <div className="space-y-1.5">
            {[
              { key: 'name',       label: 'Your name'  },
              { key: 'family',     label: 'Family'     },
              { key: 'kids',       label: 'Kids'       },
              { key: 'priorities', label: 'Priorities' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                  progress[key as keyof typeof progress] ? 'bg-indigo-500' : 'bg-slate-200'
                }`}></div>
                <span className={`text-xs transition-colors duration-300 ${
                  progress[key as keyof typeof progress] ? 'text-slate-700 font-semibold' : 'text-slate-400'
                }`}>{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: '#e8e6e0' }}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${(progressCount / 4) * 100}%`,
                background: 'linear-gradient(90deg, #6366f1, #4f46e5)',
              }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1 text-right">{progressCount}/4</p>
        </div>
      </div>

      {/* ── Messages ── */}
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl w-full mx-auto">
        <div className="space-y-4 pb-32">
          {messages.length === 0 && !isTyping && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-4xl font-bold mb-4 shadow-xl"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4338ca)' }}>
                F
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to Family OS</h2>
              <p className="text-slate-500 text-sm max-w-xs">Setting up your family workspace in a few easy steps…</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const display = getDisplay(msg);
            const isUser = msg.role === 'user';
            const isLastAssistant = !isUser && idx === messages.length - 1;

            return (
              <div key={msg.id} style={{ animation: 'fadeInUp 0.3s ease both' }}>
                <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {/* Agent avatar */}
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-1 shadow-sm"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                      F
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? 'text-white rounded-2xl rounded-br-md'
                        : 'text-slate-800 rounded-2xl rounded-bl-md'
                    }`}
                    style={{
                      background: isUser
                        ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                        : '#efeeea',
                    }}
                  >
                    {display}
                  </div>
                </div>

                {/* Family Profile Card — shown after last assistant msg when readyToLaunch */}
                {isLastAssistant && familyData?.readyToLaunch && (
                  <div className="mt-4 ml-11">
                    <FamilyCard data={familyData} onLaunch={() => onComplete(familyData)} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-3 justify-start" style={{ animation: 'fadeInUp 0.3s ease both' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                F
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-bl-md flex gap-1.5 items-center" style={{ background: '#efeeea' }}>
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full inline-block"
                    style={{
                      background: '#9ca3af',
                      animation: `dotBounce 1.4s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ── Fixed Input Bar ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 px-4 py-4"
        style={{ background: 'rgba(247,246,243,0.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e8e6e0' }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
            placeholder="Type your message…"
            className="flex-1 px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all disabled:opacity-50"
            style={{ background: '#ffffff', border: '1.5px solid #e0deda', fontFamily: "'DM Sans', sans-serif" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
            style={{
              background: input.trim() ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#e0deda',
            }}
          >
            <Send size={18} className="text-white" />
          </button>
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40%            { transform: scale(1.0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ─── Family Profile Card ───────────────────────────────────────────────────

interface FamilyCardProps {
  data: OnboardingData;
  onLaunch: () => void;
}

const FamilyCard: React.FC<FamilyCardProps> = ({ data, onLaunch }) => {
  const priorityLabels: Record<string, string> = {
    schoolwork: '📚 Schoolwork',
    chores: '🧹 Chores',
    calendar: '📅 Calendar',
    finances: '💰 Finances',
    'schoolwork tracking': '📚 Schoolwork',
    'chore management': '🧹 Chores',
    'family calendar': '📅 Calendar',
    'finances/budgets': '💰 Finances',
  };

  const normalizePriority = (p: string) => {
    const lower = p.toLowerCase().trim();
    return priorityLabels[lower] || `✨ ${p}`;
  };

  return (
    <div
      className="rounded-3xl p-6 overflow-hidden relative"
      style={{
        background: 'linear-gradient(135deg, #312e81, #4338ca, #4f46e5)',
        color: 'white',
        fontFamily: "'DM Sans', sans-serif",
        boxShadow: '0 20px 60px rgba(79,70,229,0.35)',
        animation: 'fadeInUp 0.4s ease both',
      }}
    >
      {/* Decorative blobs */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 160, height: 160,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: '50%',
      }} />
      <div style={{
        position: 'absolute', bottom: -20, left: -20,
        width: 100, height: 100,
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '50%',
      }} />

      <div className="relative z-10 space-y-5">
        {/* Family name */}
        <div>
          <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-1">Your Family Workspace</p>
          <h3 className="text-2xl font-bold">
            The {data.familyName} Family 🏠
          </h3>
          <p className="text-indigo-200 text-sm mt-0.5">
            {data.parent.name}
            {data.additionalAdults && data.additionalAdults.length > 0 && (
              <span> · {data.additionalAdults.map(a => a.name).join(' · ')}</span>
            )}
          </p>
        </div>

        {/* Additional adults */}
        {data.additionalAdults && data.additionalAdults.length > 0 && (
          <div>
            <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-2">Adults</p>
            <div className="flex flex-wrap gap-2">
              {[{ name: data.parent.name, relationship: 'primary' }, ...data.additionalAdults].map((adult, i) => (
                <div
                  key={i}
                  className="px-3 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  <span className="font-bold">{adult.name}</span>
                  {adult.relationship && adult.relationship !== 'primary' && (
                    <span className="text-indigo-300 ml-1 text-xs capitalize">· {adult.relationship}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Children */}
        {data.children && data.children.length > 0 && (
          <div>
            <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-2">
              {data.children.length === 1 ? 'Your Child' : 'Your Kids'}
            </p>
            <div className="flex flex-wrap gap-2">
              {data.children.map((child, i) => (
                <div
                  key={i}
                  className="px-3 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  <span className="font-bold">{child.name}</span>
                  {child.grade && <span className="text-indigo-200 ml-1 text-xs">· {child.grade}</span>}
                  {child.school && <span className="text-indigo-300 ml-1 text-xs">· {child.school}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Priorities */}
        {data.priorities && data.priorities.length > 0 && (
          <div>
            <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-2">Priorities</p>
            <div className="flex flex-wrap gap-2">
              {data.priorities.map((p, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  {normalizePriority(p)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Launch button */}
        <button
          onClick={onLaunch}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-indigo-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'white',
            boxShadow: '0 0 0 0 rgba(255,255,255,0.4)',
            animation: 'pulseGlow 2s ease-in-out infinite',
          }}
        >
          Launch Family OS
          <ArrowRight size={18} />
        </button>
      </div>

      <style>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(255,255,255,0); }
        }
      `}</style>
    </div>
  );
};

export default Onboarding;
