/**
 * VoiceInput — Microphone button using the Web Speech API.
 * States: idle → listening (with waveform animation) → processing → done.
 * Transcribed text goes through the existing chat pipeline via onTranscript callback.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

type VoiceState = 'idle' | 'listening' | 'processing' | 'unsupported';

// Web Speech API types (not in all TS libs)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export default function VoiceInput({ onTranscript, disabled }: Props) {
  const [state, setState] = useState<VoiceState>('idle');
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);

  // Check for Web Speech API support
  const isSupported = typeof window !== 'undefined' && (
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setState('idle');
    setInterimText('');
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || disabled) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setState('listening');
      setInterimText('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim) {
        setInterimText(interim);
      }

      if (finalTranscript) {
        setState('processing');
        setInterimText('');
        // Short delay to show "Processing..." state
        setTimeout(() => {
          onTranscript(finalTranscript.trim());
          setState('idle');
        }, 300);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('[Voice] Recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setState('unsupported');
      } else {
        setState('idle');
      }
      setInterimText('');
    };

    recognition.onend = () => {
      if (state === 'listening') {
        setState('idle');
      }
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, disabled, onTranscript, state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const handleClick = () => {
    if (state === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) return null;

  const isListening = state === 'listening';
  const isProcessing = state === 'processing';

  return (
    <div className="relative flex items-center">
      {/* Waveform animation when listening */}
      {isListening && (
        <div className="flex items-center gap-0.5 mr-2 h-5">
          <div className="voice-wave-bar" />
          <div className="voice-wave-bar" />
          <div className="voice-wave-bar" />
          <div className="voice-wave-bar" />
          <div className="voice-wave-bar" />
        </div>
      )}

      {/* Interim text indicator */}
      {isListening && interimText && (
        <span className="text-[10px] text-red-400/70 mr-2 max-w-[120px] truncate">
          {interimText}
        </span>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <span className="text-[10px] text-purple-400 mr-2">Processing...</span>
      )}

      {/* Mic button */}
      <button
        onClick={handleClick}
        disabled={disabled || isProcessing || state === 'unsupported'}
        title={isListening ? 'Stop recording' : 'Voice input'}
        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
          isListening
            ? 'bg-red-500 text-white voice-recording hover:bg-red-600'
            : isProcessing
              ? 'bg-purple-500/20 text-purple-400 cursor-wait'
              : 'bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/10'
        }`}
      >
        {isListening ? (
          /* Stop icon */
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          /* Mic icon */
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>
    </div>
  );
}
