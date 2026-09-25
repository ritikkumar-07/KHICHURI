import { UrgencyMeter } from "./UrgencyMeter";
import { Loader2, AlertTriangle, CheckSquare, Stethoscope, Volume2 } from "lucide-react";

function TriageCard({ result, language = "English" }) {
  if (!result) return null;

  const rawAlert = String(result.alertLevel || "").trim().toUpperCase();
  const isFinalAlert = ["RED", "YELLOW", "GREEN"].includes(rawAlert);

  // Enter in-progress state ONLY if not a final alert and explicitly IN_PROGRESS / not finalized
  const isInProgress = !isFinalAlert && (rawAlert === "IN_PROGRESS" || result.isFinalVerdict === false);

  if (isInProgress) {
    return (
      <section className="panel triage-card" id="triage-result" aria-live="polite">
        <div className="panel-head" style={{ marginBottom: "16px" }}>
          <span>AI DOCTOR CONSULTATION</span>
          <small>In Progress</small>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#fdfcfb", border: "1px solid #d8d2c8", padding: "16px", borderRadius: "12px", marginBottom: "16px" }}>
          <Loader2 className="spinner" size={24} style={{ color: "#2f7cc0", animation: "spin 1s linear infinite" }} />
          <div>
            <b style={{ display: "block", fontSize: "14px" }}>AI Doctor is speaking / listening...</b>
            {result.spokenResponse && (
              <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#4a453e" }}>"{result.spokenResponse}"</p>
            )}
          </div>
        </div>
        {result.summary && (
          <p className="summary" style={{ fontSize: "13px", color: "#817b72" }}>{result.summary}</p>
        )}
      </section>
    );
  }

  // Treat RED, YELLOW, or GREEN as a completed verdict regardless of whether isFinalVerdict is defined
  const alertLevel = isFinalAlert ? rawAlert : "YELLOW";
  const summary = result.summary || result.interpretation || "Symptom evaluation completed.";
  const immediateActions = Array.isArray(result.immediateActions) ? result.immediateActions : [];
  const recommendedCare = result.recommendedAction || result.recommendedCare;
  const voiceAdvice = result.voiceResponse || result.spokenResponse;

  const isBengali = language === "Bengali" || language === "bn-IN" ||
    result.language === "Bengali" || result.language === "bn-IN" ||
    Boolean(summary && /[\u0980-\u09FF]/.test(summary)) ||
    Boolean(voiceAdvice && /[\u0980-\u09FF]/.test(voiceAdvice));

  return (
    <section className="panel triage-card" id="triage-result" aria-live="polite">
      <div className="panel-head">
        <span>FINAL TRIAGE RESULT</span>
        <small>AI-assisted</small>
      </div>

      {/* 1. UrgencyMeter with corresponding color badge */}
      <UrgencyMeter urgency={alertLevel} />

      {/* 2. Condition Summary & symptom interpretation */}
      <div style={{ marginTop: "16px" }}>
        <label style={{ fontSize: "11px", fontWeight: 700, letterSpacing: ".08em", color: "#817b72", textTransform: "uppercase" }}>
          Condition Summary & Symptom Interpretation
        </label>
        <p className="summary" style={{ fontWeight: 600, color: "#1f1f1f", fontSize: "16px", marginTop: "6px", lineHeight: "1.5" }}>
          {summary}
        </p>
      </div>

      {/* Two columns: Immediate Actions & Recommended Care / Voice Advice */}
      <div className="two-col" style={{ marginTop: "24px" }}>
        {/* 3. Immediate Actions checklist */}
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: ".08em", color: "#817b72", textTransform: "uppercase" }}>
            <CheckSquare size={14} style={{ color: "#228557" }} />
            IMMEDIATE ACTIONS
          </label>
          {immediateActions.length > 0 ? (
            <ul style={{ paddingLeft: "18px", marginTop: "10px" }}>
              {immediateActions.map((action, idx) => (
                <li key={idx} style={{ marginBottom: "8px", fontSize: "14px", color: "#3a3530", lineHeight: "1.4" }}>
                  {action}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: "14px", color: "#817b72", marginTop: "8px" }}>No immediate emergency actions required.</p>
          )}
        </div>

        {/* 4 & 5. Recommended Care & Voice Advice */}
        <div>
          {/* 4. Recommended Care & next steps */}
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: ".08em", color: "#817b72", textTransform: "uppercase" }}>
            <Stethoscope size={14} style={{ color: "#2f7cc0" }} />
            RECOMMENDED CARE & NEXT STEPS
          </label>
          <p style={{ fontSize: "14px", color: "#3a3530", background: "#fdfcfb", border: "1px solid #d8d2c8", padding: "12px", borderRadius: "8px", marginTop: "8px", lineHeight: "1.5" }}>
            {recommendedCare || "Monitor symptoms closely and consult a primary care physician if symptoms persist or worsen."}
          </p>

          {/* 5. Spoken summary / voice advice */}
          {voiceAdvice && (
            <div style={{ marginTop: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700, letterSpacing: ".08em", color: "#817b72", textTransform: "uppercase" }}>
                <Volume2 size={14} style={{ color: "#817b72" }} />
                SPOKEN SUMMARY / VOICE ADVICE
              </label>
              <p style={{ fontSize: "14px", color: "#4a453e", fontStyle: "italic", background: "#f9f7f4", border: "1px solid #e7e2d9", padding: "10px 12px", borderRadius: "8px", marginTop: "8px", lineHeight: "1.5" }}>
                "{voiceAdvice}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Explicit, highlighted disclaimer banner at the bottom */}
      <div
        className="medical-disclaimer-banner"
        style={{
          marginTop: "28px",
          padding: "14px 16px",
          borderRadius: "10px",
          background: "#fef3c7",
          border: "1px solid #fcd34d",
          color: "#78350f",
          fontSize: "13px",
          lineHeight: "1.5",
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
        }}
      >
        <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px", color: "#b45309" }} />
        <div>
          {isBengali ? (
            "মেডিকেল ডিসক্লেইমার: এটি AI দ্বারা তৈরি এবং ভুল হতে পারে। পেশাদার চিকিৎসকের বিকল্প নয়। প্রয়োজনে অবিলম্বে ১১২ ডায়াল করুন।"
          ) : (
            "Medical Disclaimer: This analysis is generated by AI and may make mistakes. It is not a substitute for professional clinical judgment. Please consult a qualified real doctor or healthcare provider. In an emergency, call 112 immediately."
          )}
        </div>
      </div>
    </section>
  );
}

export { TriageCard };
