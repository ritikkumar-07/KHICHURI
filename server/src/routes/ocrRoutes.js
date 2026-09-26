import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import Groq from 'groq-sdk';
import { createRequire } from 'module';
import { env } from '../config/env.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function safeParseJson(rawText) {
  if (!rawText) return null;
  const cleanJson = rawText.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleanJson); } catch (e) {}

  const match = cleanJson.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (e) {}
  }
  return null;
}

async function getActiveGroqTextModels(groq) {
  const preferred = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "gemma2-9b-it"
  ];
  try {
    const modelList = await groq.models.list();
    const activeIds = new Set((modelList.data || []).map(m => m.id));
    const availablePreferred = preferred.filter(m => activeIds.has(m));
    if (availablePreferred.length > 0) return availablePreferred;
    const fallbackActive = Array.from(activeIds).filter(id => !id.includes('whisper') && !id.includes('vision'));
    if (fallbackActive.length > 0) return fallbackActive;
  } catch (e) {
    console.warn("[Groq Models List Warning]: Could not fetch dynamic models, using fallback list.", e.message);
  }
  return preferred;
}

async function getActiveGroqVisionModels(groq) {
  const preferred = ["llama-3.2-11b-vision-preview"];
  try {
    const modelList = await groq.models.list();
    const activeIds = (modelList.data || []).map(m => m.id);
    const visionActive = activeIds.filter(id => id.includes("vision"));
    if (visionActive.length > 0) return visionActive;
  } catch (e) {
    console.warn("[Groq Vision List Warning]: Using fallback vision list.", e.message);
  }
  return preferred;
}

export async function processMedicalDocument(file, language = "English") {
  const groqApiKey = (process.env.GROQ_API_KEY || process.env.GROQ_KEY || (typeof env !== 'undefined' ? env.groqKey : '') || "").trim();
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY is missing in server environment");
  }

  const groq = new Groq({ apiKey: groqApiKey });
  const filename = file.originalname || '';
  const mimeType = file.mimetype || '';
  const isPdf = mimeType === 'application/pdf' || /\.pdf$/i.test(filename);
  const isImage = mimeType && mimeType.startsWith('image/');

  let extractedText = "";

  if (isPdf) {
    try {
      const pdfData = await pdfParse(file.buffer);
      extractedText = pdfData.text ? pdfData.text.trim() : "";
    } catch (pdfErr) {
      console.warn("[PDF Parse Warning]: Failed to extract digital text stream:", pdfErr.message);
    }
    if (!extractedText || extractedText.length < 20) {
      extractedText = `[Scanned PDF Document: "${filename}", size: ${(file.size / 1024).toFixed(1)} KB]. Unable to extract raw ASCII text layer. Analyze based on document metadata and context.`;
    }
  } else if (isImage) {
    try {
      console.log(`[OCR Tesseract] Running OCR text recognition on image buffer (${filename})...`);
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const ret = await worker.recognize(file.buffer);
      extractedText = ret.data.text ? ret.data.text.trim() : '';
      await worker.terminate();
      console.log(`[OCR Tesseract] Successfully extracted ${extractedText.length} characters of image text.`);
    } catch (tessErr) {
      console.warn('[OCR Tesseract Warning]:', tessErr.message);
    }
  } else {
    extractedText = file.buffer
      .toString('utf-8', 0, 4000)
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  console.log(`[OCR] Processing file: "${filename}", mimetype: "${mimeType}", extractedText length: ${extractedText.length}`);

  let parsedData = null;
  let lastError = null;

  if (isImage) {
    const candidateVisionModels = await getActiveGroqVisionModels(groq);
    const base64Data = file.buffer.toString('base64');
    const dataUrl = `data:${mimeType || 'image/png'};base64,${base64Data}`;

    const visionPromptText = `You are an expert clinical pathologist simplifying a medical lab report for a patient in plain language.
Read every lab parameter, value, unit, reference range, and flag from this image.
Identify genuine abnormal values (e.g. Low Hemoglobin, High WBC, High Fasting Blood Glucose, High Cholesterol).

Evaluation Rules:
1. First, verify if this image represents a genuine medical record (e.g., blood test, lipid profile, metabolic panel, radiology scan, doctor prescription, discharge summary). If it is a non-medical document (e.g., resume, invoice, receipt, fee challan, photo, certificate), set "isMedicalDocument": false, specify "detectedType", and provide a clear "rejectionReason".
2. If it IS a medical report, set "isMedicalDocument": true and respond STRICTLY with valid JSON matching this schema:
{
  "isMedicalDocument": true,
  "detectedType": "Complete Blood Count / Metabolic Panel / etc.",
  "rejectionReason": "",
  "summary": "2-3 clear, patient-friendly sentences explaining the overall condition in everyday words.",
  "keyFindings": ["Finding 1 with plain explanation", "Finding 2 with plain explanation"],
  "abnormalParameters": ["Hemoglobin: 10.4 g/dL (LOW, Normal: 13.0 - 17.0) - Mild anemia", "Fasting Glucose: 124 mg/dL (HIGH, Normal: 70 - 99) - Elevated blood sugar / prediabetic range"],
  "recommendations": ["Actionable step 1", "Actionable step 2"],
  "conditions": ["Anemia", "Type 2 Diabetes"],
  "medicines": ["Metformin 500mg", "Aspirin 75mg"]
}`;

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: visionPromptText },
          { type: "image_url", image_url: { url: dataUrl } }
        ]
      }
    ];

    for (const visionModel of candidateVisionModels) {
      try {
        console.log(`[OCR] Attempting Vision model analysis via Groq (${visionModel})...`);
        const completion = await groq.chat.completions.create({
          model: visionModel,
          messages,
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 1024
        });
        const rawText = completion.choices?.[0]?.message?.content || '';
        parsedData = safeParseJson(rawText);
        if (parsedData) break;
      } catch (visionErr) {
        console.warn(`[OCR Vision Warning] Model ${visionModel} failed:`, visionErr.message);
        lastError = visionErr;
      }
    }
  }

  // Fallback to Text Model Analysis (using Tesseract OCR text or PDF extracted text) if Vision parsing did not produce valid JSON
  if (!parsedData) {
    if (!extractedText && isImage) {
      extractedText = `[Uploaded Medical Scan / Image: "${filename}", size: ${(file.size / 1024).toFixed(1)} KB]. Analyze based on available metadata and document structure.`;
    }

    const textPrompt = `You are an empathetic, expert doctor explaining medical results directly to a patient in simple everyday words.

Document filename: "${filename}"
Document text content in ${language || 'English'}:
---
${extractedText.substring(0, 10000)}
---

Evaluation Rules:
1. First, verify if this text represents a genuine medical record (e.g., blood test/CBC, lipid profile, metabolic panel, radiology report, doctor prescription, discharge summary). If it is a non-medical document (e.g., resume, invoice, challan, academic form, receipt), set "isMedicalDocument": false.
2. If it IS a medical document, set "isMedicalDocument": true and generate a real, tailored breakdown:
   - "detectedType": "Type of medical test (e.g., Complete Blood Count, Lipid Profile, Doctor Prescription)",
   - "summary": A clear, 2-3 sentence overview in simple language explaining what this test was for and the overall health outcome. (Do NOT write generic placeholders).
   - "keyFindings": An array of 2 to 5 specific, bulleted observations found in THIS document (mention the actual parameters and what they mean in plain English).
   - "abnormalParameters": An array of any values that are high, low, or out of the standard reference range (include the exact test name, the patient's value, and standard normal range). If all values are normal, return an empty array [].
   - "recommendations": An array of practical, non-alarmist next steps (e.g., diet tips, questions to ask the doctor, follow-up tests).
   - "conditions": An array of any diagnosed or mentioned medical conditions (e.g. ["Anemia", "Type 2 Diabetes"]). Empty array if none.
   - "medicines": An array of any prescribed or mentioned medicines (e.g. ["Metformin 500mg", "Aspirin 75mg"]). Empty array if none.

Return STRICT JSON matching this format:
{
  "isMedicalDocument": true,
  "detectedType": "Complete Blood Count",
  "rejectionReason": "",
  "summary": "Your blood test results show an overall healthy blood profile with normal red and white cell counts.",
  "keyFindings": ["Hemoglobin is 14.2 g/dL, which is within the healthy range.", "White blood cell count is normal, indicating no active infection."],
  "abnormalParameters": [],
  "recommendations": ["Maintain balanced nutrition and stay well hydrated.", "Follow up with your doctor during your next routine checkup."],
  "conditions": [],
  "medicines": []
}`;

    const candidateTextModels = await getActiveGroqTextModels(groq);
    for (const textModel of candidateTextModels) {
      try {
        console.log(`[OCR] Attempting Text model analysis via Groq (${textModel})...`);
        const completion = await groq.chat.completions.create({
          model: textModel,
          messages: [{ role: 'user', content: textPrompt }],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 1024
        });
        const rawText = completion.choices?.[0]?.message?.content || '';
        parsedData = safeParseJson(rawText);
        if (parsedData) break;
      } catch (textErr) {
        console.warn(`[OCR Text Warning] Model ${textModel} failed:`, textErr.message);
        lastError = textErr;
      }
    }
  }

  if (!parsedData) {
    throw lastError || new Error("Unable to parse AI response into valid JSON with active Groq models.");
  }

  return parsedData;
}

router.post('/', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No document uploaded" });
    }

    const parsedData = await processMedicalDocument(req.file, req.body.language);

    if (parsedData.isMedicalDocument === false) {
      const detectedType = parsedData.detectedType || "Non-Medical Document";
      const rejectionReason = parsedData.rejectionReason || `This document appears to be a ${detectedType}. Please upload a valid medical report.`;
      console.warn(`[OCR Rejected Document]: Detected "${detectedType}" - ${rejectionReason}`);
      return res.status(422).json({
        success: false,
        detectedType,
        message: rejectionReason
      });
    }

    const keyFindingsText = Array.isArray(parsedData.keyFindings) ? parsedData.keyFindings.map(k => "• " + k).join("\n") : "";

    return res.json({
      success: true,
      data: {
        ...parsedData,
        simplifiedText: (parsedData.summary || "Document processed successfully.") +
          (keyFindingsText ? "\n\nKey Findings:\n" + keyFindingsText : "")
      }
    });
  } catch (error) {
    console.error("[OCR Failure Reason]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to analyze document using AI service."
    });
  }
});

export default router;
