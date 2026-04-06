import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../lib/supabase';
import { uploadBase64ToStorage, getSignedUrlFromPath } from '../../utils/fileUpload';
import { useSignedUrls } from '../../hooks/useSignedUrl';
import Modal from '../../components/base/Modal';
import ImageUpload from '../nonconformity/components/ImageUpload';
import type { Ekipman, EkipmanStatus, EkipmanSahaFoto, UygunsuzlukSeverity } from '../../types';

interface KontrolKayit {
  tarih: string;
  yapanKisi: string;
  durum: EkipmanStatus;
  notlar?: string;
}

const STATUS_CONFIG: Record<EkipmanStatus, {
  label: string; color: string; bg: string; border: string; icon: string;
  lightBg: string; lightBorder: string;
}> = {
  'Uygun': {
    label: 'Uygun', color: '#059669', bg: 'rgba(5,150,105,0.1)', border: 'rgba(5,150,105,0.25)',
    icon: 'ri-checkbox-circle-fill',
    lightBg: '#ECFDF5', lightBorder: '#A7F3D0',
  },
  'Uygun Değil': {
    label: 'Uygun Değil', color: '#DC2626', bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.25)',
    icon: 'ri-close-circle-fill',
    lightBg: '#FEF2F2', lightBorder: '#FECACA',
  },
  'Bakımda': {
    label: 'Bakımda', color: '#D97706', bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.25)',
    icon: 'ri-tools-fill',
    lightBg: '#FFFBEB', lightBorder: '#FDE68A',
  },
  'Hurda': {
    label: 'Hurda', color: '#64748B', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)',
    icon: 'ri-delete-bin-fill',
    lightBg: '#F8FAFC', lightBorder: '#CBD5E1',
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
  const submittingRef = useRef(false);

  const handleSave = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const yapanKisi = currentUser.ad || 'Kullanıcı';
      const notlarVal = notlar.trim() ? `[${today} - ${yapanKisi}] ${notlar.trim()}` : '';

      let mevcutGecmis: KontrolKayit[] = [];
      try {
        const { data: freshData } = await supabase
          .from('ekipmanlar').select('data').eq('id', ekipmanId).maybeSingle();
        if (freshData?.data) {
          mevcutGecmis = (freshData.data as unknown as { kontrolGecmisi?: KontrolKayit[] }).kontrolGecmisi ?? [];
        }
      } catch { mevcutGecmis = []; }

      const yeniKayit: KontrolKayit = {
        tarih: new Date().toISOString(), yapanKisi, durum, notlar: notlar.trim() || undefined,
      };
      const yeniGecmis = [yeniKayit, ...mevcutGecmis].slice(0, 50);

      updateEkipman(ekipmanId, {
        durum, sonKontrolTarihi: today,
        ...(sonrakiTarih ? { sonrakiKontrolTarihi: sonrakiTarih } : {}),
        notlar: notlarVal, kontrolGecmisi: yeniGecmis,
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
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-all whitespace-nowrap" style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>İptal</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-all whitespace-nowrap" style={{ background: '#059669', color: '#fff' }}>
            <i className="ri-save-line mr-1" />{saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="px-3 py-2 rounded-lg" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <p className="text-xs" style={{ color: '#64748B' }}>Ekipman</p>
          <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{ekipmanAd}</p>
        </div>
        <div>
          <label className="text-xs font-semibold block mb-2" style={{ color: '#374151' }}>Kontrol Sonucu *</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(STATUS_CONFIG) as EkipmanStatus[]).map(s => {
              const sc = STATUS_CONFIG[s];
              const selected = durum === s;
              return (
                <button key={s} type="button" onClick={() => setDurum(s)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all whitespace-nowrap"
                  style={{
                    background: selected ? sc.lightBg : '#F8FAFC',
                    color: selected ? sc.color : '#64748B',
                    border: `1px solid ${selected ? sc.lightBorder : '#E2E8F0'}`,
                  }}
                >
                  <i className={sc.icon} />{sc.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold block mb-2" style={{ color: '#374151' }}>Sonraki Kontrol Tarihi</label>
          <input type="date" value={sonrakiTarih} onChange={e => setSonrakiTarih(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-emerald-500/20" style={{ background: '#fff', borderColor: '#E2E8F0', color: '#0F172A' }} />
        </div>
        <div>
          <label className="text-xs font-semibold block mb-2" style={{ color: '#374151' }}>Notlar</label>
          <textarea value={notlar} onChange={e => setNotlar(e.target.value)} rows={3} maxLength={500} placeholder="Kontrol notları..." className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none" style={{ background: '#fff', borderColor: '#E2E8F0', color: '#0F172A' }} />
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
    supabase.from('ekipmanlar').select('data').eq('id', ekipmanId).maybeSingle()
      .then(({ data }) => {
        if (data?.data) {
          const kayitlar: KontrolKayit[] = (data.data as unknown as { kontrolGecmisi?: KontrolKayit[] }).kontrolGecmisi ?? [];
          setGecmis(kayitlar.slice(0, 10));
        } else { setGecmis([]); }
      }).finally(() => setLoading(false));
  }, [open, ekipmanId]);

  const durumRenk: Record<EkipmanStatus, { color: string; bg: string; border: string; icon: string }> = {
    'Uygun':       { color: '#059669', bg: '#ECFDF5',   border: '#A7F3D0',   icon: 'ri-checkbox-circle-fill' },
    'Uygun Değil': { color: '#DC2626', bg: '#FEF2F2',   border: '#FECACA',   icon: 'ri-close-circle-fill' },
    'Bakımda':     { color: '#D97706', bg: '#FFFBEB',   border: '#FDE68A',   icon: 'ri-tools-fill' },
    'Hurda':       { color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', icon: 'ri-delete-bin-fill' },
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Kontrol Geçmişi" size="sm" icon="ri-history-line"
      footer={<button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-all whitespace-nowrap w-full" style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>Kapat</button>}
    >
      <div>
        <div className="px-3 py-2 rounded-xl mb-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <p className="text-xs" style={{ color: '#64748B' }}>Ekipman</p>
          <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{ekipmanAd}</p>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#A7F3D0', borderTopColor: '#059669' }} />
            <p className="text-xs" style={{ color: '#94A3B8' }}>Yükleniyor...</p>
          </div>
        ) : gecmis.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-12 h-12 flex items-center justify-center rounded-2xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <i className="ri-history-line text-xl" style={{ color: '#94A3B8' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: '#64748B' }}>Henüz kontrol yapılmamış</p>
          </div>
        ) : (
          <div className="space-y-2">
            {gecmis.map((kayit, idx) => {
              const dr = durumRenk[kayit.durum] ?? durumRenk['Uygun'];
              const tarihObj = new Date(kayit.tarih);
              const tarihStr = tarihObj.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
              const saatStr = tarihObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={idx} className="flex items-start gap-3 px-3 py-3 rounded-xl"
                  style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5"
                    style={{ background: dr.bg, border: `1px solid ${dr.border}` }}>
                    <i className={`${dr.icon} text-sm`} style={{ color: dr.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-lg whitespace-nowrap"
                        style={{ background: dr.bg, color: dr.color, border: `1px solid ${dr.border}` }}>
                        {kayit.durum}
                      </span>
                      {idx === 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-lg font-semibold whitespace-nowrap"
                          style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                          Son Kontrol
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold truncate" style={{ color: '#374151' }}>{kayit.yapanKisi}</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>{tarihStr} — {saatStr}</p>
                    {kayit.notlar && (
                      <p className="text-xs mt-1.5 px-2 py-1.5 rounded-lg leading-relaxed"
                        style={{ background: '#F1F5F9', color: '#64748B' }}>
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
  const submittingRef = useRef(false);
  const firma = firmalar.find(f => f.id === firmaId);

  const handleSave = async () => {
    if (!baslik.trim()) { addToast('Başlık zorunludur.', 'error'); return; }
    if (!firmaId) { addToast('Firma bilgisi eksik.', 'error'); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      let acilisFotoUrl: string | undefined;
      let acilisFotoMevcut = false;
      if (foto) {
        if (!foto.startsWith('data:')) { acilisFotoUrl = foto; acilisFotoMevcut = true; }
      }
      const rec = await addUygunsuzluk({
        baslik: baslik.trim(), aciklama: aciklama.trim(), onlem: '', firmaId,
        tarih: new Date().toISOString().slice(0, 10), severity, sorumlu: '', hedefTarih: '',
        notlar: `QR ile bildirildi — Ekipman: ${ekipmanAd}`, durum: 'Açık',
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
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-all whitespace-nowrap" style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>İptal</button>
          <button onClick={handleSave} disabled={saving}
            className="whitespace-nowrap px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-all"
            style={{ background: '#EF4444', color: '#fff' }}>
            <i className="ri-send-plane-line mr-1" />{saving ? 'Gönderiliyor...' : 'Bildir'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <p className="text-xs" style={{ color: '#EF4444' }}>Ekipman</p>
          <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{ekipmanAd}</p>
          {firma && <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{firma.ad}</p>}
        </div>
        <div>
          <label className="text-xs font-semibold block mb-2" style={{ color: '#374151' }}>Başlık *</label>
          <input value={baslik} onChange={e => setBaslik(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-red-500/20" style={{ background: '#fff', borderColor: '#E2E8F0', color: '#0F172A' }} />
        </div>
        <div>
          <label className="text-xs font-semibold block mb-2" style={{ color: '#374151' }}>Önem Derecesi</label>
          <div className="flex gap-2 flex-wrap">
            {SEV_OPTIONS.map(s => {
              const colors: Record<UygunsuzlukSeverity, string> = { 'Düşük': '#059669', 'Orta': '#D97706', 'Yüksek': '#EA580C', 'Kritik': '#DC2626' };
              const selected = severity === s;
              return (
                <button key={s} type="button" onClick={() => setSeverity(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                  style={{
                    background: selected ? `${colors[s]}20` : '#F8FAFC',
                    color: selected ? colors[s] : '#64748B',
                    border: `1px solid ${selected ? colors[s] + '50' : '#E2E8F0'}`,
                  }}>{s}</button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold block mb-2" style={{ color: '#374151' }}>Açıklama</label>
          <textarea value={aciklama} onChange={e => setAciklama(e.target.value)} rows={3} maxLength={500} placeholder="Uygunsuzluğun detayları..." className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-red-500/20 resize-none" style={{ background: '#fff', borderColor: '#E2E8F0', color: '#0F172A' }} />
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
  const submittingRef = useRef(false);
  const ekipman = ekipmanlar.find(e => e.id === ekipmanId);

  const handleClose = () => { setFoto(null); setAciklama(''); onClose(); };

  const handleSave = async () => {
    if (!foto) { addToast('Fotoğraf seçiniz.', 'error'); return; }
    if (!foto.startsWith('data:')) { addToast('Geçersiz fotoğraf formatı.', 'error'); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const fotoId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
      const orgId = org?.id ?? 'unknown';
      const filePath = await uploadBase64ToStorage(foto, orgId, `ekipman-saha/${ekipmanId}`, fotoId);
      if (!filePath) { addToast('Fotoğraf yüklenemedi.', 'error'); return; }
      const yeniFoto: EkipmanSahaFoto = {
        id: fotoId, url: filePath, aciklama: aciklama.trim(),
        tarih: new Date().toISOString(), yukleyenKisi: currentUser.ad || 'Kullanıcı',
      };
      let mevcutFotolar: EkipmanSahaFoto[] = [];
      try {
        const { data: freshData } = await supabase.from('ekipmanlar').select('data').eq('id', ekipmanId).maybeSingle();
        if (freshData?.data) mevcutFotolar = (freshData.data as unknown as { sahaFotolari?: EkipmanSahaFoto[] }).sahaFotolari ?? [];
      } catch { mevcutFotolar = ekipman?.sahaFotolari ?? []; }
      updateEkipman(ekipmanId, { sahaFotolari: [...mevcutFotolar, yeniFoto] });
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
          <button onClick={handleClose} className="px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-all whitespace-nowrap" style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>İptal</button>
          <button onClick={handleSave} disabled={saving || !foto} className="px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-all whitespace-nowrap disabled:opacity-50" style={{ background: '#059669', color: '#fff' }}>
            {saving ? <><i className="ri-loader-4-line animate-spin mr-1" />Yükleniyor...</> : <><i className="ri-upload-cloud-line mr-1" />Yükle</>}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="px-3 py-2 rounded-lg" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <p className="text-xs" style={{ color: '#64748B' }}>Ekipman</p>
          <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{ekipmanAd}</p>
        </div>
        <ImageUpload label="Saha Fotoğrafı *" value={foto} onChange={setFoto} />
        <div>
          <label className="text-xs font-semibold block mb-2" style={{ color: '#374151' }}>Açıklama <span style={{ color: '#94A3B8', fontSize: '11px' }}>(İsteğe bağlı)</span></label>
          <textarea value={aciklama} onChange={e => setAciklama(e.target.value)} rows={2} maxLength={300} placeholder="Fotoğraf hakkında not..." className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none" style={{ background: '#fff', borderColor: '#E2E8F0', color: '#0F172A' }} />
        </div>
      </div>
    </Modal>
  );
}

// ── Evrak Modal ──
function EvrakModal({
  open, onClose, dosyaVeri, dosyaAdi, dosyaTipi,
}: { open: boolean; onClose: () => void; dosyaVeri: string; dosyaAdi: string; dosyaTipi: string }) {
  const isImage = dosyaTipi?.startsWith('image/');
  const isPdf = dosyaTipi === 'application/pdf';
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = dosyaVeri; link.download = dosyaAdi || 'ekipman-belgesi';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };
  return (
    <Modal isOpen={open} onClose={onClose} title={dosyaAdi || 'Belge'} size="lg" icon="ri-file-text-line"
      footer={<><button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-all whitespace-nowrap" style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>Kapat</button><button onClick={handleDownload} className="px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-all whitespace-nowrap" style={{ background: '#059669', color: '#fff' }}><i className="ri-download-2-line mr-1" />İndir</button></>}
    >
      <div className="flex flex-col items-center gap-4">
        {isImage && <img src={dosyaVeri} alt={dosyaAdi} className="max-w-full rounded-xl object-contain" style={{ maxHeight: '60vh' }} />}
        {isPdf && <iframe src={dosyaVeri} title={dosyaAdi} className="w-full rounded-xl" style={{ height: '60vh', border: 'none' }} />}
        {!isImage && !isPdf && (
          <div className="text-center py-8">
            <div className="w-16 h-16 flex items-center justify-center rounded-2xl mx-auto mb-4" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
              <i className="ri-file-line text-3xl" style={{ color: '#059669' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{dosyaAdi}</p>
            <p className="text-xs mt-1" style={{ color: '#64748B' }}>Bu dosya türü önizlenemiyor.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Lightbox ──
function PhotoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.95)' }} onClick={onClose}>
      <button className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full cursor-pointer"
        style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }} onClick={onClose}>
        <i className="ri-close-line text-xl" />
      </button>
      <img src={url} alt="Saha fotoğrafı" className="max-w-full max-h-full rounded-2xl object-contain" onClick={e => e.stopPropagation()} />
    </div>
  );
}

// ── Ana Sayfa ──
export default function QrDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ekipmanlar, firmalar, org, dataLoading, evraklar } = useApp();

  const handleGoBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
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
      const { data, error } = await supabase.from('ekipmanlar').select('data').eq('id', id).maybeSingle();
      if (error) {
        setLocalEkipman(ekipmanlar.find(e => e.id === id && !e.silinmis) ?? null);
      } else if (data?.data) {
        setLocalEkipman(data.data as Ekipman);
      } else {
        setLocalEkipman(ekipmanlar.find(e => e.id === id && !e.silinmis) ?? null);
      }
    } catch {
      setLocalEkipman(ekipmanlar.find(e => e.id === id && !e.silinmis) ?? null);
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
    if (fromStore) { setLocalEkipman(fromStore); setLocalLoading(false); }
  }, [dataLoading, ekipmanlar, id, localEkipman]);

  useEffect(() => {
    if (!id || localEkipman === undefined) return;
    const fromStore = ekipmanlar.find(e => e.id === id && !e.silinmis);
    if (fromStore) setLocalEkipman(fromStore);
  }, [ekipmanlar, id]);

  const handleAfterSave = useCallback(() => { fetchEkipmanFromDb(); }, [fetchEkipmanFromDb]);

  const ekipmanEvraklari = evraklar.filter(
    e => !e.silinmis && e.firmaId === localEkipman?.firmaId &&
      e.ad?.toLowerCase().includes(localEkipman?.ad?.toLowerCase() ?? '')
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
      setBelgeUrl(url); setBelgeAdi(localEkipman.dosyaAdi || 'Ekipman Belgesi');
      setBelgeTipi(mimeMap[ext] || 'application/octet-stream'); setShowBelge(true);
    } catch { /* ignore */ }
  };

  const firma = firmalar.find(f => f.id === localEkipman?.firmaId);

  // ── Loading ──
  if (localLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#F8FAFC' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
          <i className="ri-qr-code-line text-3xl" style={{ color: '#059669' }} />
        </div>
        <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin mb-3"
          style={{ borderColor: '#A7F3D0', borderTopColor: '#059669' }} />
        <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>Ekipman yükleniyor...</p>
      </div>
    );
  }

  // ── Bulunamadı ──
  if (!localEkipman || localEkipman.silinmis) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F8FAFC' }}>
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            <i className="ri-error-warning-line text-4xl" style={{ color: '#DC2626' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#0F172A' }}>Ekipman Bulunamadı</h2>
          <p className="text-sm mb-6" style={{ color: '#64748B' }}>Bu QR koda ait ekipman kaydı mevcut değil veya silinmiş.</p>
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
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>

      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(255,255,255,0.95)', borderBottom: '1px solid #E2E8F0', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <button onClick={handleGoBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer transition-all active:scale-90"
          style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
          <i className="ri-arrow-left-s-line text-lg" />
          <span className="text-xs font-semibold">Geri</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
            <i className="ri-qr-code-line text-xs" style={{ color: '#059669' }} />
          </div>
          <span className="text-sm font-bold" style={{ color: '#0F172A' }}>Saha Modu</span>
        </div>

        <div className="w-16" />
      </div>

      <div className="px-4 pt-4 pb-10 max-w-lg mx-auto space-y-3">

        {/* ── Ekipman Kimlik Kartı ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
          {/* Renkli üst şerit */}
          <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${sc.color}, ${sc.color}88)` }} />

          <div className="p-4">
            {/* Durum + seri no */}
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: sc.lightBg, color: sc.color, border: `1px solid ${sc.lightBorder}` }}>
                <i className={`${sc.icon} text-xs`} />
                {sc.label}
              </span>
              {localEkipman.seriNo && (
                <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg"
                  style={{ background: '#F8FAFC', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
                  S/N: {localEkipman.seriNo}
                </span>
              )}
            </div>

            {/* İkon + ad */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: sc.lightBg, border: `1px solid ${sc.lightBorder}` }}>
                <i className="ri-tools-line text-2xl" style={{ color: sc.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-extrabold leading-tight tracking-tight" style={{ color: '#0F172A' }}>
                  {localEkipman.ad}
                </h1>
                {firma && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <i className="ri-building-2-line text-xs" style={{ color: '#94A3B8' }} />
                    <span className="text-xs font-medium" style={{ color: '#64748B' }}>{firma.ad}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Chip'ler */}
            {(localEkipman.tur || localEkipman.bulunduguAlan || localEkipman.marka) && (
              <div className="flex flex-wrap gap-1.5">
                {localEkipman.tur && (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                    <i className="ri-settings-3-line text-xs" />{localEkipman.tur}
                  </span>
                )}
                {localEkipman.bulunduguAlan && (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                    <i className="ri-map-pin-2-line text-xs" />{localEkipman.bulunduguAlan}
                  </span>
                )}
                {localEkipman.marka && (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                    <i className="ri-price-tag-3-line text-xs" />{localEkipman.marka}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Kontrol Uyarısı ── */}
        {(isOverdue || isUrgent) && (
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{
              background: isOverdue ? '#FEF2F2' : '#FFFBEB',
              border: `1px solid ${isOverdue ? '#FECACA' : '#FDE68A'}`,
            }}>
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: isOverdue ? '#FEE2E2' : '#FEF3C7' }}>
              <i className={`${isOverdue ? 'ri-alarm-warning-fill' : 'ri-time-fill'} text-base`}
                style={{ color: isOverdue ? '#DC2626' : '#D97706' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: isOverdue ? '#DC2626' : '#D97706' }}>
                {isOverdue ? `Kontrol ${Math.abs(days)} gün gecikmiş!` : `Kontrol ${days} gün sonra`}
              </p>
              <p className="text-xs mt-0.5" style={{ color: isOverdue ? '#EF4444' : '#F59E0B' }}>
                {isOverdue ? 'Lütfen en kısa sürede kontrol yapın' : 'Yaklaşan kontrol tarihi'}
              </p>
            </div>
          </div>
        )}

        {/* ── Hızlı Aksiyonlar ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
          <div className="px-4 pt-3.5 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Hızlı İşlemler</p>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {/* Kontrol Yap */}
            <button onClick={() => setShowKontrol(true)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-all active:scale-95 text-center"
              style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#D1FAE5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#ECFDF5'; }}>
              <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: '#fff', border: '1px solid #A7F3D0' }}>
                <i className="ri-checkbox-circle-line text-xl" style={{ color: '#059669' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#059669' }}>Kontrol Yap</p>
                <p className="text-[10px] mt-0.5 leading-tight" style={{ color: '#6EE7B7' }}>Durumu güncelle</p>
              </div>
            </button>

            {/* Uygunsuzluk Bildir */}
            <button onClick={() => setShowUygunsuzluk(true)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-all active:scale-95 text-center"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; }}>
              <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: '#fff', border: '1px solid #FECACA' }}>
                <i className="ri-alert-line text-xl" style={{ color: '#DC2626' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#DC2626' }}>Uygunsuzluk</p>
                <p className="text-[10px] mt-0.5 leading-tight" style={{ color: '#FCA5A5' }}>Sorun bildir</p>
              </div>
            </button>

            {/* Fotoğraf Yükle */}
            <button onClick={() => setShowFoto(true)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-all active:scale-95 text-center"
              style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FEF3C7'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFBEB'; }}>
              <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: '#fff', border: '1px solid #FDE68A' }}>
                <i className="ri-camera-line text-xl" style={{ color: '#D97706' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#D97706' }}>Fotoğraf</p>
                <p className="text-[10px] mt-0.5 leading-tight" style={{ color: '#FCD34D' }}>Saha fotoğrafı</p>
              </div>
            </button>

            {/* Kontrol Geçmişi */}
            <button onClick={() => setShowGecmis(true)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-all active:scale-95 text-center"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; }}>
              <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
                <i className="ri-history-line text-xl" style={{ color: '#64748B' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#475569' }}>Geçmiş</p>
                <p className="text-[10px] mt-0.5 leading-tight" style={{ color: '#94A3B8' }}>Kontrol kayıtları</p>
              </div>
            </button>
          </div>
        </div>

        {/* ── Detay Bilgileri ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
          <div className="px-4 pt-3.5 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Ekipman Bilgileri</p>
          </div>
          <div className="px-2 pb-2 pt-1">
            {[
              { icon: 'ri-price-tag-3-line', label: 'Marka / Model', value: [localEkipman.marka, localEkipman.model].filter(Boolean).join(' / ') || null, color: '#64748B' },
              {
                icon: 'ri-calendar-check-line', label: 'Son Kontrol',
                value: localEkipman.sonKontrolTarihi ? new Date(localEkipman.sonKontrolTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : null,
                color: '#059669',
              },
              {
                icon: 'ri-calendar-2-line', label: 'Sonraki Kontrol',
                value: localEkipman.sonrakiKontrolTarihi ? new Date(localEkipman.sonrakiKontrolTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : null,
                color: isOverdue ? '#DC2626' : isUrgent ? '#D97706' : '#0F172A',
              },
              ...(localEkipman.aciklama ? [{ icon: 'ri-file-text-line', label: 'Açıklama', value: localEkipman.aciklama, color: '#64748B' }] : []),
            ].filter(r => r.value).map((row, i, arr) => (
              <div key={i} className="flex items-center gap-3 px-2 py-3 rounded-xl"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <i className={`${row.icon} text-sm`} style={{ color: '#94A3B8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color: '#94A3B8' }}>{row.label}</p>
                  <p className="text-sm font-semibold break-words" style={{ color: row.color }}>{row.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Saha Fotoğrafları ── */}
        {sahaFotolar.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
            <div className="px-4 pt-3.5 pb-1 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Saha Fotoğrafları</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>
                {sahaFotolar.length}
              </span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {[...sahaFotolar].reverse().slice(0, 4).map((foto) => {
                const displayUrl = signedFotoUrls[foto.url] || foto.url;
                return (
                  <button key={foto.id} onClick={() => setLightboxUrl(displayUrl)}
                    className="relative rounded-xl overflow-hidden cursor-pointer active:scale-95 transition-all"
                    style={{ aspectRatio: '1/1', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <img src={displayUrl} alt={foto.aciklama || 'Saha fotoğrafı'}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="absolute inset-0 flex items-end p-2"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 55%)' }}>
                      <p className="text-xs text-white leading-tight line-clamp-1 font-medium">
                        {foto.aciklama || new Date(foto.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Belgeler ── */}
        {(hasBelge || ekipmanEvraklari.length > 0) && (
          <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
            <div className="px-4 pt-3.5 pb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Belgeler</p>
            </div>
            <div className="px-2 pb-2 pt-1">
              {hasBelge && (
                <button onClick={handleOpenBelge}
                  className="w-full flex items-center gap-3 px-2 py-3 rounded-xl cursor-pointer transition-all text-left"
                  style={{ borderBottom: ekipmanEvraklari.length > 0 ? '1px solid #F1F5F9' : 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                    <i className="ri-file-check-line text-sm" style={{ color: '#059669' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{localEkipman.dosyaAdi || 'Ekipman Belgesi'}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Görüntüle / İndir</p>
                  </div>
                  <i className="ri-eye-line text-sm flex-shrink-0" style={{ color: '#059669' }} />
                </button>
              )}
              {ekipmanEvraklari.map((evrak, idx) => (
                <div key={evrak.id} className="flex items-center gap-3 px-2 py-3 rounded-xl"
                  style={{ borderBottom: idx < ekipmanEvraklari.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <i className="ri-file-text-line text-sm" style={{ color: '#94A3B8' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{evrak.ad}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                      {evrak.tur || 'Evrak'}
                      {evrak.gecerlilikTarihi && ` — ${new Date(evrak.gecerlilikTarihi).toLocaleDateString('tr-TR')} tarihine kadar`}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 font-semibold"
                    style={{
                      background: evrak.durum === 'Yüklü' ? '#ECFDF5' : '#FEF2F2',
                      color: evrak.durum === 'Yüklü' ? '#059669' : '#DC2626',
                      border: `1px solid ${evrak.durum === 'Yüklü' ? '#A7F3D0' : '#FECACA'}`,
                    }}>
                    {evrak.durum}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 flex items-center justify-center rounded-md" style={{ background: '#ECFDF5' }}>
              <i className="ri-shield-check-line text-xs" style={{ color: '#059669' }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: '#94A3B8' }}>{org?.name || 'ISG Denetim'}</span>
          </div>
          <button onClick={() => navigate('/')}
            className="text-xs cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap"
            style={{ color: '#64748B', background: '#fff', border: '1px solid #E2E8F0' }}>
            <i className="ri-home-line" />
            <span>Ana Sayfa</span>
          </button>
        </div>
      </div>

      {/* Modaller */}
      <KontrolModal open={showKontrol} onClose={() => setShowKontrol(false)}
        ekipmanAd={localEkipman.ad} ekipmanId={localEkipman.id} onSaved={handleAfterSave} />
      <UygunsuzlukModal open={showUygunsuzluk} onClose={() => setShowUygunsuzluk(false)}
        ekipmanAd={localEkipman.ad} firmaId={localEkipman.firmaId} />
      <FotoModal open={showFoto} onClose={() => setShowFoto(false)}
        ekipmanAd={localEkipman.ad} ekipmanId={localEkipman.id} onUploaded={handleAfterSave} />
      <KontrolGecmisiModal open={showGecmis} onClose={() => setShowGecmis(false)}
        ekipmanId={localEkipman.id} ekipmanAd={localEkipman.ad} />
      {lightboxUrl && <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
      {showBelge && belgeUrl && (
        <EvrakModal open={showBelge} onClose={() => setShowBelge(false)}
          dosyaVeri={belgeUrl} dosyaAdi={belgeAdi} dosyaTipi={belgeTipi} />
      )}
    </div>
  );
}
