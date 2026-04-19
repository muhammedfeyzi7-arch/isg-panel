/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback } from 'react';
import Drawer from '@/components/base/Drawer';
import Button from '@/components/base/Button';
import { useApp } from '@/store/AppContext';
import type { VerificationType } from '@/types/database';
import { TR_DISTRICTS } from '@/mocks/districts';

interface AddFirmDrawerProps {
  open: boolean;
  onClose: () => void;
}

const steps = ['Genel Bilgi', 'Sözleşme', 'Konum & Doğrulama'];

const TR_CITIES = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin',
  'Aydın','Balıkesir','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa',
  'Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Edirne','Elazığ','Erzincan',
  'Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Isparta',
  'Mersin','İstanbul','İzmir','Kars','Kastamonu','Kayseri','Kırklareli','Kırşehir',
  'Kocaeli','Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin','Muğla',
  'Muş','Nevşehir','Niğde','Ordu','Rize','Sakarya','Samsun','Siirt',
  'Sinop','Sivas','Tekirdağ','Tokat','Trabzon','Tunceli','Şanlıurfa','Uşak',
  'Van','Yozgat','Zonguldak','Aksaray','Bayburt','Karaman','Kırıkkale','Batman',
  'Şırnak','Bartın','Ardahan','Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce',
];

const emptyForm = {
  name: '', contact: '', phone: '', email: '', sector: '', employeeCount: '',
  dangerClass: '', contractStart: '', contractEnd: '', contractType: '',
  address: '', city: '', district: '',
  latitude: '', longitude: '',
  verificationType: 'qr' as VerificationType,
};

type FormErrors = Partial<Record<keyof typeof emptyForm, string>>;

declare global {
  interface Window { L: any; }
}

export default function AddFirmDrawer({ open, onClose }: AddFirmDrawerProps) {
  const { addFirm, showToast } = useApp();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const set = (field: keyof typeof emptyForm, value: string | VerificationType) => {
    setForm((p) => {
      const next = { ...p, [field]: value };
      // İl değişince ilçeyi sıfırla
      if (field === 'city') next.district = '';
      return next;
    });
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const districtOptions = form.city ? (TR_DISTRICTS[form.city] ?? []) : [];

  const placeMarker = useCallback((lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;
    const L = window.L;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapInstanceRef.current);
      markerRef.current.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        setForm((p) => ({ ...p, latitude: pos.lat.toFixed(6), longitude: pos.lng.toFixed(6) }));
      });
    }
    mapInstanceRef.current.setView([lat, lng], 15);
  }, []);

  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([39.9334, 32.8597], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      setForm((p) => ({ ...p, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
      placeMarker(lat, lng);
    });
    mapInstanceRef.current = map;
    setMapReady(true);
  }, [placeMarker]);

  const loadLeaflet = useCallback(() => {
    if (window.L) { setTimeout(initMap, 50); return; }
    if (document.getElementById('leaflet-css')) { setTimeout(initMap, 300); return; }

    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setTimeout(initMap, 50);
    document.head.appendChild(script);
  }, [initMap]);

  useEffect(() => {
    if (step !== 2 || !open) return;
    loadLeaflet();
  }, [step, open, loadLeaflet]);

  // Reset map when drawer closes
  useEffect(() => {
    if (!open) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        setMapReady(false);
      }
    }
  }, [open]);

  // Invalidate map size when it becomes visible
  useEffect(() => {
    if (mapReady && mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);
    }
  }, [mapReady]);

  const handleGeocode = async () => {
    const addressStr = [form.address, form.district, form.city, 'Türkiye'].filter(Boolean).join(', ');
    if (!form.address.trim() && !form.city) {
      showToast('Önce adres veya il girin', 'error');
      return;
    }
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressStr)}&limit=1&countrycodes=tr`,
        { headers: { 'Accept-Language': 'tr' } }
      );
      const data = await res.json();
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setForm((p) => ({ ...p, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
        placeMarker(lat, lng);
        showToast('Adres haritada gösterildi');
      } else {
        showToast('Adres bulunamadı, haritadan manuel seçin', 'error');
      }
    } catch {
      showToast('Arama başarısız, haritadan manuel seçin', 'error');
    } finally {
      setGeocoding(false);
    }
  };

  const validateStep = (): boolean => {
    const newErrors: FormErrors = {};
    if (step === 0) {
      if (!form.name.trim()) newErrors.name = 'Firma adı zorunludur';
      if (!form.dangerClass) newErrors.dangerClass = 'Tehlike sınıfı seçiniz';
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        newErrors.email = 'Geçerli bir e-posta girin';
      }
    }
    if (step === 1) {
      if (form.contractStart && form.contractEnd && form.contractEnd < form.contractStart) {
        newErrors.contractEnd = 'Bitiş tarihi başlangıçtan önce olamaz';
      }
    }
    if (step === 2 && form.verificationType === 'qr_gprs') {
      if (!form.latitude || !form.longitude) {
        newErrors.latitude = 'QR+GPRS doğrulaması için haritadan konum seçiniz';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < steps.length - 1) setStep(step + 1);
    else handleSave();
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showToast('Tarayıcınız konum desteklemiyor', 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setForm((p) => ({ ...p, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
        placeMarker(lat, lng);
        setLocating(false);
        showToast('Konumunuz haritada gösterildi');
      },
      () => {
        showToast('Konum alınamadı. İzin verdiğinizden emin olun.', 'error');
        setLocating(false);
      }
    );
  };

  const handleSave = () => {
    const today = new Date().toISOString().split('T')[0];
    const fullAddress = [form.address, form.district, form.city].filter(Boolean).join(', ') || '—';
    addFirm({
      name: form.name.trim(),
      contact: form.contact.trim() || '—',
      phone: form.phone.trim() || '—',
      email: form.email.trim() || '—',
      sector: form.sector || 'Diğer',
      employeeCount: parseInt(form.employeeCount, 10) || 0,
      dangerClass: form.dangerClass as never,
      contractStart: form.contractStart || today,
      contractEnd: form.contractEnd || '—',
      contractStatus: 'Aktif',
      address: fullAddress,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      status: 'Aktif',
      verificationType: form.verificationType,
      qrToken: null,
    });
    showToast(`"${form.name}" firmaya eklendi`);
    handleClose();
  };

  const handleClose = () => {
    setStep(0);
    setForm(emptyForm);
    setErrors({});
    onClose();
  };

  const errorStyle: React.CSSProperties = { color: 'var(--danger)', fontSize: '11px', marginTop: '4px' };

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title="Yeni Firma Ekle"
      width="w-[560px]"
      footer={
        <>
          {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Geri</Button>}
          <Button variant="primary" className="flex-1" onClick={handleNext}>
            {step < steps.length - 1 ? 'Devam Et' : 'Firmayı Kaydet'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col h-full">
        {/* Stepper */}
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: i <= step ? 'var(--text-primary)' : 'var(--surface)',
                      color: i <= step ? 'var(--card)' : 'var(--text-muted)',
                      border: `1px solid ${i <= step ? 'var(--text-primary)' : 'var(--border)'}`,
                    }}
                  >
                    {i < step ? <i className="ri-check-line text-xs" /> : i + 1}
                  </div>
                  <span className="text-xs font-medium whitespace-nowrap" style={{ color: i === step ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-px mx-3" style={{ backgroundColor: i < step ? 'var(--text-primary)' : 'var(--border)' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 0: Genel Bilgi */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="form-label">Firma Adı *</label>
                <input className="input" placeholder="Örn: Arçelik A.Ş." value={form.name} onChange={(e) => set('name', e.target.value)} style={errors.name ? { borderColor: 'var(--danger)' } : {}} />
                {errors.name && <p style={errorStyle}>{errors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Yetkili Kişi</label>
                  <input className="input" placeholder="Ad Soyad" value={form.contact} onChange={(e) => set('contact', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Telefon</label>
                  <input className="input" placeholder="0212 000 00 00" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="form-label">E-posta</label>
                <input className="input" type="email" placeholder="firma@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} style={errors.email ? { borderColor: 'var(--danger)' } : {}} />
                {errors.email && <p style={errorStyle}>{errors.email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Sektör</label>
                  <select className="input cursor-pointer" value={form.sector} onChange={(e) => set('sector', e.target.value)}>
                    <option value="">Seçin</option>
                    {['Üretim', 'İnşaat', 'Perakende', 'Telekomünikasyon', 'Holding', 'Diğer'].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Çalışan Sayısı</label>
                  <input className="input" type="number" min="0" placeholder="0" value={form.employeeCount} onChange={(e) => set('employeeCount', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="form-label">Tehlike Sınıfı *</label>
                <div className="flex gap-2">
                  {['Az Tehlikeli', 'Tehlikeli', 'Çok Tehlikeli'].map((d) => (
                    <button key={d} onClick={() => set('dangerClass', d)}
                      className="flex-1 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      style={{ border: `1px solid ${form.dangerClass === d ? 'var(--text-primary)' : errors.dangerClass ? 'var(--danger)' : 'var(--border)'}`, backgroundColor: form.dangerClass === d ? 'var(--text-primary)' : 'transparent', color: form.dangerClass === d ? 'var(--card)' : 'var(--text-secondary)' }}
                    >{d}</button>
                  ))}
                </div>
                {errors.dangerClass && <p style={errorStyle}>{errors.dangerClass}</p>}
              </div>
            </div>
          )}

          {/* Step 1: Sözleşme */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="form-label">Sözleşme Türü</label>
                <select className="input cursor-pointer" value={form.contractType} onChange={(e) => set('contractType', e.target.value)}>
                  <option value="">Seçin</option>
                  {['Yıllık', '2 Yıllık', '3 Yıllık', 'Özel Süre'].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Başlangıç Tarihi</label>
                  <input className="input" type="date" value={form.contractStart} onChange={(e) => set('contractStart', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Bitiş Tarihi</label>
                  <input className="input" type="date" value={form.contractEnd} onChange={(e) => set('contractEnd', e.target.value)} style={errors.contractEnd ? { borderColor: 'var(--danger)' } : {}} />
                  {errors.contractEnd && <p style={errorStyle}>{errors.contractEnd}</p>}
                </div>
              </div>
              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <div className="flex items-start gap-2">
                  <i className="ri-information-line text-sm mt-0.5" style={{ color: 'var(--warning)' }} />
                  <p className="text-xs" style={{ color: 'var(--warning-text)' }}>Sözleşme bitiş tarihine 30 gün kala otomatik hatırlatma gönderilecektir. Süresi dolan sözleşmeler otomatik pasife alınır.</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Konum & Doğrulama */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="form-label">Adres</label>
                <textarea className="input resize-none" rows={2} placeholder="Sokak, mahalle, bina no..." value={form.address} onChange={(e) => set('address', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">İl</label>
                  <select className="input cursor-pointer" value={form.city} onChange={(e) => set('city', e.target.value)}>
                    <option value="">Seçin</option>
                    {TR_CITIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">İlçe</label>
                  {districtOptions.length > 0 ? (
                    <select className="input cursor-pointer" value={form.district} onChange={(e) => set('district', e.target.value)}>
                      <option value="">Seçin</option>
                      {districtOptions.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  ) : (
                    <input className="input" placeholder={form.city ? 'İlçe' : 'Önce il seçin'} value={form.district} onChange={(e) => set('district', e.target.value)} disabled={!form.city} />
                  )}
                </div>
              </div>

              {/* Adres arama butonu */}
              <button
                onClick={handleGeocode}
                disabled={geocoding}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                style={{ border: '1px solid var(--text-primary)', color: 'var(--text-primary)', backgroundColor: 'transparent' }}
              >
                <i className={`ri-search-eye-line ${geocoding ? 'animate-pulse' : ''}`} />
                {geocoding ? 'Adres aranıyor...' : 'Adresi Haritada Göster'}
              </button>

              {/* Harita */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">Harita</label>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {form.latitude && form.longitude
                      ? `${parseFloat(form.latitude).toFixed(4)}, ${parseFloat(form.longitude).toFixed(4)}`
                      : 'Haritaya tıklayarak konum seçin'}
                  </span>
                </div>
                <div
                  ref={mapRef}
                  className="w-full rounded-lg overflow-hidden"
                  style={{ height: '260px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
                />
                {!mapReady && (
                  <div className="flex items-center gap-2 mt-2">
                    <i className="ri-loader-4-line animate-spin text-xs" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Harita yükleniyor...</span>
                  </div>
                )}
                {errors.latitude && <p style={errorStyle}>{errors.latitude}</p>}
              </div>

              {/* Mevcut konum butonu */}
              <button
                onClick={handleGetLocation}
                disabled={locating}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--surface)' }}
              >
                <i className={`ri-crosshair-line ${locating ? 'animate-pulse' : ''}`} />
                {locating ? 'Konum alınıyor...' : 'Mevcut Konumumu Kullan'}
              </button>

              {/* Doğrulama Tipi */}
              <div>
                <label className="form-label">Ziyaret Doğrulama Tipi</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'qr', label: 'Sadece QR', icon: 'ri-qr-code-line', desc: 'QR okutmak yeterli' },
                    { value: 'qr_gprs', label: 'QR + GPRS', icon: 'ri-map-pin-line', desc: '1 km içinde olunmalı' },
                  ] as { value: VerificationType; label: string; icon: string; desc: string }[]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => set('verificationType', opt.value)}
                      className="p-3 rounded-lg text-left transition-colors cursor-pointer"
                      style={{
                        border: `1px solid ${form.verificationType === opt.value ? 'var(--text-primary)' : 'var(--border)'}`,
                        backgroundColor: form.verificationType === opt.value ? 'var(--text-primary)' : 'transparent',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <i className={`${opt.icon} text-sm`} style={{ color: form.verificationType === opt.value ? 'var(--card)' : 'var(--text-muted)' }} />
                        <span className="text-xs font-semibold" style={{ color: form.verificationType === opt.value ? 'var(--card)' : 'var(--text-primary)' }}>{opt.label}</span>
                      </div>
                      <p className="text-xs" style={{ color: form.verificationType === opt.value ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
