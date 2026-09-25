import { useEffect, useState } from 'react';
import { Download, Printer, QrCode, RefreshCw, ShieldOff } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { api } from '../../services/api';

const defaults = { enabled: true, displayName: '', bloodGroup: '', emergencyContact: { name: '', relationship: '', phone: '' }, share: { name: false, bloodGroup: true, allergies: true, medicines: false, conditions: false, emergencyContact: true } };
const listText = value => (value || []).join('\n');
const listValue = value => [...new Set(value.split(/[\n,]/).map(item => item.trim()).filter(Boolean))].slice(0, 12);

export function EmergencyQrSettings() {
  const [form, setForm] = useState(defaults), [availableMedicines, setAvailableMedicines] = useState([]), [token, setToken] = useState('');
  const [allergies, setAllergies] = useState(''), [medicines, setMedicines] = useState(''), [conditions, setConditions] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState(() => {
    try {
      return localStorage.getItem('sanjeevani_qr_base_url') || '';
    } catch (_) {
      return '';
    }
  });
  const [directTextMode, setDirectTextMode] = useState(() => {
    try {
      return localStorage.getItem('sanjeevani_qr_text_mode') === 'true';
    } catch (_) {
      return false;
    }
  });

  const handleCustomBaseUrlChange = value => {
    setCustomBaseUrl(value);
    try {
      if (value.trim()) {
        localStorage.setItem('sanjeevani_qr_base_url', value.trim());
      } else {
        localStorage.removeItem('sanjeevani_qr_base_url');
      }
    } catch (_) {}
  };

  const handleDirectTextModeToggle = checked => {
    setDirectTextMode(checked);
    try {
      localStorage.setItem('sanjeevani_qr_text_mode', checked ? 'true' : 'false');
    } catch (_) {}
  };

  useEffect(() => {
    api.emergency.load()
      .then(data => {
        if (data.profile) {
          setForm({ ...defaults, ...data.profile, emergencyContact: { ...defaults.emergencyContact, ...data.profile.emergencyContact }, share: { ...defaults.share, ...data.profile.share } });
          setAllergies(listText(data.profile.allergies));
          setMedicines(listText(data.profile.importantMedicines));
          setConditions(listText(data.profile.criticalConditions));
        }
        setToken(data.token || '');
        setAvailableMedicines(data.medicines || []);
        try { localStorage.setItem('sanjeevani_emergency_profile', JSON.stringify({ form: data.profile, token: data.token, medicines: data.medicines })); } catch (_) {}
      })
      .catch((err) => {
        console.warn("EmergencyProfile load error:", err);
        const cached = localStorage.getItem('sanjeevani_emergency_profile');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.form) {
              setForm({ ...defaults, ...parsed.form });
              setAllergies(listText(parsed.form.allergies));
              setMedicines(listText(parsed.form.importantMedicines));
              setConditions(listText(parsed.form.criticalConditions));
            }
            if (parsed.token) setToken(parsed.token);
            if (parsed.medicines) setAvailableMedicines(parsed.medicines);
            setMessage("Viewing saved offline Emergency Profile.");
            return;
          } catch (_) {}
        }
        setToken('demo-emergency-token');
        setMessage("Operating in offline demo mode. Sign in to synchronize your Emergency QR.");
      })
      .finally(() => setLoading(false));
  }, []);
  const update = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const selectedMedicines = listValue(medicines);
  const toggleMedicine = name => setMedicines(listText(selectedMedicines.includes(name) ? selectedMedicines.filter(item => item !== name) : [...selectedMedicines, name]));
  const save = async event => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const payload = { ...form, enabled: true, allergies: listValue(allergies), importantMedicines: selectedMedicines, criticalConditions: listValue(conditions) };
    try {
      const data = await api.emergency.save(payload);
      setForm(payload);
      setToken(data.token);
      try { localStorage.setItem('sanjeevani_emergency_profile', JSON.stringify({ form: payload, token: data.token, medicines: availableMedicines })); } catch (_) {}
      setMessage('Emergency Profile saved. Your QR is active.');
    } catch (error) {
      setForm(payload);
      const offlineToken = token || 'demo-emergency-token';
      setToken(offlineToken);
      try { localStorage.setItem('sanjeevani_emergency_profile', JSON.stringify({ form: payload, token: offlineToken, medicines: availableMedicines })); } catch (_) {}
      const status = error.response?.status;
      setMessage(status === 401 ? 'Saved locally. Sign in to sync with cloud.' : 'Saved to local offline storage.');
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    if (!window.confirm('Disable Emergency QR?\n\nAnyone scanning your existing QR will no longer be able to view your emergency profile.')) return;
    setBusy(true);
    try {
      await api.emergency.disable();
      update('enabled', false);
      setMessage('Emergency QR disabled.');
    } catch (_) {
      update('enabled', false);
      setMessage('Emergency QR disabled locally.');
    } finally {
      setBusy(false);
    }
  };
  const regenerate = async () => {
    if (!window.confirm('Generate a new Emergency QR?\n\nYour previous QR will stop working.')) return;
    setBusy(true);
    try {
      const data = await api.emergency.regenerate();
      setToken(data.token);
      update('enabled', true);
      setMessage('A new Emergency QR is active. The previous QR no longer works.');
    } catch (_) {
      const newToken = 'local-qr-' + Date.now();
      setToken(newToken);
      update('enabled', true);
      setMessage('Generated new offline Emergency QR.');
    } finally {
      setBusy(false);
    }
  };
  const getAppBaseUrl = () => {
    if (customBaseUrl && customBaseUrl.trim()) {
      return customBaseUrl.trim().replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return window.location.origin;
    }
    const envUrl = (
      import.meta.env.VITE_APP_URL ||
      import.meta.env.VITE_PUBLIC_URL ||
      import.meta.env.VITE_CLIENT_URL ||
      ''
    ).trim().replace(/\/$/, '');
    if (envUrl) return envUrl;
    return typeof window !== 'undefined' ? window.location.origin : '';
  };

  const getDirectMedicalIdText = () => {
    const nameVal = form.displayName?.trim() || 'Not specified';
    const bloodVal = form.bloodGroup || 'Not provided';
    const allergiesList = allergies?.trim()
      ? allergies.split(/[\n,]/).map(s => s.trim()).filter(Boolean).join(', ')
      : 'None listed';
    const contactName = form.emergencyContact?.name?.trim() || '';
    const contactPhone = form.emergencyContact?.phone?.trim() || '';
    const contactVal = (contactName && contactPhone)
      ? `${contactName} - ${contactPhone}`
      : (contactPhone || contactName || 'None provided');

    return [
      'EMERGENCY MEDICAL ID',
      `Name: ${nameVal}`,
      `Blood Group: ${bloodVal}`,
      `Allergies: ${allergiesList}`,
      `ICE Contact: ${contactVal}`
    ].join('\n');
  };

  const appBaseUrl = getAppBaseUrl();
  const url = token ? `${appBaseUrl}${window.location.pathname}?emergency=${encodeURIComponent(token)}` : '';
  const qrValue = directTextMode ? getDirectMedicalIdText() : url;
  const download = () => { const canvas = document.getElementById('sanjeevani-emergency-qr'); if (!canvas) return; const link = document.createElement('a'); link.download = 'sanjeevani-emergency-qr.png'; link.href = canvas.toDataURL('image/png'); link.click(); };
  if (loading) return <section className="emergency-settings">Loading Emergency Profile…</section>;
  return <section className="emergency-settings">
    <header className="page-heading"><span className="section-kicker">SCAN → UNDERSTAND → ACT</span><h1>Sanjeevani Emergency QR</h1><p>When a patient cannot speak for themselves, Sanjeevani speaks for them.</p></header>
    <div className="emergency-settings-layout"><form className="emergency-form" onSubmit={save}>
      <div className="privacy-note">Only the information you choose will be visible to someone who scans your Emergency QR.</div>
      <label>Name (optional)<input maxLength="100" value={form.displayName} onChange={event => update('displayName', event.target.value)} /></label>
      <label>Blood Group<select value={form.bloodGroup} onChange={event => update('bloodGroup', event.target.value)}><option value="">Not provided</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Known Allergies<textarea placeholder="One per line" value={allergies} onChange={event => setAllergies(event.target.value)} /></label>
      <label>Critical Health Conditions<textarea placeholder="Only conditions you explicitly want to record" value={conditions} onChange={event => setConditions(event.target.value)} /></label>
      <label>Important Current Medicines<textarea placeholder="One per line" value={medicines} onChange={event => setMedicines(event.target.value)} /></label>
      {availableMedicines.length > 0 && <fieldset><legend>Select from My Medicines</legend><div className="emergency-check-grid">{availableMedicines.map(name => <label key={name}><input type="checkbox" checked={selectedMedicines.includes(name)} onChange={() => toggleMedicine(name)} />{name}</label>)}</div></fieldset>}
      <fieldset><legend>Emergency Contact</legend><div className="emergency-contact-grid"><label>Name<input maxLength="100" value={form.emergencyContact.name} onChange={event => update('emergencyContact', { ...form.emergencyContact, name: event.target.value })} /></label><label>Relationship (optional)<input maxLength="60" value={form.emergencyContact.relationship} onChange={event => update('emergencyContact', { ...form.emergencyContact, relationship: event.target.value })} /></label><label>Phone Number<input type="tel" maxLength="30" value={form.emergencyContact.phone} onChange={event => update('emergencyContact', { ...form.emergencyContact, phone: event.target.value })} /></label></div></fieldset>
      <fieldset><legend>Information visible when scanned</legend><div className="emergency-share-grid">{[['name','Share Name'],['bloodGroup','Share Blood Group'],['allergies','Share Allergies'],['medicines','Share Important Medicines'],['conditions','Share Critical Conditions'],['emergencyContact','Share Emergency Contact']].map(([key,label]) => <label key={key}><input type="checkbox" checked={form.share[key]} onChange={event => update('share', { ...form.share, [key]: event.target.checked })} />{label}</label>)}</div></fieldset>
      <button className="button primary" disabled={busy}><QrCode size={17} />{token ? 'Save Emergency Profile' : 'Generate Emergency QR'}</button>{message && <p className="emergency-message" role="status">{message}</p>}
    </form><aside className="qr-panel"><h2>Your Emergency QR</h2>
      <div className="qr-mode-card" style={{ display: 'grid', gap: '10px', marginBottom: '16px', padding: '12px', background: '#f5f2ec', borderRadius: '12px', border: '1px solid #d8d2c8', textAlign: 'left' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={directTextMode}
            onChange={e => handleDirectTextModeToggle(e.target.checked)}
          />
          Direct Medical ID (No Internet/Server Needed)
        </label>
        {!directTextMode && (
          <label style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
            <span style={{ fontWeight: 600, color: '#5f5b55' }}>Custom QR URL / Tunnel Base</span>
            <input
              type="text"
              placeholder="e.g. https://my-app.loca.lt or http://10.182.226.40:5173"
              value={customBaseUrl}
              onChange={e => handleCustomBaseUrlChange(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #d8d2c8', background: '#fff' }}
            />
          </label>
        )}
      </div>
      {(directTextMode || token) ? <><div className={!form.enabled && !directTextMode ? 'qr-disabled' : ''}><QRCodeCanvas id="sanjeevani-emergency-qr" value={qrValue} size={240} level="H" marginSize={3} /></div><b>{directTextMode ? 'Direct Offline Medical ID' : (form.enabled ? 'Active' : 'Disabled')}</b><p>{directTextMode ? 'The QR encodes essential medical data directly—scannable on any smartphone camera without internet.' : 'The QR contains only a secure random link—not medical information.'}</p><div className="qr-actions"><button className="button secondary" onClick={download}><Download size={16} />Download QR</button><button className="button secondary" onClick={() => window.print()}><Printer size={16} />Print</button>{!directTextMode && <><button className="button secondary" onClick={regenerate} disabled={busy}><RefreshCw size={16} />Generate New QR</button>{form.enabled && <button className="button danger-button" onClick={disable} disabled={busy}><ShieldOff size={16} />Disable Emergency QR</button>}</>}</div></> : <p>Save your profile to generate its secure QR.</p>}</aside></div>
  </section>;
}
