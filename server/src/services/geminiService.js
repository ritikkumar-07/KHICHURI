import Groq from 'groq-sdk';
import { env } from '../config/env.js';
import { extractMedicineStrength, knownMedicineAlias } from './medicineAliases.js';

const fallbackModels = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "gemma2-9b-it"
];

async function getActiveGroqModels(groq) {
  try {
    const list = await groq.models.list();
    const activeIds = new Set((list.data || []).map(m => m.id));
    const available = fallbackModels.filter(m => activeIds.has(m));
    if (available.length > 0) return available;
    const chatActive = Array.from(activeIds).filter(id => !id.includes('whisper') && !id.includes('vision'));
    if (chatActive.length > 0) return chatActive;
  } catch (e) {
    console.warn("[Groq Models List Warning]:", e.message);
  }
  return fallbackModels;
}

async function callGroqText(prompt, temperature = 0.1, maxTokens = null) {
  const groqKey = (process.env.GROQ_API_KEY || process.env.GROQ_KEY || env.groqKey || "").trim();
  if (!groqKey) throw new Error("GROQ_API_KEY is missing");
  const groq = new Groq({ apiKey: groqKey });
  
  const candidateModels = await getActiveGroqModels(groq);
  let lastErr = null;
  for (const modelName of candidateModels) {
    try {
      const options = {
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        temperature,
      };
      if (maxTokens) options.max_tokens = maxTokens;
      
      const completion = await groq.chat.completions.create(options);
      const resText = completion.choices?.[0]?.message?.content || "";
      if (resText) return resText;
    } catch (err) {
      lastErr = err;
      console.warn(`[Groq Text Warning] Model ${modelName} failed:`, err.message);
    }
  }
  throw lastErr || new Error("All Groq text models failed");
}

// Gemini models removed.


export { triageSymptoms, conductVoiceConsultation } from './aiDispatcher.js';




export async function askMedicine(question) {
    if (!process.env.GROQ_API_KEY) {
        const error = new Error('MEDICINE_AI_NOT_CONFIGURED');
        error.code = 'MEDICINE_AI_NOT_CONFIGURED';
        throw error;
    }
    const instruction = `You are the medicine information assistant inside the Sanjeevani healthcare application.
Answer only general informational questions about medicines in simple language.
Include only information relevant to the question, such as a medicine's general purpose, common uses, common side effects, medicine class, precautions, or general warnings when confidently known.
Do not diagnose, prescribe, recommend starting or stopping a medicine, change a prescribed dose, calculate a personalized dose, recommend a replacement, or claim a medicine is definitely safe for a specific person.
If asked to make a personal medication decision, advise speaking with the prescribing doctor or a pharmacist.
Do not invent medicine information. If reliable information cannot be determined, clearly say so.
Keep normal answers concise, practical, and approximately 50 to 200 words unless the user explicitly requests detail.
Do not add a disclaimer; the interface displays one separately.

User question: ${question}`;

    try {
        const answer = await callGroqText(instruction, 0.1);
        if (!answer) throw new Error('EMPTY_MEDICINE_AI_RESPONSE');
        return answer.trim();
    } catch (error) {
        if (error.code === 'MEDICINE_AI_NOT_CONFIGURED') throw error;
        const unavailable = new Error('MEDICINE_AI_UNAVAILABLE');
        unavailable.code = 'MEDICINE_AI_UNAVAILABLE';
        throw unavailable;
    }
}

export async function normalizeMedicineName(value) {
    const originalQuery = String(value || '').trim();
    const known = knownMedicineAlias(originalQuery);
    if (known) return { originalQuery, possibleBrand: known.possibleBrand, genericName: known.genericName, alternateGenericName: known.alternateGenericName, strength: extractMedicineStrength(originalQuery), confidence: known.confidence };
    if (!process.env.GROQ_API_KEY) return null;

    const prompt = `Identify only the likely medicine brand/generic name in the user's query. Do not provide uses, doses, side effects, precautions, contraindications, interactions, or treatment advice. Return ONLY valid raw JSON with this exact shape and no markdown:
{"originalQuery":"","possibleBrand":"","genericName":"","alternateGenericName":"","strength":"","confidence":"high|medium|low"}
Use an empty string for any field that cannot be determined reliably. If the query is fake or unknown, leave genericName empty. User query: ${JSON.stringify(originalQuery)}`;
    try {
        const content = await callGroqText(prompt, 0);
        const raw = content.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(raw);
        const confidence = ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low';
        const genericName = String(parsed.genericName || '').trim().slice(0, 100);
        if (!genericName || confidence === 'low') return null;
        return { originalQuery, possibleBrand: String(parsed.possibleBrand || originalQuery).trim().slice(0, 100), genericName, alternateGenericName: String(parsed.alternateGenericName || '').trim().slice(0, 100), strength: String(parsed.strength || extractMedicineStrength(originalQuery)).trim().slice(0, 40), confidence };
    } catch {
        return null;
    }
}

export async function researchMedicine(name) {
    if (!process.env.GROQ_API_KEY) { const error = new Error('MEDICINE_AI_NOT_CONFIGURED'); error.code = 'MEDICINE_AI_NOT_CONFIGURED'; throw error; }
    const prompt = `You are the medicine information assistant for Sanjeevani. Identify generic names, Indian brand names, strengths, and minor misspellings. Return ONLY raw JSON, no markdown:
{"found":true,"confidence":"high|medium|low","searchedName":"","displayName":"","correctedName":"","genericName":"","strength":"","drugClass":"","uses":[],"commonSideEffects":[],"importantWarnings":[],"precautions":[],"simpleExplanation":""}
If identity is uncertain return {"found":false,"confidence":"low","searchedName":"","message":"I could not confidently identify this medicine. Please check the spelling or packaging."}. Use short factual points. Do not diagnose, prescribe, recommend starting/stopping, or give personalized doses. Omit uncertain facts. Input: ${JSON.stringify(name)}`;
    try {
        const content = await callGroqText(prompt, 0);
        const data = JSON.parse(content.replace(/```json|```/g, '').trim());
        const cleanText = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
        const cleanArray = value => Array.isArray(value) ? value.map(item => cleanText(item, 300)).filter(Boolean).slice(0, 8) : [];
        if (data.found !== true || !['high', 'medium'].includes(data.confidence) || !cleanText(data.displayName || data.genericName, 100)) return { found: false, confidence: 'low', searchedName: name, message: "We couldn't confidently identify this medicine. Check the spelling or try the name written on the medicine packaging." };
        return { found: true, confidence: data.confidence, searchedName: name, displayName: cleanText(data.displayName, 100), correctedName: cleanText(data.correctedName, 100), genericName: cleanText(data.genericName, 160), strength: cleanText(data.strength, 60), drugClass: cleanText(data.drugClass, 160), uses: cleanArray(data.uses), commonSideEffects: cleanArray(data.commonSideEffects), importantWarnings: cleanArray(data.importantWarnings), precautions: cleanArray(data.precautions), simpleExplanation: cleanText(data.simpleExplanation, 600) };
    } catch (cause) { const error = new Error('MEDICINE_AI_UNAVAILABLE'); error.code = 'MEDICINE_AI_UNAVAILABLE'; error.cause = cause; throw error; }
}
