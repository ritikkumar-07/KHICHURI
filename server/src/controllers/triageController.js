import { triageSymptoms, getFallbackTriage } from '../services/aiDispatcher.js';

export async function assessTriage(req, res) {
  // Accept both `symptoms` (new client shape) and `text` (legacy shape)
  const { symptoms, text, language = 'English' } = req.body || {};
  const input = (symptoms || text || '').trim();
  if (!input) {
    return res.status(400).json({ success: false, message: 'A symptom description is required.' });
  }
  try {
    const data = await triageSymptoms(input.slice(0, 4000), language);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[triageController] Fallback triggered:', err?.message || err);
    res.json({ success: true, data: getFallbackTriage(language) });
  }
}
