import { useState, useRef, useCallback, useEffect } from 'react';

interface SpeechInputOptions {
  /** Called each time the transcript updates (interim + final) */
  onTranscript?: (text: string) => void;
  /** Called when a final result is committed */
  onFinalTranscript?: (text: string) => void;
  /** Called on recognition error */
  onError?: (err: string) => void;
  /** Language tag, defaults to 'en-US' */
  lang?: string;
  /** Whether to accumulate text across pauses or reset each session. Default: false */
  continuous?: boolean;
}

export interface SpeechInputResult {
  transcript: string;
  isListening: boolean;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

// Safely access the browser Speech Recognition API
const SpeechRecognition =
  (typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
  null;

export function useSpeechInput(options: SpeechInputOptions = {}): SpeechInputResult {
  const { onTranscript, onFinalTranscript, onError, lang = 'en-US', continuous = false } = options;

  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const accumulatedRef = useRef('');

  // Keep callback refs up-to-date so handlers always call the latest version,
  // even if the parent re-renders with new function references while listening.
  const onTranscriptRef = useRef(onTranscript);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onFinalTranscriptRef.current = onFinalTranscript;
    onErrorRef.current = onError;
  }, [onTranscript, onFinalTranscript, onError]);

  const isSupported = SpeechRecognition !== null;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || isListening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      accumulatedRef.current = '';
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        accumulatedRef.current += final;
        setTranscript(accumulatedRef.current);
        onTranscriptRef.current?.(accumulatedRef.current);
        onFinalTranscriptRef.current?.(accumulatedRef.current);
      } else if (interim) {
        const display = accumulatedRef.current + interim;
        setTranscript(display);
        onTranscriptRef.current?.(display);
      }
    };

    recognition.onerror = (event: any) => {
      const errMsg = event.error === 'not-allowed'
        ? 'Microphone permission denied.'
        : event.error === 'no-speech'
        ? 'No speech detected.'
        : `Speech recognition error: ${event.error}`;
      onErrorRef.current?.(errMsg);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      onErrorRef.current?.('Could not start speech recognition.');
    }
  // Callbacks intentionally omitted — accessed via refs above to avoid stale closures
  }, [isSupported, isListening, lang, continuous]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    accumulatedRef.current = '';
    setTranscript('');
  }, []);

  return { transcript, isListening, isSupported, startListening, stopListening, resetTranscript };
}
