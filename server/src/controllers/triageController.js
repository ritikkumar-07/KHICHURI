import {
  triageSymptoms,
  getFallbackTriage,
  normalizeLanguage,
} from '../services/aiDispatcher.js';

export async function assessTriage(req, res) {
  // Accept both `symptoms` (new client shape) and `text` (legacy shape).
  const { symptoms, text, language } = req.body || {};
  const input = String(symptoms || text || '').trim();
  const normalizedLanguage = normalizeLanguage(language);

  if (!input) {
    return res.status(400).json({
      success: false,
      message: 'A symptom description is required.',
    });
  }

  try {
    const data = await triageSymptoms(
      input.slice(0, 4000),
      normalizedLanguage
    );
    return res.json({ success: true, data });
  } catch (error) {
    console.error(
      '[triageController] Unexpected fallback:',
      error?.message || error
    );
    return res.json({
      success: true,
      data: getFallbackTriage(normalizedLanguage, input),
    });
  }
}
