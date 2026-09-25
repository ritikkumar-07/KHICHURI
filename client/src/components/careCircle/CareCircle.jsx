import { useEffect, useState } from "react";
import { AlertTriangle, Check, HeartHandshake, Phone, Pill, Plus, Trash2, UserRound } from "lucide-react";
import { api } from "../../services/api";
import { localToday } from "../../services/cycleCalculations";

const idOf = item => item?._id || item?.id;
const relationships = ["Mother", "Father", "Grandmother", "Grandfather", "Sister", "Brother", "Spouse", "Child", "Other"];
const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];
const blank = { name: "", relationship: "Mother", age: "", bloodGroup: "", allergy: "", emergencyContact: "" };
const timeLabel = value => new Date(2000, 0, 1, ...value.split(":").map(Number)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function MemberForm({ initial, busy, save, close }) {
  const [form, setForm] = useState(initial || blank);
  return <form className="care-panel care-member-form" onSubmit={event => { event.preventDefault(); save(form); }}>
    <div className="care-section-head"><h2>{initial ? "Edit Profile" : "Add Family Member"}</h2><button type="button" className="text-button" onClick={close}>Cancel</button></div>
    <div className="care-form-grid">
      <label>Name<input required maxLength="100" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label>Relationship<select value={form.relationship} onChange={event => setForm({ ...form, relationship: event.target.value })}>{relationships.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Age (optional)<input type="number" min="0" max="130" value={form.age} onChange={event => setForm({ ...form, age: event.target.value })} /></label>
      <label>Blood Group<select value={form.bloodGroup} onChange={event => setForm({ ...form, bloodGroup: event.target.value })}><option value="">Not recorded</option>{bloodGroups.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Important Allergy<input maxLength="300" value={form.allergy} onChange={event => setForm({ ...form, allergy: event.target.value })} /></label>
      <label>Emergency Contact Number<input type="tel" maxLength="40" value={form.emergencyContact} onChange={event => setForm({ ...form, emergencyContact: event.target.value })} /></label>
    </div>
    <button className="button primary" disabled={busy}>{busy ? "Saving…" : initial ? "Save Changes" : "Add Member"}</button>
  </form>;
}

function RecordForm({ memberId, category, busy, save, close }) {
  const [form, setForm] = useState({ title: "", formStrength: "", reminderTime: "", startDate: "", details: "" });
  return <form className="care-inline-form" onSubmit={event => { event.preventDefault(); save({ ...form, category, patientProfileId: memberId }); }}>
    <h3>Add {category}</h3><label>{category} Name<input required maxLength="160" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
    {category === "Medicine" ? <><label>Strength (optional)<input maxLength="160" value={form.formStrength} onChange={event => setForm({ ...form, formStrength: event.target.value })} /></label><label>Reminder time (optional)<input type="time" value={form.reminderTime} onChange={event => setForm({ ...form, reminderTime: event.target.value })} /></label></> : <><label>Since (optional)<input type="date" value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} /></label><label>Notes (optional)<textarea maxLength="2000" value={form.details} onChange={event => setForm({ ...form, details: event.target.value })} /></label></>}
    <div><button className="button primary" disabled={busy}>Save</button><button type="button" className="button secondary" onClick={close}>Cancel</button></div>
  </form>;
}

function Schedule({ medicines, busy, taken }) {
  const date = localToday(), now = new Date().toTimeString().slice(0, 5);
  const entries = medicines.flatMap(medicine => !medicine.reminder?.enabled || date < medicine.reminder.startDate || (medicine.reminder.endDate && date > medicine.reminder.endDate) ? [] : medicine.reminder.times.map(time => ({ medicine, time, done: medicine.reminder.taken?.some(item => item.date === date && item.time === time) })));
  return entries.length ? <div className="care-medicine-list">{entries.sort((a, b) => a.time.localeCompare(b.time)).map(entry => <article key={`${idOf(entry.medicine)}-${entry.time}`}><time>{timeLabel(entry.time)}</time><div><b>{entry.medicine.title}</b><small>{entry.medicine.formStrength || "Strength not recorded"}</small></div>{entry.done ? <span className="care-taken"><Check size={14} /> Taken</span> : <><span className={entry.time < now ? "care-missed" : "care-pending"}>{entry.time < now ? "Missed" : "Pending"}</span><button className="button secondary compact" disabled={busy} onClick={() => taken(idOf(entry.medicine), { date, time: entry.time })}>Taken</button></>}</article>)}</div> : <div className="care-empty-small">No medicine reminders scheduled today.</div>;
}

export function CareCircle() {
  const [profile, setProfile] = useState(null), [selectedId, setSelectedId] = useState(""), [mode, setMode] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.healthTracker.load();
      setProfile(data);
      setSelectedId(current => current && (data.careCircle || []).some(item => idOf(item) === current) ? current : idOf(data.careCircle?.[0]) || "");
      try { localStorage.setItem("sanjeevani_care_circle", JSON.stringify(data)); } catch (_) {}
    } catch (err) {
      console.warn("CareCircle load error:", err);
      const cached = localStorage.getItem("sanjeevani_care_circle");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setProfile(parsed);
          setSelectedId(current => current && (parsed.careCircle || []).some(item => idOf(item) === current) ? current : idOf(parsed.careCircle?.[0]) || "");
          setError("Viewing saved offline Care Circle records.");
          return;
        } catch (_) {}
      }
      const fallback = { careCircle: [], history: [] };
      setProfile(fallback);
      setSelectedId("");
      setError("Operating in offline demo mode. Sign in to synchronize your family records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const run = async action => {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
      setMode("");
      return true;
    } catch (requestError) {
      console.warn("CareCircle action error:", requestError);
      setError(requestError.response?.data?.message || "Could not sync with server. Offline changes preserved locally.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading && !profile) return <section className="care-loading">Loading Care Circle…</section>;

  const members = profile.careCircle || [], selected = members.find(item => idOf(item) === selectedId);
  const records = (profile.history || []).filter(item => item.patientProfileId === selectedId);
  const medicines = records.filter(item => item.category === "Medicine" && item.status?.toLowerCase() !== "previous"), conditions = records.filter(item => item.category === "Condition");
  const saveRecord = data => run(async () => { const record = await api.healthTracker.addHistory({ ...data, reminderTime: undefined, status: data.category === "Medicine" ? "Current" : "" }); if (data.reminderTime) await api.healthTracker.saveReminder(idOf(record), { frequency: "Once Daily", times: [data.reminderTime], startDate: localToday(), enabled: true }); });
  const todaySummary = member => { const today = localToday(), meds = (profile.history || []).filter(item => item.patientProfileId === idOf(member) && item.category === "Medicine" && item.reminder?.enabled && today >= item.reminder.startDate && (!item.reminder.endDate || today <= item.reminder.endDate)); const total = meds.reduce((sum, item) => sum + item.reminder.times.length, 0), done = meds.reduce((sum, item) => sum + item.reminder.times.filter(time => item.reminder.taken?.some(entry => entry.date === today && entry.time === time)).length, 0); return total ? done === total ? "All medicines taken ✓" : `${done} taken · ${total - done} pending` : "No reminders today"; };

  return <section className="care-circle-view">
    <header className="page-heading care-heading"><span className="section-kicker">FAMILY HEALTH ORGANIZER</span><h1>Care Circle</h1><p>Keep your family's important health information together.</p></header>
    {error && <div className="care-error" role="alert"><AlertTriangle size={17} />{error}</div>}
    {!members.length && mode !== "add" && <section className="care-panel care-empty"><HeartHandshake size={34} /><h2>Keep important health information for the people you care about in one place.</h2><button className="button primary" onClick={() => setMode("add")}><Plus size={16} /> Add First Family Member</button></section>}
    {members.length > 0 && <><section className="care-panel care-switcher"><label>Viewing health for:<select value={selectedId} onChange={event => { setSelectedId(event.target.value); setMode(""); }}>{members.map(member => <option value={idOf(member)} key={idOf(member)}>{member.name} · {member.relationship}</option>)}</select></label><button className="button secondary" onClick={() => setMode("add")}><Plus size={15} /> Add Family Member</button></section><section className="care-panel"><span className="section-kicker">FAMILY TODAY</span><h2>Medicine status</h2><div className="care-family-today">{members.map(member => <button key={idOf(member)} onClick={() => setSelectedId(idOf(member))}><b>{member.name}</b><small>{todaySummary(member)}</small></button>)}</div></section></>}
    {mode === "add" && <MemberForm busy={busy} save={form => run(() => api.healthTracker.addCareMember(form))} close={() => setMode("")} />}
    {selected && mode !== "add" && <>
      <section className="care-profile-head"><div className="care-avatar"><UserRound /></div><div><h2>{selected.name}</h2><p>{selected.relationship}{selected.age !== undefined ? ` · Age ${selected.age}` : ""}</p></div><button className="button secondary" onClick={() => setMode("edit")}>Edit Profile</button></section>
      {mode === "edit" && <MemberForm initial={{ name: selected.name, relationship: selected.relationship, age: selected.age ?? "", bloodGroup: selected.bloodGroup || "", allergy: selected.allergy || "", emergencyContact: selected.emergencyContact || "" }} busy={busy} save={form => run(() => api.healthTracker.updateCareMember(selectedId, form))} close={() => setMode("")} />}
      <div className="care-grid">
        <section className="care-panel"><div className="care-section-head"><div><span className="section-kicker">TODAY'S MEDICINES</span><h2>Medicine reminders</h2></div><button className="button secondary compact" onClick={() => setMode("Medicine")}><Plus size={14} /> Add Medicine</button></div><Schedule medicines={medicines} busy={busy} taken={(id, data) => run(() => api.healthTracker.markReminderTaken(id, data))} />{mode === "Medicine" && <RecordForm memberId={selectedId} category="Medicine" busy={busy} save={saveRecord} close={() => setMode("")} />}<div className="care-record-list">{medicines.map(item => <p key={idOf(item)}><Pill size={15} /><span><b>{item.title}</b><small>{item.reminder ? item.reminder.times.map(timeLabel).join(" · ") : "No reminder"}</small></span><button className="icon-button danger" aria-label={`Remove ${item.title}`} onClick={() => window.confirm(`Remove ${item.title} from ${selected.name}?`) && run(() => api.healthTracker.deleteHistory(idOf(item)))}><Trash2 size={14} /></button></p>)}</div></section>
        <section className="care-panel"><div className="care-section-head"><div><span className="section-kicker">HEALTH INFORMATION</span><h2>Health Conditions</h2></div><button className="button secondary compact" onClick={() => setMode("Condition")}><Plus size={14} /> Add Condition</button></div>{mode === "Condition" && <RecordForm memberId={selectedId} category="Condition" busy={busy} save={saveRecord} close={() => setMode("")} />}<div className="care-record-list">{conditions.length ? conditions.map(item => <p key={idOf(item)}><span><b>{item.title}</b><small>{item.details || "User-entered condition"}</small></span><button className="icon-button danger" aria-label={`Remove ${item.title}`} onClick={() => window.confirm(`Remove ${item.title}?`) && run(() => api.healthTracker.deleteHistory(idOf(item)))}><Trash2 size={14} /></button></p>) : <div className="care-empty-small">No health conditions recorded.</div>}</div></section>
        <section className="care-panel care-emergency"><span className="section-kicker">EMERGENCY INFORMATION</span><h2>{selected.name}</h2><p><span>Blood Group</span><b>{selected.bloodGroup || "Not recorded"}</b></p><p><span>Important Allergy</span><b>{selected.allergy || "None recorded"}</b></p><p><span>Current Medicines</span><b>{medicines.length}</b></p>{selected.emergencyContact ? <a className="button primary" href={`tel:${selected.emergencyContact}`}><Phone size={15} /> Call {selected.emergencyContact}</a> : <p><span>Emergency Contact</span><b>Not recorded</b></p>}</section>
      </div>
      <button className="text-button danger" onClick={() => window.confirm(`Remove ${selected.name} from your Care Circle? Associated medicines and conditions must be removed first.`) && run(() => api.healthTracker.deleteCareMember(selectedId))}>Remove Family Member</button>
    </>}
  </section>;
}
