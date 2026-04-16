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

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', borderRadius: '10px',
  color: 'var(--text-primary)', outline: 'none', width: '100%', padding: '10px 12px', fontSize: '13px',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)',
};

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
      const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
      if (!data || data.length === 0) {
        setGeocodeError('Adres bulunamadı. Daha ayrıntılı bir adres deneyin.');
        return;
      }
      const { lat, lon } = data[0];
      setFirmaForm(p => ({ ...p, firmaLat: parseFloat(lat), firmaLng: parseFloat(lon) }));
    } catch {
      setGeocodeError('Adres arama sırasında bir hata oluştu.');
    } finally {
      setGeocodeLoading(false);
    }
  }, [firmaForm.adres]);

  const handleFirmaEkle = async () => {
    if (!firmaForm.ad.trim()) { setFirmaError('Firma adı zorunludur.'); return; }
    if (firmaForm.ziyaretDogrulama === 'qr_konum' && !firmaForm.adres.trim()) {
      setFirmaError('QR + Konum doğrulama seçildiğinde adres zorunludur.');
      setFirmaFormTab(2);
      return;
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
          name: firmaForm.ad.trim(),
          invite_code: inviteCode,
          created_by: user?.id,
          org_type: 'firma',
          parent_org_id: orgId,
          gps_required: gpsRequired,
          gps_radius: gpsRequired ? firmaForm.izinVerilenMesafe : 1000,
          gps_strict: gpsRequired ? firmaForm.gpsStrict : true,
          firma_adres: firmaForm.adres.trim() || null,
          firma_lat: gpsRequired ? firmaForm.firmaLat : null,
          firma_lng: gpsRequired ? firmaForm.firmaLng : null,
        })
        .select()
        .maybeSingle();

      if (error || !newFirma) {
        setFirmaError(error?.message ?? 'Firma oluşturulamadı.');
        return;
      }

      await supabase.from('app_data').upsert(
        {
          organization_id: newFirma.id,
          data: {
            yetkili: firmaForm.yetkili,
            telefon: firmaForm.telefon,
            email: firmaForm.eposta,
            sgkSicil: firmaForm.sgkSicil,
            adres: firmaForm.adres,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' }
      );

      const added: AltFirma = {
        id: newFirma.id,
        name: firmaForm.ad.trim(),
        invite_code: inviteCode,
        created_at: new Date().toISOString(),
        personelSayisi: 0,
        uzmanAd: null,
        uygunsuzluk: 0,
      };
      onSuccess(added);
      addToast(`${firmaForm.ad.trim()} başarıyla eklendi!`, 'success');
      handleClose();
    } catch (err) {
      setFirmaError(String(err));
    } finally {
      setFirmaLoading(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)', zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl animate-modal-in overflow-hidden flex flex-col"
        style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
              <i className="ri-building-2-line text-base" style={{ color: '#0EA5E9' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Müşteri Firma Ekle</h3>
              <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>OSGB&apos;nize bağlı yeni müşteri firma</p>
            </div>
          </div>
          <button onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
            style={{ background: 'var(--bg-item)', color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}>
            <i className="ri-close-line text-sm" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-1.5 px-6 pt-4 flex-shrink-0">
          {[
            { idx: 0, icon: 'ri-id-card-line', label: 'Kimlik & İletişim' },
            { idx: 1, icon: 'ri-file-list-3-line', label: 'Sözleşme & Durum' },
            { idx: 2, icon: 'ri-map-pin-line', label: 'Konum & Ziyaret' },
          ].map(tab => (
            <button
              key={tab.idx}
              onClick={() => setFirmaFormTab(tab.idx as FirmaFormTab)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
              style={{
                background: firmaFormTab === tab.idx
                  ? tab.idx === 2 ? 'rgba(239,68,68,0.08)' : 'rgba(14,165,233,0.1)'
                  : 'var(--bg-item)',
                border: firmaFormTab === tab.idx
                  ? tab.idx === 2 ? '1.5px solid rgba(239,68,68,0.25)' : '1.5px solid rgba(14,165,233,0.3)'
                  : '1px solid var(--border-subtle)',
                color: firmaFormTab === tab.idx
                  ? tab.idx === 2 ? '#EF4444' : '#0EA5E9'
                  : 'var(--text-muted)',
              }}>
              <i className={`${tab.icon} text-xs`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.idx + 1}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {/* Tab 0: Kimlik & İletişim */}
          {firmaFormTab === 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
                  <i className="ri-id-card-line text-xs" style={{ color: '#0EA5E9' }} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Kimlik & İletişim</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Firma adı, yetkili ve iletişim bilgileri</p>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Firma Adı <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  value={firmaForm.ad}
                  onChange={e => { setFirmaForm(p => ({ ...p, ad: e.target.value })); setFirmaError(null); }}
                  placeholder="Firma adı giriniz"
                  style={inputStyle}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                />
              </div>
              <div>
                <label style={labelStyle}>Firma Logosu <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(PNG / JPG, isteğe bağlı)</span></label>
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="hidden"
                  onChange={e => { const f = e.target.files?.[0] ?? null; setFirmaForm(p => ({ ...p, logoFile: f })); }} />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: firmaForm.logoFile ? 'rgba(14,165,233,0.06)' : 'var(--bg-item)',
                    border: `2px dashed ${firmaForm.logoFile ? 'rgba(14,165,233,0.35)' : 'var(--border-subtle)'}`,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.45)'; (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.05)'; }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = firmaForm.logoFile ? 'rgba(14,165,233,0.35)' : 'var(--border-subtle)';
                    (e.currentTarget as HTMLElement).style.background = firmaForm.logoFile ? 'rgba(14,165,233,0.06)' : 'var(--bg-item)';
                  }}>
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{ background: firmaForm.logoFile ? 'rgba(14,165,233,0.12)' : 'var(--bg-hover)' }}>
                    <i className={`${firmaForm.logoFile ? 'ri-image-line' : 'ri-upload-cloud-2-line'} text-lg`}
                      style={{ color: firmaForm.logoFile ? '#0EA5E9' : 'var(--text-faint)' }} />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    {firmaForm.logoFile ? (
                      <>
                        <p className="text-xs font-semibold truncate" style={{ color: '#0EA5E9' }}>{firmaForm.logoFile.name}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {(firmaForm.logoFile.size / 1024).toFixed(1)} KB · Değiştirmek için tıklayın
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Logo yüklemek için tıklayın</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>PNG veya JPG, max 2MB</p>
                      </>
                    )}
                  </div>
                  {firmaForm.logoFile && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(14,165,233,0.12)', color: '#0284C7' }}>Yüklendi</span>
                  )}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Yetkili Kişi</label>
                  <input value={firmaForm.yetkili} onChange={e => setFirmaForm(p => ({ ...p, yetkili: e.target.value }))} placeholder="Yetkili kişi adı" style={inputStyle}
                    onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                    onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }} />
                </div>
                <div>
                  <label style={labelStyle}>Telefon</label>
                  <input value={firmaForm.telefon} onChange={e => setFirmaForm(p => ({ ...p, telefon: e.target.value }))} placeholder="0212 000 00 00" style={inputStyle}
                    onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                    onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }} />
                </div>
                <div>
                  <label style={labelStyle}>E-posta</label>
                  <input type="email" value={firmaForm.eposta} onChange={e => setFirmaForm(p => ({ ...p, eposta: e.target.value }))} placeholder="info@firma.com" style={inputStyle}
                    onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                    onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }} />
                </div>
                <div>
                  <label style={labelStyle}>SGK Sicil No</label>
                  <input value={firmaForm.sgkSicil} onChange={e => setFirmaForm(p => ({ ...p, sgkSicil: e.target.value }))} placeholder="SGK sicil numarası" style={inputStyle}
                    onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                    onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Adres</label>
                <textarea value={firmaForm.adres} onChange={e => setFirmaForm(p => ({ ...p, adres: e.target.value }))} placeholder="Firma adresi" rows={3}
                  style={{ ...inputStyle, resize: 'none', height: 'auto' }}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }} />
              </div>
            </div>
          )}

          {/* Tab 1: Sözleşme & Durum */}
          {firmaFormTab === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(245,158,11,0.1)' }}>
                  <i className="ri-file-list-3-line text-xs" style={{ color: '#F59E0B' }} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Sözleşme & Durum</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Tehlike sınıfı, firma durumu ve sözleşme tarihleri</p>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Tehlike Sınıfı</label>
                <div className="flex gap-2">
                  {(['Az Tehlikeli', 'Tehlikeli', 'Çok Tehlikeli'] as const).map(opt => (
                    <button key={opt} type="button" onClick={() => setFirmaForm(p => ({ ...p, tehlikeSinifi: opt }))}
                      className="flex-1 py-2.5 px-2 rounded-xl text-[10.5px] font-semibold cursor-pointer transition-all whitespace-nowrap"
                      style={{
                        background: firmaForm.tehlikeSinifi === opt ? (opt === 'Çok Tehlikeli' ? 'rgba(239,68,68,0.1)' : opt === 'Tehlikeli' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)') : 'var(--bg-item)',
                        border: firmaForm.tehlikeSinifi === opt ? (opt === 'Çok Tehlikeli' ? '1.5px solid rgba(239,68,68,0.3)' : opt === 'Tehlikeli' ? '1.5px solid rgba(245,158,11,0.3)' : '1.5px solid rgba(16,185,129,0.3)') : '1.5px solid var(--border-subtle)',
                        color: firmaForm.tehlikeSinifi === opt ? (opt === 'Çok Tehlikeli' ? '#EF4444' : opt === 'Tehlikeli' ? '#F59E0B' : '#10B981') : 'var(--text-muted)',
                      }}>{opt}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Firma Durumu</label>
                <div className="flex gap-2">
                  {(['Aktif', 'Pasif'] as const).map(opt => (
                    <button key={opt} type="button" onClick={() => setFirmaForm(p => ({ ...p, durum: opt }))}
                      className="flex-1 py-2.5 px-3 rounded-xl text-[11px] font-semibold cursor-pointer transition-all"
                      style={{
                        background: firmaForm.durum === opt ? (opt === 'Aktif' ? 'rgba(14,165,233,0.1)' : 'rgba(100,116,139,0.1)') : 'var(--bg-item)',
                        border: firmaForm.durum === opt ? (opt === 'Aktif' ? '1.5px solid rgba(14,165,233,0.3)' : '1.5px solid rgba(100,116,139,0.3)') : '1.5px solid var(--border-subtle)',
                        color: firmaForm.durum === opt ? (opt === 'Aktif' ? '#0EA5E9' : '#64748B') : 'var(--text-muted)',
                      }}>
                      {opt === 'Aktif' ? '● Aktif' : '○ Pasif'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Sözleşme Tarihleri</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-faint)' }}>Başlangıç</p>
                    <input type="date" value={firmaForm.sozlesmeBas} onChange={e => setFirmaForm(p => ({ ...p, sozlesmeBas: e.target.value }))}
                      className="text-sm px-3 py-2 rounded-xl outline-none"
                      style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)' }}
                      onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                      onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }} />
                  </div>
                  <div>
                    <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-faint)' }}>Bitiş</p>
                    <input type="date" value={firmaForm.sozlesmeBit} onChange={e => setFirmaForm(p => ({ ...p, sozlesmeBit: e.target.value }))}
                      className="text-sm px-3 py-2 rounded-xl outline-none"
                      style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)' }}
                      onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                      onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }} />
                  </div>
                </div>
              </div>
              {firmaForm.sozlesmeBas && firmaForm.sozlesmeBit && (
                <div className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)' }}>
                  <i className="ri-calendar-check-line text-sm flex-shrink-0" style={{ color: '#0EA5E9' }} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: '#0EA5E9', fontWeight: 600 }}>{new Date(firmaForm.sozlesmeBas).toLocaleDateString('tr-TR')}</span>
                    <span style={{ color: 'var(--text-faint)' }}> — </span>
                    <span style={{ color: '#0EA5E9', fontWeight: 600 }}>{new Date(firmaForm.sozlesmeBit).toLocaleDateString('tr-TR')}</span>
                    <span style={{ color: 'var(--text-muted)' }}> tarihler arası sözleşme</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Konum & Ziyaret Doğrulama */}
          {firmaFormTab === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <i className="ri-map-pin-line text-xs" style={{ color: '#EF4444' }} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Konum & Ziyaret Doğrulama</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Uzmanın firmayı ziyaret ederken doğrulama yöntemi</p>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Ziyaret Doğrulama Yöntemi</label>
                <div className="flex gap-2">
                  {([
                    { val: 'sadece_qr' as const, icon: 'ri-qr-code-line', label: 'Sadece QR', desc: 'QR kodu tarayarak giriş', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.3)' },
                    { val: 'qr_konum' as const, icon: 'ri-map-pin-2-line', label: 'QR + Konum', desc: 'QR + GPS konum doğrulama', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
                  ]).map(opt => (
                    <button key={opt.val} type="button" onClick={() => setFirmaForm(p => ({ ...p, ziyaretDogrulama: opt.val }))}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: firmaForm.ziyaretDogrulama === opt.val ? opt.bg : 'var(--bg-item)',
                        border: `1.5px solid ${firmaForm.ziyaretDogrulama === opt.val ? opt.border : 'var(--border-subtle)'}`,
                        color: firmaForm.ziyaretDogrulama === opt.val ? opt.color : 'var(--text-muted)',
                      }}>
                      <i className={`${opt.icon} text-base`} />
                      <span className="text-xs font-bold">{opt.label}</span>
                      <span className="text-[9px] text-center leading-tight" style={{ color: 'var(--text-faint)' }}>{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {firmaForm.ziyaretDogrulama === 'qr_konum' && (
                <>
                  <div>
                    <label style={labelStyle}>
                      Firma Adresi <span style={{ color: '#EF4444' }}>*</span>
                      <span className="ml-1 text-[10px] font-normal" style={{ color: 'var(--text-faint)' }}>(Konum doğrulama için zorunlu)</span>
                    </label>
                    <div className="flex gap-2">
                      <textarea
                        value={firmaForm.adres}
                        onChange={e => { setFirmaForm(p => ({ ...p, adres: e.target.value })); setGeocodeError(null); }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleGeocode(); } }}
                        placeholder="Tam adres girin, sonra 'Ara' butonuna tıklayın"
                        rows={2}
                        className="flex-1"
                        style={{ ...inputStyle, resize: 'none', height: 'auto', borderColor: !firmaForm.adres.trim() ? 'rgba(239,68,68,0.4)' : 'var(--border-input)' }}
                        onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.6)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(239,68,68,0.08)'; }}
                        onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = !firmaForm.adres.trim() ? 'rgba(239,68,68,0.4)' : 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                      />
                      <button type="button" onClick={() => void handleGeocode()} disabled={geocodeLoading || !firmaForm.adres.trim()}
                        className="flex-shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap self-stretch"
                        style={{
                          background: firmaForm.adres.trim() ? 'rgba(239,68,68,0.1)' : 'var(--bg-item)',
                          border: `1.5px solid ${firmaForm.adres.trim() ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`,
                          color: firmaForm.adres.trim() ? '#EF4444' : 'var(--text-faint)',
                          opacity: geocodeLoading ? 0.7 : 1,
                        }}>
                        {geocodeLoading ? <i className="ri-loader-4-line animate-spin text-sm" /> : <i className="ri-search-line text-sm" />}
                        Ara
                      </button>
                    </div>
                    {geocodeError && (
                      <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1.5 rounded-lg"
                        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <i className="ri-error-warning-line text-xs flex-shrink-0" style={{ color: '#EF4444' }} />
                        <p className="text-[10px]" style={{ color: '#EF4444' }}>{geocodeError}</p>
                      </div>
                    )}
                    {firmaForm.firmaLat !== null && !geocodeError && (
                      <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1.5 rounded-lg"
                        style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <i className="ri-map-pin-2-fill text-xs flex-shrink-0" style={{ color: '#22C55E' }} />
                        <p className="text-[10px]" style={{ color: '#16A34A' }}>
                          Konum bulundu: {firmaForm.firmaLat.toFixed(5)}, {firmaForm.firmaLng?.toFixed(5)} — haritayı kontrol edin veya tıklayarak ayarlayın
                        </p>
                      </div>
                    )}
                    <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-faint)' }}>
                      <i className="ri-information-line mr-0.5" />
                      Adresi girin ve "Ara"ya tıklayın — harita otomatik konuma gider.
                    </p>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      İzin Verilen Mesafe
                      <span className="ml-2 font-bold" style={{ color: '#EF4444' }}>{firmaForm.izinVerilenMesafe} metre</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input type="range" min={50} max={5000} step={50} value={firmaForm.izinVerilenMesafe}
                        onChange={e => setFirmaForm(p => ({ ...p, izinVerilenMesafe: Number(e.target.value) }))}
                        className="flex-1 cursor-pointer" style={{ accentColor: '#EF4444' }} />
                      <input type="number" min={50} max={5000} step={50} value={firmaForm.izinVerilenMesafe}
                        onChange={e => setFirmaForm(p => ({ ...p, izinVerilenMesafe: Math.max(50, Math.min(5000, Number(e.target.value))) }))}
                        className="text-sm text-center rounded-lg outline-none"
                        style={{ width: '80px', padding: '6px 8px', background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)' }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      {[50, 250, 500, 1000, 2000, 5000].map(v => (
                        <button key={v} type="button" onClick={() => setFirmaForm(p => ({ ...p, izinVerilenMesafe: v }))}
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded cursor-pointer transition-all"
                          style={{
                            background: firmaForm.izinVerilenMesafe === v ? 'rgba(239,68,68,0.1)' : 'var(--bg-item)',
                            color: firmaForm.izinVerilenMesafe === v ? '#EF4444' : 'var(--text-faint)',
                            border: `1px solid ${firmaForm.izinVerilenMesafe === v ? 'rgba(239,68,68,0.25)' : 'transparent'}`,
                          }}>{v}m</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>GPS Alınamazsa</label>
                    <div className="flex gap-2">
                      {([
                        { val: true, icon: 'ri-shield-keyhole-line', label: 'Engelle', desc: 'Check-in yapılamaz', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
                        { val: false, icon: 'ri-error-warning-line', label: 'Uyar, İzin Ver', desc: 'Uyarı göster, devam et', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' },
                      ] as Array<{ val: boolean; icon: string; label: string; desc: string; color: string; bg: string; border: string }>).map(opt => (
                        <button key={String(opt.val)} type="button" onClick={() => setFirmaForm(p => ({ ...p, gpsStrict: opt.val }))}
                          className="flex-1 flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl cursor-pointer transition-all"
                          style={{
                            background: firmaForm.gpsStrict === opt.val ? opt.bg : 'var(--bg-item)',
                            border: `1.5px solid ${firmaForm.gpsStrict === opt.val ? opt.border : 'var(--border-subtle)'}`,
                            color: firmaForm.gpsStrict === opt.val ? opt.color : 'var(--text-muted)',
                          }}>
                          <i className={`${opt.icon} text-base`} />
                          <span className="text-xs font-bold">{opt.label}</span>
                          <span className="text-[9px] text-center leading-tight" style={{ color: 'var(--text-faint)' }}>{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] mt-2" style={{ color: 'var(--text-faint)' }}>
                      <i className="ri-information-line mr-0.5" />
                      {firmaForm.gpsStrict ? 'Konum izni verilmezse uzman check-in yapamaz.' : 'Konum alınamazsa uyarı gösterilir, check-in yine de yapılır.'}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Haritadan Konum Seç</label>
                      {firmaForm.firmaLat !== null && firmaForm.firmaLng !== null && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }}>
                          <i className="ri-map-pin-fill mr-1" />
                          {firmaForm.firmaLat.toFixed(5)}, {firmaForm.firmaLng.toFixed(5)}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] mb-2" style={{ color: 'var(--text-faint)' }}>
                      <i className="ri-cursor-line mr-1" />Haritaya tıklayarak veya marker&apos;ı sürükleyerek konum belirleyin.
                    </p>
                    <Suspense fallback={
                      <div className="w-full h-[260px] rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--bg-item)', border: '1.5px solid rgba(239,68,68,0.2)' }}>
                        <div className="flex flex-col items-center gap-2">
                          <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#EF4444' }} />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Harita yükleniyor...</span>
                        </div>
                      </div>
                    }>
                      <FirmaKonumSecici
                        lat={firmaForm.firmaLat}
                        lng={firmaForm.firmaLng}
                        radius={firmaForm.izinVerilenMesafe}
                        onSelect={(lat, lng) => setFirmaForm(p => ({ ...p, firmaLat: lat, firmaLng: lng }))}
                      />
                    </Suspense>
                    {firmaForm.firmaLat === null && (
                      <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg"
                        style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <i className="ri-information-line text-xs flex-shrink-0" style={{ color: '#F59E0B' }} />
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Konum seçilmedi — haritaya tıklayarak seçin (isteğe bağlı)</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {firmaForm.ziyaretDogrulama === 'sadece_qr' && (
                <div className="flex items-start gap-3 p-4 rounded-xl"
                  style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)' }}>
                  <i className="ri-information-line text-sm flex-shrink-0" style={{ color: '#0EA5E9' }} />
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Sadece QR Doğrulama</p>
                    <p className="text-[10.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      Gezici uzman, firmadaki QR kodu tarayarak giriş yapacak. GPS konum doğrulaması uygulanmaz.
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
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-sm flex-shrink-0" style={{ color: '#ef4444' }} />
            <p className="text-xs" style={{ color: '#dc2626' }}>{firmaError}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex gap-2">
            <button onClick={() => setFirmaFormTab(t => Math.max(0, t - 1) as FirmaFormTab)} disabled={firmaFormTab === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
              style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', opacity: firmaFormTab === 0 ? 0.35 : 1 }}>
              <i className="ri-arrow-left-line" /> Geri
            </button>
            {firmaFormTab < 2 && (
              <button onClick={() => setFirmaFormTab(t => Math.min(2, t + 1) as FirmaFormTab)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#0EA5E9' }}>
                İleri <i className="ri-arrow-right-line" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleClose}
              className="whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
              style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; }}>
              İptal
            </button>
            <button onClick={handleFirmaEkle} disabled={firmaLoading || !firmaForm.ad.trim()}
              className="whitespace-nowrap flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white cursor-pointer transition-all"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', opacity: (firmaLoading || !firmaForm.ad.trim()) ? 0.65 : 1 }}
              onMouseEnter={e => { if (!firmaLoading && firmaForm.ad.trim()) { (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}>
              {firmaLoading ? <><i className="ri-loader-4-line animate-spin" />Ekleniyor...</> : <><i className="ri-add-line" />Firma Ekle</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
