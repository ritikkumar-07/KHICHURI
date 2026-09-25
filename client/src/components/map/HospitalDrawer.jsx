import React from 'react';
import { X, Navigation, Phone, MapPin, Bed, Activity } from 'lucide-react';

export function HospitalDrawer({ facility, onClose, userPosition, position }) {
  if (!facility) return null;

  const actualPosition = userPosition || position;

  const handleRouteClick = () => {
    const destLat = facility?.latitude || facility?.lat;
    const destLng = facility?.longitude || facility?.lng;

    if (!destLat || !destLng) return;

    let url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;

    if (actualPosition?.latitude && actualPosition?.longitude) {
      url = `https://www.google.com/maps/dir/${actualPosition.latitude},${actualPosition.longitude}/${destLat},${destLng}`;
    }

    window.open(url, "_blank");
  };

  return (
    <div className="hospital-drawer" style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'white',
      padding: '20px',
      borderTopLeftRadius: '20px',
      borderTopRightRadius: '20px',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '15px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1f1f1f' }}>{facility?.name || 'Unknown Facility'}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#817b72' }}>
          <X size={24} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', color: '#817b72', fontSize: '0.9rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f5f4f0', padding: '4px 8px', borderRadius: '4px' }}>
          <Activity size={14} />
          {facility?.type || 'Clinic'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f5f4f0', padding: '4px 8px', borderRadius: '4px' }}>
          <Navigation size={14} />
          {facility?.distance ? `${facility?.distance} km` : 'Unknown distance'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1f1f1f' }}>
          <Bed size={18} color="#2f7cc0" />
          <span>ICU Beds: {facility?.icuBeds || 0}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: facility?.emergency ? '#d84a4a' : '#817b72' }}>
          <Activity size={18} color={facility?.emergency ? '#d84a4a' : '#817b72'} />
          <span>{facility?.emergency ? 'Emergency Available' : 'No Emergency'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#555', marginTop: '5px' }}>
        <MapPin size={18} style={{ marginTop: '2px', flexShrink: 0 }} />
        <span>{facility?.address || 'Address not available'}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555' }}>
        <Phone size={18} />
        <span>{facility?.phone || 'Phone not available'}</span>
      </div>

      <button onClick={handleRouteClick} style={{
        marginTop: '10px',
        padding: '12px',
        background: '#2f7cc0',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px'
      }}>
        <Navigation size={18} />
        Get Directions
      </button>
    </div>
  );
}