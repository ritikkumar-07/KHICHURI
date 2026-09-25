import express from 'express';
import { getMedicineLabel, searchMedicineLabels } from '../services/medicineService.js';
import { askMedicine, normalizeMedicineName, researchMedicine } from '../services/geminiService.js';
import { medicineSearchVariants } from '../services/medicineAliases.js';

const router = express.Router();
const comparable = value => String(value || '').toLowerCase().replace(/\b(tablets?|capsules?|syrup|suspension|injection|cream|gel|drops?)\b/g, '').replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|%|iu)?\b/g, '').replace(/[^a-z0-9]/g, '');
const usefulDirectResults = (query, results) => {
  const wanted = comparable(query);
  return results.filter(result => comparable(result.name) === wanted || comparable(result.genericName).includes(wanted));
};

router.post('/ask', async (req, res, next) => {
  try {
    const question = String(req.body?.question || '').trim();
    if (!question) return res.status(400).json({ success: false, message: 'Enter a medicine name or question.' });
    if (question.length > 500) return res.status(400).json({ success: false, message: 'Keep the medicine question under 500 characters.' });
    const answer = await askMedicine(question);
    res.json({ success: true, data: { answer } });
  } catch (error) { next(error); }
});

router.get('/search', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 2 || query.length > 80) return res.status(400).json({ success: false, message: 'Enter between 2 and 80 characters.' });
    for (const candidate of medicineSearchVariants(query)) {
      const results = await searchMedicineLabels(candidate);
      const useful = usefulDirectResults(candidate, results);
      if (useful.length) return res.json({ success: true, data: useful });
    }

    const normalized = await normalizeMedicineName(query);
    if (normalized?.genericName) {
      const candidates = [...new Set([normalized.genericName, normalized.alternateGenericName].filter(Boolean))];
      for (const candidate of candidates) {
        const results = await searchMedicineLabels(candidate);
        if (results.length) return res.json({ success: true, data: results.map(result => ({ ...result, resolution: normalized })) });
      }
    }
    res.json({ success: true, data: [] });
  } catch (error) { next(error); }
});

router.get('/labels/:id', async (req, res, next) => {
  try {
    const result = await getMedicineLabel(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Reliable medicine information was not found.' });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

router.post('/research', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Enter a medicine name.' });
    if (name.length > 120) return res.status(400).json({ success: false, message: 'Keep the medicine name under 120 characters.' });
    res.json({ success: true, data: await researchMedicine(name) });
  } catch (error) { next(error); }
});

router.use((error, _req, res, _next) => {
  if (error.code === 'MEDICINE_AI_NOT_CONFIGURED') return res.status(503).json({ success: false, message: 'Medicine questions are not available right now.' });
  if (error.code === 'MEDICINE_AI_UNAVAILABLE') return res.status(503).json({ success: false, message: "We couldn't get medicine information right now. Please try again." });
  if (error.message === 'MEDICINE_PROVIDER_UNAVAILABLE') return res.status(503).json({ success: false, message: "Medicine information is temporarily unavailable. Please try again." });
  console.error('Medicine information request failed:', error.message);
  res.status(500).json({ success: false, message: 'Medicine information could not be loaded.' });
});

export default router;

