import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/base/Modal';
import ImageUpload from '../nonconformity/components/ImageUpload';
import type { Ekipman, EkipmanStatus, UygunsuzlukSeverity } from '../../types';

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
  open, onClose, ekipmanAd, ekipmanId, onSaved,
}: { open: boolean; onClose: () => void; ekipmanAd: string; ekipmanId: string; onSaved: () => void }) {
  const { updateEkipman, addToast, currentUser } = useApp();
  const [durum, setDurum] = useState<EkipmanStatus>('Uygun');
  const [notlar, setNotlar] = useState('');
  const [sonrakiTarih, setSonrakiTarih] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const notlarVal = notlar.trim()
        ? `[${today} - ${currentUser.ad || 'Kullanıcı'}] ${notlar.trim()}`
        : '';
      // Store üzerinden güncelle (saveToDb otomatik çalışır)
      updateEkipman(ekipmanId, {
        durum,
        sonKontrolTarihi: today,
        ...(sonrakiTarih ? { sonrakiKontrolTarihi: sonrakiTarih } : {}),
        notlar: notlarVal,
      });
      addToast('Kontrol kaydedildi.', 'success');
      onClose();
      // Store'a yazıldıktan sonra Supabase'den taze veriyi çek
      setTimeout(() => onSaved(), 800);
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

// ── Evrak Görüntüle Modal ──
function EvrakModal({
  open, onClose, dosyaVeri, dosyaAdi, dosyaTipi,
}: { open: boolean; onClose: () => void; dosyaVeri: string; dosyaAdi: string; dosyaTipi: string }) {
  const isImage = dosyaTipi?.startsWith('image/');
  const isPdf = dosyaTipi === 'application/pdf';

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = dosyaVeri;
    link.download = dosyaAdi || 'ekipman-belgesi';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={dosyaAdi || 'Belge'} size="lg" icon="ri-file-text-line"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary whitespace-nowrap">Kapat</button>
          <button onClick={handleDownload} className="btn-primary whitespace-nowrap">
            <i className="ri-download-2-line mr-1" />İndir
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        {isImage && (
          <img src={dosyaVeri} alt={dosyaAdi} className="max-w-full rounded-xl object-contain" style={{ maxHeight: '60vh' }} />
        )}
        {isPdf && (
          <iframe src={dosyaVeri} title={dosyaAdi} className="w-full rounded-xl" style={{ height: '60vh', border: 'none' }} />
        )}
        {!isImage && !isPdf && (
          <div className="text-center py-8">
            <div className="w-16 h-16 flex items-center justify-center rounded-2xl mx-auto mb-4" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <i className="ri-file-line text-3xl" style={{ color: '#34D399' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{dosyaAdi}</p>
            <p className="text-xs mt-1" style={{ color: '#64748B' }}>Bu dosya türü önizlenemiyor. İndirmek için butona tıklayın.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Ana Sayfa ──
export default function QrDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ekipmanlar, firmalar, org, dataLoading, getEkipmanFile, evraklar } = useApp();

  // Local ekipman state — Supabase'den direkt çekilen güncel veri
  const [localEkipman, setLocalEkipman] = useState<Ekipman | null | undefined>(undefined);
  const [localLoading, setLocalLoading] = useState(true);
  const [showKontrol, setShowKontrol] = useState(false);
  const [showUygunsuzluk, setShowUygunsuzluk] = useState(false);
  const [showFoto, setShowFoto] = useState(false);
  const [showEvrak, setShowEvrak] = useState(false);
  const [evrakVeri, setEvrakVeri] = useState('');
  const [evrakAdi, setEvrakAdi] = useState('');
  const [evrakTipi, setEvrakTipi] = useState('');
  const fetchedRef = useRef(false);

  // Supabase'den ekipmanı direkt çek — en güncel veriyi al
  const fetchEkipmanFromDb = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('ekipmanlar')
        .select('data')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        console.error('[QR] Ekipman fetch error:', error);
        // Hata durumunda store'dan dene
        const fromStore = ekipmanlar.find(e => e.id === id && !e.silinmis);
        setLocalEkipman(fromStore ?? null);
      } else if (data && data.data) {
        // Veri data.data içinde JSON olarak saklı
        setLocalEkipman(data.data as Ekipman);
      } else {
        // Supabase'de yok, store'dan dene
        const fromStore = ekipmanlar.find(e => e.id === id && !e.silinmis);
        setLocalEkipman(fromStore ?? null);
      }
    } catch {
      const fromStore = ekipmanlar.find(e => e.id === id && !e.silinmis);
      setLocalEkipman(fromStore ?? null);
    } finally {
      setLocalLoading(false);
    }
  }, [id, ekipmanlar]);

  // İlk yüklemede Supabase'den çek
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchEkipmanFromDb();
  }, [fetchEkipmanFromDb]);

  // dataLoading bitince store'dan da kontrol et (fallback)
  useEffect(() => {
    if (dataLoading || localEkipman !== undefined) return;
    const fromStore = ekipmanlar.find(e => e.id === id && !e.silinmis);
    if (fromStore) {
      setLocalEkipman(fromStore);
      setLocalLoading(false);
    }
  }, [dataLoading, ekipmanlar, id, localEkipman]);

  // Store'daki ekipman güncellenince local state'i de anlık güncelle
  useEffect(() => {
    if (!id || localEkipman === undefined) return;
    const fromStore = ekipmanlar.find(e => e.id === id && !e.silinmis);
    if (fromStore) {
      setLocalEkipman(fromStore);
    }
  }, [ekipmanlar, id]);

  // Kontrol kaydedildikten sonra Supabase'den taze veri çek
  const handleAfterSave = useCallback(() => {
    fetchEkipmanFromDb();
  }, [fetchEkipmanFromDb]);

  const handleKontrolClose = () => setShowKontrol(false);
  const handleUygunsuzlukClose = () => setShowUygunsuzluk(false);
  const handleFotoClose = () => setShowFoto(false);

  // Ekipmanın evraklarını bul (store'dan)
  const ekipmanEvraklari = evraklar.filter(
    e => !e.silinmis && e.firmaId === localEkipman?.firmaId && e.ad?.toLowerCase().includes(localEkipman?.ad?.toLowerCase() ?? '')
  );

  // Ekipmanın kendi belgesi
  const handleOpenBelge = () => {
    if (!localEkipman) return;
    const veri = getEkipmanFile(localEkipman.id);
    if (!veri) return;
    setEvrakVeri(veri);
    setEvrakAdi(localEkipman.dosyaAdi || 'Ekipman Belgesi');
    setEvrakTipi(localEkipman.dosyaTipi || '');
    setShowEvrak(true);
  };

  const firma = firmalar.find(f => f.id === localEkipman?.firmaId);

  // Yükleniyor
  if (localLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'rgba(100,116,139,0.4)', borderTopColor: '#64748B' }} />
          <p className="text-sm" style={{ color: '#64748B' }}>Ekipman yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Bulunamadı
  if (!localEkipman || localEkipman.silinmis) {
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

  const sc = STATUS_CONFIG[localEkipman.durum] ?? STATUS_CONFIG['Uygun'];
  const days = getDaysUntil(localEkipman.sonrakiKontrolTarihi);
  const isOverdue = days < 0;
  const isUrgent = days >= 0 && days <= 30;
  const hasBelge = !!(localEkipman.dosyaAdi && getEkipmanFile(localEkipman.id));

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
                  {localEkipman.seriNo && (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                      {localEkipman.seriNo}
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(51,65,85,0.4)', color: '#64748B' }}>
                    {localEkipman.tur || 'Ekipman'}
                  </span>
                </div>
                <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{localEkipman.ad}</h1>
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
            <InfoRow icon="ri-map-pin-line" label="Bulunduğu Alan" value={localEkipman.bulunduguAlan} />
            <InfoRow icon="ri-price-tag-3-line" label="Marka / Model" value={[localEkipman.marka, localEkipman.model].filter(Boolean).join(' / ') || null} />
            <InfoRow icon="ri-calendar-check-line" label="Son Kontrol" value={localEkipman.sonKontrolTarihi ? new Date(localEkipman.sonKontrolTarihi).toLocaleDateString('tr-TR') : null} />
            <InfoRow icon="ri-calendar-2-line" label="Sonraki Kontrol" value={localEkipman.sonrakiKontrolTarihi ? new Date(localEkipman.sonrakiKontrolTarihi).toLocaleDateString('tr-TR') : null} valueColor={isOverdue ? '#EF4444' : isUrgent ? '#F59E0B' : undefined} />
            {localEkipman.aciklama && <InfoRow icon="ri-file-text-line" label="Açıklama" value={localEkipman.aciklama} />}
          </div>
        </div>

        {/* ── BELGELER ── */}
        {(hasBelge || ekipmanEvraklari.length > 0) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-1" style={{ color: '#475569' }}>
              <i className="ri-folder-open-line mr-1.5" />Belgeler
            </p>
            <div className="isg-card rounded-2xl overflow-hidden">
              {/* Ekipmanın kendi belgesi */}
              {hasBelge && (
                <button
                  onClick={handleOpenBelge}
                  className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all text-left"
                  style={{ borderBottom: ekipmanEvraklari.length > 0 ? '1px solid rgba(51,65,85,0.3)' : 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <i className="ri-file-check-line text-base" style={{ color: '#34D399' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{localEkipman.dosyaAdi || 'Ekipman Belgesi'}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                      {localEkipman.dosyaBoyutu ? `${(localEkipman.dosyaBoyutu / 1024).toFixed(1)} KB` : 'Ekipman belgesi'} — Görüntüle / İndir
                    </p>
                  </div>
                  <i className="ri-eye-line text-sm flex-shrink-0" style={{ color: '#34D399' }} />
                </button>
              )}

              {/* Evrak modülündeki ilgili evraklar */}
              {ekipmanEvraklari.map((evrak, idx) => (
                <div
                  key={evrak.id}
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={{ borderBottom: idx < ekipmanEvraklari.length - 1 ? '1px solid rgba(51,65,85,0.3)' : 'none' }}
                >
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)' }}>
                    <i className="ri-file-text-line text-base" style={{ color: '#60A5FA' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{evrak.ad}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                      {evrak.tur || 'Evrak'}
                      {evrak.gecerlilikTarihi && ` — ${new Date(evrak.gecerlilikTarihi).toLocaleDateString('tr-TR')} tarihine kadar geçerli`}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-lg whitespace-nowrap flex-shrink-0" style={{
                    background: evrak.durum === 'Yüklü' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                    color: evrak.durum === 'Yüklü' ? '#34D399' : '#F87171',
                  }}>
                    {evrak.durum}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
        ekipmanAd={localEkipman.ad}
        ekipmanId={localEkipman.id}
        onSaved={handleAfterSave}
      />
      <UygunsuzlukModal
        open={showUygunsuzluk}
        onClose={handleUygunsuzlukClose}
        ekipmanAd={localEkipman.ad}
        firmaId={localEkipman.firmaId}
      />
      <FotoModal
        open={showFoto}
        onClose={handleFotoClose}
        ekipmanAd={localEkipman.ad}
        ekipmanId={localEkipman.id}
      />
      <EvrakModal
        open={showEvrak}
        onClose={() => setShowEvrak(false)}
        dosyaVeri={evrakVeri}
        dosyaAdi={evrakAdi}
        dosyaTipi={evrakTipi}
      />
    </div>
  );
}
