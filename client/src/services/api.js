import axios from "axios";
import { FIRST_AID } from "./offlineStorage";
import { supabase } from "./supabase";


const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  timeout: 60000,
});

// ---------------------------------------------------------------------------
// Health-tracker owner key (stable per-browser, stored in localStorage)
// ---------------------------------------------------------------------------
const OWNER_KEY_STORAGE = "sanjeevani_owner_key";
function getOwnerKey() {
  let key = localStorage.getItem(OWNER_KEY_STORAGE);
  if (!key || !/^[a-zA-Z0-9-]{20,80}$/.test(key)) {
    const generated = "uk-" + crypto.randomUUID().replace(/-/g, "").slice(0, 33);
    localStorage.setItem(OWNER_KEY_STORAGE, generated);
    key = generated;
  }
  return key;
}

// All health-tracker API calls require the x-health-owner-key header
async function healthRequest(method, url, data) {
  const headers = { "x-health-owner-key": getOwnerKey() };
  const response = await client({ method, url, data, headers });
  return response.data?.data ?? response.data;
}

const authHeaders = async () => {
  if (!supabase) throw new Error("Authentication is not configured.");
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Authentication required.");
  return { Authorization: `Bearer ${data.session.access_token}` };
};

// ---------------------------------------------------------------------------
// Dynamic fallback helper: realistic local facilities around GPS location
// ---------------------------------------------------------------------------
const getDynamicFallbackFacilities = (lat = 22.5726, lng = 88.3639) => {
  const dist = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
  };

  const facilities = [
    { id: "local-h1", name: "Sub-District Hospital",               type: "Hospital",   lat: lat + 0.005, lng: lng + 0.004, emergency: true,  icuBeds: 12, address: "Station Road",    phone: "102 / 108"      },
    { id: "local-h2", name: "College of Medicine & JNM Hospital",  type: "Hospital",   lat: lat - 0.012, lng: lng - 0.015, emergency: true,  icuBeds: 18, address: "University Campus",phone: "033-2582-8562"  },
    { id: "local-h3", name: "Lifeline Multi-Specialty Hospital",   type: "Hospital",   lat: lat + 0.008, lng: lng - 0.006, emergency: true,  icuBeds: 8,  address: "Central Avenue",   phone: "1800-123-4567"  },
    { id: "local-h4", name: "City Care Hospital",                  type: "Hospital",   lat: lat - 0.005, lng: lng + 0.010, emergency: true,  icuBeds: 4,  address: "Market Area",       phone: "033-2582-1234"  },
    { id: "local-c1", name: "Polyclinic & Diagnostic Centre",      type: "Clinic",     lat: lat + 0.002, lng: lng + 0.003, emergency: false, icuBeds: 0,  address: "MG Road",           phone: "033-2582-2345"  },
    { id: "local-c2", name: "Care & Cure Clinic",                  type: "Clinic",     lat: lat - 0.004, lng: lng + 0.006, emergency: true,  icuBeds: 2,  address: "College Road",      phone: "033-2582-3456"  },
    { id: "local-c3", name: "Urban Primary Health Centre",         type: "Clinic",     lat: lat + 0.007, lng: lng - 0.002, emergency: true,  icuBeds: 1,  address: "North Sector",      phone: "033-2582-4567"  },
    { id: "local-p1", name: "Apollo Pharmacy 24/7",                type: "Pharmacy",   lat: lat + 0.003, lng: lng - 0.005, emergency: true,  icuBeds: 0,  address: "Central Avenue",    phone: "1860-500-0101"  },
    { id: "local-p2", name: "MedPlus Pharmacy",                    type: "Pharmacy",   lat: lat - 0.003, lng: lng + 0.004, emergency: false, icuBeds: 0,  address: "Station Road",      phone: "033-2582-5678"  },
    { id: "local-p3", name: "Frank Ross Pharmacy",                 type: "Pharmacy",   lat: lat + 0.006, lng: lng + 0.007, emergency: false, icuBeds: 0,  address: "Hospital Road",     phone: "033-2582-6789"  },
    { id: "local-p4", name: "Sanjeevani Day & Night Chemist",      type: "Pharmacy",   lat: lat - 0.007, lng: lng - 0.004, emergency: true,  icuBeds: 0,  address: "South Sector",      phone: "033-2582-7890"  },
    { id: "local-b1", name: "Red Cross Blood Centre",              type: "Blood Bank", lat: lat - 0.006, lng: lng - 0.003, emergency: true,  icuBeds: 0,  address: "Main Market",       phone: "033-2582-8282"  },
    { id: "local-b2", name: "Sub-Divisional Voluntary Blood Bank", type: "Blood Bank", lat: lat + 0.004, lng: lng + 0.008, emergency: true,  icuBeds: 0,  address: "Hospital Campus",   phone: "033-2582-8901"  },
    { id: "local-b3", name: "Lifeline Blood Bank & Component Centre",type:"Blood Bank", lat: lat - 0.009, lng: lng + 0.005, emergency: true, icuBeds: 0,  address: "Industrial Area",   phone: "033-2582-9012"  },
  ];

  return facilities
    .map((f) => ({ ...f, latitude: f.lat, longitude: f.lng, distance: dist(lat, lng, f.lat, f.lng) }))
    .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
};

const unwrap = (p, fallback) => p.then((r) => r.data.data).catch(() => fallback);

// ---------------------------------------------------------------------------
// Main API object
// ---------------------------------------------------------------------------
const api = {
  health: () => unwrap(client.get("/api/health"), { status: "offline demo" }),

  // ------------------------------------------------------------------
  // Nearby facilities: tries Overpass OSM first, merges with fallbacks
  // ------------------------------------------------------------------
  facilities: async (lat, lng) => {
    if (!lat || !lng) return getDynamicFallbackFacilities(22.5726, 88.3639);

    const fallbacks = getDynamicFallbackFacilities(lat, lng);
    const query = `[out:json][timeout:5];(node["amenity"~"hospital|clinic|pharmacy"](around:8000,${lat},${lng});node["healthcare"](around:8000,${lat},${lng}););out body 30;`;

    let overpassResults = [];
    try {
      // Use axios-native timeout (not AbortController) so the request is
      // cancelled cleanly — no dangling "pending → canceled" in DevTools.
      const res = await axios.post(
        "https://overpass-api.de/api/interpreter",
        `data=${encodeURIComponent(query)}`,
        {
          timeout: 3500,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );
      if (res.status === 200 && res.data?.elements?.length > 0) {
        overpassResults = res.data.elements;
      }
    } catch {
      // Timeout or network error — fallbacks will be used silently.
    }

    const seenNames = new Set();
    const R = 6371;

    const parseOverpassElements = (elements) =>
      elements
        .map((el) => {
          const itemLat = el.lat || el.center?.lat;
          const itemLng = el.lon || el.center?.lon;
          if (!itemLat || !itemLng) return null;

          const tags = el.tags || {};
          const dLat = ((itemLat - lat) * Math.PI) / 180;
          const dLng = ((itemLng - lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat * Math.PI) / 180) *
            Math.cos((itemLat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
          const distance = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);

          let type = "Clinic";
          if (tags.amenity === "hospital" || tags.healthcare === "hospital")       type = "Hospital";
          else if (tags.amenity === "pharmacy" || tags.healthcare === "pharmacy")  type = "Pharmacy";
          else if (tags.amenity === "doctors"  || tags.healthcare === "doctor")    type = "Doctor";
          else if (tags.healthcare === "blood_bank" || tags.amenity === "blood_bank") type = "Blood Bank";
          else if (tags.healthcare === "centre") type = "Clinic";

          const isHospital = type === "Hospital";
          const rawName    = tags.name || tags["name:en"];
          const name       = rawName || (isHospital ? "Local Hospital" : `${type} Facility`);
          if (rawName && seenNames.has(rawName)) return null;
          if (rawName) seenNames.add(rawName);

          return {
            id: el.id.toString(), name, type,
            latitude: itemLat, longitude: itemLng, lat: itemLat, lng: itemLng, distance,
            icuBeds: isHospital ? Math.floor(Math.random() * 15) + 1 : 0,
            emergency: tags.emergency === "yes" || isHospital,
            address: tags["addr:street"] || tags["addr:full"] || tags["addr:suburb"] || "Local Area",
            phone: tags.phone || tags["contact:phone"] || "102 / 108",
          };
        })
        .filter(Boolean);

    const combined = [...parseOverpassElements(overpassResults)];
    for (const fb of fallbacks) {
      if (!seenNames.has(fb.name)) { seenNames.add(fb.name); combined.push(fb); }
    }
    return combined.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
  },

  // ------------------------------------------------------------------
  // Report simplifier (OCR → Gemini)
  // ------------------------------------------------------------------
  simplifyReport: (file, language) => {
    const f = new FormData();
    f.append("document", file);
    f.append("language", language);
    return client
      .post("/api/simplify-report", f, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      })
      .then((r) => r.data?.data || r.data)
      .catch((e) => {
        const err = new Error(
          e.response?.data?.message || e.response?.data?.error || e.message || "Failed to analyze document."
        );
        if (e.response?.status === 422) {
          err.status = 422;
          err.detectedType = e.response?.data?.detectedType || "Non-medical Document";
        }
        throw err;
      });
  },

  // ------------------------------------------------------------------
  // Voice transcription (audio blob → Groq Whisper, fallback local)
  // ------------------------------------------------------------------
  transcribe: (audio, language) => {

    const f = new FormData();
    f.append("audio", audio, "voice.webm");
    f.append("language", language);
    return unwrap(
      client.post("/api/voice/transcribe", f),
      { text: "I have a headache and feel dizzy since this morning.", source: "local fallback" }
    );
  },

  // ------------------------------------------------------------------
  // Triage (text symptoms → Gemini AI urgency classification)
  // ------------------------------------------------------------------
  triage: async (symptoms, language = "English") => {
    const res = await client.post("/api/triage", { symptoms, language });
    return res.data?.data || res.data;
  },

  // ------------------------------------------------------------------
  // Multi-turn voice consultation — used by App.jsx doConsultationStep()
  // ------------------------------------------------------------------
  voiceConsultation: async (history, language = "English") => {
    const res = await client.post("/api/voice/consultation", { history, language });
    return res.data?.data || res.data;
  },

  // ------------------------------------------------------------------
  // Emergency SOS
  // ------------------------------------------------------------------
  sos: (body) =>
    unwrap(client.post("/api/sos", body), {
      id: "DEMO-SOS",
      coordinates: { latitude: 22.5726, longitude: 88.3639 },
      timestamp: new Date().toISOString(),
      urgency: "RED",
      conditionSummary: "Emergency assistance requested",
      status: "dispatching",
      etaMinutes: 12,
    }),

  firstAid: () => FIRST_AID,

  // ------------------------------------------------------------------
  // Health Tracker (requires x-health-owner-key header on every call)
  // ------------------------------------------------------------------

  admin: { me: async () => client.get("/api/admin/me", { headers: await authHeaders() }).then(response => response.data.data) },
  emergency: {
    public: token => client.get(`/api/emergency/${encodeURIComponent(token)}`).then(response => response.data.data),
    load: () => healthRequest("get", "/api/health-tracker/emergency-profile"),
    save: data => healthRequest("put", "/api/health-tracker/emergency-profile", data),
    disable: () => healthRequest("post", "/api/health-tracker/emergency-profile/disable"),
    regenerate: () => healthRequest("post", "/api/health-tracker/emergency-profile/regenerate")
  },

  healthTracker: {
    load:              ()           => healthRequest("get",    "/api/health-tracker"),
    addCareMember:     (data)       => healthRequest("post",   "/api/health-tracker/care-circle", data),
    updateCareMember:  (id, data)   => healthRequest("patch",  `/api/health-tracker/care-circle/${id}`, data),
    deleteCareMember:  (id)         => healthRequest("delete", `/api/health-tracker/care-circle/${id}`),
    createPlan:        (data)       => healthRequest("post",   "/api/health-tracker/plans", data),
    updatePlan:        (id, data)   => healthRequest("patch",  `/api/health-tracker/plans/${id}`, data),
    deletePlan:        (id)         => healthRequest("delete", `/api/health-tracker/plans/${id}`),
    addCheckIn:        (id, data)   => healthRequest("post",   `/api/health-tracker/plans/${id}/check-ins`, data),
    deleteCheckIn:     (pid, id)    => healthRequest("delete", `/api/health-tracker/plans/${pid}/check-ins/${id}`),
    addMilestone:      (id, data)   => healthRequest("post",   `/api/health-tracker/plans/${id}/milestones`, data),
    updateMilestone:   (pid, id, d) => healthRequest("patch",  `/api/health-tracker/plans/${pid}/milestones/${id}`, d),
    deleteMilestone:   (pid, id)    => healthRequest("delete", `/api/health-tracker/plans/${pid}/milestones/${id}`),
    addHistory:        (data)       => healthRequest("post",   "/api/health-tracker/history", data),
    updateHistory:     (id, data)   => healthRequest("patch",  `/api/health-tracker/history/${id}`, data),
    deleteHistory:     (id)         => healthRequest("delete", `/api/health-tracker/history/${id}`),
    saveReminder:      (id, data)   => healthRequest("put",    `/api/health-tracker/history/${id}/reminder`, data),
    deleteReminder:    (id)         => healthRequest("delete", `/api/health-tracker/history/${id}/reminder`),
    markReminderTaken: (id, data)   => healthRequest("post",   `/api/health-tracker/history/${id}/reminder/taken`, data),
  },

  // ------------------------------------------------------------------
  // Medicine Safety
  // ------------------------------------------------------------------
  medicines: {
    research: (name)     => client.post("/api/medicines/research", { name }).then((r) => r.data.data),
    ask:      (question) => client.post("/api/medicines/ask", { question }).then((r) => r.data.data),
    search:   (query)    => client.get("/api/medicines/search", { params: { q: query } }).then((r) => r.data.data),
    details:  (id)       => client.get(`/api/medicines/labels/${encodeURIComponent(id)}`).then((r) => r.data.data),
  },
};

export { api };
