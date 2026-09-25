import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Configure default Leaflet marker assets for Vite
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Distinct Red marker for User Geolocation
const userMarkerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Distinct Blue marker for Facilities
const facilityMarkerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export function NeonMap({ facilities = [], position, onSelect, selected }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routeLayerRef = useRef(null);

  const userLat = position?.latitude || position?.lat;
  const userLng = position?.longitude || position?.lng;

  const defaultCenter = (userLat && userLng)
    ? [userLat, userLng]
    : [22.5726, 88.3639];

  // Guaranteed fallback data
  const hospitalList = (facilities && facilities.length > 0) ? facilities : [
    { id: "h1", name: "Apollo Multispeciality Hospital", type: "Hospital", lat: 22.5780, lng: 88.3650, distance: "1.2", emergency: true },
    { id: "h2", name: "Central Blood Bank", type: "Blood Bank", lat: 22.5680, lng: 88.3580, distance: "2.5", emergency: false },
    { id: "h3", name: "MedPlus 24/7 Pharmacy", type: "Pharmacy", lat: 22.5740, lng: 88.3710, distance: "0.8", emergency: true },
    { id: "h4", name: "Lifeline Emergency Clinic", type: "Clinic", lat: 22.5820, lng: 88.3590, distance: "1.7", emergency: true }
  ];

  // 1. Initialize Leaflet Map Instance Once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapContainerRef.current._leaflet_id && !mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        scrollWheelZoom: true
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);

      const resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);

      return () => {
        resizeObserver.disconnect();
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    }
  }, []);

  // 2. Sync Center & Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // User Marker
    if (userLat && userLng) {
      const userMarker = L.marker([userLat, userLng], { icon: userMarkerIcon });
      userMarker.bindPopup("<strong>Your Location</strong>");
      markersLayer.addLayer(userMarker);
      map.setView([userLat, userLng], map.getZoom());
    }

    // Facility Markers
    hospitalList.forEach((f) => {
      const lat = f.latitude || f.lat;
      const lng = f.longitude || f.lng;
      if (!lat || !lng) return;

      const marker = L.marker([lat, lng], { icon: facilityMarkerIcon });

      const popupContent = `
        <div style="padding: 3px;">
          <strong style="font-size: 13px; color: #1f1f1f;">${f.name}</strong>
          <div style="font-size: 11px; color: #817b72; margin: 2px 0;">${f.type}</div>
          ${f.distance ? `<div style="font-size: 11px; color: #2f7cc0; font-weight: bold;">📍 ${f.distance} km away</div>` : ''}
          ${f.emergency ? `<div style="font-size: 10px; color: #d84a4a; font-weight: bold; margin-top: 4px;">24/7 Emergency Available</div>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on("click", () => {
        if (onSelect) onSelect(f);
      });

      markersLayer.addLayer(marker);
    });
  }, [userLat, userLng, hospitalList, onSelect]);

  // 3. Sync Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !routeLayer) return;

    routeLayer.clearLayers();

    const selectedLat = selected?.latitude || selected?.lat;
    const selectedLng = selected?.longitude || selected?.lng;

    if (userLat && userLng && selectedLat && selectedLng) {
      const line = L.polyline(
        [[userLat, userLng], [selectedLat, selectedLng]],
        { color: "#2f7cc0", weight: 4, dashArray: "6, 8" }
      );
      routeLayer.addLayer(line);
      map.fitBounds(line.getBounds(), { padding: [50, 50] });
    }
  }, [userLat, userLng, selected]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        height: "480px",
        width: "100%",
        minHeight: "480px",
        display: "block",
        position: "relative",
        borderRadius: "15px",
        overflow: "hidden",
        border: "1px solid #d8d2c8",
        zIndex: 1
      }}
    />
  );
}

export default NeonMap;