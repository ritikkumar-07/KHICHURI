const aliases = [
  { pattern: /^(dolo|crocin|calpol)\b/i, genericName: 'paracetamol', alternateGenericName: 'acetaminophen' },
  { pattern: /^paracetamol\b/i, genericName: 'paracetamol', alternateGenericName: 'acetaminophen', genericQuery: true },
  { pattern: /^acetaminophen\b/i, genericName: 'acetaminophen', alternateGenericName: 'paracetamol', genericQuery: true },
  { pattern: /^allegra\b/i, genericName: 'fexofenadine', alternateGenericName: 'fexofenadine hydrochloride' },
  { pattern: /^augmentin\b/i, genericName: 'amoxicillin clavulanate', alternateGenericName: 'amoxicillin clavulanate potassium' }
];

export function knownMedicineAlias(value) {
  const query = String(value || '').trim();
  const alias = aliases.find(item => item.pattern.test(query));
  return alias ? { ...alias, possibleBrand: alias.genericQuery ? '' : query, confidence: 'high' } : null;
}

export function extractMedicineStrength(value) {
  const match = String(value || '').match(/\b(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|ml|%|iu)\b/i)
    || String(value || '').match(/\b(\d{2,4})\b/);
  if (!match) return '';
  return match[2] ? `${match[1]} ${match[2].toLowerCase()}` : `${match[1]} mg`;
}

export function medicineSearchVariants(value) {
  const original = String(value || '').trim();
  const withoutForm = original.replace(/\b(tablets?|capsules?|syrup|suspension|injection|cream|gel|drops?)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const withoutStrength = withoutForm.replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|%|iu)?\b/gi, ' ').replace(/\s+/g, ' ').trim();
  return [...new Set([original, withoutForm, withoutStrength].filter(item => item.length >= 2))];
}
