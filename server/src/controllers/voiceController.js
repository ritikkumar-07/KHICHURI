import { transcribe } from '../services/groqService.js';
import { conductVoiceConsultation } from '../services/geminiService.js';

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Audio processing request timed out after 8s')), ms)
    )
  ]);
}

export async function voiceTranscribe(req, res) { 
    try {
        const language = String(req.body.language || 'English');
        const data = await withTimeout(transcribe(req.file, language), 8000);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Unable to transcribe audio', error: err.message });
    } 
}

export async function voiceConsult(req, res) {
    try {
        const history = req.body.history || [];
        const language = String(req.body.language || 'English');
        const data = await withTimeout(conductVoiceConsultation(history, language), 8000);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Voice consultation failed', error: err.message });
    }
}
