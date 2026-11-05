import axios from 'axios';
import FormData from 'form-data';
import { env } from '../config/env.js';

const LANGUAGE_CODES = {
  English: 'en',
  Hindi: 'hi',
  Bengali: 'bn',
  Marathi: 'mr',
  Gujarati: 'gu',
  Telugu: 'te',
  Tamil: 'ta',
  'en-IN': 'en',
  'hi-IN': 'hi',
  'bn-IN': 'bn',
  'mr-IN': 'mr',
  'gu-IN': 'gu',
  'te-IN': 'te',
  'ta-IN': 'ta',
};

export async function transcribe(audio, language = 'English') {
  if (!audio?.buffer?.length) {
    const error = new Error('NO_AUDIO');
    error.code = 'NO_AUDIO';
    throw error;
  }

  const groqKey = (process.env.GROQ_API_KEY || process.env.GROQ_KEY || env.groqKey || '').trim();

  // Never invent patient speech. Without a provider, the client must show an
  // unavailable state rather than generate symptoms that were never spoken.
  if (!groqKey) {
    const error = new Error('TRANSCRIPTION_NOT_CONFIGURED');
    error.code = 'TRANSCRIPTION_NOT_CONFIGURED';
    throw error;
  }

  try {
    const body = new FormData();
    body.append('file', audio.buffer, {
      filename: audio.originalname || 'audio.webm',
      contentType: audio.mimetype || 'audio/webm',
    });
    body.append('model', 'whisper-large-v3-turbo');
    body.append('language', LANGUAGE_CODES[language] || 'en');

    const { data } = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      body,
      {
        timeout: 18_000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        headers: {
          ...body.getHeaders(),
          Authorization: `Bearer ${groqKey}`,
        },
      }
    );

    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    if (!text) throw new Error('EMPTY_TRANSCRIPTION');

    return { text, source: 'groq' };
  } catch (error) {
    console.error(
      '[Groq Whisper Error]:',
      error?.response?.status || error?.code || error?.message || 'unknown'
    );

    if (env.isProduction) {
      const unavailable = new Error('TRANSCRIPTION_UNAVAILABLE');
      unavailable.code = 'TRANSCRIPTION_UNAVAILABLE';
      throw unavailable;
    }

    return demoTranscription(language);
  }
}
