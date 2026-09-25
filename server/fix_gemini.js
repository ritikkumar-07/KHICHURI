import { readFileSync, writeFileSync } from 'fs';

const file = 'src/services/geminiService.js';
let content = readFileSync(file, 'utf8');

// Locate the broken triageSymptoms block start
const startMarker = 'export async function triageSymptoms';
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) { console.error('startMarker not found'); process.exit(1); }

// The broken block ends at the double-close '}\n}' that appears after the stray extra brace
// Find the '}\n}\n' pattern that closes the broken function
const endMarker = '\r\n}\r\n}';

const endIdx = content.indexOf(endMarker, startIdx);
if (endIdx === -1) { console.error('endMarker not found'); process.exit(1); }
const afterEnd = endIdx + endMarker.length;

const fixedFn = `export async function triageSymptoms(symptoms, language = 'English') {
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing in server environment');

  const prompt = [
    \`You are SANJEEVANI AI, an emergency clinical triage system.\`,
    \`Analyze these patient symptoms: "\${symptoms}" in \${language}.\`,
    \`\`,
    \`Determine clinical urgency strictly as:\`,
    \`- "RED": Critical / severe emergency (immediate emergency care needed)\`,
    \`- "YELLOW": Moderate / non-emergency (clinic evaluation within 24-48h)\`,
    \`- "GREEN": Mild / negligible (home rest, hydration, monitoring)\`,
    \`\`,
    \`Return ONLY a valid JSON object without markdown fences:\`,
    \`{\`,
    \`  "alertLevel": "RED" | "YELLOW" | "GREEN",\`,
    \`  "summary": "1-2 sentence clinical summary tailored to the patient symptoms",\`,
    \`  "immediateActions": ["Specific action 1", "Specific action 2"],\`,
    \`  "recommendedCare": "Recommended care instructions",\`,
    \`  "voiceResponse": "Natural spoken 1-2 sentence clinical response in \${language}."\`,
    \`}\`,
  ].join('\\n');

  // Attempt 1: Official SDK
  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const parsed = safeParseJson(result.response.text());
      if (parsed && parsed.alertLevel) return parsed;
      console.warn(\`Triage model \${modelName} returned unparseable JSON\`);
    } catch (err) {
      console.warn(\`Triage model \${modelName} failed:\`, err.message);
    }
  }

  // Attempt 2: Direct REST fallback
  try {
    const res = await fetch(
      \`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=\${apiKey}\`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(20000),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = safeParseJson(rawText);
      if (parsed && parsed.alertLevel) return parsed;
    }
  } catch (restErr) {
    console.warn('Triage REST fallback failed:', restErr.message);
  }

  throw new Error('Unable to contact Gemini AI for symptom analysis.');
}`;

content = content.slice(0, startIdx) + fixedFn + content.slice(afterEnd);
writeFileSync(file, content, 'utf8');
console.log('Done. Lines:', content.split('\n').length);
