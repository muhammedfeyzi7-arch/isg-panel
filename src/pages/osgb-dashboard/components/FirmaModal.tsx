import { useState, useRef, lazy, Suspense, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';

const FirmaKonumSecici = lazy(() => import('./FirmaKonumSecici'));

interface AltFirma {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  personelSayisi: number;
  uzmanAd: string | null;
  uygunsuzluk: number;
}

interface FirmaModalProps {
  open: boolean;
  orgId: string;
  onClose: () => void;
  onSuccess: (firma: AltFirma) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type FirmaFormTab = 0 | 1 | 2;

interface FirmaForm {
  ad: string;
  yetkili: string;
  telefon: string;
  eposta: string;
  sgkSicil: string;
  adres: string;
  tehlikeSinifi: string;
  durum: string;
  sozlesmeBas: string;
  sozlesmeBit: string;
  logoFile: File | null;
  ziyaretDogrulama: 'sadece_qr' | 'qr_konum';
  izinVerilenMesafe: number;
  firmaLat: number | null;
  firmaLng: number | null;
  gpsStrict: boolean;
}

const defaultFirmaForm: FirmaForm = {
  ad: '', yetkili: '', telefon: '', eposta: '', sgkSicil: '', adres: '',
  tehlikeSinifi: 'Tehlikeli', durum: 'Aktif',
  sozlesmeBas: '', sozlesmeBit: '', logoFile: null,
  ziyaretDogrulama: 'sadece_qr',
  izinVerilenMesafe: 1000,
  firmaLat: null,
  firmaLng: null,
  gpsStrict: true,
};

const TABS = [
  { idx: 0, icon: 'ri-id-card-line', label: 'Kimlik & İletişim', color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.3)' },
  { idx: 1, icon: 'ri-file-list-3-line', label: 'Sözleşme & Durum', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  { idx: 2, icon: 'ri-map-pin-line', label: 'Konum & Ziyaret', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
];

function InputField({
  label, value, onChange, placeholder, type = 'text', required, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
        {hint && <span className="ml-1 font-normal" style={{ color: 'var(--text-faint)' }}>{hint}</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm px-3 py-2.5 rounded-xl outline-none transition-all"
        style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)', fontSize: '13px' }}
        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.09)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.boxShadow = 'none'; }}
      />
    </div>
  );
}

export default function FirmaModal({ open, orgId, onClose, onSuccess, addToast }: FirmaModalProps) {
  const { user } = useAuth();
  const [firmaForm, setFirmaForm] = useState<FirmaForm>(defaultFirmaForm);
  const [firmaFormTab, setFirmaFormTab] = useState<FirmaFormTab>(0);
  const [firmaLoading, setFirmaLoading] = useState(false);
  const [firmaError, setFirmaError] = useState<string | null>(null);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setFirmaForm(defaultFirmaForm);
    setFirmaFormTab(0);
    setFirmaError(null);
    setGeocodeError(null);
    onClose();
  };

  const handleGeocode = useCallback(async () => {
    const q = firmaForm.adres.trim();
    if (!q) return;
    setGeocodeLoading(true);
    setGeocodeError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'tr' } });
      const data = await res.json() as Array<{ lat: string; lon: string }>;
      if (!data || data.length === 0) { setGeocodeError('Adres bulunamadı.'); return; }
      setFirmaForm(p => ({ ...p, firmaLat: parseFloat(data[0].lat), firmaLng: parseFloat(data[0].lon) }));
    } catch { setGeocodeError('Adres arama hatası.'); }
    finally { setGeocodeLoading(false); }
  }, [firmaForm.adres]);

  const handleFirmaEkle = async () => {
    if (!firmaForm.ad.trim()) { setFirmaError('Firma adı zorunludur.'); return; }
    if (firmaForm.ziyaretDogrulama === 'qr_konum' && !firmaForm.adres.trim()) {
      setFirmaError('QR + Konum doğrulama seçildiğinde adres zorunludur.');
      setFirmaFormTab(2); return;
    }
    if (!orgId) return;
    setFirmaLoading(true);
    setFirmaError(null);
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const inviteCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const gpsRequired = firmaForm.ziyaretDogrulama === 'qr_konum';

      const { data: newFirma, error } = await supabase
        .from('organizations')
        .insert({
          name: firmaForm.ad.trim(), invite_code: inviteCode, created_by: user?.id,
          org_type: 'firma', parent_org_id: orgId,
          gps_required: gpsRequired, gps_radius: gpsRequired ? firmaForm.izinVerilenMesafe : 1000,
          gps_strict: gpsRequired ? firmaForm.gpsStrict : true,
          firma_adres: firmaForm.adres.trim() || null,
          firma_lat: gpsRequired ? firmaForm.firmaLat : null,
          firma_lng: gpsRequired ? firmaForm.firmaLng : null,
        }).select().maybeSingle();

      if (error || !newFirma) { setFirmaError(error?.message ?? 'Firma oluşturulamadı.'); return; }

      await supabase.from('app_data').upsert({
        organization_id: newFirma.id,
        data: { yetkili: firmaForm.yetkili, telefon: firmaForm.telefon, email: firmaForm.eposta, sgkSicil: firmaForm.sgkSicil, adres: firmaForm.adres },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id' });

      onSuccess({ id: newFirma.id, name: firmaForm.ad.trim(), invite_code: inviteCode, created_at: new Date().toISOString(), personelSayisi: 0, uzmanAd: null, uygunsuzluk: 0 });
      addToast(`${firmaForm.ad.trim()} başarıyla eklendi!`, 'success');
      handleClose();
    } catch (err) { setFirmaError(String(err)); }
    finally { setFirmaLoading(false); }
  };

  if (!open) return null;

  const activeTab = TABS[firmaFormTab];

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(18px)', zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="w-full max-w-2xl rounded-2xl flex flex-col overflow-hidden"
        style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', maxHeight: '92vh' }}>

        {/* ── MODAL HEADER ── */}
        <div className="relative overflow-hidden px-6 py-5 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.12) 0%, rgba(2,132,199,0.06) 100%)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(14,165,233,0.2)', border: '1.5px solid rgba(14,165,233,0.35)' }}>
                <i className="ri-building-2-line text-lg" style={{ color: '#0EA5E9' }} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Müşteri Firma Ekle</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>OSGB&apos;nize bağlı yeni müşteri firma oluşturun</p>
              </div>
            </div>
            <button onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all"
              style={{ background: 'var(--bg-item)', color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}>
              <i className="ri-close-line text-base" />
            </button>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 px-6 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {TABS.map(tab => (
            <button key={tab.idx} onClick={() => setFirmaFormTab(tab.idx as FirmaFormTab)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
              style={{
                background: firmaFormTab === tab.idx ? tab.bg : 'var(--bg-item)',
                border: `1.5px solid ${firmaFormTab === tab.idx ? tab.border : 'var(--border-subtle)'}`,
                color: firmaFormTab === tab.idx ? tab.color : 'var(--text-muted)',
              }}>
              <i className={`${tab.icon} text-xs`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.idx + 1}</span>
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* Tab 0: Kimlik & İletişim */}
          {firmaFormTab === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 p-3 rounded-xl mb-2"
                style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
                <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(14,165,233,0.15)' }}>
                  <i className="ri-id-card-line text-xs" style={{ color: '#0EA5E9' }} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Kimlik & İletişim</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Firma adı, yetkili ve iletişim bilgileri</p>
                </div>
              </div>

              <InputField label="Firma Adı" value={firmaForm.ad} required
                onChange={v => { setFirmaForm(p => ({ ...p, ad: v })); setFirmaError(null); }}
                placeholder="Firma adını giriniz" />

              {/* Logo Upload */}
              <div>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Firma Logosu <span className="font-normal" style={{ color: 'var(--text-faint)' }}>(isteğe bağlı)</span>
                </label>
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="hidden"
                  onChange={e => setFirmaForm(p => ({ ...p, logoFile: e.target.files?.[0] ?? null }))} />
                <button type="button" onClick={() => logoInputRef.current?.click()}
                  className="w-full flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all"
                  style={{ background: firmaForm.logoFile ? 'rgba(14,165,233,0.06)' : 'var(--bg-item)', border: `2px dashed ${firmaForm.logoFile ? 'rgba(14,165,233,0.35)' : 'var(--border-subtle)'}` }}>
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{ background: firmaForm.logoFile ? 'rgba(14,165,233,0.12)' : 'var(--bg-hover)' }}>
                    <i className={`${firmaForm.logoFile ? 'ri-image-line' : 'ri-upload-cloud-2-line'} text-lg`}
                      style={{ color: firmaForm.logoFile ? '#0EA5E9' : 'var(--text-faint)' }} />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    {firmaForm.logoFile ? (
                      <><p className="text-xs font-semibold truncate" style={{ color: '#0EA5E9' }}>{firmaForm.logoFile.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{(firmaForm.logoFile.size / 1024).toFixed(1)} KB · Değiştirmek için tıklayın</p></>
                    ) : (
                      <><p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Logo yüklemek için tıklayın</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>PNG veya JPG, max 2MB</p></>
                    )}
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputField label="Yetkili Kişi" value={firmaForm.yetkili} onChange={v => setFirmaForm(p => ({ ...p, yetkili: v }))} placeholder="Yetkili kişi adı" />
                <InputField label="Telefon" value={firmaForm.telefon} onChange={v => setFirmaForm(p => ({ ...p, telefon: v }))} placeholder="0212 000 00 00" />
                <InputField label="E-posta" type="email" value={firmaForm.eposta} onChange={v => setFirmaForm(p => ({ ...p, eposta: v }))} placeholder="info@firma.com" />
                <InputField label="SGK Sicil No" value={firmaForm.sgkSicil} onChange={v => setFirmaForm(p => ({ ...p, sgkSicil: v }))} placeholder="SGK sicil numarası" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Adres</label>
                <textarea value={firmaForm.adres} onChange={e => setFirmaForm(p => ({ ...p, adres: e.target.value }))}
                  placeholder="Firma adresi" rows={3}
                  className="w-full text-sm px-3 py-2.5 rounded-xl outline-none transition-all resize-none"
                  style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)', fontSize: '13px' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.09)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.boxShadow = 'none'; }} />
              </div>
            </div>
          )}

          {/* Tab 1: Sözleşme & Durum */}
          {firmaFormTab === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2.5 p-3 rounded-xl mb-2"
                style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(245,158,11,0.15)' }}>
                  <i className="ri-file-list-3-line text-xs" style={{ color: '#F59E0B' }} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Sözleşme & Durum</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Tehlike sınıfı, firma durumu ve sözleşme tarihleri</p>
                </div>
              </div>

              {/* Tehlike Sınıfı */}
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Tehlike Sınıfı</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { val: 'Az Tehlikeli', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
                    { val: 'Tehlikeli', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
                    { val: 'Çok Tehlikeli', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
                  ]).map(opt => (
                    <button key={opt.val} type="button" onClick={() => setFirmaForm(p => ({ ...p, tehlikeSinifi: opt.val }))}
                      className="py-3 rounded-xl text-[11px] font-bold cursor-pointer transition-all"
                      style={{
                        background: firmaForm.tehlikeSinifi === opt.val ? opt.bg : 'var(--bg-item)',
                        border: `1.5px solid ${firmaForm.tehlikeSinifi === opt.val ? opt.border : 'var(--border-subtle)'}`,
                        color: firmaForm.tehlikeSinifi === opt.val ? opt.color : 'var(--text-muted)',
                      }}>
                      {opt.val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Firma Durumu */}
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Firma Durumu</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Aktif', 'Pasif'] as const).map(opt => (
                    <button key={opt} type="button" onClick={() => setFirmaForm(p => ({ ...p, durum: opt }))}
                      className="py-3 rounded-xl text-[11px] font-bold cursor-pointer transition-all"
                      style={{
                        background: firmaForm.durum === opt ? (opt === 'Aktif' ? 'rgba(14,165,233,0.1)' : 'rgba(100,116,139,0.1)') : 'var(--bg-item)',
                        border: `1.5px solid ${firmaForm.durum === opt ? (opt === 'Aktif' ? 'rgba(14,165,233,0.3)' : 'rgba(100,116,139,0.3)') : 'var(--border-subtle)'}`,
                        color: firmaForm.durum === opt ? (opt === 'Aktif' ? '#0EA5E9' : '#94A3B8') : 'var(--text-muted)',
                      }}>
                      {opt === 'Aktif' ? '● Aktif' : '○ Pasif'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sözleşme Tarihleri */}
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Sözleşme Tarihleri</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Başlangıç', key: 'sozlesmeBas' as const },
                    { label: 'Bitiş', key: 'sozlesmeBit' as const },
                  ].map(f => (
                    <div key={f.key}>
                      <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-faint)' }}>{f.label}</p>
                      <input type="date" value={firmaForm[f.key]}
                        onChange={e => setFirmaForm(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full text-sm px-3 py-2 rounded-xl outline-none"
                        style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.09)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.boxShadow = 'none'; }} />
                    </div>
                  ))}
                </div>
                {firmaForm.sozlesmeBas && firmaForm.sozlesmeBit && (
                  <div className="flex items-center gap-2 mt-3 p-3 rounded-xl"
                    style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)' }}>
                    <i className="ri-calendar-check-line text-sm flex-shrink-0" style={{ color: '#0EA5E9' }} />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span style={{ color: '#0EA5E9', fontWeight: 600 }}>{new Date(firmaForm.sozlesmeBas).toLocaleDateString('tr-TR')}</span>
                      <span style={{ color: 'var(--text-faint)' }}> — </span>
                      <span style={{ color: '#0EA5E9', fontWeight: 600 }}>{new Date(firmaForm.sozlesmeBit).toLocaleDateString('tr-TR')}</span>
                      <span> sözleşme dönemi</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Konum & Ziyaret */}
          {firmaFormTab === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2.5 p-3 rounded-xl mb-2"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(239,68,68,0.15)' }}>
                  <i className="ri-map-pin-line text-xs" style={{ color: '#EF4444' }} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Konum & Ziyaret Doğrulama</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Uzmanın ziyaret doğrulama yöntemi</p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Doğrulama Yöntemi</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { val: 'sadece_qr' as const, icon: 'ri-qr-code-line', label: 'Sadece QR', desc: 'QR kodu tarayarak giriş', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.3)' },
                    { val: 'qr_konum' as const, icon: 'ri-map-pin-2-line', label: 'QR + Konum', desc: 'QR + GPS doğrulama', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
                  ]).map(opt => (
                    <button key={opt.val} type="button" onClick={() => setFirmaForm(p => ({ ...p, ziyaretDogrulama: opt.val }))}
                      className="flex flex-col items-center gap-1.5 py-4 px-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: firmaForm.ziyaretDogrulama === opt.val ? opt.bg : 'var(--bg-item)',
                        border: `1.5px solid ${firmaForm.ziyaretDogrulama === opt.val ? opt.border : 'var(--border-subtle)'}`,
                        color: firmaForm.ziyaretDogrulama === opt.val ? opt.color : 'var(--text-muted)',
                      }}>
                      <i className={`${opt.icon} text-xl`} />
                      <span className="text-xs font-bold">{opt.label}</span>
                      <span className="text-[10px] text-center leading-tight" style={{ color: 'var(--text-faint)' }}>{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {firmaForm.ziyaretDogrulama === 'qr_konum' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Firma Adresi <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div className="flex gap-2">
                      <textarea value={firmaForm.adres}
                        onChange={e => { setFirmaForm(p => ({ ...p, adres: e.target.value })); setGeocodeError(null); }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleGeocode(); } }}
                        placeholder="Tam adres girin" rows={2} className="flex-1 text-sm px-3 py-2 rounded-xl outline-none resize-none transition-all"
                        style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)' }} />
                      <button type="button" onClick={() => void handleGeocode()} disabled={geocodeLoading || !firmaForm.adres.trim()}
                        className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.3)', color: '#EF4444', opacity: geocodeLoading ? 0.7 : 1 }}>
                        {geocodeLoading ? <i className="ri-loader-4-line animate-spin text-sm" /> : <i className="ri-search-line text-sm" />}
                        Ara
                      </button>
                    </div>
                    {geocodeError && (
                      <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: '#EF4444' }}>
                        <i className="ri-error-warning-line" />{geocodeError}
                      </p>
                    )}
                    {firmaForm.firmaLat !== null && !geocodeError && (
                      <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: '#22C55E' }}>
                        <i className="ri-map-pin-2-fill" />Konum bulundu: {firmaForm.firmaLat.toFixed(5)}, {firmaForm.firmaLng?.toFixed(5)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                      İzin Verilen Mesafe:
                      <span className="ml-1.5 font-bold" style={{ color: '#EF4444' }}>{firmaForm.izinVerilenMesafe} m</span>
                    </label>
                    <input type="range" min={50} max={5000} step={50} value={firmaForm.izinVerilenMesafe}
                      onChange={e => setFirmaForm(p => ({ ...p, izinVerilenMesafe: Number(e.target.value) }))}
                      className="w-full cursor-pointer" style={{ accentColor: '#EF4444' }} />
                    <div className="flex justify-between mt-1">
                      {[50, 250, 500, 1000, 2000, 5000].map(v => (
                        <button key={v} type="button" onClick={() => setFirmaForm(p => ({ ...p, izinVerilenMesafe: v }))}
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded cursor-pointer transition-all"
                          style={{ background: firmaForm.izinVerilenMesafe === v ? 'rgba(239,68,68,0.1)' : 'var(--bg-item)', color: firmaForm.izinVerilenMesafe === v ? '#EF4444' : 'var(--text-faint)', border: `1px solid ${firmaForm.izinVerilenMesafe === v ? 'rgba(239,68,68,0.25)' : 'transparent'}` }}>
                          {v}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>GPS Alınamazsa</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { val: true, icon: 'ri-shield-keyhole-line', label: 'Engelle', desc: 'Check-in yapılamaz', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
                        { val: false, icon: 'ri-error-warning-line', label: 'Uyar, İzin Ver', desc: 'Uyarı göster', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' },
                      ] as Array<{ val: boolean; icon: string; label: string; desc: string; color: string; bg: string; border: string }>).map(opt => (
                        <button key={String(opt.val)} type="button" onClick={() => setFirmaForm(p => ({ ...p, gpsStrict: opt.val }))}
                          className="flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl cursor-pointer transition-all"
                          style={{
                            background: firmaForm.gpsStrict === opt.val ? opt.bg : 'var(--bg-item)',
                            border: `1.5px solid ${firmaForm.gpsStrict === opt.val ? opt.border : 'var(--border-subtle)'}`,
                            color: firmaForm.gpsStrict === opt.val ? opt.color : 'var(--text-muted)',
                          }}>
                          <i className={`${opt.icon} text-base`} />
                          <span className="text-xs font-bold">{opt.label}</span>
                          <span className="text-[9px] text-center" style={{ color: 'var(--text-faint)' }}>{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Haritadan Konum Seç</label>
                    <Suspense fallback={
                      <div className="w-full h-60 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--bg-item)', border: '1.5px solid rgba(239,68,68,0.2)' }}>
                        <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#EF4444' }} />
                      </div>
                    }>
                      <FirmaKonumSecici lat={firmaForm.firmaLat} lng={firmaForm.firmaLng} radius={firmaForm.izinVerilenMesafe}
                        onSelect={(lat, lng) => setFirmaForm(p => ({ ...p, firmaLat: lat, firmaLng: lng }))} />
                    </Suspense>
                  </div>
                </>
              )}

              {firmaForm.ziyaretDogrulama === 'sadece_qr' && (
                <div className="flex items-start gap-3 p-4 rounded-xl"
                  style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)' }}>
                  <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#0EA5E9' }} />
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Sadece QR Doğrulama</p>
                    <p className="text-[10.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      Uzman, firmadaki QR kodu tarayarak giriş yapacak. GPS konum doğrulaması uygulanmaz.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {firmaError && (
          <div className="mx-6 mb-3 flex items-start gap-2 p-3 rounded-xl flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)' }}>
            <i className="ri-error-warning-line text-sm flex-shrink-0" style={{ color: '#EF4444' }} />
            <p className="text-xs" style={{ color: '#dc2626' }}>{firmaError}</p>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-item)' }}>
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {TABS.map(t => (
              <button key={t.idx} onClick={() => setFirmaFormTab(t.idx as FirmaFormTab)}
                className="cursor-pointer transition-all"
                style={{ width: firmaFormTab === t.idx ? '20px' : '6px', height: '6px', borderRadius: '9999px', background: firmaFormTab === t.idx ? activeTab.color : 'var(--border-main)' }} />
            ))}
            <div className="flex items-center gap-1.5 ml-2">
              {firmaFormTab > 0 && (
                <button onClick={() => setFirmaFormTab(t => Math.max(0, t - 1) as FirmaFormTab)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                  <i className="ri-arrow-left-line text-xs" /> Geri
                </button>
              )}
              {firmaFormTab < 2 && (
                <button onClick={() => setFirmaFormTab(t => Math.min(2, t + 1) as FirmaFormTab)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  style={{ background: 'rgba(14,165,233,0.08)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>
                  İleri <i className="ri-arrow-right-line text-xs" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleClose}
              className="whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
              İptal
            </button>
            <button onClick={handleFirmaEkle} disabled={firmaLoading || !firmaForm.ad.trim()}
              className="whitespace-nowrap flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white cursor-pointer transition-all"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', opacity: (firmaLoading || !firmaForm.ad.trim()) ? 0.65 : 1 }}
              onMouseEnter={e => { if (!firmaLoading && firmaForm.ad.trim()) (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = (firmaLoading || !firmaForm.ad.trim()) ? '0.65' : '1'; }}>
              {firmaLoading ? <><i className="ri-loader-4-line animate-spin" />Ekleniyor...</> : <><i className="ri-add-line" />Firma Ekle</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
