import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';

interface AktifZiyaret {
  uzman_ad: string | null;
  uzman_user_id: string;
  gps_status: string | null;
}

interface FirmaPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  gps_radius: number;
  gps_required: boolean;
  aktifZiyaretler: AktifZiyaret[];
  ihlalVar: boolean;
}

interface FirmalarHaritasiProps {
  isDark: boolean;
  onFirmaClick?: (firmaId: string, firmaAd: string) => void;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

export default function FirmalarHaritasi({ isDark, onFirmaClick }: FirmalarHaritasiProps) {
  const { org } = useApp();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const [firmalar, setFirmalar] = useState<FirmaPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [selectedFirma, setSelectedFirma] = useState<FirmaPin | null>(null);
  const [stats, setStats] = useState({ toplamFirma: 0, konumluFirma: 0, aktifZiyaret: 0, ihlalVar: 0 });
  const [error, setError] = useState<string | null>(null);

  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';

  const fetchFirmalar = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: orgData, error: orgErr }, { data: ziyaretData }] = await Promise.all([
        supabase
          .from('organizations')
          .select('id, name, firma_lat, firma_lng, gps_radius, gps_required')
          .eq('parent_org_id', org.id)
          .eq('org_type', 'firma')
          .is('deleted_at', null),
        supabase
          .from('osgb_ziyaretler')
          .select('firma_org_id, durum, gps_status, uzman_ad, uzman_user_id')
          .eq('osgb_org_id', org.id)
          .eq('durum', 'aktif'),
      ]);

      if (orgErr) { setError(orgErr.message); return; }

      const ziyaretByFirma = new Map<string, AktifZiyaret[]>();
      const ihlalFirmaIds = new Set<string>();
      (ziyaretData ?? []).forEach(z => {
        if (!ziyaretByFirma.has(z.firma_org_id)) ziyaretByFirma.set(z.firma_org_id, []);
        ziyaretByFirma.get(z.firma_org_id)!.push({ uzman_ad: z.uzman_ad, uzman_user_id: z.uzman_user_id, gps_status: z.gps_status });
        if (z.gps_status === 'too_far' || z.gps_status === 'no_permission') ihlalFirmaIds.add(z.firma_org_id);
      });

      const pins: FirmaPin[] = (orgData ?? [])
        .filter(f => f.firma_lat != null && f.firma_lng != null)
        .map(f => ({
          id: f.id,
          name: f.name,
          lat: f.firma_lat as number,
          lng: f.firma_lng as number,
          gps_radius: f.gps_radius ?? 1000,
          gps_required: f.gps_required ?? false,
          aktifZiyaretler: ziyaretByFirma.get(f.id) ?? [],
          ihlalVar: ihlalFirmaIds.has(f.id),
        }));

      setFirmalar(pins);
      setStats({
        toplamFirma: (orgData ?? []).length,
        konumluFirma: pins.length,
        aktifZiyaret: [...ziyaretByFirma.values()].reduce((s, a) => s + a.length, 0),
        ihlalVar: ihlalFirmaIds.size,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [org?.id]);

  useEffect(() => { void fetchFirmalar(); }, [fetchFirmalar]);

  // Harita init — sadece veri gelince ve firmalar varsa
  useEffect(() => {
    if (loading || firmalar.length === 0 || !mapRef.current || mapInstanceRef.current) return;

    // Dinamik import — leaflet'in CSS'i index.html'den CDN ile yüklü
    const initMap = async () => {
      try {
        const L = (await import('leaflet')).default;

        // Leaflet ikon fix
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });

        const map = L.map(mapRef.current!, {
          center: [39.9334, 32.8597],
          zoom: 6,
          zoomControl: true,
        });

        L.tileLayer(
          isDark
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { attribution: '© OpenStreetMap', maxZoom: 19 }
        ).addTo(map);

        const bounds: [number, number][] = [];

        firmalar.forEach(f => {
          const hasAktif = f.aktifZiyaretler.length > 0;
          const pinColor = hasAktif ? '#22C55E' : f.ihlalVar ? '#EF4444' : f.gps_required ? '#0EA5E9' : '#64748B';

          // Uzman avatar HTML
          const avatarHtml = hasAktif
            ? f.aktifZiyaretler.slice(0, 2).map((z, i) => `
                <div style="position:absolute;top:-${26+i*4}px;left:${-6+i*14}px;width:24px;height:24px;border-radius:50%;
                  background:linear-gradient(135deg,#0EA5E9,#0284C7);border:2px solid white;display:flex;
                  align-items:center;justify-content:center;font-size:7px;font-weight:800;color:white;
                  font-family:system-ui;box-shadow:0 2px 6px rgba(0,0,0,0.3);z-index:${10-i};
                  animation:upBob 2s ease-in-out infinite;animation-delay:${i*0.4}s;">
                  ${getInitials(z.uzman_ad)}
                </div>`).join('')
            : '';

          const extraBadge = hasAktif && f.aktifZiyaretler.length > 2
            ? `<div style="position:absolute;top:-32px;right:-6px;background:#F59E0B;color:white;
                border-radius:50%;width:14px;height:14px;font-size:6px;font-weight:800;
                display:flex;align-items:center;justify-content:center;border:1.5px solid white;">
                +${f.aktifZiyaretler.length - 2}</div>`
            : '';

          const pulseRing = hasAktif
            ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                width:38px;height:38px;border-radius:50%;background:rgba(34,197,94,0.35);
                animation:pulsRing 1.8s ease-out infinite;pointer-events:none;"></div>`
            : '';

          const icon = L.divIcon({
            html: `
              <style>
                @keyframes upBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
                @keyframes pulsRing{0%{transform:translate(-50%,-50%) scale(.7);opacity:.8}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}
              </style>
              <div style="position:relative;width:32px;height:44px;">
                ${pulseRing}${avatarHtml}${extraBadge}
                <svg width="32" height="40" viewBox="0 0 32 40">
                  <path d="M16 0C7.16 0 0 7.16 0 16C0 26 16 40 16 40C16 40 32 26 32 16C32 7.16 24.84 0 16 0Z" fill="${pinColor}"/>
                  <circle cx="16" cy="16" r="9" fill="white" fill-opacity=".95"/>
                  ${hasAktif
                    ? `<circle cx="16" cy="16" r="4" fill="${pinColor}"/><circle cx="16" cy="16" r="2" fill="white"/>`
                    : `<rect x="12" y="11" width="8" height="10" rx="2" fill="${pinColor}" opacity=".9"/>
                       <rect x="13" y="9" width="6" height="4" rx="1" fill="${pinColor}" opacity=".7"/>`}
                </svg>
              </div>`,
            className: '',
            iconSize: [32, 44],
            iconAnchor: [16, 44],
            popupAnchor: [0, -46],
          });

          const marker = L.marker([f.lat, f.lng], { icon, zIndexOffset: hasAktif ? 1000 : 0 }).addTo(map);

          if (f.gps_required) {
            L.circle([f.lat, f.lng], {
              radius: f.gps_radius,
              color: pinColor,
              fillColor: pinColor,
              fillOpacity: 0.05,
              weight: 1.5,
              dashArray: '5 5',
            }).addTo(map);
          }

          const uzmanHtml = hasAktif
            ? f.aktifZiyaretler.map(z => `
                <div style="display:flex;align-items:center;gap:5px;margin-top:4px;">
                  <div style="width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg,#0EA5E9,#0284C7);
                    display:flex;align-items:center;justify-content:center;font-size:6px;font-weight:800;color:white;">
                    ${getInitials(z.uzman_ad)}</div>
                  <span style="font-size:10px;font-weight:600;color:#0f172a;">${z.uzman_ad ?? 'Uzman'}</span>
                  <span style="font-size:9px;font-weight:700;color:#16A34A;">● Aktif</span>
                </div>`).join('')
            : '';

          marker.bindPopup(`
            <div style="font-family:system-ui,sans-serif;min-width:170px;padding:2px;">
              <p style="font-size:13px;font-weight:700;margin:0 0 4px;color:#0f172a;">${f.name}</p>
              <div style="display:flex;gap:3px;flex-wrap:wrap;">
                ${hasAktif ? `<span style="font-size:9px;font-weight:700;color:#16A34A;background:rgba(34,197,94,.1);border-radius:20px;padding:2px 7px;">${f.aktifZiyaretler.length} aktif ziyaret</span>` : ''}
                ${f.ihlalVar ? `<span style="font-size:9px;font-weight:700;color:#DC2626;background:rgba(239,68,68,.1);border-radius:20px;padding:2px 7px;">⚠ GPS ihlali</span>` : ''}
                ${f.gps_required ? `<span style="font-size:9px;color:#0EA5E9;background:rgba(14,165,233,.08);border-radius:20px;padding:2px 7px;">
                  GPS ${f.gps_radius >= 1000 ? `${(f.gps_radius/1000).toFixed(1)}km` : `${f.gps_radius}m`}</span>` : ''}
              </div>
              ${uzmanHtml}
            </div>`, { closeButton: false, maxWidth: 230 });

          marker.on('click', () => setSelectedFirma(f));

          bounds.push([f.lat, f.lng]);
        });

        if (bounds.length > 0) map.fitBounds(bounds as [number,number][], { padding: [50, 50], maxZoom: 13 });

        mapInstanceRef.current = map;
        setMapReady(true);
      } catch (e) {
        setError(`Harita yüklenemedi: ${String(e)}`);
      }
    };

    void initMap();

    return () => {
      if (mapInstanceRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapInstanceRef.current as any).remove();
        mapInstanceRef.current = null;
        setMapReady(false);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, firmalar.length]);

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Firma Haritası</h3>
          <p className="text-xs mt-0.5" style={{ color: textMuted }}>
            Tüm firmalar · Aktif ziyarette uzman avatarı gösterilir
          </p>
        </div>
        <button onClick={() => { mapInstanceRef.current && (() => { (mapInstanceRef.current as { remove: () => void }).remove(); mapInstanceRef.current = null; setMapReady(false); })(); void fetchFirmalar(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
          style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0EA5E9'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = textMuted; }}>
          <i className="ri-refresh-line text-xs" /> Yenile
        </button>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Firma', value: stats.toplamFirma, color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)', icon: 'ri-building-2-line' },
          { label: 'Haritada Görünen', value: stats.konumluFirma, color: '#6366F1', bg: 'rgba(99,102,241,0.08)', icon: 'ri-map-pin-line' },
          { label: 'Aktif Ziyaret', value: stats.aktifZiyaret, color: '#22C55E', bg: 'rgba(34,197,94,0.08)', icon: 'ri-map-pin-user-line' },
          { label: 'GPS İhlali', value: stats.ihlalVar, color: '#EF4444', bg: 'rgba(239,68,68,0.08)', icon: 'ri-error-warning-line' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: s.bg, border: `1px solid ${s.color}22` }}>
            <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${s.color}18` }}>
              <i className={`${s.icon} text-xs`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-lg font-extrabold leading-none" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[9px] mt-0.5 font-medium" style={{ color: textMuted }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Harita alanı */}
      {error ? (
        <div className="rounded-2xl flex flex-col items-center justify-center gap-3 p-8"
          style={{ height: '300px', background: 'var(--bg-card-solid)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <i className="ri-error-warning-line text-2xl" style={{ color: '#EF4444' }} />
          <p className="text-sm font-semibold" style={{ color: textPrimary }}>Harita yüklenemedi</p>
          <p className="text-xs text-center max-w-xs" style={{ color: textMuted }}>{error}</p>
          <button onClick={() => void fetchFirmalar()}
            className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', color: '#0EA5E9' }}>
            Tekrar Dene
          </button>
        </div>
      ) : loading ? (
        <div className="rounded-2xl flex items-center justify-center gap-3"
          style={{ height: '380px', background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}>
          <i className="ri-loader-4-line text-xl animate-spin" style={{ color: '#0EA5E9' }} />
          <span className="text-sm" style={{ color: textMuted }}>Firma verileri yükleniyor...</span>
        </div>
      ) : firmalar.length === 0 ? (
        <div className="rounded-2xl flex flex-col items-center justify-center gap-4"
          style={{ height: '380px', background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.15)' }}>
            <i className="ri-map-pin-line text-2xl" style={{ color: '#0EA5E9' }} />
          </div>
          <div className="text-center px-6">
            <p className="text-sm font-bold" style={{ color: textPrimary }}>Konumlu firma bulunamadı</p>
            <p className="text-xs mt-1.5 max-w-xs leading-relaxed" style={{ color: textMuted }}>
              Firma eklerken "Konum &amp; Ziyaret" sekmesinde adres girin. Adres otomatik koordinata dönüştürülür.
            </p>
            <p className="text-[10px] mt-2 font-semibold" style={{ color: '#F59E0B' }}>
              Not: {stats.toplamFirma} firmanızdan {stats.toplamFirma - stats.konumluFirma} tanesinde konum eksik.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          {/* Harita container — her zaman render'da, initMap içinde dolu */}
          <div ref={mapRef} style={{ height: '440px', width: '100%' }} />
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl"
              style={{ background: 'var(--bg-card-solid)', pointerEvents: 'none' }}>
              <i className="ri-map-2-line text-xl animate-pulse" style={{ color: '#0EA5E9' }} />
              <span className="text-sm" style={{ color: textMuted }}>Harita başlatılıyor...</span>
            </div>
          )}
        </div>
      )}

      {/* Seçili firma */}
      {selectedFirma && (
        <div className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all"
          style={{
            background: selectedFirma.aktifZiyaretler.length > 0 ? 'rgba(34,197,94,0.06)' : 'var(--bg-card-solid)',
            border: `1px solid ${selectedFirma.aktifZiyaretler.length > 0 ? 'rgba(34,197,94,0.25)' : 'var(--border-subtle)'}`,
          }}
          onClick={() => onFirmaClick?.(selectedFirma.id, selectedFirma.name)}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: selectedFirma.aktifZiyaretler.length > 0 ? 'linear-gradient(135deg,#22C55E,#16A34A)' : 'linear-gradient(135deg,#0EA5E9,#0284C7)' }}>
            {selectedFirma.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: textPrimary }}>{selectedFirma.name}</p>
            {selectedFirma.aktifZiyaretler.length > 0 ? (
              <div className="flex flex-wrap gap-x-3 mt-0.5">
                {selectedFirma.aktifZiyaretler.map((z, i) => (
                  <span key={i} className="text-[10px] font-semibold" style={{ color: '#16A34A' }}>
                    ● {z.uzman_ad ?? 'Uzman'} aktif ziyarette
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px]" style={{ color: textMuted }}>Aktif ziyaret yok</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {selectedFirma.aktifZiyaretler.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }}>
                ● {selectedFirma.aktifZiyaretler.length} Aktif
              </span>
            )}
            {selectedFirma.ihlalVar && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                ⚠ İhlal
              </span>
            )}
            <i className="ri-arrow-right-s-line text-sm" style={{ color: textMuted }} />
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5 flex-wrap">
        {[
          { color: '#22C55E', label: 'Aktif ziyaret (uzman avatarı görünür)' },
          { color: '#EF4444', label: 'GPS ihlali' },
          { color: '#0EA5E9', label: 'GPS doğrulamalı' },
          { color: '#64748B', label: 'Sadece QR' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
            <span className="text-[10px]" style={{ color: textMuted }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
