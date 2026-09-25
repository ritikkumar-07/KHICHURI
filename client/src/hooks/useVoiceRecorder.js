import { useRef, useState } from "react";

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState();
  const transcriptRef = useRef("");
  const rec = useRef();

  const start = async (language = "en-IN") => {
    transcriptRef.current = "";
    setError(undefined);
    
    // First, try standard speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      return new Promise((resolve) => {
        rec.current = new SpeechRecognition();
        rec.current.lang = language;
        rec.current.continuous = true;
        rec.current.interimResults = false;
        
        rec.current.onstart = () => {
          setRecording(true);
          resolve(true);
        };
        
        rec.current.onresult = (event) => {
          let current = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) current += event.results[i][0].transcript;
          }
          transcriptRef.current += current + " ";
        };
        
        rec.current.onerror = async (event) => {
          if (event.error === 'network') {
            // Network error fallback to MediaRecorder
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              rec.current = new MediaRecorder(stream);
              const chunks = [];
              rec.current.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
              rec.current.onstop = () => {
                transcriptRef.current = new Blob(chunks, { type: 'audio/webm' });
              };
              rec.current.start();
              setRecording(true);
              resolve(true);
            } catch (fallbackErr) {
              setError("Network error and microphone access denied. Please type your symptoms.");
              setRecording(false);
              resolve(false);
            }
          } else if (event.error === 'no-speech') {
            // Ignore no-speech, it happens if user is quiet
          } else {
            setError("Microphone error: " + event.error);
            setRecording(false);
            resolve(false);
          }
        };
        
        rec.current.onend = () => {
          if (rec.current._manualStop) {
            setRecording(false);
          } else if (recording && typeof rec.current.start === 'function' && !(rec.current instanceof MediaRecorder)) {
            try { rec.current.start(); } catch(e) { setRecording(false); }
          } else if (!(rec.current instanceof MediaRecorder)) {
            setRecording(false);
          }
        };
        
        try {
          rec.current.start();
        } catch (err) {
          setError("Failed to start recording.");
          resolve(false);
        }
      });
    }

    // Direct fallback if no speech recognition
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      rec.current = new MediaRecorder(stream);
      const chunks = [];
      rec.current.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      rec.current.onstop = () => {
        transcriptRef.current = new Blob(chunks, { type: 'audio/webm' });
      };
      rec.current.start();
      setRecording(true);
      return true;
    } catch(e) {
      setError("Speech recognition is not supported and microphone access denied.");
      return false;
    }
  };

  const stop = () => {
    return new Promise((resolve) => {
      if (rec.current && recording) {
        rec.current._manualStop = true;
        
        if (rec.current instanceof MediaRecorder) {
          rec.current.onstop = () => {
            setRecording(false);
            rec.current.stream.getTracks().forEach(t => t.stop());
            resolve(transcriptRef.current);
          };
          rec.current.stop();
        } else {
          rec.current.onend = () => {
            setRecording(false);
            resolve(transcriptRef.current.trim());
          };
          try { rec.current.stop(); } catch(e){}
        }
      } else {
        resolve(typeof transcriptRef.current === 'string' ? transcriptRef.current.trim() : transcriptRef.current);
      }
    });
  };

  return { recording, error, start, stop };
}
