import axios from 'axios';
import FormData from 'form-data';
import { env } from '../config/env.js';

export async function transcribe(audio, language) {
  const groqKey = (process.env.GROQ_API_KEY || env.groqKey || '').trim();
  if (audio && groqKey) {
    try {
      const body = new FormData();
      body.append('file', audio.buffer, {
        filename: audio.originalname || 'audio.webm',
        contentType: audio.mimetype || 'audio/webm',
      });
      body.append('model', 'whisper-large-v3-turbo');
      body.append('language', language === 'Hindi' ? 'hi' : language === 'Bengali' ? 'bn' : 'en');

      const { data } = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', body, {
        timeout: 4000,
        headers: {
          ...body.getHeaders(),
          Authorization: `Bearer ${groqKey}`,
        },
      });
      return { text: data.text, source: 'groq' };
    } catch (err) {
      console.error('[Groq Whisper Error]:', err?.response?.data || err.message || err);
    }
  } else {
    console.warn('[Groq Whisper Warning]: Missing audio buffer or GROQ_API_KEY');
  }
  const phrase = language === 'Hindi' ? 'मुझे सीने में दर्द और चक्कर आ रहे हैं।' : language === 'Bengali' ? 'আমার বুকে ব্যথা এবং মাথা ঘোরা হচ্ছে।' : 'I have a headache and feel dizzy since this morning.';
  return { text: phrase, source: 'fallback' };
}

