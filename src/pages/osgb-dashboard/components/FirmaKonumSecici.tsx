import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Props {
  lat: number | null;
  lng: number | null;
  radius: number;
  onSelect: (lat: number, lng: number) => void;
}

export default function FirmaKonumSecici({ lat, lng, radius, onSelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const defaultLat = lat ?? 39.9334;
    const defaultLng = lng ?? 32.8597;

    const map = L.map(mapRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    if (lat !== null && lng !== null) {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onSelect(pos.lat, pos.lng);
      });
      markerRef.current = marker;

      const circle = L.circle([lat, lng], { radius, color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.08, weight: 2 }).addTo(map);
      circleRef.current = circle;
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;

      if (markerRef.current) {
        markerRef.current.setLatLng([clickLat, clickLng]);
      } else {
        const marker = L.marker([clickLat, clickLng], { draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onSelect(pos.lat, pos.lng);
        });
        markerRef.current = marker;
      }

      if (circleRef.current) {
        circleRef.current.setLatLng([clickLat, clickLng]);
      } else {
        const circle = L.circle([clickLat, clickLng], { radius, color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.08, weight: 2 }).addTo(map);
        circleRef.current = circle;
      }

      onSelect(clickLat, clickLng);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Radius değişince circle'ı güncelle
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius);
    }
  }, [radius]);

  // Dışarıdan lat/lng değişirse (ilk yüklemede null'dan değere geçiş)
  useEffect(() => {
    if (!mapInstanceRef.current || lat === null || lng === null) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
    }
    mapInstanceRef.current.panTo([lat, lng]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-xl overflow-hidden"
      style={{ height: '260px', border: '1.5px solid rgba(239,68,68,0.3)' }}
    />
  );
}
