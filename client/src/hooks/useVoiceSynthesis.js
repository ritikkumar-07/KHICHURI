import { useState, useCallback, useEffect } from "react";

export function useVoiceSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback((text, language = "en-IN", onEnd = null) => {
    if (!window.speechSynthesis) {
      if (onEnd) onEnd();
      return;
    }

    // Always cancel active speech before starting new speech to prevent voice queue lockups
    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    
    // Map internal languages to BCP-47 for synthesis
    const langMap = {
      "English": "en-IN",
      "Hindi": "hi-IN",
      "Bengali": "bn-IN",
      "Marathi": "mr-IN",
      "Gujarati": "gu-IN",
      "Telugu": "te-IN",
      "Tamil": "ta-IN"
    };
    
    const bcp47 = langMap[language] || language || "en-IN";
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = bcp47;

    const cleanup = () => {
      setIsSpeaking(false);
      if (onEnd) onEnd();
    };

    utterance.onend = cleanup;
    utterance.onerror = (err) => {
      console.warn("[SpeechSynthesis Error]:", err);
      cleanup();
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("[SpeechSynthesis Exception]:", err);
      cleanup();
    }
  }, []);
  
  const stop = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { speak, stop, isSpeaking };
}

