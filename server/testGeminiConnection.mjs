import { GoogleGenAI } from '@google/genai';
import { env } from './src/config/env.js';
try {
  const ai = new GoogleGenAI({ apiKey: env.geminiKey });
  const response = await ai.models.generateContent({ model: 'gemini-3.6-flash', contents: 'Respond only with OK' });
  console.log(JSON.stringify({ keyConfigured: Boolean(env.geminiKey), ok: response.text?.trim() === 'OK', text: response.text?.trim() }));
} catch (error) {
  console.log(JSON.stringify({ keyConfigured: Boolean(env.geminiKey), ok: false, name: error.name, status: error.status, message: error.message }));
  process.exit(1);
}
