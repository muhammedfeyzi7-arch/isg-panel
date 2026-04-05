import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../lib/supabase';
import { uploadBase64ToStorage, getSignedUrlFromPath } from '../../utils/fileUpload';
import { useSignedUrls } from '../../hooks/useSignedUrl';
import Modal from '../../components/base/Modal';
import ImageUpload from '../nonconformity/components/ImageUpload';
import type { Ekipman, EkipmanStatus, EkipmanSahaFoto, UygunsuzlukSeverity } from '../../types';

// ── Kontrol Geçmişi tipi ──
interface KontrolKayit {
  tarih: string;
  yapanKisi: string;
  durum: EkipmanStatus;
  notlar?: string;
}

const STATUS_CONFIG: Record<EkipmanStatus, {
  label: string; color: string; bg: string; border: string; icon: string;
  gradient: string; glowColor: string; heroGradient: string;
}> = {
  'Uygun': {
    label: 'Uygun', color: '#34D399', bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.35)',
    icon: 'ri-checkbox-circle-fill',
    gradient: 'linear-gradient(135deg, rgba(52,211,153,0.2) 0%, rgba(16,185,129,0.08) 100%)',
    glowColor: 'rgba(52,211,153,0.3)',
    heroGradient: 'linear-gradient(160deg, rgba(52,211,153,0.18) 0%, rgba(16,185,129,0.06) 40%, rgba(11,17,32,0) 70%)',
  },
  'Uygun Değil': {
    label: 'Uygun Değil', color: '#F87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.35)',
    icon: 'ri-close-circle-fill',
    gradient: 'linear-gradient(135deg, rgba(248,113,113,0.2) 0%, rgba(239,68,68,0.08) 100%)',
    glowColor: 'rgba(248,113,113,0.3)',
    heroGradient: 'linear-gradient(160deg, rgba(248,113,113,0.18) 0%, rgba(239,68,68,0.06) 40%, rgba(11,17,32,0) 70%)',
  },
  'Bakımda': {
    label: 'Bakımda', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.35)',
    icon: 'ri-tools-fill',
    gradient: 'linear-gradient(135deg, rgba(251,191,36,0.2) 0%, rgba(245,158,11,0.08) 100%)',
    glowColor: 'rgba(251,191,36,0.3)',
    heroGradient: 'linear-gradient(160deg, rgba(251,191,36,0.18) 0%, rgba(245,158,11,0.06) 40%, rgba(11,17,32,0) 70%)',
  },
  'Hurda': {
    label: 'Hurda', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.35)',
    icon: 'ri-delete-bin-fill',
    gradient: 'linear-gradient(135deg, rgba(148,163,184,0.2) 0%, rgba(100,116,139,0.08) 100%)',
    glowColor: 'rgba(148,163,184,0.3)',
    heroGradient: 'linear-gradient(160deg, rgba(148,163,184,0.18) 0%, rgba(100,116,139,0.06) 40%, rgba(11,17,32,0) 70%)',
  },
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
  const { updateEkipman, addToast, currentUser, org } = useApp();
  const [durum, setDurum] = useState<EkipmanStatus>('Uygun');
  const [notlar, setNotlar] = useState('');
  const [sonrakiTarih, setSonrakiTarih] = useState('');
  const [saving, setSaving] = useState(false);
  // FIX 4: useRef lock to prevent double-click duplicate submissions
  const submittingRef = useRef(false);

  const handleSave = async () => {
    // FIX 4: Immediate ref lock — prevents double-click before state update
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const yapanKisi = currentUser.ad || 'Kullanıcı';
      const notlarVal = notlar.trim()
        ? `[${today} - ${yapanKisi}] ${notlar.trim()}`
        : '';

      // FIX 3: Always fetch latest from DB before updating kontrolGecmisi
      // This prevents race condition where stale local state overwrites concurrent updates
      let mevcutGecmis: KontrolKayit[] = [];
      try {
        const { data: freshData } = await supabase
          .from('ekipmanlar')
          .select('data')
          .eq('id', ekipmanId)
          .maybeSingle();
        if (freshData?.data) {
          mevcutGecmis = (freshData.data as unknown as { kontrolGecmisi?: KontrolKayit[] }).kontrolGecmisi ?? [];
        }
      } catch {
        // Fallback to empty if fetch fails — still better than stale state
        mevcutGecmis = [];
      }

      const yeniKayit: KontrolKayit = {
        tarih: new Date().toISOString(),
        yapanKisi,
        durum,
        notlar: notlar.trim() || undefined,
      };
      const yeniGecmis = [yeniKayit, ...mevcutGecmis].slice(0, 50); // max 50 kayıt tut

      // FIX 1: Denetci field restriction — pass role so store enforces whitelist
      // Only sonKontrolTarihi, durum, kontrolGecmisi, notlar allowed for denetci
      updateEkipman(ekipmanId, {
        durum,
        sonKontrolTarihi: today,
        ...(sonrakiTarih ? { sonrakiKontrolTarihi: sonrakiTarih } : {}),
        notlar: notlarVal,
        kontrolGecmisi: yeniGecmis,
      } as Partial<Ekipman>, org?.role?.toLowerCase());
      addToast('Kontrol kaydedildi.', 'success');
      onClose();
      setTimeout(() => onSaved(), 800);
    } finally {
      setSaving(false);
      submittingRef.current = false;
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

// ── Kontrol Geçmişi Modal ──
function KontrolGecmisiModal({
  open, onClose, ekipmanId, ekipmanAd,
}: { open: boolean; onClose: () => void; ekipmanId: string; ekipmanAd: string }) {
  const [gecmis, setGecmis] = useState<KontrolKayit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !ekipmanId) return;
    setLoading(true);
    supabase
      .from('ekipmanlar')
      .select('data')
      .eq('id', ekipmanId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.data) {
          const kayitlar: KontrolKayit[] = (data.data as unknown as { kontrolGecmisi?: KontrolKayit[] }).kontrolGecmisi ?? [];
          setGecmis(kayitlar.slice(0, 10));
        } else {
          setGecmis([]);
        }
      })
      .finally(() => setLoading(false));
  }, [open, ekipmanId]);

  const durumRenk: Record<EkipmanStatus, { color: string; bg: string; border: string; icon: string }> = {
    'Uygun':       { color: '#34D399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.25)',  icon: 'ri-checkbox-circle-fill' },
    'Uygun Değil': { color: '#F87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)', icon: 'ri-close-circle-fill' },
    'Bakımda':     { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)',  icon: 'ri-tools-fill' },
    'Hurda':       { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)', icon: 'ri-delete-bin-fill' },
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Kontrol Geçmişi"
      size="sm"
      icon="ri-history-line"
      footer={
        <button onClick={onClose} className="btn-secondary whitespace-nowrap w-full">Kapat</button>
      }
    >
      <div>
        {/* Ekipman adı */}
        <div
          className="px-3 py-2 rounded-xl mb-4"
          style={{ background: 'rgba(51,65,85,0.3)', border: '1px solid rgba(51,65,85,0.4)' }}
        >
          <p className="text-xs" style={{ color: '#64748B' }}>Ekipman</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ekipmanAd}</p>
        </div>

        {/* İçerik */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div
              className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'rgba(52,211,153,0.3)', borderTopColor: '#34D399' }}
            />
            <p className="text-xs" style={{ color: '#475569' }}>Yükleniyor...</p>
          </div>
        ) : gecmis.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div
              className="w-12 h-12 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(51,65,85,0.3)', border: '1px solid rgba(51,65,85,0.4)' }}
            >
              <i className="ri-history-line text-xl" style={{ color: '#475569' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: '#64748B' }}>Henüz kontrol yapılmamış</p>
            <p className="text-xs text-center" style={{ color: '#334155' }}>
              Bu ekipman için kayıtlı kontrol geçmişi bulunmuyor.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {gecmis.map((kayit, idx) => {
              const dr = durumRenk[kayit.durum] ?? durumRenk['Uygun'];
              const tarihObj = new Date(kayit.tarih);
              const tarihStr = tarihObj.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
              const saatStr = tarihObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 px-3 py-3 rounded-xl"
                  style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.3)' }}
                >
                  {/* Durum ikonu */}
                  <div
                    className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5"
                    style={{ background: dr.bg, border: `1px solid ${dr.border}` }}
                  >
                    <i className={`${dr.icon} text-sm`} style={{ color: dr.color }} />
                  </div>

                  {/* Bilgiler */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-lg whitespace-nowrap"
                        style={{ background: dr.bg, color: dr.color, border: `1px solid ${dr.border}` }}
                      >
                        {kayit.durum}
                      </span>
                      {idx === 0 && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-lg font-semibold whitespace-nowrap"
                          style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.2)' }}
                        >
                          Son Kontrol
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <i className="ri-user-line text-xs" style={{ color: '#475569' }} />
                      <p className="text-sm font-semibold truncate" style={{ color: '#CBD5E1' }}>{kayit.yapanKisi}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <i className="ri-calendar-line text-xs" style={{ color: '#475569' }} />
                      <p className="text-xs" style={{ color: '#64748B' }}>{tarihStr} — {saatStr}</p>
                    </div>
                    {kayit.notlar && (
                      <p
                        className="text-xs mt-1.5 px-2 py-1.5 rounded-lg leading-relaxed"
                        style={{ background: 'rgba(51,65,85,0.3)', color: '#94A3B8' }}
                      >
                        {kayit.notlar}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
  // FIX 4: useRef lock to prevent double-click duplicate submissions
  const submittingRef = useRef(false);

  const firma = firmalar.find(f => f.id === firmaId);

  const handleSave = async () => {
    if (!baslik.trim()) { addToast('Başlık zorunludur.', 'error'); return; }
    if (!firmaId) { addToast('Firma bilgisi eksik.', 'error'); return; }
    // FIX 4: Immediate ref lock
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      let acilisFotoUrl: string | undefined;
      let acilisFotoMevcut = false;

      if (foto) {
        if (!foto.startsWith('data:')) {
          acilisFotoUrl = foto;
          acilisFotoMevcut = true;
        }
      }

      const rec = await addUygunsuzluk({
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
        acilisFotoMevcut: acilisFotoMevcut || (foto?.startsWith('data:') ?? false),
        kapatmaFotoMevcut: false,
        ...(acilisFotoUrl ? { acilisFotoUrl } : {}),
      });

      if (foto && foto.startsWith('data:') && rec?.id) {
        const url = await setUygunsuzlukPhoto(rec.id, 'acilis', foto);
        if (url) updateUygunsuzluk(rec.id, { acilisFotoUrl: url });
      }
      addToast('Uygunsuzluk bildirildi.', 'success');
      onClose();
    } finally {
      setSaving(false);
      submittingRef.current = false;
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
  open, onClose, ekipmanAd, ekipmanId, onUploaded,
}: { open: boolean; onClose: () => void; ekipmanAd: string; ekipmanId: string; onUploaded: () => void }) {
  const { updateEkipman, ekipmanlar, currentUser, addToast, org } = useApp();
  const [foto, setFoto] = useState<string | null>(null);
  const [aciklama, setAciklama] = useState('');
  const [saving, setSaving] = useState(false);
  // FIX 4: useRef lock to prevent double-click duplicate uploads
  const submittingRef = useRef(false);

  const ekipman = ekipmanlar.find(e => e.id === ekipmanId);

  const handleClose = () => {
    setFoto(null);
    setAciklama('');
    onClose();
  };

  const handleSave = async () => {
    if (!foto) { addToast('Fotoğraf seçiniz.', 'error'); return; }
    if (!foto.startsWith('data:')) { addToast('Geçersiz fotoğraf formatı.', 'error'); return; }
    // FIX 4: Immediate ref lock
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const fotoId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
      const orgId = org?.id ?? 'unknown';

      const filePath = await uploadBase64ToStorage(
        foto,
        orgId,
        `ekipman-saha/${ekipmanId}`,
        fotoId,
      );

      if (!filePath) {
        addToast('Fotoğraf yüklenemedi. Lütfen tekrar deneyin.', 'error');
        return;
      }

      const yeniFoto: EkipmanSahaFoto = {
        id: fotoId,
        url: filePath,
        aciklama: aciklama.trim(),
        tarih: new Date().toISOString(),
        yukleyenKisi: currentUser.ad || 'Kullanıcı',
      };

      // FIX: Always fetch latest sahaFotolari from DB to prevent race condition
      // (two users uploading simultaneously would overwrite each other's photos)
      let mevcutFotolar: EkipmanSahaFoto[] = [];
      try {
        const { data: freshData } = await supabase
          .from('ekipmanlar')
          .select('data')
          .eq('id', ekipmanId)
          .maybeSingle();
        if (freshData?.data) {
          mevcutFotolar = (freshData.data as unknown as { sahaFotolari?: EkipmanSahaFoto[] }).sahaFotolari ?? [];
        }
      } catch {
        mevcutFotolar = ekipman?.sahaFotolari ?? [];
      }

      updateEkipman(ekipmanId, {
        sahaFotolari: [...mevcutFotolar, yeniFoto],
      });

      addToast('Fotoğraf başarıyla yüklendi.', 'success');
      handleClose();
      setTimeout(() => onUploaded(), 800);
    } catch (err) {
      console.error('[FotoModal] Error:', err);
      addToast('Fotoğraf yüklenirken hata oluştu.', 'error');
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };

  return (
    <Modal isOpen={open} onClose={handleClose} title="Saha Fotoğrafı Yükle" size="sm" icon="ri-camera-line"
      footer={
        <>
          <button onClick={handleClose} className="btn-secondary whitespace-nowrap">İptal</button>
          <button onClick={handleSave} disabled={saving || !foto} className="btn-primary whitespace-nowrap disabled:opacity-50">
            {saving ? (
              <><i className="ri-loader-4-line animate-spin mr-1" />Yükleniyor...</>
            ) : (
              <><i className="ri-upload-cloud-line mr-1" />Yükle</>
            )}
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

// ── Fotoğraf Lightbox ──
function PhotoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.95)' }}
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full cursor-pointer transition-all"
        style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
        onClick={onClose}
      >
        <i className="ri-close-line text-xl" />
      </button>
      <img
        src={url}
        alt="Saha fotoğrafı"
        className="max-w-full max-h-full rounded-2xl object-contain"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

// ── Ana Sayfa ──
export default function QrDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ekipmanlar, firmalar, org, dataLoading, evraklar } = useApp();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const [localEkipman, setLocalEkipman] = useState<Ekipman | null | undefined>(undefined);
  const [localLoading, setLocalLoading] = useState(true);
  const [showKontrol, setShowKontrol] = useState(false);
  const [showUygunsuzluk, setShowUygunsuzluk] = useState(false);
  const [showFoto, setShowFoto] = useState(false);
  const [showGecmis, setShowGecmis] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchEkipmanFromDb = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('ekipmanlar')
        .select('data')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        const fromStore = ekipmanlar.find(e => e.id === id && !e.silinmis);
        setLocalEkipman(fromStore ?? null);
      } else if (data && data.data) {
        setLocalEkipman(data.data as Ekipman);
      } else {
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

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchEkipmanFromDb();
  }, [fetchEkipmanFromDb]);

  useEffect(() => {
    if (dataLoading || localEkipman !== undefined) return;
    const fromStore = ekipmanlar.find(e => e.id === id && !e.silinmis);
    if (fromStore) {
      setLocalEkipman(fromStore);
      setLocalLoading(false);
    }
  }, [dataLoading, ekipmanlar, id, localEkipman]);

  useEffect(() => {
    if (!id || localEkipman === undefined) return;
    const fromStore = ekipmanlar.find(e => e.id === id && !e.silinmis);
    if (fromStore) setLocalEkipman(fromStore);
  }, [ekipmanlar, id]);

  const handleAfterSave = useCallback(() => {
    fetchEkipmanFromDb();
  }, [fetchEkipmanFromDb]);

  const ekipmanEvraklari = evraklar.filter(
    e => !e.silinmis && e.firmaId === localEkipman?.firmaId && e.ad?.toLowerCase().includes(localEkipman?.ad?.toLowerCase() ?? '')
  );

  const sahaFotolar = localEkipman?.sahaFotolari ?? [];
  const fotoFilePaths = sahaFotolar.map(f => f.url);
  const signedFotoUrls = useSignedUrls(fotoFilePaths);

  const [belgeUrl, setBelgeUrl] = useState<string | null>(null);
  const [belgeAdi, setBelgeAdi] = useState<string>('');
  const [belgeTipi, setBelgeTipi] = useState<string>('');
  const [showBelge, setShowBelge] = useState(false);

  const handleOpenBelge = async () => {
    if (!localEkipman?.dosyaUrl) return;
    try {
      let url = localEkipman.dosyaUrl;
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
        const signed = await getSignedUrlFromPath(localEkipman.dosyaUrl);
        if (!signed) return;
        url = signed;
      }
      const ext = (localEkipman.dosyaAdi || url).split('.').pop()?.toLowerCase() ?? '';
      const mimeMap: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
      setBelgeUrl(url);
      setBelgeAdi(localEkipman.dosyaAdi || 'Ekipman Belgesi');
      setBelgeTipi(mimeMap[ext] || 'application/octet-stream');
      setShowBelge(true);
    } catch {
      // ignore
    }
  };

  const firma = firmalar.find(f => f.id === localEkipman?.firmaId);

  // ── Loading ──
  if (localLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'linear-gradient(160deg, #0B1120 0%, #0D1829 100%)' }}>
        <div className="relative mb-6">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}
          >
            <i className="ri-qr-code-line text-4xl" style={{ color: '#34D399' }} />
          </div>
          <div
            className="absolute -inset-2 rounded-3xl opacity-30 animate-ping"
            style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}
          />
        </div>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: 'rgba(52,211,153,0.3)', borderTopColor: '#34D399' }} />
        <p className="text-sm font-medium" style={{ color: '#475569' }}>Ekipman yükleniyor...</p>
      </div>
    );
  }

  // ── Bulunamadı ──
  if (!localEkipman || localEkipman.silinmis) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(160deg, #0B1120 0%, #0D1829 100%)' }}>
        <div className="text-center max-w-sm">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-5xl" style={{ color: '#EF4444' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#F1F5F9' }}>Ekipman Bulunamadı</h2>
          <p className="text-sm mb-8" style={{ color: '#64748B' }}>Bu QR koda ait ekipman kaydı mevcut değil veya silinmiş.</p>
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
  const hasBelge = !!localEkipman.dosyaUrl;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #080E1C 0%, #0B1120 50%, #0A1018 100%)' }}>

      {/* ── Top Bar ── */}
      <div
        className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(8,14,28,0.85)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        <button
          onClick={handleGoBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <i className="ri-arrow-left-s-line text-lg" />
          <span className="text-xs font-medium">Geri</span>
        </button>

        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)' }}
          >
            <i className="ri-qr-code-line text-xs" style={{ color: '#34D399' }} />
          </div>
          <span className="text-sm font-bold tracking-tight" style={{ color: '#E2E8F0' }}>Saha Modu</span>
        </div>

        <div className="w-16" />
      </div>

      {/* ── HERO SECTION ── */}
      <div className="relative overflow-hidden">
        {/* Ambient glow arka plan */}
        <div
          className="absolute inset-0"
          style={{ background: sc.heroGradient }}
        />
        {/* Büyük dekoratif daire */}
        <div
          className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-[0.07]"
          style={{ background: `radial-gradient(circle, ${sc.color} 0%, transparent 70%)` }}
        />
        <div
          className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full opacity-[0.05]"
          style={{ background: `radial-gradient(circle, ${sc.color} 0%, transparent 70%)` }}
        />

        <div className="relative px-5 pt-8 pb-6">
          {/* Üst satır: durum + seri no */}
          <div className="flex items-center justify-between mb-5">
            <span
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide"
              style={{
                background: sc.bg,
                color: sc.color,
                border: `1px solid ${sc.border}`,
                boxShadow: `0 0 16px ${sc.glowColor}`,
              }}
            >
              <i className={`${sc.icon} text-sm`} />
              {sc.label}
            </span>
            {localEkipman.seriNo && (
              <span
                className="text-xs font-mono font-bold px-2.5 py-1.5 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: '#64748B',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                S/N: {localEkipman.seriNo}
              </span>
            )}
          </div>

          {/* Büyük ikon + ekipman adı */}
          <div className="flex items-start gap-4 mb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: sc.bg,
                border: `1px solid ${sc.border}`,
                boxShadow: `0 8px 32px ${sc.glowColor}`,
              }}
            >
              <i className="ri-tools-line text-3xl" style={{ color: sc.color }} />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-2xl font-extrabold leading-tight mb-1.5 tracking-tight" style={{ color: '#F8FAFC' }}>
                {localEkipman.ad}
              </h1>
              {firma && (
                <div className="flex items-center gap-1.5">
                  <i className="ri-building-2-line text-xs" style={{ color: '#475569' }} />
                  <span className="text-sm font-medium" style={{ color: '#64748B' }}>{firma.ad}</span>
                </div>
              )}
            </div>
          </div>

          {/* Chip'ler */}
          <div className="flex flex-wrap gap-2">
            {localEkipman.tur && (
              <span
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <i className="ri-settings-3-line text-xs" />
                {localEkipman.tur}
              </span>
            )}
            {localEkipman.bulunduguAlan && (
              <span
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <i className="ri-map-pin-2-line text-xs" />
                {localEkipman.bulunduguAlan}
              </span>
            )}
            {localEkipman.marka && (
              <span
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <i className="ri-price-tag-3-line text-xs" />
                {localEkipman.marka}
              </span>
            )}
          </div>
        </div>

        {/* Kontrol uyarı bandı */}
        {(isOverdue || isUrgent) && (
          <div
            className="mx-4 mb-4 px-4 py-3 rounded-2xl flex items-center gap-3"
            style={{
              background: isOverdue ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)'}`,
            }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: isOverdue ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)' }}
            >
              <i
                className={`${isOverdue ? 'ri-alarm-warning-fill' : 'ri-time-fill'} text-base`}
                style={{ color: isOverdue ? '#EF4444' : '#F59E0B' }}
              />
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: isOverdue ? '#EF4444' : '#F59E0B' }}>
                {isOverdue ? `Kontrol ${Math.abs(days)} gün gecikmiş!` : `Kontrol ${days} gün sonra`}
              </p>
              <p className="text-xs mt-0.5" style={{ color: isOverdue ? 'rgba(239,68,68,0.6)' : 'rgba(245,158,11,0.6)' }}>
                {isOverdue ? 'Lütfen en kısa sürede kontrol yapın' : 'Yaklaşan kontrol tarihi'}
              </p>
            </div>
          </div>
        )}

        {/* Alt ayırıcı çizgi */}
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }} />
      </div>

      {/* ── İçerik ── */}
      <div className="px-4 pt-6 pb-12 max-w-lg mx-auto space-y-6">

        {/* ── Hızlı Aksiyonlar ── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-4 px-1 flex items-center gap-2" style={{ color: '#334155' }}>
            <span
              className="inline-block w-4 h-0.5 rounded-full"
              style={{ background: 'rgba(52,211,153,0.5)' }}
            />
            Hızlı Aksiyonlar
          </p>

          <div className="space-y-3">
            {/* Kontrol Yap */}
            <button
              onClick={() => setShowKontrol(true)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98] text-left group"
              style={{
                background: 'linear-gradient(135deg, rgba(52,211,153,0.1) 0%, rgba(16,185,129,0.04) 100%)',
                border: '1px solid rgba(52,211,153,0.2)',
              }}
            >
              <div
                className="w-14 h-14 flex items-center justify-center rounded-2xl flex-shrink-0 transition-all"
                style={{
                  background: 'rgba(52,211,153,0.15)',
                  border: '1px solid rgba(52,211,153,0.25)',
                  boxShadow: '0 4px 20px rgba(52,211,153,0.15)',
                }}
              >
                <i className="ri-checkbox-circle-line text-2xl" style={{ color: '#34D399' }} />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold mb-0.5" style={{ color: '#34D399' }}>Kontrol Yap</p>
                <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>Durumu güncelle, kontrol tarihi kaydet</p>
              </div>
              <div
                className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: 'rgba(52,211,153,0.1)' }}
              >
                <i className="ri-arrow-right-s-line text-lg" style={{ color: '#34D399' }} />
              </div>
            </button>

            {/* Uygunsuzluk Bildir */}
            <button
              onClick={() => setShowUygunsuzluk(true)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98] text-left"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(220,38,38,0.04) 100%)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <div
                className="w-14 h-14 flex items-center justify-center rounded-2xl flex-shrink-0"
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  boxShadow: '0 4px 20px rgba(239,68,68,0.15)',
                }}
              >
                <i className="ri-alert-line text-2xl" style={{ color: '#F87171' }} />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold mb-0.5" style={{ color: '#F87171' }}>Uygunsuzluk Bildir</p>
                <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>Tespit edilen sorunu kayıt altına al</p>
              </div>
              <div
                className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.1)' }}
              >
                <i className="ri-arrow-right-s-line text-lg" style={{ color: '#F87171' }} />
              </div>
            </button>

            {/* Fotoğraf Yükle */}
            <button
              onClick={() => setShowFoto(true)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98] text-left"
              style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(245,158,11,0.04) 100%)',
                border: '1px solid rgba(251,191,36,0.2)',
              }}
            >
              <div
                className="w-14 h-14 flex items-center justify-center rounded-2xl flex-shrink-0"
                style={{
                  background: 'rgba(251,191,36,0.15)',
                  border: '1px solid rgba(251,191,36,0.25)',
                  boxShadow: '0 4px 20px rgba(251,191,36,0.12)',
                }}
              >
                <i className="ri-camera-line text-2xl" style={{ color: '#FBBF24' }} />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold mb-0.5" style={{ color: '#FBBF24' }}>Fotoğraf Yükle</p>
                <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>Saha fotoğrafı çek ve sisteme kaydet</p>
              </div>
              <div
                className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: 'rgba(251,191,36,0.1)' }}
              >
                <i className="ri-arrow-right-s-line text-lg" style={{ color: '#FBBF24' }} />
              </div>
            </button>

            {/* Kontrol Geçmişi */}
            <button
              onClick={() => setShowGecmis(true)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98] text-left"
              style={{
                background: 'linear-gradient(135deg, rgba(148,163,184,0.08) 0%, rgba(100,116,139,0.03) 100%)',
                border: '1px solid rgba(148,163,184,0.15)',
              }}
            >
              <div
                className="w-14 h-14 flex items-center justify-center rounded-2xl flex-shrink-0"
                style={{
                  background: 'rgba(148,163,184,0.12)',
                  border: '1px solid rgba(148,163,184,0.2)',
                  boxShadow: '0 4px 20px rgba(148,163,184,0.08)',
                }}
              >
                <i className="ri-history-line text-2xl" style={{ color: '#94A3B8' }} />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold mb-0.5" style={{ color: '#94A3B8' }}>Kontrol Geçmişi</p>
                <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>Yapılan kontrolleri görüntüle</p>
              </div>
              <div
                className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: 'rgba(148,163,184,0.08)' }}
              >
                <i className="ri-arrow-right-s-line text-lg" style={{ color: '#94A3B8' }} />
              </div>
            </button>
          </div>
        </div>

        {/* ── Detay Bilgileri ── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-4 px-1 flex items-center gap-2" style={{ color: '#334155' }}>
            <span className="inline-block w-4 h-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.5)' }} />
            Ekipman Bilgileri
          </p>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {[
              { icon: 'ri-price-tag-3-line', label: 'Marka / Model', value: [localEkipman.marka, localEkipman.model].filter(Boolean).join(' / ') || null },
              { icon: 'ri-calendar-check-line', label: 'Son Kontrol', value: localEkipman.sonKontrolTarihi ? new Date(localEkipman.sonKontrolTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : null },
              {
                icon: 'ri-calendar-2-line', label: 'Sonraki Kontrol',
                value: localEkipman.sonrakiKontrolTarihi ? new Date(localEkipman.sonrakiKontrolTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : null,
                valueColor: isOverdue ? '#EF4444' : isUrgent ? '#F59E0B' : undefined,
              },
              ...(localEkipman.aciklama ? [{ icon: 'ri-file-text-line', label: 'Açıklama', value: localEkipman.aciklama }] : []),
            ].map((row, i, arr) => row.value ? (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderBottom: i < arr.filter(r => r.value).length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              >
                <div
                  className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <i className={`${row.icon} text-sm`} style={{ color: '#475569' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs mb-0.5" style={{ color: '#334155' }}>{row.label}</p>
                  <p className="text-sm font-semibold break-words" style={{ color: row.valueColor || '#CBD5E1' }}>{row.value}</p>
                </div>
              </div>
            ) : null)}
          </div>
        </div>

        {/* ── Saha Fotoğrafları ── */}
        {sahaFotolar.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4 px-1">
              <p className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: '#334155' }}>
                <span className="inline-block w-4 h-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.5)' }} />
                Saha Fotoğrafları
              </p>
              <span
                className="text-xs px-2.5 py-1 rounded-full font-bold"
                style={{ background: 'rgba(251,191,36,0.1)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.2)' }}
              >
                {sahaFotolar.length}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              {[...sahaFotolar].reverse().slice(0, 4).map((foto) => {
                const displayUrl = signedFotoUrls[foto.url] || foto.url;
                return (
                  <button
                    key={foto.id}
                    onClick={() => setLightboxUrl(displayUrl)}
                    className="relative rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all"
                    style={{ aspectRatio: '1/1', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <img
                      src={displayUrl}
                      alt={foto.aciklama || 'Saha fotoğrafı'}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 flex items-end p-2.5" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)' }}>
                      <p className="text-xs text-white leading-tight line-clamp-2 font-medium">
                        {foto.aciklama || new Date(foto.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                    <div
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-lg"
                      style={{ background: 'rgba(0,0,0,0.5)' }}
                    >
                      <i className="ri-zoom-in-line text-xs text-white" />
                    </div>
                  </button>
                );
              })}
            </div>

            {sahaFotolar.length > 4 && (
              <div className="space-y-2">
                {[...sahaFotolar].reverse().slice(4).map((foto) => {
                  const displayUrl = signedFotoUrls[foto.url] || foto.url;
                  return (
                    <button
                      key={foto.id}
                      onClick={() => setLightboxUrl(displayUrl)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer transition-all active:scale-95 text-left"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <img src={displayUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {foto.aciklama && <p className="text-sm font-medium truncate mb-1" style={{ color: '#CBD5E1' }}>{foto.aciklama}</p>}
                        <div className="flex items-center gap-3 flex-wrap">
                          {foto.yukleyenKisi && (
                            <span className="text-xs flex items-center gap-1" style={{ color: '#475569' }}>
                              <i className="ri-user-line text-xs" />{foto.yukleyenKisi}
                            </span>
                          )}
                          <span className="text-xs flex items-center gap-1" style={{ color: '#475569' }}>
                            <i className="ri-time-line text-xs" />
                            {new Date(foto.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <i className="ri-zoom-in-line text-sm flex-shrink-0" style={{ color: '#334155' }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Belgeler ── */}
        {(hasBelge || ekipmanEvraklari.length > 0) && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-4 px-1 flex items-center gap-2" style={{ color: '#334155' }}>
              <span className="inline-block w-4 h-0.5 rounded-full" style={{ background: 'rgba(96,165,250,0.5)' }} />
              Belgeler
            </p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {hasBelge && (
                <button
                  onClick={handleOpenBelge}
                  className="w-full flex items-center gap-3 px-4 py-4 cursor-pointer transition-all text-left"
                  style={{ borderBottom: ekipmanEvraklari.length > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div
                    className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.18)' }}
                  >
                    <i className="ri-file-check-line text-base" style={{ color: '#34D399' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#CBD5E1' }}>{localEkipman.dosyaAdi || 'Ekipman Belgesi'}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Görüntüle / İndir</p>
                  </div>
                  <i className="ri-eye-line text-sm flex-shrink-0" style={{ color: '#34D399' }} />
                </button>
              )}
              {ekipmanEvraklari.map((evrak, idx) => (
                <div
                  key={evrak.id}
                  className="flex items-center gap-3 px-4 py-4"
                  style={{ borderBottom: idx < ekipmanEvraklari.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                >
                  <div
                    className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)' }}
                  >
                    <i className="ri-file-text-line text-base" style={{ color: '#94A3B8' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#CBD5E1' }}>{evrak.ad}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
                      {evrak.tur || 'Evrak'}
                      {evrak.gecerlilikTarihi && ` — ${new Date(evrak.gecerlilikTarihi).toLocaleDateString('tr-TR')} tarihine kadar`}
                    </p>
                  </div>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 font-semibold"
                    style={{
                      background: evrak.durum === 'Yüklü' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                      color: evrak.durum === 'Yüklü' ? '#34D399' : '#F87171',
                      border: `1px solid ${evrak.durum === 'Yüklü' ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
                    }}
                  >
                    {evrak.durum}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div
          className="flex items-center justify-between pt-2 pb-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 flex items-center justify-center rounded-lg"
              style={{ background: 'rgba(52,211,153,0.08)' }}
            >
              <i className="ri-shield-check-line text-xs" style={{ color: '#34D399' }} />
            </div>
            <span className="text-xs font-medium" style={{ color: '#334155' }}>{org?.name || 'ISG Denetim'}</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-xs cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all"
            style={{ color: '#475569', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <i className="ri-home-line" />
            <span>Ana Sayfa</span>
          </button>
        </div>
      </div>

      {/* Modaller */}
      <KontrolModal
        open={showKontrol}
        onClose={() => setShowKontrol(false)}
        ekipmanAd={localEkipman.ad}
        ekipmanId={localEkipman.id}
        onSaved={handleAfterSave}
      />
      <UygunsuzlukModal
        open={showUygunsuzluk}
        onClose={() => setShowUygunsuzluk(false)}
        ekipmanAd={localEkipman.ad}
        firmaId={localEkipman.firmaId}
      />
      <FotoModal
        open={showFoto}
        onClose={() => setShowFoto(false)}
        ekipmanAd={localEkipman.ad}
        ekipmanId={localEkipman.id}
        onUploaded={handleAfterSave}
      />

      <KontrolGecmisiModal
        open={showGecmis}
        onClose={() => setShowGecmis(false)}
        ekipmanId={localEkipman.id}
        ekipmanAd={localEkipman.ad}
      />

      {lightboxUrl && (
        <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

      {showBelge && belgeUrl && (
        <EvrakModal
          open={showBelge}
          onClose={() => setShowBelge(false)}
          dosyaVeri={belgeUrl}
          dosyaAdi={belgeAdi}
          dosyaTipi={belgeTipi}
        />
      )}
    </div>
  );
}
