/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import Drawer from '@/components/base/Drawer';
import StatusBadge from '@/components/base/StatusBadge';
import Button from '@/components/base/Button';
import FirmQRCode from './FirmQRCode';
import type { AppFirm, AppPersonnel, VerificationType } from '@/types/database';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { getFirmAssignments, assignPersonnelToFirm, removeAssignment } from '@/services/firmService';

interface FirmDrawerProps {
  open: boolean;
  onClose: () => void;
  firm: AppFirm | null;
}

declare global { interface Window { L: any } }

// ─── Leaflet harita bileşeni (düzenleme için) ─────────────────────────────────
function FirmEditMap({ lat, lng, onSelect }: { lat: number | null; lng: number | null; onSelect: (lat: number, lng: number) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const placeMarker = useCallback((mlat: number, mlng: number) => {
    if (!mapInstanceRef.current) return;
    const L = window.L;
    if (markerRef.current) {
      markerRef.current.setLatLng([mlat, mlng]);
    } else {
      markerRef.current = L.marker([mlat, mlng], { draggable: true }).addTo(mapInstanceRef.current);
      markerRef.current.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        onSelectRef.current(pos.lat, pos.lng);
      });
    }
    mapInstanceRef.current.setView([mlat, mlng], 15);
  }, []);

  const initMap = useCallback((initLat: number, initLng: number, zoom: number, hasPin: boolean) => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([initLat, initLng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
    map.on('click', (e: any) => {
      const { lat: clat, lng: clng } = e.latlng;
      onSelectRef.current(clat, clng);
      placeMarker(clat, clng);
    });
    mapInstanceRef.current = map;
    if (hasPin) placeMarker(initLat, initLng);
    setTimeout(() => map.invalidateSize(), 100);
  }, [placeMarker]);

  useEffect(() => {
    const savedLat = lat;
    const savedLng = lng;
    const hasPin = savedLat !== null && savedLng !== null;
    const initLat = hasPin ? savedLat! : 39.9334;
    const initLng = hasPin ? savedLng! : 32.8597;
    const zoom = hasPin ? 15 : 6;

    const doInit = () => initMap(initLat, initLng, zoom, hasPin);

    if (window.L) { setTimeout(doInit, 50); }
    else {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      if (!document.getElementById('leaflet-js')) {
        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => setTimeout(doInit, 50);
        document.head.appendChild(script);
      } else {
        setTimeout(doInit, 300);
      }
    }
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={mapRef} className="w-full rounded-lg overflow-hidden" style={{ height: '180px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }} />
  );
}

const verificationLabels: Record<VerificationType, { label: string; icon: string }> = {
  qr: { label: 'Sadece QR', icon: 'ri-qr-code-line' },
  qr_gprs: { label: 'QR + GPRS', icon: 'ri-map-pin-line' },
};

function isContractExpired(contractEnd: string): boolean {
  if (!contractEnd || contractEnd === '—') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(contractEnd);
  return end < today;
}

export default function FirmDrawer({ open, onClose, firm }: FirmDrawerProps) {
  const { updateFirm, deleteFirm, personnel, showToast, refreshPersonnel } = useApp();
  const { session } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<AppFirm>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'qr' | 'assignments'>('info');
  const [assignments, setAssignments] = useState<{ id: string; personnelId: string; name: string; role: string }[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState('');
  const [locating, setLocating] = useState(false);
  const [qrDownloading, setQrDownloading] = useState(false);

  const loadAssignments = useCallback(async () => {
    if (!firm) return;
    setAssignLoading(true);
    try {
      const data = await getFirmAssignments(firm.id);
      setAssignments(data.map((a: { id: string; personnel_id: string; personnel?: { full_name?: string; role?: string } }) => ({
        id: a.id,
        personnelId: a.personnel_id,
        name: a.personnel?.full_name ?? '—',
        role: a.personnel?.role ?? '—',
      })));
    } catch {
      // silent
    } finally {
      setAssignLoading(false);
    }
  }, [firm]);

  useEffect(() => {
    if (open && firm) {
      loadAssignments();
      setActiveTab('info');
      setEditing(false);
      setConfirmDelete(false);
      if (isContractExpired(firm.contractEnd) && firm.contractStatus === 'Aktif') {
        updateFirm(firm.id, { contractStatus: 'Süresi Dolmuş' }).catch(() => {});
      }
    }
  }, [open, firm?.id]);

  if (!firm) return null;

  const effectiveContractStatus = isContractExpired(firm.contractEnd) ? 'Süresi Dolmuş' : firm.contractStatus;
  const handleEdit = () => { setEditForm({ ...firm }); setEditing(true); };

  const handleSaveEdit = async () => {
    try {
      const contractEnd = editForm.contractEnd ?? firm.contractEnd;
      const contractStatus = isContractExpired(contractEnd) ? 'Süresi Dolmuş' : (editForm.contractStatus ?? firm.contractStatus);
      await updateFirm(firm.id, { ...editForm, contractStatus });
      showToast(`"${editForm.name || firm.name}" güncellendi`);
      setEditing(false);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Güncelleme başarısız', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteFirm(firm.id);
      showToast(`"${firm.name}" silindi`, 'error');
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Silme başarısız', 'error');
    }
  };

  const handleAssign = async () => {
    if (!selectedPersonnelId || !session?.organizationId) return;
    if (assignments.some((a) => a.personnelId === selectedPersonnelId)) {
      showToast('Bu personel zaten atanmış', 'error');
      return;
    }
    try {
      await assignPersonnelToFirm(session.organizationId, firm.id, selectedPersonnelId);
      showToast('Personel atandı');
      setSelectedPersonnelId('');
      await loadAssignments();
      // AppContext personnel listesini güncelle (assignedFirms sayısı değişti)
      await refreshPersonnel();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Atama başarısız', 'error');
    }
  };

  const handleRemoveAssignment = async (firmId: string, personnelId: string) => {
    try {
      await removeAssignment(firmId, personnelId);
      showToast('Atama kaldırıldı');
      await loadAssignments();
      // AppContext personnel listesini güncelle (assignedFirms sayısı değişti)
      await refreshPersonnel();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Kaldırma başarısız', 'error');
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditForm((p) => ({ ...p, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setLocating(false);
        showToast('Konum alındı');
      },
      () => { showToast('Konum alınamadı', 'error'); setLocating(false); }
    );
  };

  const handleDownloadQR = async () => {
    if (!firm.qrToken) return;
    setQrDownloading(true);
    try {
      const qrUrl = `${window.location.origin}/visit?token=${firm.qrToken}`;
      const encoded = encodeURIComponent(qrUrl);
      const imgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encoded}&format=png&margin=20`;
      const response = await fetch(imgSrc);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${firm.name.replace(/\s+/g, '_')}_QR.png`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('QR kod indirildi');
    } catch {
      showToast('İndirme başarısız', 'error');
    } finally {
      setQrDownloading(false);
    }
  };

  const set = (field: keyof AppFirm, value: string | number | null) =>
    setEditForm((p) => ({ ...p, [field]: value }));

  const availablePersonnel: AppPersonnel[] = personnel.filter(
    (p) => (p.role === 'specialist' || p.role === 'doctor') &&
      p.status === 'active' &&
      !assignments.some((a) => a.personnelId === p.id)
  );

  // Kaydedilen koordinatları kullan (mevcut konum değil)
  const mapUrl = firm.latitude && firm.longitude
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${firm.longitude - 0.01},${firm.latitude - 0.01},${firm.longitude + 0.01},${firm.latitude + 0.01}&layer=mapnik&marker=${firm.latitude},${firm.longitude}`
    : null;

  const vInfo = verificationLabels[firm.verificationType] ?? verificationLabels.qr;
  const qrUrl = firm.qrToken ? `${window.location.origin}/visit?token=${firm.qrToken}` : null;

  // ─── Düzenleme modu ───────────────────────────────────────────────────────
  if (editing) {
    return (
      <Drawer open={open} onClose={() => { setEditing(false); onClose(); }} title="Firma Düzenle" width="w-[540px]"
        footer={<><Button variant="secondary" onClick={() => setEditing(false)}>İptal</Button><Button variant="primary" className="flex-1" onClick={handleSaveEdit}>Kaydet</Button></>}
      >
        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="form-label">Firma Adı</label>
            <input className="input" value={editForm.name || ''} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Yetkili</label><input className="input" value={editForm.contact || ''} onChange={(e) => set('contact', e.target.value)} /></div>
            <div><label className="form-label">Telefon</label><input className="input" value={editForm.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
          </div>
          <div><label className="form-label">E-posta</label><input className="input" type="email" value={editForm.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Sektör</label>
              <select className="input cursor-pointer" value={editForm.sector || ''} onChange={(e) => set('sector', e.target.value)}>
                {['Üretim', 'İnşaat', 'Perakende', 'Telekomünikasyon', 'Holding', 'Diğer'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="form-label">Çalışan Sayısı</label><input className="input" type="number" value={editForm.employeeCount || 0} onChange={(e) => set('employeeCount', parseInt(e.target.value, 10))} /></div>
          </div>
          <div>
            <label className="form-label">Tehlike Sınıfı</label>
            <div className="flex gap-2">
              {['Az Tehlikeli', 'Tehlikeli', 'Çok Tehlikeli'].map((d) => (
                <button key={d} onClick={() => set('dangerClass', d)} className="flex-1 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  style={{ border: `1px solid ${editForm.dangerClass === d ? 'var(--text-primary)' : 'var(--border)'}`, backgroundColor: editForm.dangerClass === d ? 'var(--text-primary)' : 'transparent', color: editForm.dangerClass === d ? 'var(--card)' : 'var(--text-secondary)' }}
                >{d}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">Durum</label>
            <div className="flex gap-2">
              {['Aktif', 'Pasif'].map((s) => (
                <button key={s} onClick={() => set('status', s)} className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  style={{ border: `1px solid ${editForm.status === s ? 'var(--text-primary)' : 'var(--border)'}`, backgroundColor: editForm.status === s ? 'var(--text-primary)' : 'transparent', color: editForm.status === s ? 'var(--card)' : 'var(--text-secondary)' }}
                >{s}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Sözleşme Başlangıç</label>
              <input className="input" type="date" value={editForm.contractStart || ''} onChange={(e) => set('contractStart', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Sözleşme Bitiş</label>
              <input className="input" type="date" value={editForm.contractEnd || ''} onChange={(e) => set('contractEnd', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="form-label">Adres</label>
            <textarea className="input resize-none" rows={2} value={editForm.address || ''} onChange={(e) => set('address', e.target.value)} />
          </div>

          {/* Konum — Leaflet harita */}
          <div>
            <label className="form-label">Konum (Haritadan Seç)</label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              {editForm.latitude && editForm.longitude
                ? `Seçili: ${Number(editForm.latitude).toFixed(5)}, ${Number(editForm.longitude).toFixed(5)}`
                : 'Haritaya tıklayarak konum seçin veya sürükleyin'}
            </p>
            <FirmEditMap
              lat={editForm.latitude ? Number(editForm.latitude) : null}
              lng={editForm.longitude ? Number(editForm.longitude) : null}
              onSelect={(lat, lng) => setEditForm((p) => ({ ...p, latitude: lat, longitude: lng }))}
            />
            <button onClick={handleGetLocation} disabled={locating}
              className="mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg cursor-pointer whitespace-nowrap"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--surface)' }}
            >
              <i className={`ri-crosshair-line ${locating ? 'animate-pulse' : ''}`} />
              {locating ? 'Alınıyor...' : 'Mevcut Konumu Kullan'}
            </button>
          </div>

          {/* Doğrulama Tipi */}
          <div>
            <label className="form-label">Ziyaret Doğrulama Tipi</label>
            <div className="grid grid-cols-2 gap-2">
              {(['qr', 'qr_gprs'] as VerificationType[]).map((v) => (
                <button key={v} onClick={() => set('verificationType', v)} className="p-3 rounded-lg text-left cursor-pointer"
                  style={{ border: `1px solid ${editForm.verificationType === v ? 'var(--text-primary)' : 'var(--border)'}`, backgroundColor: editForm.verificationType === v ? 'var(--text-primary)' : 'transparent' }}
                >
                  <div className="flex items-center gap-2">
                    <i className={`${verificationLabels[v].icon} text-sm`} style={{ color: editForm.verificationType === v ? 'var(--card)' : 'var(--text-muted)' }} />
                    <span className="text-xs font-semibold" style={{ color: editForm.verificationType === v ? 'var(--card)' : 'var(--text-primary)' }}>{verificationLabels[v].label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Drawer>
    );
  }

  // ─── Detay modu ───────────────────────────────────────────────────────────
  return (
    <Drawer open={open} onClose={onClose} title="Firma Detayı" width="w-[540px]"
      footer={
        <>
          <button onClick={() => setConfirmDelete(true)} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer flex-shrink-0"
            style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          ><i className="ri-delete-bin-line text-sm" /></button>
          <Button variant="secondary" className="flex-1" onClick={handleEdit}>Düzenle</Button>
        </>
      }
    >
      {confirmDelete && (
        <div className="mx-6 mt-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--danger-text)' }}>Bu firmayı silmek istediğinize emin misiniz?</p>
          <p className="text-xs mb-3" style={{ color: 'var(--danger-text)', opacity: 0.8 }}>Bu işlem geri alınamaz.</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>İptal</Button>
            <button onClick={handleDelete} className="px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap" style={{ backgroundColor: 'var(--danger)', color: '#fff' }}>Evet, Sil</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-6 pt-4 pb-0">
        <div className="flex gap-1 p-1 rounded-full" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', width: 'fit-content' }}>
          {([
            ['info', 'Bilgiler', 'ri-information-line'],
            ['qr', 'QR Kod', 'ri-qr-code-line'],
            ['assignments', 'Personel', 'ri-team-line'],
          ] as [string, string, string][]).map(([key, label, icon]) => (
            <button key={key} onClick={() => setActiveTab(key as 'info' | 'qr' | 'assignments')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: activeTab === key ? 'var(--card)' : 'transparent', color: activeTab === key ? 'var(--text-primary)' : 'var(--text-muted)', border: activeTab === key ? '1px solid var(--border)' : '1px solid transparent' }}
            >
              <i className={`${icon} text-xs`} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <i className="ri-building-2-line text-xl" style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{firm.name}</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{firm.sector}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={firm.status} />
                <StatusBadge status={firm.dangerClass} />
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <i className={`${vInfo.icon} text-xs`} />{vInfo.label}
                </span>
              </div>
            </div>
          </div>

          <div>
            <p className="drawer-section-title">Genel Bilgiler</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Yetkili', value: firm.contact, icon: 'ri-user-line' },
                { label: 'Telefon', value: firm.phone, icon: 'ri-phone-line' },
                { label: 'E-posta', value: firm.email, icon: 'ri-mail-line' },
                { label: 'Çalışan', value: `${firm.employeeCount} kişi`, icon: 'ri-team-line' },
              ].map((item) => (
                <div key={item.label} className="drawer-info-grid">
                  <div className="flex items-center gap-1.5 mb-1">
                    <i className={`${item.icon} text-xs`} style={{ color: 'var(--text-muted)' }} />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  </div>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="drawer-section-title">Sözleşme</p>
            <div className="rounded-lg p-4 space-y-2.5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
              {[
                { label: 'Durum', value: effectiveContractStatus, isBadge: true },
                { label: 'Başlangıç', value: firm.contractStart },
                { label: 'Bitiş', value: firm.contractEnd },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                  {item.isBadge ? <StatusBadge status={item.value} /> : <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</span>}
                </div>
              ))}
              {isContractExpired(firm.contractEnd) && (
                <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <i className="ri-error-warning-line text-xs" style={{ color: 'var(--danger)' }} />
                  <span className="text-xs" style={{ color: 'var(--danger)' }}>Sözleşme süresi dolmuş, otomatik pasife alındı</span>
                </div>
              )}
            </div>
          </div>

          {/* Konum — kaydedilen koordinatları göster */}
          <div>
            <p className="drawer-section-title">Konum</p>
            <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{firm.address}</p>
              {firm.latitude && firm.longitude && (
                <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>{firm.latitude.toFixed(5)}, {firm.longitude.toFixed(5)}</p>
              )}
            </div>
            {mapUrl ? (
              <div className="rounded-lg overflow-hidden" style={{ height: '160px', border: '1px solid var(--border)' }}>
                <iframe src={mapUrl} width="100%" height="100%" style={{ border: 0 }} loading="lazy" title="Firma Konumu" />
              </div>
            ) : (
              <div className="h-28 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="text-center">
                  <i className="ri-map-2-line text-xl" style={{ color: 'var(--border)' }} />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Konum tanımlı değil</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Tab */}
      {activeTab === 'qr' && (
        <div className="p-6 space-y-5">
          <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-information-line text-sm" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Bu QR kod firmaya özeldir</p>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Personel bu QR kodu okutarak ziyaret kaydı oluşturur. Her firmaya benzersiz bir token atanmıştır.
            </p>
          </div>

          {qrUrl ? (
            <>
              <div className="flex flex-col items-center gap-4 py-4">
                <FirmQRCode value={qrUrl} size={180} />
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{firm.name}</p>
                  <p className="text-xs mt-1 font-mono px-3 py-1 rounded" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                    {firm.qrToken?.slice(0, 16)}...
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="drawer-section-title">QR Bağlantısı</p>
                <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{qrUrl}</p>
                  <button onClick={() => { navigator.clipboard.writeText(qrUrl); showToast('Bağlantı kopyalandı'); }}
                    className="w-7 h-7 flex items-center justify-center rounded cursor-pointer flex-shrink-0" style={{ color: 'var(--text-muted)' }} title="Kopyala">
                    <i className="ri-file-copy-line text-sm" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="primary" className="flex-1" icon={qrDownloading ? 'ri-loader-4-line' : 'ri-download-line'} onClick={handleDownloadQR}>
                  {qrDownloading ? 'İndiriliyor...' : 'QR Kodu İndir'}
                </Button>
                <button onClick={() => window.open(qrUrl, '_blank')}
                  className="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                  Test Et
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-14 h-14 flex items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <i className="ri-qr-code-line text-2xl" style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>QR Token Yok</p>
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Bu firma için QR token oluşturulmamış.</p>
            </div>
          )}
        </div>
      )}

      {/* Assignments Tab */}
      {activeTab === 'assignments' && (
        <div className="p-6 space-y-4">
          <div>
            <p className="drawer-section-title">Personel Ata</p>
            <div className="flex gap-2">
              <select className="input flex-1 cursor-pointer" value={selectedPersonnelId} onChange={(e) => setSelectedPersonnelId(e.target.value)}>
                <option value="">Personel seçin...</option>
                {availablePersonnel.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.role === 'doctor' ? 'Hekim' : 'Uzman'})</option>
                ))}
              </select>
              <Button variant="primary" size="sm" onClick={handleAssign} icon="ri-add-line">Ata</Button>
            </div>
            {availablePersonnel.length === 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Atanabilecek aktif personel yok.</p>
            )}
          </div>
          <div>
            <p className="drawer-section-title">Atanmış Personel ({assignments.length})</p>
            {assignLoading ? (
              <div className="py-6 text-center"><i className="ri-loader-4-line animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
            ) : assignments.length === 0 ? (
              <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>Henüz personel atanmamış</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                    <div className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                      <i className={`text-xs ${a.role === 'doctor' ? 'ri-stethoscope-line' : 'ri-shield-check-line'}`} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.role === 'doctor' ? 'Hekim' : 'Uzman'}</p>
                    </div>
                    <button onClick={() => handleRemoveAssignment(firm.id, a.personnelId)}
                      className="w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                      title="Atamayı Kaldır"
                    ><i className="ri-close-line text-sm" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
