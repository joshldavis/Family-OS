
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Sparkles, X, Send, Loader2, Bot, User as UserIcon, Lightbulb, Mic, MicOff } from 'lucide-react';
import { useSpeechInput } from '../hooks/useSpeechInput';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatPanelProps {
  familyContext: string;
}

const QUICK_PROMPTS = [
  { label: '📅 Plan this week', prompt: 'Help me plan our family schedule for this week based on our current events, assignments, and chores.' },
  { label: '🍽️ Meal ideas', prompt: 'Suggest 3 quick weeknight dinner ideas for our family of 4 that are kid-friendly.' },
  { label: '✅ Productivity tips', prompt: 'Based on our current workload, give me 3 specific tips to help our family be more productive this week.' },
  { label: '💰 Budget check', prompt: 'Review our family budget and spending trends and give me a brief financial health summary.' },
];

const AIChatPanel: React.FC<AIChatPanelProps> = ({ familyContext }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isListening, isSupported: speechSupported, startListening, stopListening } = useSpeechInput({
    onFinalTranscript: (text) => setInput(text),
    onTranscript: (text) => setInput(text),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text.trim(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_API_KEY || '';
      if (!apiKey) {
        throw new Error('No API key configured');
      }

      const ai = new GoogleGenAI({ apiKey });

      const conversationHistory = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      conversationHistory.push({
        role: 'user',
        parts: [{ text: text.trim() }],
      });

      const result = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: conversationHistory,
        config: {
          systemInstruction: `You are a helpful family assistant for the Miller Family inside "Family OS" — a family management app. Be warm, concise, and practical. Use emoji occasionally. Keep responses short (2-4 paragraphs max). Here is the current family context data:\n\n${familyContext}`,
        },
      });

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: result.text || 'Sorry, I couldn\'t generate a response.',
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: '⚠️ Unable to connect to AI. Please check that your Gemini API key is set in the `.env` file as `VITE_API_KEY`.',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Assistant"
        aria-expanded={isOpen}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-200 flex items-center justify-center transition-all hover:scale-110 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <Sparkles size={24} />
      </button>

      {/* Slide-in Panel */}
      <div className={`fixed inset-y-0 right-0 z-[120] w-full max-w-md transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full bg-white border-l shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-indigo-50/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Family AI Assistant</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Powered by Gemini</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close AI Assistant"
              className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X size={18} className="text-slate-500" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                  <Bot size={32} className="text-indigo-400" />
                </div>
                <h4 className="font-bold text-slate-900 mb-1">Hi there! 👋</h4>
                <p className="text-sm text-slate-500 mb-6">
                  I'm your Family OS assistant. I can help with planning, meal ideas, budgeting, and more.
                </p>

                <div className="w-full space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                    <Lightbulb size={12} />
                    <span>Quick prompts</span>
                  </div>
                  {QUICK_PROMPTS.map((qp, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(qp.prompt)}
                      className="w-full text-left p-3 bg-slate-50 hover:bg-indigo-50 border hover:border-indigo-200 rounded-xl text-sm text-slate-700 transition-colors"
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot size={14} className="text-indigo-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-md'
                        : 'bg-slate-100 text-slate-800 rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <UserIcon size={14} className="text-white" />
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-indigo-600" />
                </div>
                <div className="bg-slate-100 p-3 rounded-2xl rounded-bl-md">
                  <Loader2 size={18} className="text-indigo-500 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t bg-white">
            {isListening && (
              <div className="mb-2 flex items-center gap-2 text-xs text-red-500 font-semibold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Listening… speak now
              </div>
            )}
            <div className="flex items-center gap-2 bg-slate-50 border rounded-xl p-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? 'Listening…' : 'Ask about your family…'}
                className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
                disabled={isLoading}
              />
              {speechSupported && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  title={isListening ? 'Stop listening' : 'Speak your question'}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    isListening
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                  }`}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="w-9 h-9 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg flex items-center justify-center transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[115] bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default AIChatPanel;
