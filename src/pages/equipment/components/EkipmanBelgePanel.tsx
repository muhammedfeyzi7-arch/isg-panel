import { useState, useRef } from 'react';
import type { EkipmanBelge } from '@/types';
import { uploadFileToStorage, validateFile, getSignedUrlFromPath } from '@/utils/fileUpload';

interface Props {
  ekipmanId: string;
  orgId: string;
  belgeler: EkipmanBelge[];
  onBelgeEkle: (belge: Omit<EkipmanBelge, 'id' | 'arsiv'>) => void;
  yukleyenKisi: string;
  canEdit: boolean;
}

function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function GecerlilikBadge({ tarih }: { tarih: string }) {
  const days = getDaysUntil(tarih);
  if (days < 0) {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
        <i className="ri-error-warning-line mr-0.5" />
        {Math.abs(days)} gün geçti
      </span>
    );
  }
  if (days <= 30) {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>
        <i className="ri-alarm-warning-line mr-0.5" />
        {days} gün kaldı
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}>
      <i className="ri-checkbox-circle-line mr-0.5" />
      {days} gün kaldı
    </span>
  );
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return { icon: 'ri-file-pdf-line', color: '#EF4444' };
  if (['doc', 'docx'].includes(ext)) return { icon: 'ri-file-word-line', color: '#60A5FA' };
  if (['xls', 'xlsx'].includes(ext)) return { icon: 'ri-file-excel-line', color: '#34D399' };
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { icon: 'ri-image-line', color: '#FBBF24' };
  return { icon: 'ri-file-line', color: '#94A3B8' };
}

export default function EkipmanBelgePanel({ ekipmanId, orgId, belgeler, onBelgeEkle, yukleyenKisi, canEdit }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [showArsiv, setShowArsiv] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [form, setForm] = useState({ ad: '', gecerlilikTarihi: '' });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const aktifBelgeler = belgeler.filter(b => !b.arsiv);
  const arsivBelgeler = belgeler.filter(b => b.arsiv);

  const handleFileChange = (file?: File) => {
    if (!file) return;
    const err = validateFile(file, 20);
    if (err) { alert(err); return; }
    setPendingFile(file);
  };

  const handleKaydet = async () => {
    if (!pendingFile) return;
    if (!form.gecerlilikTarihi) { alert('Geçerlilik tarihi zorunludur.'); return; }
    setUploading(true);
    try {
      const url = await uploadFileToStorage(pendingFile, orgId, 'ekipman-belge', `${ekipmanId}-${Date.now()}`);
      if (!url) { alert('Dosya yüklenemedi.'); return; }
      onBelgeEkle({
        ad: form.ad || pendingFile.name,
        dosyaAdi: pendingFile.name,
        dosyaBoyutu: pendingFile.size,
        dosyaTipi: pendingFile.type,
        dosyaUrl: url,
        gecerlilikTarihi: form.gecerlilikTarihi,
        yuklemeTarihi: new Date().toISOString(),
        yukleyenKisi,
      });
      setForm({ ad: '', gecerlilikTarihi: '' });
      setPendingFile(null);
      setShowForm(false);
    } finally {
      setUploading(false);
    }
  };

  const handleGoruntule = async (belge: EkipmanBelge) => {
    setOpeningId(belge.id);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write('<html><body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p style="font-size:16px">Belge yükleniyor...</p></body></html>');
    }
    try {
      const url = await getSignedUrlFromPath(belge.dosyaUrl);
      if (url) {
        if (win && !win.closed) win.location.href = url;
        else window.open(url, '_blank');
      } else {
        if (win && !win.closed) win.close();
      }
    } finally {
      setOpeningId(null);
    }
  };

  const BelgeKart = ({ belge, isArsiv }: { belge: EkipmanBelge; isArsiv: boolean }) => {
    const { icon, color } = getFileIcon(belge.dosyaAdi);
    const isOpening = openingId === belge.id;
    return (
      <div className="flex items-start gap-3 px-3 py-3 rounded-xl"
        style={{
          background: isArsiv ? 'rgba(255,255,255,0.02)' : 'rgba(52,211,153,0.04)',
          border: `1px solid ${isArsiv ? 'rgba(255,255,255,0.06)' : 'rgba(52,211,153,0.15)'}`,
          opacity: isArsiv ? 0.7 : 1,
        }}>
        <div className="w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: `${color}18` }}>
          <i className={`${icon} text-sm`} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {belge.ad || belge.dosyaAdi}
            </p>
            {isArsiv ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: 'rgba(100,116,139,0.15)', color: '#64748B' }}>
                Arşiv
              </span>
            ) : (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}>
                Aktif
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] flex items-center gap-1" style={{ color: '#64748B' }}>
              <i className="ri-calendar-line" />
              Geçerlilik: {new Date(belge.gecerlilikTarihi).toLocaleDateString('tr-TR')}
            </span>
            {!isArsiv && <GecerlilikBadge tarih={belge.gecerlilikTarihi} />}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px]" style={{ color: '#475569' }}>
              <i className="ri-user-line mr-0.5" />{belge.yukleyenKisi}
            </span>
            <span className="text-[10px]" style={{ color: '#334155' }}>
              {new Date(belge.yuklemeTarihi).toLocaleDateString('tr-TR')}
            </span>
          </div>
        </div>
        <button
          onClick={() => void handleGoruntule(belge)}
          disabled={isOpening}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}
          title="Görüntüle">
          {isOpening
            ? <i className="ri-loader-4-line animate-spin text-xs" />
            : <i className="ri-eye-line text-xs" />}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Aktif belgeler */}
      {aktifBelgeler.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
          <div className="w-11 h-11 flex items-center justify-center rounded-xl mb-2"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <i className="ri-file-add-line text-lg" style={{ color: '#818CF8' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: '#64748B' }}>Aktif belge yok</p>
          <p className="text-xs mt-0.5" style={{ color: '#334155' }}>Belge ekleyerek takip başlatın</p>
        </div>
      ) : (
        <div className="space-y-2">
          {aktifBelgeler.map(b => <BelgeKart key={b.id} belge={b} isArsiv={false} />)}
        </div>
      )}

      {/* Yeni belge ekle butonu */}
      {canEdit && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl cursor-pointer text-sm font-semibold transition-all"
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.3)', color: '#818CF8' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.14)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; }}>
          <i className="ri-add-line" />
          {aktifBelgeler.length > 0 ? 'Yeni Belge Yükle (Eskisi Arşive Alınır)' : 'Belge Ekle'}
        </button>
      )}

      {/* Yeni belge formu */}
      {showForm && canEdit && (
        <div className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <p className="text-xs font-bold" style={{ color: '#818CF8' }}>
            <i className="ri-file-add-line mr-1.5" />Yeni Belge Ekle
          </p>

          {/* Belge adı */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#94A3B8' }}>
              Belge Adı / Türü
            </label>
            <input
              value={form.ad}
              onChange={e => setForm(p => ({ ...p, ad: e.target.value }))}
              placeholder="Kalibrasyon Sertifikası, Periyodik Bakım Raporu..."
              className="isg-input text-sm"
            />
          </div>

          {/* Geçerlilik tarihi */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#94A3B8' }}>
              Geçerlilik Tarihi <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="date"
              value={form.gecerlilikTarihi}
              onChange={e => setForm(p => ({ ...p, gecerlilikTarihi: e.target.value }))}
              className="isg-input text-sm"
            />
          </div>

          {/* Dosya seç */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#94A3B8' }}>
              Dosya <span style={{ color: '#EF4444' }}>*</span>
            </label>
            {pendingFile ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                <i className="ri-file-check-line text-sm" style={{ color: '#34D399' }} />
                <span className="text-xs flex-1 truncate" style={{ color: '#34D399' }}>{pendingFile.name}</span>
                <button onClick={() => setPendingFile(null)} className="cursor-pointer" style={{ color: '#EF4444' }}>
                  <i className="ri-close-line text-xs" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 rounded-xl cursor-pointer text-sm"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', color: '#475569' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}>
                <i className="ri-upload-cloud-2-line" />
                Dosya Seç (PDF, JPG, PNG)
              </div>
            )}
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              className="hidden" onChange={e => handleFileChange(e.target.files?.[0])} />
          </div>

          {/* Butonlar */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setShowForm(false); setPendingFile(null); setForm({ ad: '', gecerlilikTarihi: '' }); }}
              disabled={uploading}
              className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              style={{ background: 'rgba(100,116,139,0.1)', color: '#64748B' }}>
              İptal
            </button>
            <button
              onClick={() => void handleKaydet()}
              disabled={uploading || !pendingFile || !form.gecerlilikTarihi}
              className="flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap disabled:opacity-40"
              style={{ background: 'rgba(99,102,241,0.2)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)' }}>
              {uploading
                ? <><i className="ri-loader-4-line animate-spin mr-1" />Yükleniyor...</>
                : <><i className="ri-save-line mr-1" />Kaydet</>}
            </button>
          </div>
        </div>
      )}

      {/* Arşiv */}
      {arsivBelgeler.length > 0 && (
        <div>
          <button
            onClick={() => setShowArsiv(p => !p)}
            className="flex items-center gap-2 text-xs font-semibold cursor-pointer py-1 whitespace-nowrap"
            style={{ color: '#475569' }}>
            <i className={`ri-archive-line`} />
            Arşiv ({arsivBelgeler.length} belge)
            {showArsiv ? <i className="ri-arrow-up-s-line ml-auto" /> : <i className="ri-arrow-down-s-line ml-auto" />}
          </button>
          {showArsiv && (
            <div className="space-y-2 mt-2">
              {arsivBelgeler.map(b => <BelgeKart key={b.id} belge={b} isArsiv />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
