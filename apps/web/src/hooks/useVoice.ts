"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface SpeechRecognitionResult {
  transcript: string;
}

interface SpeechRecognitionResultList {
  [index: number]: {
    [index: number]: SpeechRecognitionResult;
  };
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: unknown) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export const useVoice = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [hasSupport, setHasSupport] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      // Use microtask to avoid "setState synchronously within an effect" lint error
      // and ensure hydration matches (starts false on both, then updates on client)
      Promise.resolve().then(() => setHasSupport(true));
      const rec = new SpeechRecognition() as SpeechRecognitionInstance;
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let text = event.results[0][0].transcript;

        // Initial trim and remove trailing period (often auto-inserted by speech engines)
        text = text.trim();
        if (text.endsWith(".")) {
          text = text.slice(0, -1);
        }

        // Normalize technical inputs (especially emails)
        // Convert " dot " to ".", " at " to "@", etc.
        text = text
          .toLowerCase()
          .replace(/\s+dot\s+/gi, ".")
          .replace(/\s+at\s+/gi, "@")
          .replace(/\s+underscore\s+/gi, "_")
          .replace(/\s+dash\s+/gi, "-")
          .replace(/\s+hyphen\s+/gi, "-");

        // Remove spaces if it looks like an email attempt
        if (text.includes("@") || text.includes(".")) {
          text = text.replace(/\s+/g, "");
        }

        // Final sanity check: remove any trailing dot that might have persisted
        // after space removal (e.g., "gmail . com ." -> "gmail.com.")
        if (text.endsWith(".")) {
          text = text.slice(0, -1);
        }

        setTranscript(text);
        setIsListening(false);
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      if (isListening) {
        console.warn("Speech recognition is already in progress.");
        return;
      }
      try {
        setTranscript("");
        setIsListening(true);
        recognitionRef.current.start();
      } catch (e) {
        console.error("Speech recognition start failed:", e);
        setIsListening(false);
      }
    } else {
      alert("Speech recognition not supported in this browser.");
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    hasSupport,
  };
};
