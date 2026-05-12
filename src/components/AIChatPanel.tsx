
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Sparkles, X, Send, Loader2, Bot, User as UserIcon, Lightbulb, Mic, MicOff, Volume2, VolumeX, Square } from 'lucide-react';
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

// Detect Safari — it doesn't support Web Speech API reliably
const isSafari = typeof navigator !== 'undefined' &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Strip markdown for TTS
function stripForSpeech(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/[*_~`>]/g, '')
    .trim();
}

// ── Voice Overlay ──────────────────────────────────────────────────────────────

interface VoiceOverlayProps {
  status: 'idle' | 'listening' | 'thinking' | 'speaking';
  transcript: string;
  lastResponse: string;
  error: string | null;
  isSafariMode: boolean;
  onStart: () => void;
  onStop: () => void;
  onMute: () => void;
  onSwitchToChat: () => void;
  onClose: () => void;
}

const VoiceOverlay: React.FC<VoiceOverlayProps> = ({
  status, transcript, lastResponse, error, isSafariMode,
  onStart, onStop, onMute, onSwitchToChat, onClose,
}) => {
  const cfg = {
    idle:      { label: isSafariMode ? 'Tap to record' : 'Tap to speak', orb: 'bg-indigo-600 shadow-indigo-400', pulse: false },
    listening: { label: isSafariMode ? 'Recording — tap to send' : 'Listening…', orb: 'bg-red-500 shadow-red-400', pulse: true  },
    thinking:  { label: 'Thinking…',  orb: 'bg-amber-400 shadow-amber-300',     pulse: false },
    speaking:  { label: 'Speaking…',  orb: 'bg-emerald-500 shadow-emerald-400', pulse: true  },
  }[status];

  const handleOrb = () => {
    if (status === 'idle')      onStart();
    else if (status === 'listening') onStop();
    else if (status === 'speaking')  onMute();
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-between bg-slate-950 p-6">
      {/* Header */}
      <div className="w-full flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-500 rounded-md flex items-center justify-center">
            <Sparkles size={13} className="text-white" />
          </div>
          <span className="text-white text-sm font-bold">Voice Mode</span>
          {isSafariMode && <span className="text-indigo-400 text-xs">(Gemini STT)</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onSwitchToChat} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors">
            <Send size={12} /> Text chat
          </button>
          <button onClick={onClose} className="text-white/50 hover:text-white p-1 transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Orb */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={handleOrb}
          disabled={status === 'thinking'}
          className={`w-32 h-32 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 active:scale-95
            ${cfg.orb} ${cfg.pulse ? 'animate-pulse' : ''} ${status === 'thinking' ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:opacity-90'}`}
        >
          {status === 'thinking'  ? <Loader2 size={44} className="text-white animate-spin" /> :
           status === 'speaking'  ? <VolumeX size={44} className="text-white" /> :
           status === 'listening' ? (isSafariMode ? <Square size={44} className="text-white" /> : <MicOff size={44} className="text-white" />) :
                                    <Mic size={44} className="text-white" />}
        </button>
        <p className="text-white/70 text-sm font-medium">{cfg.label}</p>
      </div>

      {/* Content area */}
      <div className="w-full space-y-3 max-h-56 overflow-y-auto">
        {error ? (
          <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-4 space-y-3 text-center">
            <p className="text-red-300 text-sm leading-relaxed">{error}</p>
            <button onClick={onSwitchToChat} className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors">
              <Send size={12} /> Use text chat instead
            </button>
          </div>
        ) : (
          <>
            {transcript && (
              <div className="bg-white/10 rounded-2xl p-4">
                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1 font-bold">You said</p>
                <p className="text-white text-sm leading-relaxed">{transcript}</p>
              </div>
            )}
            {lastResponse && (
              <div className="bg-indigo-500/20 border border-indigo-500/30 rounded-2xl p-4">
                <p className="text-[10px] text-indigo-300 uppercase tracking-widest mb-1 font-bold">Assistant</p>
                <p className="text-white text-sm leading-relaxed">{lastResponse}</p>
              </div>
            )}
            {!transcript && !lastResponse && status === 'idle' && (
              <p className="text-center text-white/30 text-xs">Tap the orb to start talking</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

const AIChatPanel: React.FC<AIChatPanelProps> = ({ familyContext }) => {
  const [isOpen, setIsOpen]         = useState(false);
  const [voiceMode, setVoiceMode]   = useState(false);
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [input, setInput]           = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false); // Gemini STT phase (separate from AI response)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastResponse, setLastResponse]     = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceError, setVoiceError]         = useState<string | null>(null);
  const [isRecording, setIsRecording]       = useState(false); // Safari MediaRecorder state

  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLInputElement>(null);
  const voiceModeRef      = useRef(voiceMode);
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const streamRef         = useRef<MediaStream | null>(null);
  // Ref keeps sendMessage always fresh inside stopRecordingAndTranscribe (fixes stale closure)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendMessageRef    = useRef<(text: string, fromVoice?: boolean) => Promise<void>>(async () => {});
  // Tracks whether TTS actually started — used to detect silent iOS blocking
  const isSpeakingRef     = useRef(false);

  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);

  // ── TTS ─────────────────────────────────────────────────────────────────
  const speakText = useCallback((text: string, onDone?: () => void) => {
    if (!window.speechSynthesis) { onDone?.(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(stripForSpeech(text));
    utt.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Google')))
      ?? voices.find(v => v.lang.startsWith('en'));
    if (preferred) utt.voice = preferred;

    // Guard so onDone fires exactly once regardless of which path triggers it
    let doneCalled = false;
    const done = () => {
      if (doneCalled) return;
      doneCalled = true;
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      onDone?.();
    };

    utt.onstart = () => { setIsSpeaking(true); isSpeakingRef.current = true; };
    utt.onend   = done;
    utt.onerror = done;
    window.speechSynthesis.speak(utt);

    // iOS Safari often blocks speechSynthesis silently in async contexts —
    // onstart/onend/onerror never fire. After 1.5 s, if TTS hasn't started,
    // call onDone anyway so voice-mode auto-restarts listening.
    setTimeout(() => { if (!isSpeakingRef.current) done(); }, 1500);
  }, []); // isSpeakingRef is a ref, not reactive — safe to omit from deps

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    isSpeakingRef.current = false;
  }, []);

  // ── Web Speech API (Chrome/Edge) ─────────────────────────────────────────
  const { isListening, isSupported: nativeSpeechSupported, startListening, stopListening } = useSpeechInput({
    onTranscript:      (t) => { setInput(t); if (voiceModeRef.current) setVoiceTranscript(t); },
    onFinalTranscript: (t) => {
      setInput(t);
      if (voiceModeRef.current) { setVoiceTranscript(t); setTimeout(() => sendMessage(t, true), 300); }
    },
    onError: (err) => {
      if (err.includes('no-speech')) return;
      setVoiceError('Microphone error. Try switching to text chat.');
    },
  });

  // Use Web Speech on Chrome, MediaRecorder+Gemini on Safari
  const useGeminiSTT = isSafari || !nativeSpeechSupported;
  const speechSupported = nativeSpeechSupported || (typeof navigator !== 'undefined' && !!navigator.mediaDevices);

  // ── Gemini STT (Safari / MediaRecorder) ─────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
        : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setVoiceError(null);
    } catch {
      setVoiceError('Could not access microphone. Check System Settings → Privacy & Security → Microphone.');
    }
  }, []);

  const stopRecordingAndTranscribe = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    setIsRecording(false);
    setIsTranscribing(true); // Use separate state so isLoading stays false → sendMessage won't bail out
    setVoiceTranscript('');

    recorder.onstop = async () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const chunks = audioChunksRef.current;
      if (!chunks.length) { setIsTranscribing(false); return; }

      const blob = new Blob(chunks, { type: chunks[0].type });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const mimeType = blob.type || 'audio/mp4';
        try {
          const apiKey = import.meta.env.VITE_API_KEY || '';
          const ai = new GoogleGenAI({ apiKey });
          const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ parts: [
              { inlineData: { data: base64, mimeType } },
              { text: 'Transcribe exactly what is spoken. Return only the spoken words, nothing else.' }
            ]}],
          });
          const transcript = result.text?.trim() ?? '';
          if (transcript) {
            setVoiceTranscript(transcript);
            setIsTranscribing(false); // Clear BEFORE calling sendMessage so isLoading guard sees false
            // Use ref so we always call the latest sendMessage, not a stale closure
            await sendMessageRef.current(transcript, true);
          } else {
            setIsTranscribing(false);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
          setVoiceError(isQuota
            ? '⚠️ API quota exceeded. Wait a moment and try again.'
            : 'Could not transcribe audio. Please try again.');
          setIsTranscribing(false);
        }
      };
      reader.readAsDataURL(blob);
    };
    recorder.stop();
  }, []); // stopRecordingAndTranscribe is stable; sendMessage accessed via ref above

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string, fromVoice = false) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (fromVoice) setVoiceTranscript('');
    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_API_KEY || '';
      if (!apiKey) throw new Error('No API key');

      const ai = new GoogleGenAI({ apiKey });
      const history = [
        ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
        { role: 'user', parts: [{ text: text.trim() }] },
      ];
      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: history,
        config: { systemInstruction: `You are a helpful family assistant inside "Family OS". Be warm, concise, practical. Use emoji occasionally. Keep responses to 2-4 paragraphs max.\n\nFamily context:\n${familyContext}` },
      });

      const responseText = result.text || "Sorry, I couldn't generate a response.";
      setMessages(prev => [...prev, { id: `msg-${Date.now()}-ai`, role: 'assistant', content: responseText }]);
      setLastResponse(responseText);

      if (fromVoice || voiceModeRef.current) {
        // Single-fire guard: speakText's onDone callback and the 1.5s iOS
        // fallback inside speakText both eventually call this. The doneCalled
        // guard inside speakText ensures it fires exactly once.
        speakText(responseText, () => {
          if (!voiceModeRef.current) return;
          if (useGeminiSTT) startRecording();   // Safari: start recording again
          else startListening();                 // Chrome: start listening again
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
      const errText = isQuota
        ? '⚠️ API quota exceeded. Wait a moment and try again.'
        : '⚠️ Unable to connect to AI. Check your Gemini API key.';
      setMessages(prev => [...prev, { id: `msg-${Date.now()}-err`, role: 'assistant', content: errText }]);
      // Surface the error in the voice overlay too (it's hidden behind the overlay in voice mode)
      if (fromVoice || voiceModeRef.current) {
        setVoiceError(errText);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, familyContext, speakText, startListening, useGeminiSTT, startRecording]);

  // Keep sendMessageRef in sync so async callbacks always use the latest version
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  // ── Voice mode controls ───────────────────────────────────────────────────
  const enterVoiceMode = useCallback(async () => {
    // Fast-fail if the Gemini key is missing (needed for Safari STT + all AI chat)
    const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
    if (!apiKey) {
      setVoiceMode(true);
      setIsOpen(true);
      setVoiceError('Add VITE_API_KEY to your .env file to enable voice mode.');
      return;
    }

    setVoiceMode(true);
    setIsOpen(true);
    setVoiceError(null);
    stopSpeaking();

    // iOS Safari blocks speechSynthesis.speak() in async callbacks unless we
    // "unlock" TTS with a silent utterance during the user-gesture frame.
    if (window.speechSynthesis) {
      const unlock = new SpeechSynthesisUtterance('');
      unlock.volume = 0;
      window.speechSynthesis.speak(unlock);
    }

    if (useGeminiSTT) {
      // Safari / fallback: use MediaRecorder + Gemini STT
      await startRecording();
    } else {
      // Chrome / Edge: Web Speech API handles its own mic permission internally.
      // Do NOT open a separate getUserMedia stream — it conflicts with Web Speech.
      startListening();
    }
  }, [useGeminiSTT, startRecording, startListening, stopSpeaking]);

  const exitVoiceMode = useCallback(() => {
    setVoiceMode(false);
    stopListening();
    stopSpeaking();
    setVoiceTranscript('');
    setIsRecording(false);
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, [stopListening, stopSpeaking]);

  const switchToChat = useCallback(() => { exitVoiceMode(); setIsOpen(true); }, [exitVoiceMode]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (isOpen && !voiceMode) inputRef.current?.focus(); }, [isOpen, voiceMode]);
  useEffect(() => { if (!isOpen) { stopSpeaking(); stopListening(); } }, [isOpen, stopSpeaking, stopListening]);

  const voiceStatus: 'idle' | 'listening' | 'thinking' | 'speaking' =
    isSpeaking ? 'speaking' : (isLoading || isTranscribing) ? 'thinking' : (isListening || isRecording) ? 'listening' : 'idle';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <>
      {/* FAB */}
      {!isOpen && (
        <button
          onClick={speechSupported ? enterVoiceMode : () => { setIsOpen(true); setVoiceMode(false); }}
          aria-label="Talk to AI"
          className="fixed bottom-6 right-4 md:right-6 z-50 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white pl-4 pr-5 py-3 rounded-full shadow-xl shadow-indigo-300/50 transition-all hover:scale-105 active:scale-95"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <Mic size={18} />
          <span className="text-sm font-semibold">Ask AI</span>
        </button>
      )}

      {/* Panel */}
      <div className={`fixed inset-y-0 right-0 z-[120] w-full max-w-md transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full bg-white border-l shadow-2xl flex flex-col relative overflow-hidden">

          {/* Voice overlay */}
          {voiceMode && (
            <VoiceOverlay
              status={voiceStatus}
              transcript={voiceTranscript}
              lastResponse={lastResponse}
              error={voiceError}
              isSafariMode={useGeminiSTT}
              onStart={() => { setVoiceError(null); useGeminiSTT ? startRecording() : startListening(); }}
              onStop={() => { useGeminiSTT ? stopRecordingAndTranscribe() : stopListening(); }}
              onMute={stopSpeaking}
              onSwitchToChat={switchToChat}
              onClose={() => { exitVoiceMode(); setIsOpen(false); }}
            />
          )}

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-indigo-50/50 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Family AI Assistant</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Powered by Gemini</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {speechSupported && (
                <button onClick={enterVoiceMode} title="Voice mode"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full transition-colors">
                  <Mic size={13} /> Voice
                </button>
              )}
              {isSpeaking && (
                <button onClick={stopSpeaking} className="p-2 hover:bg-slate-200 rounded-full text-indigo-500 transition-colors">
                  <VolumeX size={16} />
                </button>
              )}
              <button onClick={() => { setIsOpen(false); exitVoiceMode(); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                  <Bot size={32} className="text-indigo-400" />
                </div>
                <h4 className="font-bold text-slate-900 mb-1">Hi there! 👋</h4>
                <p className="text-sm text-slate-500 mb-6">Ask me anything about your family's schedule, meals, budget, and more.</p>
                <div className="w-full space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                    <Lightbulb size={12} /><span>Quick prompts</span>
                  </div>
                  {QUICK_PROMPTS.map((qp, i) => (
                    <button key={i} onClick={() => sendMessage(qp.prompt)}
                      className="w-full text-left p-3 bg-slate-50 hover:bg-indigo-50 border hover:border-indigo-200 rounded-xl text-sm text-slate-700 transition-colors">
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot size={14} className="text-indigo-600" />
                    </div>
                  )}
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-slate-100 text-slate-800 rounded-bl-md'
                  }`}>
                    {msg.content}
                    {msg.role === 'assistant' && (
                      <button onClick={() => speakText(msg.content)} title="Read aloud"
                        className="ml-2 inline-flex items-center opacity-40 hover:opacity-80 transition-opacity">
                        <Volume2 size={12} />
                      </button>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <UserIcon size={14} className="text-white" />
                    </div>
                  )}
                </div>
              ))
            )}
            {(isLoading || isTranscribing) && (
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

          {/* Input bar */}
          <div className="p-4 border-t bg-white flex-shrink-0">
            {isListening && (
              <div className="mb-2 flex items-center gap-2 text-xs text-red-500 font-semibold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Listening…
              </div>
            )}
            <div className="flex items-center gap-2 bg-slate-50 border rounded-xl p-1">
              <input ref={inputRef} type="text" value={input}
                onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Ask about your family…"
                className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
                disabled={isLoading} />
              {!useGeminiSTT && nativeSpeechSupported && (
                <button onClick={isListening ? stopListening : startListening}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    isListening ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                  }`}>
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
                className="w-9 h-9 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg flex items-center justify-center transition-colors">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-[115] bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => { setIsOpen(false); exitVoiceMode(); }} />
      )}
    </>
  );
};

export default AIChatPanel;
