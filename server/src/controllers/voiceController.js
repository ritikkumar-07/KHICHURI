import { transcribe } from '../services/groqService.js';
import {
  conductVoiceConsultation,
  normalizeLanguage,
} from '../services/aiDispatcher.js';

function withTimeout(promise, ms = 20_000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(Object.assign(new Error('Request timed out'), { code: 'TIMEOUT' })),
      ms
    );
    timer.unref?.();
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function sanitizeHistory(value) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-20)
    .map((item) => {
      const role = ['user', 'assistant', 'model'].includes(item?.role)
        ? item.role === 'assistant'
          ? 'model'
          : item.role
        : 'user';
      const raw = item?.parts?.[0]?.text ?? item?.content ?? '';
      const text = typeof raw === 'string' ? raw.trim().slice(0, 2000) : '';
      return { role, parts: [{ text }] };
    })
    .filter((item) => item.parts[0].text);
}

export async function voiceTranscribe(req, res) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'An audio recording is required.',
    });
  }

  const language = normalizeLanguage(req.body?.language);

  try {
    const data = await withTimeout(transcribe(req.file, language), 20_000);
    return res.json({ success: true, data });
  } catch (error) {
    if (error.code === 'NO_AUDIO') {
      return res.status(400).json({
        success: false,
        message: 'An audio recording is required.',
      });
    }
    if (error.code === 'TRANSCRIPTION_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        message: 'Voice transcription is not configured.',
      });
    }
    if (error.code === 'TRANSCRIPTION_UNAVAILABLE') {
      return res.status(502).json({
        success: false,
        message: 'Voice transcription is temporarily unavailable. Please try again.',
      });
    }
    if (error.code === 'TIMEOUT') {
      return res.status(504).json({
        success: false,
        message: 'Audio processing took too long. Please try a shorter recording.',
      });
    }

    console.error('[voiceTranscribe] Failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to transcribe audio. Please try again.',
    });
  }
}

export async function voiceConsult(req, res) {
  const history = sanitizeHistory(req.body?.history);
  const language = normalizeLanguage(req.body?.language);

  if (!history.length) {
    return res.status(400).json({
      success: false,
      message: 'A consultation message is required.',
    });
  }

  try {
    const data = await withTimeout(
      conductVoiceConsultation(history, language),
      20_000
    );
    return res.json({ success: true, data });
  } catch (error) {
    if (error.code === 'TIMEOUT') {
      return res.status(504).json({
        success: false,
        message: 'The consultation took too long. Please try again.',
      });
    }

    console.error('[voiceConsult] Failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Voice consultation is temporarily unavailable. Please try again.',
    });
  }
}
