import axios from 'axios';

const endpoint = 'https://api.fda.gov/drug/label.json';
const cache = new Map();
const cacheMs = 30 * 60 * 1000;
const source = { name: 'openFDA Drug Labeling', url: 'https://open.fda.gov/apis/drug/label/' };

const cached = key => {
  const item = cache.get(key);
  if (!item || Date.now() - item.savedAt > cacheMs) { cache.delete(key); return null; }
  return item.value;
};
const remember = (key, value) => { cache.set(key, { savedAt: Date.now(), value }); return value; };
const list = value => Array.isArray(value) ? value.filter(Boolean) : [];
const first = value => list(value)[0] || '';
const unique = values => [...new Set(values.filter(Boolean))];
const text = (record, fields, limit = 12000) => unique(fields.flatMap(field => list(record[field]))).join('\n\n').slice(0, limit);
const cleanQuery = value => String(value || '').replace(/[^a-zA-Z0-9 .'-]/g, '').trim().slice(0, 80);

function normalizeSummary(record) {
  const open = record.openfda || {};
  const id = first(open.spl_set_id) || record.set_id || record.id;
  if (!id) return null;
  return {
    id,
    name: first(open.brand_name) || first(open.generic_name) || first(open.substance_name) || 'Unnamed medicine label',
    genericName: first(open.generic_name) || first(open.substance_name),
    brandNames: unique(list(open.brand_name)),
    manufacturer: first(open.manufacturer_name),
    route: unique(list(open.route)),
    source
  };
}

function normalizeDetails(record) {
  const summary = normalizeSummary(record);
  if (!summary) return null;
  const open = record.openfda || {};
  return {
    ...summary,
    drugClass: unique([...(open.pharm_class_epc || []), ...(open.pharm_class_moa || [])]),
    substanceNames: unique(list(open.substance_name)),
    dosageForms: unique(list(open.dosage_form)),
    uses: text(record, ['indications_and_usage', 'purpose']),
    adverseReactions: text(record, ['adverse_reactions']),
    warnings: text(record, ['boxed_warning', 'warnings', 'warnings_and_cautions']),
    contraindications: text(record, ['contraindications']),
    precautions: text(record, ['precautions', 'general_precautions', 'information_for_patients']),
    interactions: text(record, ['drug_interactions']),
    pregnancy: text(record, ['pregnancy', 'pregnancy_or_breast_feeding']),
    clinicalStudies: text(record, ['clinical_studies'], 2000),
    effectiveTime: record.effective_time || '',
    sourceDocumentId: record.id || '',
    source
  };
}

async function request(params) {
  try {
    const response = await axios.get(endpoint, { params, timeout: 9000, headers: { 'User-Agent': 'Sanjeevani-health-information-app/1.0' } });
    return response.data.results || [];
  } catch (error) {
    if (error.response?.status === 404) return [];
    const next = new Error('MEDICINE_PROVIDER_UNAVAILABLE');
    next.cause = error;
    throw next;
  }
}

export async function searchMedicineLabels(value) {
  const query = cleanQuery(value);
  if (query.length < 2) return [];
  const key = `search:${query.toLowerCase()}`;
  const hit = cached(key);
  if (hit) return hit;
  const term = query.split(/\s+/).join('\\ ');
  const search = `(openfda.brand_name:${term}* OR openfda.generic_name:${term}* OR openfda.substance_name:${term}*)`;
  const records = await request({ search, limit: 20 });
  const seen = new Set();
  const results = records.map(normalizeSummary).filter(item => item && !seen.has(item.id) && seen.add(item.id)).slice(0, 12);
  return remember(key, results);
}

export async function getMedicineLabel(id) {
  const safeId = String(id || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80);
  if (!safeId) return null;
  const key = `label:${safeId}`;
  const hit = cached(key);
  if (hit) return hit;
  const records = await request({ search: `openfda.spl_set_id:"${safeId}"`, limit: 1 });
  return records.length ? remember(key, normalizeDetails(records[0])) : null;
}
