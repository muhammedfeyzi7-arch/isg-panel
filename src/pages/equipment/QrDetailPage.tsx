import { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/base/Modal';
import ImageUpload from '../nonconformity/components/ImageUpload';
import type { EkipmanStatus, UygunsuzlukSeverity } from '../../types';

const STATUS_CONFIG: Record<EkipmanStatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  'Uygun':       { label: 'Uygun',       color: '#34D399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)',  icon: 'ri-checkbox-circle-line' },
  'Uygun Değil': { label: 'Uygun Değil', color: '#F87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', icon: 'ri-close-circle-line' },
  'Bakımda':     { label: 'Bakımda',     color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',  icon: 'ri-time-line' },
  'Hurda':       { label: 'Hurda',       color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', icon: 'ri-delete-bin-line' },
};

const SEV_OPTIONS: UygunsuzlukSeverity[] = ['Düşük', 'Orta', 'Yüksek', 'Kritik'];

function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ── Kontrol Yap Modal ──
function KontrolModal({
  open, onClose, ekipmanAd, firmaId, ekipmanId,
}: { open: boolean; onClose: () => void; ekipmanAd: string; firmaId: string; ekipmanId: string }) {
  const { updateEkipman, addToast, currentUser } = useApp();
  const [durum, setDurum] = useState<EkipmanStatus>('Uygun');
  const [notlar, setNotlar] = useState('');
  const [sonrakiTarih, setSonrakiTarih] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      updateEkipman(ekipmanId, {
        durum,
        sonKontrolTarihi: today,
        ...(sonrakiTarih ? { sonrakiKontrolTarihi: sonrakiTarih } : {}),
        notlar: notlar.trim() ? `[${today} - ${currentUser.ad || 'Kullanıcı'}] ${notlar.trim()}` : '',
      });
      addToast('Kontrol kaydedildi.', 'success');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Kontrol Yap" size="sm" icon="ri-checkbox-circle-line"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary whitespace-nowrap">İptal</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary whitespace-nowrap">
            <i className="ri-save-line mr-1" />{saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(51,65,85,0.3)', border: '1px solid rgba(51,65,85,0.4)' }}>
          <p className="text-xs" style={{ color: '#64748B' }}>Ekipman</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ekipmanAd}</p>
        </div>
        <div>
          <label className="form-label">Kontrol Sonucu *</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(STATUS_CONFIG) as EkipmanStatus[]).map(s => {
              const sc = STATUS_CONFIG[s];
              const selected = durum === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDurum(s)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all whitespace-nowrap"
                  style={{
                    background: selected ? sc.bg : 'rgba(15,23,42,0.4)',
                    color: selected ? sc.color : '#64748B',
                    border: `1px solid ${selected ? sc.border : 'rgba(51,65,85,0.3)'}`,
                  }}
                >
                  <i className={sc.icon} />{sc.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="form-label">Sonraki Kontrol Tarihi</label>
          <input type="date" value={sonrakiTarih} onChange={e => setSonrakiTarih(e.target.value)} className="isg-input" />
        </div>
        <div>
          <label className="form-label">Notlar</label>
          <textarea value={notlar} onChange={e => setNotlar(e.target.value)} rows={3} maxLength={500} placeholder="Kontrol notları..." className="isg-input" />
        </div>
      </div>
    </Modal>
  );
}

// ── Uygunsuzluk Bildir Modal ──
function UygunsuzlukModal({
  open, onClose, ekipmanAd, firmaId,
}: { open: boolean; onClose: () => void; ekipmanAd: string; firmaId: string }) {
  const { addUygunsuzluk, setUygunsuzlukPhoto, updateUygunsuzluk, firmalar, addToast } = useApp();
  const [baslik, setBaslik] = useState(`${ekipmanAd} — Uygunsuzluk`);
  const [aciklama, setAciklama] = useState('');
  const [severity, setSeverity] = useState<UygunsuzlukSeverity>('Orta');
  const [foto, setFoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const firma = firmalar.find(f => f.id === firmaId);

  const handleSave = async () => {
    if (!baslik.trim()) { addToast('Başlık zorunludur.', 'error'); return; }
    if (!firmaId) { addToast('Firma bilgisi eksik.', 'error'); return; }
    setSaving(true);
    try {
      const rec = addUygunsuzluk({
        baslik: baslik.trim(),
        aciklama: aciklama.trim(),
        onlem: '',
        firmaId,
        tarih: new Date().toISOString().slice(0, 10),
        severity,
        sorumlu: '',
        hedefTarih: '',
        notlar: `QR ile bildirildi — Ekipman: ${ekipmanAd}`,
        durum: 'Açık',
        acilisFotoMevcut: !!foto,
        kapatmaFotoMevcut: false,
      });
      if (foto && foto.startsWith('data:')) {
        const url = await setUygunsuzlukPhoto(rec.id, 'acilis', foto);
        if (url) updateUygunsuzluk(rec.id, { acilisFotoUrl: url });
      }
      addToast('Uygunsuzluk bildirildi.', 'success');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Uygunsuzluk Bildir" size="md" icon="ri-alert-line"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary whitespace-nowrap">İptal</button>
          <button onClick={handleSave} disabled={saving} className="whitespace-nowrap px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-all" style={{ background: '#EF4444', color: '#fff' }}>
            <i className="ri-send-plane-line mr-1" />{saving ? 'Gönderiliyor...' : 'Bildir'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <p className="text-xs" style={{ color: '#EF4444' }}>Ekipman</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ekipmanAd}</p>
          {firma && <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{firma.ad}</p>}
        </div>
        <div>
          <label className="form-label">Başlık *</label>
          <input value={baslik} onChange={e => setBaslik(e.target.value)} className="isg-input" />
        </div>
        <div>
          <label className="form-label">Önem Derecesi</label>
          <div className="flex gap-2 flex-wrap">
            {SEV_OPTIONS.map(s => {
              const colors: Record<UygunsuzlukSeverity, string> = { 'Düşük': '#34D399', 'Orta': '#FBBF24', 'Yüksek': '#F97316', 'Kritik': '#EF4444' };
              const selected = severity === s;
              return (
                <button key={s} type="button" onClick={() => setSeverity(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                  style={{
                    background: selected ? `${colors[s]}20` : 'rgba(15,23,42,0.4)',
                    color: selected ? colors[s] : '#64748B',
                    border: `1px solid ${selected ? colors[s] + '50' : 'rgba(51,65,85,0.3)'}`,
                  }}
                >{s}</button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="form-label">Açıklama</label>
          <textarea value={aciklama} onChange={e => setAciklama(e.target.value)} rows={3} maxLength={500} placeholder="Uygunsuzluğun detayları..." className="isg-input" />
        </div>
        <ImageUpload label="Fotoğraf" value={foto} onChange={setFoto} />
      </div>
    </Modal>
  );
}

// ── Fotoğraf Yükle Modal ──
function FotoModal({
  open, onClose, ekipmanAd, ekipmanId,
}: { open: boolean; onClose: () => void; ekipmanAd: string; ekipmanId: string }) {
  const { addUygunsuzluk, setUygunsuzlukPhoto, updateUygunsuzluk, ekipmanlar, addToast } = useApp();
  const [foto, setFoto] = useState<string | null>(null);
  const [aciklama, setAciklama] = useState('');
  const [saving, setSaving] = useState(false);

  const ekipman = ekipmanlar.find(e => e.id === ekipmanId);

  const handleSave = async () => {
    if (!foto) { addToast('Fotoğraf seçiniz.', 'error'); return; }
    setSaving(true);
    try {
      // Fotoğrafı uygunsuzluk kaydı olarak ekle (QR fotoğraf kaydı)
      const rec = addUygunsuzluk({
        baslik: `${ekipmanAd} — Saha Fotoğrafı`,
        aciklama: aciklama.trim() || `QR ile yüklenen saha fotoğrafı`,
        onlem: '',
        firmaId: ekipman?.firmaId ?? '',
        tarih: new Date().toISOString().slice(0, 10),
        severity: 'Düşük',
        sorumlu: '',
        hedefTarih: '',
        notlar: `QR fotoğraf kaydı — Ekipman: ${ekipmanAd}`,
        durum: 'Açık',
        acilisFotoMevcut: true,
        kapatmaFotoMevcut: false,
      });
      if (foto.startsWith('data:')) {
        const url = await setUygunsuzlukPhoto(rec.id, 'acilis', foto);
        if (url) updateUygunsuzluk(rec.id, { acilisFotoUrl: url });
      }
      addToast('Fotoğraf yüklendi ve kayıt oluşturuldu.', 'success');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Fotoğraf Yükle" size="sm" icon="ri-camera-line"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary whitespace-nowrap">İptal</button>
          <button onClick={handleSave} disabled={saving || !foto} className="btn-primary whitespace-nowrap disabled:opacity-50">
            <i className="ri-upload-cloud-line mr-1" />{saving ? 'Yükleniyor...' : 'Yükle'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(51,65,85,0.3)', border: '1px solid rgba(51,65,85,0.4)' }}>
          <p className="text-xs" style={{ color: '#64748B' }}>Ekipman</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ekipmanAd}</p>
        </div>
        <ImageUpload label="Saha Fotoğrafı *" value={foto} onChange={setFoto} />
        <div>
          <label className="form-label">Açıklama <span style={{ color: '#64748B', fontSize: '11px' }}>(İsteğe bağlı)</span></label>
          <textarea value={aciklama} onChange={e => setAciklama(e.target.value)} rows={2} maxLength={300} placeholder="Fotoğraf hakkında not..." className="isg-input" />
        </div>
      </div>
    </Modal>
  );
}

// ── Ana Sayfa ──
export default function QrDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ekipmanlar, firmalar, org, dataLoading } = useApp();

  const [showKontrol, setShowKontrol] = useState(false);
  const [showUygunsuzluk, setShowUygunsuzluk] = useState(false);
  const [showFoto, setShowFoto] = useState(false);
  // Force re-render key after actions to show updated data immediately
  const [refreshKey, setRefreshKey] = useState(0);
  const prevEkipmanRef = useRef<string>('');

  // Detect when ekipman data changes (after updateEkipman) and trigger visual refresh
  const ekipman = useMemo(() => ekipmanlar.find(e => e.id === id && !e.silinmis), [ekipmanlar, id, refreshKey]);

  useEffect(() => {
    const snapshot = JSON.stringify(ekipman);
    if (snapshot !== prevEkipmanRef.current) {
      prevEkipmanRef.current = snapshot;
    }
  }, [ekipman]);

  const handleKontrolClose = () => {
    setShowKontrol(false);
    setRefreshKey(k => k + 1);
  };

  const handleUygunsuzlukClose = () => {
    setShowUygunsuzluk(false);
    setRefreshKey(k => k + 1);
  };

  const handleFotoClose = () => {
    setShowFoto(false);
    setRefreshKey(k => k + 1);
  };

  const firma = useMemo(() => firmalar.find(f => f.id === ekipman?.firmaId), [firmalar, ekipman]);

  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'rgba(100,116,139,0.4)', borderTopColor: '#64748B' }} />
          <p className="text-sm" style={{ color: '#64748B' }}>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!ekipman) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-4xl" style={{ color: '#EF4444' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Ekipman Bulunamadı</h2>
          <p className="text-sm mb-2" style={{ color: '#64748B' }}>Bu QR koda ait ekipman kaydı mevcut değil veya silinmiş.</p>
          <p className="text-xs mb-6 px-3 py-2 rounded-lg" style={{ color: '#F87171', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <i className="ri-shield-cross-line mr-1" />Bu ekipmana erişim yetkiniz yok veya kayıt mevcut değil.
          </p>
          <button onClick={() => navigate('/')} className="btn-primary whitespace-nowrap">
            <i className="ri-home-line mr-1" />Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  const sc = STATUS_CONFIG[ekipman.durum];
  const days = getDaysUntil(ekipman.sonrakiKontrolTarihi);
  const isOverdue = days < 0;
  const isUrgent = days >= 0 && days <= 30;

  const InfoRow = ({ icon, label, value, valueColor }: { icon: string; label: string; value?: string | null; valueColor?: string }) => (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid rgba(51,65,85,0.25)' }}>
      <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5" style={{ background: 'rgba(51,65,85,0.4)' }}>
        <i className={`${icon} text-sm`} style={{ color: '#64748B' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#475569' }}>{label}</p>
        <p className="text-sm font-medium break-words" style={{ color: valueColor || (value ? 'var(--text-primary)' : '#475569') }}>
          {value || '—'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-10" style={{ background: 'var(--bg-main)' }}>
      {/* Top Bar */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid rgba(51,65,85,0.4)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer" style={{ background: 'rgba(51,65,85,0.4)', color: '#94A3B8' }}>
          <i className="ri-arrow-left-line" />
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold" style={{ color: '#64748B' }}>QR Saha Modu</p>
          <p className="text-xs" style={{ color: '#334155' }}>
            <i className="ri-shield-check-line mr-0.5" style={{ color: '#22C55E' }} />
            {org?.name || 'Organizasyon'}
          </p>
        </div>
        <div className="w-9" />
      </div>

      <div className="px-4 pt-5 max-w-lg mx-auto space-y-4">

        {/* Ekipman Kimlik Kartı */}
        <div className="isg-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4" style={{ background: 'rgba(15,23,42,0.5)', borderBottom: '1px solid rgba(51,65,85,0.4)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {ekipman.seriNo && (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                      {ekipman.seriNo}
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(51,65,85,0.4)', color: '#64748B' }}>
                    {ekipman.tur || 'Ekipman'}
                  </span>
                </div>
                <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{ekipman.ad}</h1>
                {firma && <p className="text-sm mt-1" style={{ color: '#64748B' }}>{firma.ad}</p>}
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                <i className={sc.icon} />{sc.label}
              </span>
            </div>
          </div>

          {/* Kontrol uyarısı */}
          {(isOverdue || isUrgent) && (
            <div className="px-5 py-3 flex items-center gap-2" style={{ background: isOverdue ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', borderBottom: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
              <i className={`${isOverdue ? 'ri-alarm-warning-line' : 'ri-time-line'} text-sm`} style={{ color: isOverdue ? '#EF4444' : '#F59E0B' }} />
              <p className="text-xs font-semibold" style={{ color: isOverdue ? '#EF4444' : '#F59E0B' }}>
                {isOverdue ? `Kontrol ${Math.abs(days)} gün gecikmiş!` : `Kontrol tarihi ${days} gün sonra`}
              </p>
            </div>
          )}

          {/* Bilgi satırları */}
          <div className="px-5">
            <InfoRow icon="ri-building-line" label="Firma" value={firma?.ad} />
            <InfoRow icon="ri-map-pin-line" label="Bulunduğu Alan" value={ekipman.bulunduguAlan} />
            <InfoRow icon="ri-price-tag-3-line" label="Marka / Model" value={[ekipman.marka, ekipman.model].filter(Boolean).join(' / ') || null} />
            <InfoRow icon="ri-calendar-check-line" label="Son Kontrol" value={ekipman.sonKontrolTarihi ? new Date(ekipman.sonKontrolTarihi).toLocaleDateString('tr-TR') : null} />
            <InfoRow icon="ri-calendar-2-line" label="Sonraki Kontrol" value={ekipman.sonrakiKontrolTarihi ? new Date(ekipman.sonrakiKontrolTarihi).toLocaleDateString('tr-TR') : null} valueColor={isOverdue ? '#EF4444' : isUrgent ? '#F59E0B' : undefined} />
            {ekipman.aciklama && <InfoRow icon="ri-file-text-line" label="Açıklama" value={ekipman.aciklama} />}
          </div>
        </div>

        {/* ── SAHA AKSİYONLARI ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-1" style={{ color: '#475569' }}>Hızlı Aksiyonlar</p>
          <div className="grid grid-cols-1 gap-3">

            {/* Kontrol Yap */}
            <button
              onClick={() => setShowKontrol(true)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-all active:scale-95"
              style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}
            >
              <div className="w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(52,211,153,0.15)' }}>
                <i className="ri-checkbox-circle-line text-2xl" style={{ color: '#34D399' }} />
              </div>
              <div className="text-left flex-1">
                <p className="text-base font-bold" style={{ color: '#34D399' }}>Kontrol Yap</p>
                <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Ekipman durumunu güncelle, kontrol tarihi kaydet</p>
              </div>
              <i className="ri-arrow-right-s-line text-xl" style={{ color: '#334155' }} />
            </button>

            {/* Uygunsuzluk Bildir */}
            <button
              onClick={() => setShowUygunsuzluk(true)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-all active:scale-95"
              style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <div className="w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(239,68,68,0.12)' }}>
                <i className="ri-alert-line text-2xl" style={{ color: '#EF4444' }} />
              </div>
              <div className="text-left flex-1">
                <p className="text-base font-bold" style={{ color: '#EF4444' }}>Uygunsuzluk Bildir</p>
                <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Tespit edilen sorunu kayıt altına al</p>
              </div>
              <i className="ri-arrow-right-s-line text-xl" style={{ color: '#334155' }} />
            </button>

            {/* Fotoğraf Yükle */}
            <button
              onClick={() => setShowFoto(true)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-all active:scale-95"
              style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)' }}
            >
              <div className="w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(168,85,247,0.12)' }}>
                <i className="ri-camera-line text-2xl" style={{ color: '#A855F7' }} />
              </div>
              <div className="text-left flex-1">
                <p className="text-base font-bold" style={{ color: '#A855F7' }}>Fotoğraf Yükle</p>
                <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Saha fotoğrafı çek ve sisteme kaydet</p>
              </div>
              <i className="ri-arrow-right-s-line text-xl" style={{ color: '#334155' }} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 pb-2">
          <div className="flex items-center gap-1.5">
            <i className="ri-qr-code-line text-xs" style={{ color: '#334155' }} />
            <span className="text-xs" style={{ color: '#334155' }}>QR ile erişildi</span>
          </div>
          <button onClick={() => navigate('/')} className="text-xs cursor-pointer" style={{ color: '#475569' }}>
            <i className="ri-home-line mr-1" />Ana Sayfa
          </button>
        </div>
      </div>

      {/* Aksiyonlar */}
      <KontrolModal
        open={showKontrol}
        onClose={handleKontrolClose}
        ekipmanAd={ekipman.ad}
        firmaId={ekipman.firmaId}
        ekipmanId={ekipman.id}
      />
      <UygunsuzlukModal
        open={showUygunsuzluk}
        onClose={handleUygunsuzlukClose}
        ekipmanAd={ekipman.ad}
        firmaId={ekipman.firmaId}
      />
      <FotoModal
        open={showFoto}
        onClose={handleFotoClose}
        ekipmanAd={ekipman.ad}
        ekipmanId={ekipman.id}
      />
    </div>
  );
}
