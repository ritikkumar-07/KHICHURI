import { useState, useCallback, useEffect, useRef } from "react";
import { Mic, Square, VolumeX } from "lucide-react";
import { useVoiceSynthesis } from "../../hooks/useVoiceSynthesis";
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder";
import { VoiceWaveform } from "./VoiceWaveform";

export function VoiceConsultation({ onSpeechResult, language = "English", spokenText = "" }) {
  const [isListening, setIsListening] = useState(false);
  const { speak, stop, isSpeaking } = useVoiceSynthesis();
  const voiceRecorder = useVoiceRecorder();

  // Speak incoming response text
  useEffect(() => {
    if (spokenText) {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsListening(false);
      speak(spokenText, language, () => {
        setIsListening(false);
      });
    }
  }, [spokenText, language, speak]);

  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);

  const cleanupAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(console.error);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanupAudioAnalysis();
  }, [cleanupAudioAnalysis]);

  const stopRecording = useCallback(async () => {
    setIsListening(false);
    cleanupAudioAnalysis();
    const audioBlob = await voiceRecorder.stop();
    if (audioBlob && onSpeechResult) {
      onSpeechResult(audioBlob);
    }
  }, [voiceRecorder, onSpeechResult, cleanupAudioAnalysis]);

  const handleToggleListen = useCallback(async () => {
    if (isListening || voiceRecorder.recording) {
      await stopRecording();
    } else {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      stop();
      setIsListening(true);
      try {
        await voiceRecorder.start(language);
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let lastAudioTime = Date.now();

        const checkAudioLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const averageVolume = sum / dataArray.length;

          if (averageVolume > 10) {
            lastAudioTime = Date.now();
          }

          if (Date.now() - lastAudioTime >= 3000) {
            stopRecording();
            return;
          }
          
          animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
        };
        
        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      } catch (err) {
        console.error("Failed to start voice recorder:", err);
        setIsListening(false);
        cleanupAudioAnalysis();
      }
    }
  }, [isListening, voiceRecorder, language, stop, stopRecording, cleanupAudioAnalysis]);

  return (
    <div className="voice-consultation-container flex flex-col items-center gap-4 p-4">
      <VoiceWaveform state={isListening ? "recording" : isSpeaking ? "processing" : "idle"} />
      <div className="flex gap-3 items-center">
        <button
          className={`mic-button ${isListening ? "recording" : ""}`}
          onClick={handleToggleListen}
          aria-label={isListening ? "Stop listening" : "Start voice consultation"}
        >
          {isListening ? <Square size={20} /> : <Mic size={20} />}
        </button>
        {isSpeaking && (
          <button
            className="button secondary p-2"
            onClick={stop}
            title="Stop speaking"
          >
            <VolumeX size={18} />
          </button>
        )}
      </div>
      {(isListening || isSpeaking) && (
        <small className="text-sm text-gray-600">
          {isListening ? "Listening... Speak now." : "SANJEEVANI is responding..."}
        </small>
      )}
    </div>
  );
}
