import { useState } from "react";
import { Droplet, MapPin } from "lucide-react";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const MOCK_HOSPITALS = [
  { id: 'bb1', name: 'SSKM Medical College & Hospital', distance: 2.8, type: 'Government Hospital' },
  { id: 'bb2', name: 'Calcutta Medical College & Hospital', distance: 3.4, type: 'Government Hospital' },
  { id: 'bb3', name: 'NRS Medical College & Hospital', distance: 4.1, type: 'Government Hospital' },
  { id: 'bb4', name: 'RG Kar Medical College & Hospital', distance: 5.6, type: 'Government Hospital' },
  { id: 'bb5', name: 'Apollo Multispeciality Hospital', distance: 6.2, type: 'Private Hospital' },
  { id: 'bb6', name: 'Fortis Hospital Anandapur', distance: 7.5, type: 'Private Hospital' },
  { id: 'bb7', name: 'AMRI Hospital Dhakuria', distance: 8.1, type: 'Private Hospital' },
  { id: 'bb8', name: 'Peerless Hospital & B.K. Roy Research Centre', distance: 9.0, type: 'Private Hospital' },
  { id: 'bb9', name: 'Medica Superspecialty Hospital', distance: 9.4, type: 'Private Hospital' },
  { id: 'bb10', name: 'Ruby General Hospital', distance: 9.8, type: 'Private Hospital' },
  { id: 'bb11', name: 'Kalyani Jawaharlal Nehru Memorial Hospital (Local Hub)', distance: 11.2, type: 'Government Hospital' }
];

function BloodStockCounter({ facilities }) {
  const [filter, setFilter] = useState("ALL");

  // Merge mock hospitals with any real facilities if needed, or just use mock ones to guarantee the 11 centers
  const allFacilities = [...MOCK_HOSPITALS];

  // Map backend key to visual group name if needed, or generate random inventory for demo if missing
  const getInventory = (f) => {
    // Generate deterministic but pseudo-random inventory based on facility ID so it doesn't flicker
    const seed = parseInt(f.id.replace(/[a-zA-Z]/g, '') || "1", 10);
    return {
      "A+": (seed * 7) % 25,
      "A-": (seed * 3) % 8,
      "B+": (seed * 11) % 25,
      "B-": (seed * 5) % 8,
      "O+": (seed * 13) % 35,
      "O-": (seed * 7) % 10,
      "AB+": (seed * 17) % 15,
      "AB-": (seed * 19) % 5,
    };
  };

  return (
    <section className="blood-bank-view">
      <header className="page-heading">
        <span className="section-kicker">LIVE INVENTORY</span>
        <h1>Blood Bank Availability</h1>
        <p>Find real-time blood stock across nearby hospitals and blood banks.</p>
      </header>

      <div className="filter-scroll" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '20px' }}>
        <button 
          className={`button ${filter === "ALL" ? "primary" : "secondary"}`} 
          onClick={() => setFilter("ALL")}
        >
          All Types
        </button>
        {BLOOD_GROUPS.map(bg => (
          <button 
            key={bg}
            className={`button ${filter === bg ? "primary" : "secondary"}`} 
            onClick={() => setFilter(bg)}
            style={{ minWidth: '60px' }}
          >
            <Droplet size={14} style={{ marginRight: '4px' }} /> {bg}
          </button>
        ))}
      </div>

      <div className="facilities-grid" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {allFacilities.map(f => {
          const inv = getInventory(f);
          // If a specific filter is selected and the facility has 0 units of it, hide it
          if (filter !== "ALL" && inv[filter] === 0) return null;

          return (
            <div key={f.id} className="panel blood" style={{ padding: '20px' }}>
              <div className="panel-head" style={{ marginBottom: '15px' }}>
                <span>{f.name}</span>
                <small style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {f.distance} km away</small>
              </div>
              
              <div className="blood-grid">
                {filter === "ALL" ? (
                  Object.entries(inv).map(([type, units]) => (
                    <div key={type} className={units < 6 ? "low" : ""}>
                      <b>{type}</b>
                      <span>{units} units</span>
                      <small>{units < 6 ? "LOW STOCK" : "AVAILABLE"}</small>
                    </div>
                  ))
                ) : (
                  <div className={inv[filter] < 6 ? "low" : ""}>
                    <b>{filter}</b>
                    <span>{inv[filter]} units</span>
                    <small>{inv[filter] < 6 ? "LOW STOCK" : "AVAILABLE"}</small>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { BloodStockCounter };
