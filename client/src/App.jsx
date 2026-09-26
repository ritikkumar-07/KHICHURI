import { useCallback, useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useSearchParams
} from "react-router-dom";
import {
  BookOpen,
  CalendarHeart,
  ChevronRight,
  HeartHandshake,
  HeartPulse,
  Map,
  MapPin,
  Mic,
  Pill,
  Play,
  QrCode,
  ShieldAlert,
  Square,
  Stethoscope,
  FileText,
  Droplet
} from "lucide-react";
import { Navbar } from "./components/common/Navbar";
import { BackButton } from "./components/common/BackButton";
import { AccessibilitySettings } from "./components/common/AccessibilitySettings";
import { LanguageSelector } from "./components/voice/LanguageSelector";
import { VoiceWaveform } from "./components/voice/VoiceWaveform";
import { TriageCard } from "./components/triage/TriageCard";
import { NeonMap } from "./components/map/NeonMap";
import { HospitalDrawer } from "./components/map/HospitalDrawer";
import { BloodStockCounter } from "./components/map/BloodStockCounter";
import { SosButton } from "./components/emergency/SosButton";
import { EmergencyTracker } from "./components/emergency/EmergencyTracker";
import { FirstAidList } from "./components/firstaid/FirstAidList";
import { StepByStepCard } from "./components/firstaid/StepByStepCard";
import { ReportSimplifier } from "./components/reports/ReportSimplifier";
import { HealthTracker } from "./components/health/HealthTracker";
import { MedicineSafety } from "./components/medicines/MedicineSafety";
import { MedicineReminderWatcher } from "./components/medicines/MedicineReminderWatcher";
import { CareCircle } from "./components/careCircle/CareCircle";
import { LoginPage } from "./components/auth/LoginPage";
import { AdminPage } from "./components/admin/AdminPage";
import { EmergencyQrSettings } from "./components/emergencyQr/EmergencyQrSettings";
import { EmergencyPublicPage } from "./components/emergencyQr/EmergencyPublicPage";
import { useAuth } from "./auth/AuthContext";
import { supabase } from "./services/supabase";
import { api } from "./services/api";
import { cacheFirstAid, getFirstAid } from "./services/offlineStorage";
import { useGeolocation } from "./hooks/useGeolocation";
import { useVoiceRecorder } from "./hooks/useVoiceRecorder";
import { useVoiceSynthesis } from "./hooks/useVoiceSynthesis";
import { useSocket } from "./hooks/useSocket";

// Route path constants — single source of truth
export const PATHS = {
  dashboard: "/",
  voiceCheck: "/voice-check",
  facilities: "/facilities",
  bloodBank: "/blood-bank",
  firstAid: "/first-aid",
  reportReader: "/report-reader",
  sos: "/sos",
  healthTracker: "/health-tracker",
  medicineSafety: "/medicine-safety",
  womensHealth: "/womens-health",
  careCircle: "/care-circle",
  emergencyQr: "/emergency-qr",
  admin: "/admin",
  login: "/login",
  status: "/status"
};

// Backward-compatibility mapping: view strings to actual router paths
export const VIEW_TO_PATH = {
  "Dashboard":      PATHS.dashboard,
  "Voice Check":    PATHS.voiceCheck,
  "Voice Triage":   PATHS.voiceCheck,
  "Facilities":     PATHS.facilities,
  "Emergency Map":  PATHS.facilities,
  "Blood Bank":     PATHS.bloodBank,
  "First Aid":      PATHS.firstAid,
  "Report Reader":  PATHS.reportReader,
  "Medical Reports":PATHS.reportReader,
  "SOS Response":   PATHS.sos,
  "Health Tracker": PATHS.healthTracker,
  "Medicine Safety":PATHS.medicineSafety,
  "Medicines":      PATHS.medicineSafety,
  "Women's Health": PATHS.womensHealth,
  "Care Circle":    PATHS.careCircle,
  "Emergency QR":   PATHS.emergencyQr,
  "Admin":          PATHS.admin,
  "Sign In":        PATHS.login,
  "System Status":  PATHS.status
};

// Feature card definitions [label, description, Icon, path, colorClass]
const features = [
  ["Health Tracker", "Track your health and recovery progress over time.", HeartPulse, PATHS.healthTracker, "green"],
  ["Report Simplifier", "Understand complex medical jargon with AI.", FileText, PATHS.reportReader, "green"],
  ["Nearby Facilities", "Find hospitals and emergency care near you.", Map, PATHS.facilities, "green"],
  ["Care Circle", "Keep your family's important health information together.", HeartHandshake, PATHS.careCircle, "red"],
  ["Emergency QR", "Share critical health information safely during an emergency.", QrCode, PATHS.emergencyQr, "red"],
  ["Emergency SOS", "Request urgent support with your location.", ShieldAlert, PATHS.sos, "red"],
  ["Medicines", "Search medicines, understand their uses and manage your medicine reminders.", Pill, PATHS.medicineSafety, "amber"],
  ["Blood Bank", "Live blood inventory and availability.", Droplet, PATHS.bloodBank, "amber"],
  ["First Aid", "Essential emergency guides, ready when offline.", BookOpen, PATHS.firstAid, "amber"]
];

// ---------------------------------------------------------------------------
// Route Guard & Auth Components
// ---------------------------------------------------------------------------

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isHospitalAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="page-shell">
        <section className="system-card">Restoring your secure session…</section>
      </main>
    );
  }

  if (!user) {
    return <Navigate to={PATHS.login} state={{ from: location, mode: adminOnly ? "admin" : "user" }} replace />;
  }

  if (adminOnly && !isHospitalAdmin) {
    return <Navigate to={PATHS.login} state={{ from: location, mode: "admin" }} replace />;
  }

  return children;
}

function LoginPageWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialMode = location.state?.mode || null;
  const from = location.state?.from?.pathname || (initialMode === "admin" ? PATHS.admin : PATHS.dashboard);

  const handleSuccess = (mode) => {
    if (mode === "admin") {
      navigate(PATHS.admin, { replace: true });
    } else {
      navigate(from === PATHS.login ? PATHS.dashboard : from, { replace: true });
    }
  };

  const handleCancel = () => {
    navigate(PATHS.dashboard, { replace: true });
  };

  return <LoginPage initialMode={initialMode} onSuccess={handleSuccess} onCancel={handleCancel} />;
}

// ---------------------------------------------------------------------------
// Page components
// ---------------------------------------------------------------------------

function DashboardPage({ language, setLanguage, triage, geo, voice, processing, text, setText, record, showVoice, doTriage, navigate }) {
  return (
    <>
      <section className="hero-section">
        <div className="hero-badge">✦ AI-powered emergency guidance</div>
        <h1>Healthcare guidance<br /><em>when you need it.</em></h1>
        <p>Describe symptoms by voice or text. SANJEEVANI provides AI-assisted guidance, emergency support, and nearby care when every moment matters.</p>
        <p className="hero-disclaimer">Guidance only — not a replacement for professional medical diagnosis.</p>
        <div className="hero-actions">
          <button className="button primary" onClick={() => record(false)} disabled={processing}>
            <Mic size={18} />
            {voice.recording ? "Stop & analyze" : "Start Voice Check"}
            <ChevronRight size={16} />
          </button>
          <button className="button secondary" onClick={showVoice}>
            <Stethoscope size={18} />
            Describe symptoms
          </button>
        </div>
        <LanguageSelector onChange={setLanguage} value={language} />
      </section>

      <section className="voice-card" aria-label="Voice and text symptom input">
        <div className="voice-card-copy">
          <span className="section-kicker">YOUR HEALTH CHECK</span>
          <h2>Tell us what you're feeling</h2>
          <p>Speak naturally or type a few details below. We'll guide you through the next best step.</p>
        </div>
        <div className="voice-card-action">
          <VoiceWaveform state={processing ? "processing" : voice.recording ? "recording" : "idle"} />
          <button
            className="mic-button"
            onClick={() => record(false)}
            disabled={processing}
            aria-label={voice.recording ? "Stop voice recording" : "Start voice check"}
          >
            {voice.recording ? <Square size={19} /> : <Mic size={20} />}
          </button>
        </div>
        <div className="symptom-input">
          <label htmlFor="symptoms">Describe your symptoms</label>
          <div>
            <input
              id="symptoms"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doTriage(text)}
              placeholder="For example, I feel dizzy and have chest discomfort…"
            />
            <button className="button healthcare" onClick={() => doTriage(text)} disabled={processing}>
              <Play size={15} />
              Analyze
            </button>
          </div>
          {voice.error && <small className="error">{voice.error}</small>}
        </div>
      </section>

      {triage && <TriageCard result={triage} language={language} />}

      <section className="feature-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">CARE AT A GLANCE</span>
            <h2>Support beyond the check-in</h2>
          </div>
          <span>{geo?.error ? "Location fallback active" : "Location ready"} <MapPin size={15} /></span>
        </div>
        <div className="feature-grid">
          {features.map(([title, description, Icon, path, color]) => (
            <button className="feature-card" key={title} onClick={() => navigate(path)}>
              <span className={`feature-icon ${color}`}><Icon size={21} /></span>
              <ChevronRight className="feature-arrow" size={18} />
              <h3>{title}</h3>
              <p>{description}</p>
              <small><i className={color} /> Ready now</small>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function VoiceCheckPage(props) {
  useEffect(() => {
    document.getElementById("symptoms")?.focus();
  }, []);

  return <DashboardPage {...props} />;
}

function FacilitiesPage({ facilities, geo, selected, setSelected }) {
  const [filterType, setFilterType] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const displayFacilities = facilities.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "All" || f.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <section className="directory-view">
      <header className="page-heading">
        <span className="section-kicker">CARE DIRECTORY</span>
        <h1>Nearby healthcare facilities</h1>
        <p>Real-time hospitals, clinics, emergency centers, and pharmacies within 10 km of your location.</p>
      </header>

      <div className="facility-filters" style={{ display: "flex", gap: "10px", marginBottom: "20px", maxWidth: "800px", width: "100%" }}>
        <input
          type="text"
          placeholder="Search facilities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ padding: "10px 15px", flex: 1, borderRadius: "8px", border: "1px solid #d8d2c8", fontSize: "1rem", background: "#fff", color: "#1f1f1f" }}
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: "10px 15px", borderRadius: "8px", border: "1px solid #d8d2c8", fontSize: "1rem", background: "#fff", color: "#1f1f1f" }}
        >
          <option value="All">All Types</option>
          <option value="Hospital">Hospitals</option>
          <option value="Clinic">Clinics</option>
          <option value="Pharmacy">Pharmacies</option>
          <option value="Blood Bank">Blood Banks</option>
        </select>
      </div>

      <div className="facility-layout">
        <div className="facility-list">
          {displayFacilities.length === 0 ? (
            <p style={{ padding: "20px", textAlign: "center", color: "#817b72" }}>
              Searching for healthcare facilities in your 10 km radius...
            </p>
          ) : (
            displayFacilities.map((facility) => (
              <button key={facility.id} className="facility-card" onClick={() => setSelected(facility)}>
                <div>
                  <b>{facility.name}</b>
                  <small>{facility.type} · {facility.distance} km away</small>
                </div>
                <span className="availability">{facility.emergency ? "Emergency available" : "Standard care"}</span>
                <p>{facility.icuBeds || 0} ICU beds available</p>
                <span className="card-link">View route & details <ChevronRight size={15} /></span>
              </button>
            ))
          )}
        </div>
        <div style={{ minWidth: "0", width: "100%", flex: "1", minHeight: "550px" }}>
          <NeonMap facilities={displayFacilities} onSelect={setSelected} position={geo} selected={selected} />
          <HospitalDrawer facility={selected} onClose={() => setSelected(undefined)} userPosition={geo} />
        </div>
      </div>
    </section>
  );
}

function SosPage({ geo, alert, sos }) {
  return (
    <section className="sos-view">
      <header className="page-heading centered">
        <span className="section-kicker emergency-text">EMERGENCY ASSISTANCE</span>
        <h1>Help is one step away.</h1>
        <p>Share your location with our simulated response system. In a real emergency, call <b>112</b> immediately.</p>
      </header>
      <div className="sos-layout">
        <section className="sos-intro">
          <span className="sos-icon"><ShieldAlert size={30} /></span>
          <h2>Emergency SOS</h2>
          <p>Request immediate assistance and share your current location with the response team.</p>
          <SosButton geo={geo} onConfirm={sos} />
        </section>
        <EmergencyTracker alert={alert} />
      </div>
    </section>
  );
}

function FirstAidPage({ guide, setGuide }) {
  return (
    <section className="firstaid-view">
      <header className="page-heading">
        <span className="section-kicker">OFFLINE KNOWLEDGE CENTER</span>
        <h1>Emergency first-aid guides</h1>
        <p>Quick, step-by-step guidance for common emergency situations — available even offline.</p>
      </header>
      <div className="firstaid-grid">
        <FirstAidList guides={getFirstAid()} onSelect={setGuide} />
        <StepByStepCard guide={guide} />
      </div>
    </section>
  );
}

function SystemStatusPage({ geo, socket }) {
  return (
    <section className="system-card">
      <span className="section-kicker">SYSTEM STATUS</span>
      <h1>Everything is ready when you are.</h1>
      <div className="system-grid">
        <p><i /> API fallback-safe</p>
        <p><i /> GPS {geo?.error ? "demo active" : "available"}</p>
        <p><i /> Voice recorder {window.MediaRecorder ? "available" : "unavailable"}</p>
        <p><i /> Socket {socket ? "connected" : "local demo"}</p>
      </div>
      <p className="disclaimer">Demo mode keeps SANJEEVANI useful without a database, API key, GPS, microphone, or socket connection.</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Root App Component
// ---------------------------------------------------------------------------

export default function App() {
  const { user, loading: authLoading, isHospitalAdmin } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const scanToken = searchParams.get("emergency");

  const [helperGeo, setHelperGeo] = useState(null);
  const [language, setLanguage] = useState("English");
  const [triage, setTriage] = useState();
  const [facilities, setFacilities] = useState([]);
  const [selected, setSelected] = useState(undefined);
  const [alert, setAlert] = useState(undefined);
  const [guide, setGuide] = useState(getFirstAid()[0]);
  const [text, setText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  const geo = useGeolocation(!scanToken);
  const activeGeo = helperGeo || geo;
  const voice = useVoiceRecorder();
  const tts = useVoiceSynthesis();
  const onSocket = useCallback((nextAlert) => setAlert(nextAlert), []);
  const socket = useSocket(onSocket);

  useEffect(() => {
    cacheFirstAid();
    if (!scanToken) {
      api.facilities(activeGeo.latitude, activeGeo.longitude).then(setFacilities);
    }
  }, [scanToken, activeGeo.latitude, activeGeo.longitude]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const handleNavigate = useCallback((destination) => {
    const target = VIEW_TO_PATH[destination] || destination;
    navigate(target);
  }, [navigate]);

  const doTriage = async (value) => {
    if (!value?.trim()) return;
    setProcessing(true);
    setText(value);
    try {
      const result = await api.triage(value, language);
      if (result) {
        setTriage(result);
        navigate(PATHS.voiceCheck);
        if (result.voiceResponse) {
          tts.speak(result.voiceResponse, language);
        }
        setTimeout(() => {
          const el = document.getElementById("triage-result") || document.querySelector(".triage-card");
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } catch (err) {
      console.error("[doTriage] Error analyzing symptoms:", err);
    } finally {
      setProcessing(false);
    }
  };

  const record = async () => {
    if (!voice.recording) {
      const langMap = {
        "English": "en-IN",
        "Hindi": "hi-IN",
        "Bengali": "bn-IN",
        "Marathi": "mr-IN",
        "Gujarati": "gu-IN",
        "Telugu": "te-IN",
        "Tamil": "ta-IN"
      };
      await voice.start(langMap[language] || "en-IN");
      return;
    }
    setProcessing(true);
    const result = await voice.stop();
    if (result) {
      if (result instanceof Blob) {
        try {
          const transcribed = await api.transcribe(result, language);
          await doTriage(transcribed.text);
        } catch {
          setProcessing(false);
        }
      } else {
        await doTriage(result);
      }
    } else {
      setProcessing(false);
    }
  };

  const sos = async () => {
    const nextAlert = await api.sos({
      latitude: activeGeo.latitude,
      longitude: activeGeo.longitude,
      urgency: triage?.alertLevel || "RED",
      conditionSummary: triage?.summary || "Emergency assistance requested"
    });
    setAlert(nextAlert);
    navigate(PATHS.sos);
  };

  const showVoice = () => {
    navigate(PATHS.voiceCheck);
    setTimeout(() => document.getElementById("symptoms")?.focus(), 0);
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    navigate(PATHS.dashboard, { replace: true });
  };

  const requirePatientAuth = () => {
    navigate(PATHS.login, { state: { from: { pathname: PATHS.medicineSafety }, mode: "user" } });
  };

  const leavePublicScan = (newViewOrPath) => {
    setSearchParams({});
    const target = VIEW_TO_PATH[newViewOrPath] || newViewOrPath || PATHS.dashboard;
    navigate(target);
  };

  const emergencyHelp = (position) => {
    setHelperGeo(position);
    setSearchParams({});
    navigate(PATHS.facilities);
  };

  if (scanToken) {
    return (
      <div className="app-shell">
        <AccessibilitySettings />
        <EmergencyPublicPage token={scanToken} onHelp={emergencyHelp} onNavigate={leavePublicScan} />
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="app-shell">
        <main className="page-shell">
          <section className="system-card">Restoring your secure session…</section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {user && <MedicineReminderWatcher />}
      <AccessibilitySettings />
      <Navbar online={online && socket} user={user} isHospitalAdmin={isHospitalAdmin} onSignOut={signOut} />
      <main className="page-shell">
        {pathname !== PATHS.dashboard && pathname !== PATHS.login && <BackButton onBack={() => navigate(-1)} />}
        <Routes>
          {/* Public Routes */}
          <Route
            path={PATHS.dashboard}
            element={
              <DashboardPage
                language={language}
                setLanguage={setLanguage}
                triage={triage}
                geo={activeGeo}
                voice={voice}
                processing={processing}
                text={text}
                setText={setText}
                record={record}
                showVoice={showVoice}
                doTriage={doTriage}
                navigate={navigate}
              />
            }
          />
          <Route
            path={PATHS.voiceCheck}
            element={
              <VoiceCheckPage
                language={language}
                setLanguage={setLanguage}
                triage={triage}
                geo={activeGeo}
                voice={voice}
                processing={processing}
                text={text}
                setText={setText}
                record={record}
                showVoice={showVoice}
                doTriage={doTriage}
                navigate={navigate}
              />
            }
          />
          <Route path="/voice-triage" element={<Navigate to={PATHS.voiceCheck} replace />} />
          <Route
            path={PATHS.facilities}
            element={
              <FacilitiesPage
                facilities={facilities}
                geo={activeGeo}
                selected={selected}
                setSelected={setSelected}
              />
            }
          />
          <Route path={PATHS.bloodBank} element={<BloodStockCounter facilities={facilities} />} />
          <Route path={PATHS.firstAid} element={<FirstAidPage guide={guide} setGuide={setGuide} />} />
          <Route path={PATHS.reportReader} element={<ReportSimplifier language={language} />} />
          <Route
            path={PATHS.sos}
            element={<SosPage geo={activeGeo} alert={alert} sos={sos} />}
          />
          <Route
            path={PATHS.medicineSafety}
            element={
              <MedicineSafety
                onNavigate={handleNavigate}
                user={user}
                onRequireAuth={requirePatientAuth}
              />
            }
          />
          <Route path="/medicines" element={<Navigate to={PATHS.medicineSafety} replace />} />
          <Route path={PATHS.login} element={<LoginPageWrapper />} />
          <Route path="/sign-in" element={<Navigate to={PATHS.login} replace />} />
          <Route path={PATHS.status} element={<SystemStatusPage geo={geo} socket={socket} />} />

          {/* Protected Patient Routes */}
          <Route
            path={PATHS.healthTracker}
            element={
              <ProtectedRoute>
                <HealthTracker onNavigate={handleNavigate} />
              </ProtectedRoute>
            }
          />
          <Route
            path={PATHS.careCircle}
            element={
              <ProtectedRoute>
                <CareCircle />
              </ProtectedRoute>
            }
          />
          <Route
            path={PATHS.emergencyQr}
            element={
              <ProtectedRoute>
                <EmergencyQrSettings />
              </ProtectedRoute>
            }
          />

          {/* Protected Admin Route */}
          <Route
            path={PATHS.admin}
            element={
              <ProtectedRoute adminOnly>
                <AdminPage user={user} />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to={PATHS.dashboard} replace />} />
        </Routes>
      </main>
    </div>
  );
}
