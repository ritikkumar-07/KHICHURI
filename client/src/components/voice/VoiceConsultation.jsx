import { useState, useCallback, useEffect } from "react";
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

  const handleToggleListen = useCallback(async () => {
    if (isListening || voiceRecorder.recording) {
      setIsListening(false);
      const audioBlob = await voiceRecorder.stop();
      if (audioBlob && onSpeechResult) {
        onSpeechResult(audioBlob);
      }
    } else {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      stop();
      setIsListening(true);
      try {
        await voiceRecorder.start(language);
      } catch (err) {
        console.error("Failed to start voice recorder:", err);
        setIsListening(false);
      }
    }
  }, [isListening, voiceRecorder, onSpeechResult, language, stop]);

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
