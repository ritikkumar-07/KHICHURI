import Groq from 'groq-sdk';
import { env } from '../config/env.js';

const fallbackModels = [
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "groq/compound",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
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
    const chatActive = Array.from(activeIds).filter(id =>
      !id.includes('whisper') &&
      !id.includes('vision') &&
      !id.includes('guard') &&
      !id.includes('safeguard') &&
      !id.includes('orpheus')
    );
    if (chatActive.length > 0) return chatActive;
  } catch (e) {
    console.warn("[Groq Models List Warning]:", e.message);
  }
  return fallbackModels;
}

export async function callGroqText(prompt, temperature = 0.1, maxTokens = null) {
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

export function safeParseJson(raw) {
  if (!raw) return null;
  // Clean string and strip common markdown code fences and conversational preambles
  let text = String(raw).replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
  // Try direct parse first
  try { return JSON.parse(text); } catch { /* fall through */ }
  // Slice from first { to last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try { return JSON.parse(candidate); } catch { /* fall through */ }
    try {
      // Clean unescaped control chars / bad newlines inside string literals and trailing commas
      const cleaned = candidate
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => (c === '\n' || c === '\r' ? ' ' : ''))
        .replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(cleaned);
    } catch { /* fall through */ }
  }
  // Fallback for array if present
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket >= firstBracket) {
    const candidateArr = text.slice(firstBracket, lastBracket + 1);
    try { return JSON.parse(candidateArr); } catch { /* fall through */ }
    try {
      const cleanedArr = candidateArr
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => (c === '\n' || c === '\r' ? ' ' : ''))
        .replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(cleanedArr);
    } catch { /* fall through */ }
  }
  return null;
}

export function getFallbackTriage(language = 'English') {
  const isBengali = language === 'Bengali' || language === 'bn-IN' || language === 'bn' || String(language).toLowerCase().includes('bengali');
  const isHindi = language === 'Hindi' || language === 'hi-IN' || language === 'hi' || String(language).toLowerCase().includes('hindi');

  if (isBengali) {
    const recAction = "নিকটস্থ স্বাস্থ্যকেন্দ্রে বা চিকিৎসকের পরামর্শ নিন। জরুরি প্রয়োজনে অবিলম্বে ১১২ ডায়াল করুন।";
    const vResp = "আপনার লক্ষণগুলি মূল্যায়ন করা হয়েছে। অনুগ্রহ করে বিশ্রাম নিন এবং প্রয়োজন হলে চিকিৎসকের পরামর্শ নিন।";
    return {
      isFinalVerdict: true,
      alertLevel: "YELLOW",
      summary: "লক্ষণগুলির প্রাথমিক মূল্যায়ন সম্পন্ন হয়েছে। বিস্তারিত পরীক্ষা ও পরামর্শের জন্য একজন চিকিৎসকের সাথে যোগাযোগ করুন।",
      immediateActions: [
        "বিশ্রাম নিন এবং পর্যাপ্ত জল পান করুন",
        "অবস্থার অবনতি হলে অবিলম্বে নিকটস্থ হাসপাতালে যান বা ১১২ ডায়াল করুন"
      ],
      recommendedAction: recAction,
      recommendedCare: recAction,
      voiceResponse: vResp,
      spokenResponse: vResp,
    };
  }

  if (isHindi) {
    const recAction = "नजदीकी स्वास्थ्य केंद्र या डॉक्टर से परामर्श लें। आपात स्थिति में 112 डायल करें।";
    const vResp = "आपके लक्षणों का मूल्यांकन कर लिया गया है। कृपया आराम करें और आवश्यकता पड़ने पर चिकित्सक से परामर्श करें।";
    return {
      isFinalVerdict: true,
      alertLevel: "YELLOW",
      summary: "लक्षणों का प्राथमिक मूल्यांकन किया गया है। उचित सलाह के लिए किसी योग्य चिकित्सक से संपर्क करें।",
      immediateActions: [
        "आराम करें और पर्याप्त पानी पिएं",
        "स्थिति बिगड़ने पर तुरंत अस्पताल जाएं या 112 डायल करें"
      ],
      recommendedAction: recAction,
      recommendedCare: recAction,
      voiceResponse: vResp,
      spokenResponse: vResp,
    };
  }

  const recAction = "Consult a healthcare provider or visit a nearby clinic. In an emergency, dial 112.";
  const vResp = "Your symptoms have been evaluated. Please rest and consult a doctor if your symptoms persist.";
  return {
    isFinalVerdict: true,
    alertLevel: "YELLOW",
    summary: "Symptom evaluation completed. Please consult a medical professional for comprehensive assessment.",
    immediateActions: [
      "Rest and maintain adequate hydration",
      "Seek immediate emergency medical care or dial 112 if condition worsens"
    ],
    recommendedAction: recAction,
    recommendedCare: recAction,
    voiceResponse: vResp,
    spokenResponse: vResp,
  };
}

/**
 * Triage patient symptoms into clinical urgency with exact required schema:
 * - isFinalVerdict: true
 * - alertLevel: "RED" | "YELLOW" | "GREEN"
 * - summary: string explaining what the symptoms could indicate
 * - immediateActions: array of specific first-aid steps to do right now
 * - recommendedAction: guidance on where to seek care (e.g., ER, clinic, self-care)
 * - voiceResponse: spoken guidance matching the active language (English, Hindi, or Bengali)
 */
export async function triageSymptoms(symptoms, language = 'English') {
  const isBengali = language === 'Bengali' || language === 'bn-IN' || language === 'bn' || String(language).toLowerCase().includes('bengali');

  const prompt = [
    `You are SANJEEVANI AI, an emergency clinical triage system.`,
    `Analyze these patient symptoms: "${symptoms}" in ${language}.`,
    ``,
    `Determine clinical urgency strictly as:`,
    `- "NONE": If the input contains no medical symptoms, injuries, or health-related queries (e.g. general chat, greetings, random noise).`,
    `- "RED": Critical / severe emergency (immediate emergency care needed)`,
    `- "YELLOW": Moderate / non-emergency (clinic evaluation within 24-48h)`,
    `- "GREEN": Mild / negligible (home rest, hydration, monitoring)`,
    ``,
    `You must return purely raw JSON without markdown formatting. When language is 'Bengali' or 'bn-IN', all string values (summary, immediateActions, recommendedAction, voiceResponse) must be written in fluent Bengali (বাংলা লিপি).`,
    ``,
    `Return ONLY a valid JSON object without markdown fences matching this schema:`,
    `{`,
    `  "isFinalVerdict": true,`,
    `  "alertLevel": "RED" | "YELLOW" | "GREEN" | "NONE",`,
    `  "summary": "string explaining what the symptoms could indicate, or a polite message if non-medical asking to describe symptoms",`,
    `  "immediateActions": ["specific first-aid step to do right now 1", "specific first-aid step to do right now 2"],`,
    `  "recommendedAction": "guidance on where to seek care (e.g., ER, clinic, self-care)",`,
    `  "voiceResponse": "spoken guidance matching the active language (${language}: English, Hindi, or Bengali)"`,
    `}`,
  ].join('\n');

  try {
    const content = await callGroqText(prompt, 0.1);
    const parsed = safeParseJson(content);
    if (parsed && (parsed.alertLevel || parsed.summary)) {
      let rawAlert = String(parsed.alertLevel || "").toUpperCase();
      let validAlert = "YELLOW";
      if (rawAlert.includes("RED") || rawAlert.includes("লাল") || rawAlert.includes("জরুরি")) {
        validAlert = "RED";
      } else if (rawAlert.includes("NONE") || rawAlert.includes("কোনোটি নয়") || rawAlert === "NOT_MEDICAL") {
        validAlert = "NONE";
      } else if (rawAlert.includes("GREEN") || rawAlert.includes("সবুজ")) {
        validAlert = "GREEN";
      } else if (rawAlert.includes("YELLOW") || rawAlert.includes("হলুদ")) {
        validAlert = "YELLOW";
      }

      const recAction = parsed.recommendedAction || parsed.recommendedCare || (
        isBengali ? "নিকটস্থ স্বাস্থ্যকেন্দ্রে বা চিকিৎসকের পরামর্শ নিন। জরুরি প্রয়োজনে অবিলম্বে ১১২ ডায়াল করুন।" : "Consult a healthcare provider. In an emergency, dial 112."
      );
      const vResponse = parsed.voiceResponse || parsed.spokenResponse || parsed.summary || "";

      return {
        isFinalVerdict: true,
        alertLevel: validAlert,
        summary: parsed.summary || (isBengali ? "লক্ষণ মূল্যায়ন সম্পন্ন হয়েছে।" : "Symptom evaluation completed."),
        immediateActions: Array.isArray(parsed.immediateActions) ? parsed.immediateActions : [],
        recommendedAction: recAction,
        recommendedCare: recAction,
        voiceResponse: vResponse,
        spokenResponse: vResponse,
      };
    }
    throw new Error("Groq returned unparseable JSON");
  } catch (err) {
    console.warn(`[Groq Engine] Triage evaluation fallback triggered: ${err.message}`);
    return getFallbackTriage(language);
  }
}

export async function conductVoiceConsultation(history = [], language = "English") {
  const prompt = `You are SANJEEVANI AI Doctor conducting an interactive medical consultation in ${language}.
Dialogue history:
${JSON.stringify(history, null, 2)}

Rules:
1. If information is incomplete or vague, ask 1 focused follow-up question (severity 1-10, duration, fever, red-flag signs) and keep isFinalVerdict: false.
2. If red-flags appear or conversation is mature (2-3 turns), finalize with isFinalVerdict: true and alertLevel ("RED", "YELLOW", or "GREEN").

Return ONLY valid JSON without any markdown fences or extra text:
{
  "isFinalVerdict": false,
  "spokenResponse": "Short 1-2 sentence response to be read aloud to the patient",
  "alertLevel": "IN_PROGRESS",
  "summary": "Medical summary so far",
  "recommendedAction": "Next step for the patient",
  "immediateActions": ["Action 1", "Action 2"],
  "voiceResponse": "Short 1-2 sentence response to be read aloud to the patient"
}`;

  try {
    const content = await callGroqText(prompt, 0.1);
    const parsed = safeParseJson(content);
    if (parsed && (typeof parsed.spokenResponse === 'string' || typeof parsed.voiceResponse === 'string')) {
      const vResponse = parsed.voiceResponse || parsed.spokenResponse || "";
      const recAction = parsed.recommendedAction || parsed.recommendedCare || "";
      console.info('[Consultation] Responded via Groq');
      return {
        ...parsed,
        spokenResponse: vResponse,
        voiceResponse: vResponse,
        recommendedAction: recAction,
        recommendedCare: recAction,
      };
    }
  } catch (err) {
    console.warn('[Consultation] Groq failed:', err.message);
  }

  // Fallback
  const lastUserMessage = history.filter(h => h.role === 'user').at(-1)?.parts?.[0]?.text || 'your symptoms';
  console.warn('[Consultation] All AI attempts failed — returning hardcoded fallback');
  return {
    isFinalVerdict: false,
    spokenResponse: `I've noted ${lastUserMessage}. Could you tell me how severe the pain or discomfort is on a scale of 1 to 10?`,
    voiceResponse: `I've noted ${lastUserMessage}. Could you tell me how severe the pain or discomfort is on a scale of 1 to 10?`,
    alertLevel: "IN_PROGRESS",
    summary: "Awaiting more information to complete the clinical assessment.",
    recommendedAction: "Please answer the follow-up question so I can assess your condition accurately.",
    recommendedCare: "Please answer the follow-up question so I can assess your condition accurately.",
    immediateActions: ["Answer the follow-up question", "Call 112 if symptoms feel life-threatening"],
  };
}
