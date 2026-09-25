import { useEffect, useState } from "react";
import { Siren, Phone, MessageSquare } from "lucide-react";

export function SosButton({ geo, onConfirm, disabled }) {
  const [confirm, setConfirm] = useState(false);
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (geo && !geo.error && geo.latitude) {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${geo.latitude}&lon=${geo.longitude}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.display_name) setAddress(data.display_name);
        })
        .catch(e => console.error("Nominatim error", e));
    }
  }, [geo]);

  const mapsLink = geo ? `https://maps.google.com/?q=${geo.latitude},${geo.longitude}` : "";
  const msgBody = encodeURIComponent(`URGENT EMERGENCY! I need immediate help. My location is: ${address ? address : "Unknown"}. GPS: ${mapsLink}`);

  return (
    <div className="sos-wrap">
      {confirm && <p>Confirm emergency alert? This sends your location to the dispatch system.</p>}
      <button 
        className={`sos-button ${confirm ? "confirm" : ""}`} 
        disabled={disabled} 
        onClick={() => confirm ? onConfirm() : setConfirm(true)}
      >
        <Siren size={22} />
        {confirm ? "CONFIRM SOS" : "SEND SOS"}
      </button>
      
      {confirm && (
        <button className="text-button" onClick={() => setConfirm(false)}>
          Cancel
        </button>
      )}

      {geo && !geo.error && (
        <div className="direct-dispatch" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p>Direct Contact Actions:</p>
          <a href="tel:112" className="button alert" style={{background: '#b91c1c', color: 'white', textDecoration: 'none'}}><Phone size={16}/> Call 112 (Police)</a>
          <a href="tel:108" className="button alert" style={{background: '#b91c1c', color: 'white', textDecoration: 'none'}}><Phone size={16}/> Call 108 (Ambulance)</a>
          <a href={`sms:?body=${msgBody}`} className="button secondary" style={{textDecoration: 'none'}}><MessageSquare size={16}/> SMS Contacts</a>
          <a href={`whatsapp://send?text=${msgBody}`} className="button secondary" style={{textDecoration: 'none'}}><MessageSquare size={16}/> WhatsApp Contacts</a>
          {address && <small style={{marginTop: '10px', fontSize: '12px', opacity: 0.8}}>Location: {address}</small>}
        </div>
      )}
    </div>
  );
}
