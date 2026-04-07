import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/store/AppContext';
import type { IsIzni, IsIzniTip, IsIzniStatus } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import { generateIsIzniNo } from '@/store/useStore';
import Modal from '@/components/base/Modal';
import { generateIsIzniPdf } from './utils/isIzniPdfGenerator';
import { uploadFileToStorage, getSignedUrl } from '@/utils/fileUpload';
import { supabase } from '@/lib/supabase';

// ─── Tip renk/ikon config ───────────────────────────────────────────────────
const TIP_CONFIG: Record<IsIzniTip, { color: string; bg: string; icon: string }> = {
  'Sıcak Çalışma':      { color: '#F97316', bg: 'rgba(249,115,22,0.12)',   icon: 'ri-fire-line' },
  'Yüksekte Çalışma':   { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',   icon: 'ri-arrow-up-line' },
  'Kapalı Alan':        { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',   icon: 'ri-door-closed-line' },
  'Elektrikli Çalışma': { color: '#EAB308', bg: 'rgba(234,179,8,0.12)',    icon: 'ri-flashlight-line' },
  'Kazı':               { color: '#A16207', bg: 'rgba(161,98,7,0.12)',     icon: 'ri-tools-line' },
  'Genel':              { color: '#64748B', bg: 'rgba(100,116,139,0.12)', icon: 'ri-file-shield-2-line' },
};

const DURUM_CONFIG: Record<IsIzniStatus, { color: string; bg: string; border: string; icon: string; label: string }> = {
  'Onay Bekliyor': { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)', icon: 'ri-time-line',           label: 'Onay Bekliyor' },
  'Onaylandı':     { color: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)', icon: 'ri-checkbox-circle-line', label: 'Onaylandı' },
  'Reddedildi':    { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)', icon: 'ri-close-circle-line',    label: 'Reddedildi' },
};

const TIPLER: IsIzniTip[] = ['Sıcak Çalışma', 'Yüksekte Çalışma', 'Kapalı Alan', 'Elektrikli Çalışma', 'Kazı', 'Genel'];
const DURUMLAR: IsIzniStatus[] = ['Onay Bekliyor', 'Onaylandı', 'Reddedildi'];

function isExpired(bitisTarihi: string): boolean {
  if (!bitisTarihi) return false;
  const end = new Date(bitisTarihi);
  end.setHours(23, 59, 59, 999);
  return end < new Date();
}

function getDaysLeft(bitisTarihi: string): number | null {
  if (!bitisTarihi) return null;
  const end = new Date(bitisTarihi);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

// ─── Evrak listesi bileşeni ─────────────────────────────────────────────────
interface EvrakDosya {
  name: string;
  id: string;
  updated_at: string;
  metadata?: { size?: number; mimetype?: string };
}

function IsIzniEvraklari({ izinId, orgId, firmaId, izinTuru, onRefresh }: {
  izinId: string;
  orgId: string;
  firmaId: string;
  izinTuru: string;
  onRefresh?: number;
}) {
  const [dosyalar, setDosyalar] = useState<EvrakDosya[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [acikDosya, setAcikDosya] = useState<string | null>(null);

  const izinTuruSlug = izinTuru.replace(/\s+/g, '-');

  const fetchDosyalar = useCallback(async () => {
    setYukleniyor(true);
    try {
      const prefix = `${orgId}/is-izni-evrak/${firmaId}/${izinTuruSlug}`;
      const { data, error } = await supabase.storage
        .from('uploads')
        .list(prefix, { limit: 100, sortBy: { column: 'updated_at', order: 'desc' } });
      if (error || !data) { setDosyalar([]); return; }
      const filtered = data.filter(f => f.name.startsWith(izinId));
      setDosyalar(filtered as EvrakDosya[]);
    } catch {
      setDosyalar([]);
    } finally {
      setYukleniyor(false);
    }
  }, [orgId, firmaId, izinTuruSlug, izinId]);

  useEffect(() => { void fetchDosyalar(); }, [fetchDosyalar, onRefresh]);

  const handleAc = async (dosya: EvrakDosya) => {
    setAcikDosya(dosya.name);
    const prefix = `${orgId}/is-izni-evrak/${firmaId}/${izinTuruSlug}`;
    const filePath = `${prefix}/${dosya.name}`;
    const url = await getSignedUrl(filePath);
    if (url) window.open(url, '_blank');
    setAcikDosya(null);
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return { icon: 'ri-file-pdf-line', color: '#EF4444' };
    if (['doc', 'docx'].includes(ext)) return { icon: 'ri-file-word-line', color: '#3B82F6' };
    if (['xls', 'xlsx'].includes(ext)) return { icon: 'ri-file-excel-line', color: '#10B981' };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { icon: 'ri-image-line', color: '#F59E0B' };
    return { icon: 'ri-file-line', color: '#64748B' };
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (yukleniyor) {
    return (
      <div className="flex items-center gap-2 py-3 px-3 rounded-xl" style={{ background: 'var(--bg-item)' }}>
        <i className="ri-loader-4-line animate-spin text-sm" style={{ color: 'var(--text-muted)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Evraklar yükleniyor...</span>
      </div>
    );
  }

  if (dosyalar.length === 0) {
    return (
      <div className="flex items-center gap-3 py-3 px-3 rounded-xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
        <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(100,116,139,0.1)' }}>
          <i className="ri-folder-open-line text-xs" style={{ color: '#64748B' }} />
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Henüz evrak yüklenmedi</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {dosyalar.map(dosya => {
        const { icon, color } = getFileIcon(dosya.name);
        const isLoading = acikDosya === dosya.name;
        return (
          <div key={dosya.id || dosya.name}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
            <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${color}15` }}>
              <i className={`${icon} text-xs`} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{dosya.name}</p>
              {dosya.metadata?.size && (
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatSize(dosya.metadata.size)}</span>
              )}
            </div>
            <button
              onClick={() => void handleAc(dosya)}
              disabled={isLoading}
              className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
              style={{ background: 'rgba(96,165,250,0.1)', color: '#60A5FA' }}
              title="Dosyayı Aç"
            >
              {isLoading
                ? <i className="ri-loader-4-line animate-spin text-xs" />
                : <i className="ri-external-link-line text-xs" />
              }
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Denetçi Değerlendirme Modalı ──────────────────────────────────────────
interface DenetciModalProps {
  izin: IsIzni;
  firma: string;
  orgId: string;
  onClose: () => void;
  onUygun: () => void;
  onUygunDegil: (not: string, foto?: File) => void;
}

function DenetciDegerlendirmeModal({ izin, firma, orgId, onClose, onUygun, onUygunDegil }: DenetciModalProps) {
  const [adim, setAdim] = useState<'detay' | 'red'>('detay');
  const [redNot, setRedNot] = useState('');
  const [redFoto, setRedFoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const expired = isExpired(izin.bitisTarihi);
  const daysLeft = getDaysLeft(izin.bitisTarihi);

  const handleUygun = async () => {
    setSubmitting(true);
    onUygun();
  };

  const handleUygunDegil = async () => {
    if (!redNot.trim()) return;
    setSubmitting(true);
    onUygunDegil(redNot.trim(), redFoto ?? undefined);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={adim === 'detay' ? `İş İzni — ${izin.izinNo}` : 'Uygun Değil — Açıklama'}
      size="md"
      icon={adim === 'detay' ? 'ri-shield-keyhole-line' : 'ri-close-circle-line'}
      footer={
        adim === 'detay' ? (
          <>
            <button onClick={onClose} className="btn-secondary whitespace-nowrap">Kapat</button>
            {izin.durum === 'Onay Bekliyor' && (
              <>
                <button
                  onClick={() => setAdim('red')}
                  disabled={submitting}
                  className="whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  <i className="ri-close-circle-line mr-1.5" />UYGUN DEĞİL
                </button>
                <button
                  onClick={() => void handleUygun()}
                  disabled={submitting}
                  className="whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                  style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)' }}
                >
                  <i className="ri-checkbox-circle-line mr-1.5" />UYGUN
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <button onClick={() => setAdim('detay')} className="btn-secondary whitespace-nowrap">Geri</button>
            <button
              onClick={() => void handleUygunDegil()}
              disabled={submitting || !redNot.trim()}
              className="whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
              style={{
                background: redNot.trim() ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.05)',
                color: redNot.trim() ? '#EF4444' : '#94A3B8',
                border: `1px solid ${redNot.trim() ? 'rgba(239,68,68,0.3)' : 'rgba(100,116,139,0.2)'}`,
                cursor: redNot.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <i className="ri-send-plane-line mr-1.5" />Reddet ve Gönder
            </button>
          </>
        )
      }
    >
      {adim === 'detay' ? (
        <div className="space-y-4">
          {/* Durum banner */}
          {izin.durum !== 'Onay Bekliyor' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: DURUM_CONFIG[izin.durum].bg,
                border: `1px solid ${DURUM_CONFIG[izin.durum].border}`,
              }}>
              <i className={`${DURUM_CONFIG[izin.durum].icon} flex-shrink-0`} style={{ color: DURUM_CONFIG[izin.durum].color }} />
              <div>
                <p className="text-xs font-bold" style={{ color: DURUM_CONFIG[izin.durum].color }}>{izin.durum}</p>
                {izin.durum === 'Onaylandı' && izin.onaylayanKisi && (
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {izin.onaylayanKisi} · {izin.onayTarihi ? new Date(izin.onayTarihi).toLocaleDateString('tr-TR') : ''}
                  </p>
                )}
                {izin.durum === 'Reddedildi' && izin.sahaNotu && (
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{izin.sahaNotu}</p>
                )}
              </div>
            </div>
          )}

          {/* Süresi geçmiş uyarı */}
          {expired && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <i className="ri-alarm-warning-line flex-shrink-0" style={{ color: '#EF4444' }} />
              <p className="text-xs font-semibold" style={{ color: '#EF4444' }}>Bu iş izninin süresi geçmiş!</p>
            </div>
          )}

          {/* Bilgi grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Firma', value: firma },
              { label: 'İzin Tipi', value: izin.tip },
              { label: 'Başlangıç', value: izin.baslamaTarihi ? new Date(izin.baslamaTarihi).toLocaleDateString('tr-TR') : '—' },
              { label: 'Bitiş', value: izin.bitisTarihi ? new Date(izin.bitisTarihi).toLocaleDateString('tr-TR') : '—' },
            ].map(item => (
              <div key={item.label} className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-item)' }}>
                <p className="text-[10px] font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Açıklama */}
          {izin.aciklama && (
            <div className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-item)' }}>
              <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Açıklama</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{izin.aciklama}</p>
            </div>
          )}

          {/* Evraklar */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(96,165,250,0.2)' }}>
            <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: 'rgba(96,165,250,0.07)', borderBottom: '1px solid rgba(96,165,250,0.15)' }}>
              <i className="ri-attachment-2 text-sm" style={{ color: '#60A5FA' }} />
              <p className="text-xs font-bold" style={{ color: '#60A5FA' }}>Evraklar</p>
            </div>
            <div className="p-3">
              <IsIzniEvraklari
                izinId={izin.id}
                orgId={orgId}
                firmaId={izin.firmaId}
                izinTuru={izin.tip}
              />
            </div>
          </div>

          {/* Onay bekliyor bilgi */}
          {izin.durum === 'Onay Bekliyor' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <i className="ri-information-line flex-shrink-0" style={{ color: '#F59E0B' }} />
              <p className="text-xs" style={{ color: '#F59E0B' }}>Değerlendirmenizi yapmak için aşağıdaki butonları kullanın.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line flex-shrink-0" style={{ color: '#EF4444' }} />
            <p className="text-xs" style={{ color: '#EF4444' }}>Reddetme sebebini açıklayın. Bu not admin tarafından görülecek.</p>
          </div>

          <div>
            <label className="form-label">Reddetme Sebebi <span style={{ color: '#EF4444' }}>*</span></label>
            <textarea
              value={redNot}
              onChange={e => setRedNot(e.target.value)}
              placeholder="Neden uygun değil? Eksik evrak, güvenlik riski vb..."
              rows={4}
              maxLength={500}
              className="isg-input w-full resize-none"
            />
            <p className="text-[10px] mt-1 text-right" style={{ color: 'var(--text-muted)' }}>{redNot.length}/500</p>
          </div>

          <div>
            <label className="form-label">Fotoğraf Ekle (opsiyonel)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => setRedFoto(e.target.files?.[0] ?? null)}
            />
            {redFoto ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <i className="ri-image-line text-sm" style={{ color: '#F59E0B' }} />
                <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{redFoto.name}</span>
                <button onClick={() => setRedFoto(null)} className="w-6 h-6 flex items-center justify-center rounded cursor-pointer" style={{ color: '#EF4444' }}>
                  <i className="ri-close-line text-xs" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl cursor-pointer text-sm"
                style={{ background: 'var(--bg-item)', border: '1px dashed var(--bg-item-border)', color: 'var(--text-muted)' }}
              >
                <i className="ri-camera-line" />Fotoğraf Seç
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Ana Sayfa ──────────────────────────────────────────────────────────────
const emptyForm = {
  tip: 'Genel' as IsIzniTip,
  firmaId: '',
  aciklama: '',
  baslamaTarihi: '',
  bitisTarihi: '',
};

export default function IsIzniPage() {
  const {
    isIzinleri, firmalar, personeller, currentUser,
    addIsIzni, updateIsIzni, deleteIsIzni, addToast, quickCreate, setQuickCreate, org, refreshData,
  } = useApp();
  const { canCreate, canEdit, canDelete, isDenetci } = usePermissions();

  const [search, setSearch] = useState('');
  const [durumFilter, setDurumFilter] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewRecordId, setViewRecordId] = useState<string | null>(null);
  const [denetciRecordId, setDenetciRecordId] = useState<string | null>(null);

  // Store'dan canlı oku — admin güncellediğinde modal otomatik yenilenir
  const viewRecord = viewRecordId ? (isIzinleri.find(i => i.id === viewRecordId) ?? null) : null;
  const denetciRecord = denetciRecordId ? (isIzinleri.find(i => i.id === denetciRecordId) ?? null) : null;
  const [form, setForm] = useState({ ...emptyForm });
  const [formEvrak, setFormEvrak] = useState<File | null>(null);
  const [formEvrakUploading, setFormEvrakUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [evrakRefresh, setEvrakRefresh] = useState(0);
  const submittingRef = useRef<boolean>(false);
  const evrakInputRef = useRef<HTMLInputElement>(null);

  const aktivFirmalar = useMemo(() => firmalar.filter(f => !f.silinmis), [firmalar]);

  useEffect(() => {
    if (quickCreate === 'is-izinleri') {
      setEditId(null);
      setForm({ ...emptyForm });
      setFormEvrak(null);
      setShowModal(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return isIzinleri
      .filter(iz => !iz.silinmis)
      .filter(iz => {
        const firma = firmalar.find(f => f.id === iz.firmaId);
        return (
          (!q || iz.izinNo.toLowerCase().includes(q) || (firma?.ad.toLowerCase().includes(q) ?? false) || iz.aciklama.toLowerCase().includes(q))
          && (!durumFilter || iz.durum === durumFilter)
          && (!firmaFilter || iz.firmaId === firmaFilter)
        );
      })
      .sort((a, b) => (b.olusturmaTarihi ?? '').localeCompare(a.olusturmaTarihi ?? ''));
  }, [isIzinleri, firmalar, search, durumFilter, firmaFilter]);

  const aktifIsIzinleri = useMemo(() => isIzinleri.filter(i => !i.silinmis), [isIzinleri]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return {
      total: aktifIsIzinleri.length,
      onayBekliyor: aktifIsIzinleri.filter(i => i.durum === 'Onay Bekliyor').length,
      onaylandi: aktifIsIzinleri.filter(i => i.durum === 'Onaylandı').length,
      reddedildi: aktifIsIzinleri.filter(i => i.durum === 'Reddedildi').length,
      suresiDolan: aktifIsIzinleri.filter(i => i.bitisTarihi && new Date(i.bitisTarihi) < today).length,
    };
  }, [aktifIsIzinleri]);

  const sf = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const openAdd = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setFormEvrak(null);
    setShowModal(true);
  };

  const openEdit = (iz: IsIzni) => {
    setEditId(iz.id);
    setFormEvrak(null);
    setForm({
      tip: iz.tip,
      firmaId: iz.firmaId,
      aciklama: iz.aciklama || '',
      baslamaTarihi: iz.baslamaTarihi,
      bitisTarihi: iz.bitisTarihi,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (!form.baslamaTarihi) { addToast('Başlangıç tarihi zorunludur.', 'error'); return; }
    if (!form.bitisTarihi) { addToast('Bitiş tarihi zorunludur.', 'error'); return; }
    if (!editId && !formEvrak) { addToast('En az bir evrak yüklemeniz zorunludur.', 'error'); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormEvrakUploading(true);

    const orgId = org?.id ?? 'unknown';

    try {
      if (editId) {
        updateIsIzni(editId, {
          tip: form.tip,
          firmaId: form.firmaId,
          aciklama: form.aciklama,
          baslamaTarihi: form.baslamaTarihi,
          bitisTarihi: form.bitisTarihi,
          // Reddedilmişse tekrar onay bekleyene al
          durum: 'Onay Bekliyor',
        } as Partial<IsIzni>);
        if (formEvrak) {
          const izinTuruSlug = form.tip.replace(/\s+/g, '-');
          const path = `${orgId}/is-izni-evrak/${form.firmaId}/${izinTuruSlug}/${editId}_${Date.now()}_${formEvrak.name}`;
          await supabase.storage.from('uploads').upload(path, formEvrak, { upsert: true });
        }
        addToast('İş izni güncellendi ve tekrar onaya gönderildi.', 'success');
        setShowModal(false);
        setFormEvrak(null);
        setEvrakRefresh(p => p + 1);
      } else {
        const saveData = {
          tip: form.tip,
          firmaId: form.firmaId,
          aciklama: form.aciklama,
          baslamaTarihi: form.baslamaTarihi,
          bitisTarihi: form.bitisTarihi,
          durum: 'Onay Bekliyor' as IsIzniStatus,
          bolum: '',
          sorumlu: '',
          calisanlar: '',
          calisanSayisi: 1,
          tehlikeler: '',
          onlemler: '',
          gerekliEkipman: '',
          onaylayanKisi: '',
          onayTarihi: '',
          notlar: '',
          olusturanKisi: currentUser.ad,
          belgeMevcut: false,
        };
        const newIz = await addIsIzni(saveData as Omit<IsIzni, 'id' | 'izinNo' | 'olusturmaTarihi' | 'guncellemeTarihi'>);
        if (!newIz?.id) { addToast('İş izni oluşturulurken hata oluştu.', 'error'); return; }
        if (formEvrak) {
          const izinTuruSlug = form.tip.replace(/\s+/g, '-');
          const path = `${orgId}/is-izni-evrak/${form.firmaId}/${izinTuruSlug}/${newIz.id}_${Date.now()}_${formEvrak.name}`;
          await supabase.storage.from('uploads').upload(path, formEvrak, { upsert: true });
        }
        setFormEvrak(null);
        setShowModal(false);
        addToast('İş izni oluşturuldu ve sahaya gönderildi.', 'success');
      }
    } finally {
      submittingRef.current = false;
      setFormEvrakUploading(false);
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteIsIzni(deleteId);
    addToast('İş izni silindi.', 'success');
    setDeleteId(null);
  };

  // Denetçi: UYGUN
  const handleUygun = (iz: IsIzni) => {
    updateIsIzni(iz.id, {
      durum: 'Onaylandı',
      sahaNotu: 'Sahada uygundur',
      onaylayanKisi: currentUser.ad,
      onayTarihi: new Date().toISOString().split('T')[0],
    } as Partial<IsIzni>);
    addToast('İş izni onaylandı.', 'success');
    setDenetciRecordId(null);
  };

  // Denetçi: UYGUN DEĞİL
  const handleUygunDegil = async (iz: IsIzni, not: string, foto?: File) => {
    const orgId = org?.id ?? 'unknown';
    if (foto) {
      const izinTuruSlug = iz.tip.replace(/\s+/g, '-');
      const path = `${orgId}/is-izni-evrak/${iz.firmaId}/${izinTuruSlug}/${iz.id}_red_${Date.now()}_${foto.name}`;
      await supabase.storage.from('uploads').upload(path, foto, { upsert: true });
    }
    updateIsIzni(iz.id, {
      durum: 'Reddedildi',
      sahaNotu: not,
      reddedenKisi: currentUser.ad,
      reddetmeTarihi: new Date().toISOString().split('T')[0],
    } as Partial<IsIzni>);
    addToast('İş izni reddedildi.', 'error');
    setDenetciRecordId(null);
  };

  const inp = 'isg-input w-full';

  return (
    <div className="space-y-5">
      {/* Denetçi bilgi banner */}
      {isDenetci && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <i className="ri-shield-check-line flex-shrink-0" style={{ color: '#34D399' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#34D399' }}>Denetçi Modu</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>İş izinlerini görüntüleyebilir ve değerlendirme yapabilirsiniz.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>İş İzni Takip</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isDenetci ? 'Onay bekleyen iş izinlerini değerlendirin' : 'İş izinlerini oluşturun ve takip edin'}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={async () => { setRefreshing(true); await refreshData(); setRefreshing(false); }}
            disabled={refreshing}
            className="btn-secondary whitespace-nowrap"
          >
            <i className={`ri-refresh-line mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Yenileniyor...' : 'Yenile'}
          </button>
          {canCreate && (
            <button onClick={openAdd} className="btn-primary whitespace-nowrap">
              <i className="ri-add-line" /> Yeni İş İzni
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Toplam',        value: stats.total,        icon: 'ri-shield-keyhole-line',  color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
          { label: 'Onay Bekliyor', value: stats.onayBekliyor, icon: 'ri-time-line',            color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Onaylandı',     value: stats.onaylandi,    icon: 'ri-checkbox-circle-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Reddedildi',    value: stats.reddedildi,   icon: 'ri-close-circle-line',    color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
          { label: 'Süresi Dolan',  value: stats.suresiDolan,  icon: 'ri-alarm-warning-line',   color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
        ].map(s => (
          <div key={s.label} className="isg-card rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: s.bg }}>
              <i className={`${s.icon} text-base`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 px-4 py-3 rounded-2xl isg-card">
        <div className="relative flex-1 min-w-[180px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="İzin no, firma ara..." className="isg-input pl-9" />
        </div>
        <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input" style={{ minWidth: '160px' }}>
          <option value="">Tüm Firmalar</option>
          {aktivFirmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
        </select>
        <select value={durumFilter} onChange={e => setDurumFilter(e.target.value)} className="isg-input" style={{ minWidth: '140px' }}>
          <option value="">Tüm Durumlar</option>
          {DURUMLAR.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {(search || durumFilter || firmaFilter) && (
          <button onClick={() => { setSearch(''); setDurumFilter(''); setFirmaFilter(''); }} className="btn-secondary whitespace-nowrap">
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <i className="ri-list-check text-xs" />{filtered.length} sonuç
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="isg-card rounded-xl py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <i className="ri-shield-keyhole-line text-3xl" style={{ color: '#60A5FA' }} />
          </div>
          <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>İş izni kaydı bulunamadı</p>
          {canCreate && <button onClick={openAdd} className="btn-primary mt-5"><i className="ri-add-line" /> Yeni İş İzni</button>}
        </div>
      ) : (
        <div className="isg-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-premium w-full">
              <thead>
                <tr>
                  <th className="text-left">İzin No</th>
                  <th className="text-left">Tip</th>
                  <th className="text-left">Firma</th>
                  <th className="text-left">Tarih Aralığı</th>
                  <th className="text-left">Durum</th>
                  <th className="text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(iz => {
                  const firma = firmalar.find(f => f.id === iz.firmaId);
                  const tip = TIP_CONFIG[iz.tip] || { color: '#64748B', bg: 'rgba(100,116,139,0.12)', icon: 'ri-question-line' };
                  const dur = DURUM_CONFIG[iz.durum] || DURUM_CONFIG['Onay Bekliyor'];
                  const expired = isExpired(iz.bitisTarihi);
                  const daysLeft = getDaysLeft(iz.bitisTarihi);
                  const expiringSoon = !expired && daysLeft !== null && daysLeft >= 0 && daysLeft <= 2;

                  return (
                    <tr key={iz.id}>
                      <td>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-mono font-semibold" style={{ color: '#60A5FA' }}>{iz.izinNo}</span>
                          {expired && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                              Süresi Geçmiş
                            </span>
                          )}
                          {expiringSoon && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                              {daysLeft === 0 ? 'Bugün' : `${daysLeft}g`}
                            </span>
                          )}
                        </div>
                        {iz.aciklama && (
                          <p className="text-[11px] mt-0.5 truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>{iz.aciklama}</p>
                        )}
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: tip.bg, color: tip.color }}>
                          <i className={tip.icon} />{iz.tip}
                        </span>
                      </td>
                      <td>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{firma?.ad || '—'}</p>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <i className="ri-calendar-line text-xs" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {iz.baslamaTarihi ? new Date(iz.baslamaTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                            {iz.bitisTarihi && (
                              <span style={{ color: 'var(--text-muted)' }}>
                                {' → '}
                                {new Date(iz.bitisTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap" style={{ background: dur.bg, color: dur.color, border: `1px solid ${dur.border}` }}>
                          <i className={`${dur.icon} text-xs`} />{dur.label}
                        </span>
                        {iz.durum === 'Reddedildi' && iz.sahaNotu && (
                          <p className="text-[10px] mt-0.5 truncate max-w-[160px]" style={{ color: '#EF4444' }}>{iz.sahaNotu}</p>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          {/* Denetçi: değerlendirme butonu */}
                          {isDenetci && iz.durum === 'Onay Bekliyor' && (
                            <button
                              onClick={() => setDenetciRecordId(iz.id)}
                              title="Değerlendir"
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-semibold whitespace-nowrap"
                              style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}
                            >
                              <i className="ri-shield-check-line text-xs" />Değerlendir
                            </button>
                          )}
                          {/* Denetçi: detay görüntüle */}
                          {isDenetci && iz.durum !== 'Onay Bekliyor' && (
                            <button
                              onClick={() => setDenetciRecordId(iz.id)}
                              title="Detay"
                              className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                              style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}
                            >
                              <i className="ri-eye-line text-xs" />
                            </button>
                          )}
                          {/* Admin/Member işlemleri */}
                          {!isDenetci && (
                            <>
                              <button onClick={() => setViewRecordId(iz.id)} title="Detay" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>
                                <i className="ri-eye-line text-xs" />
                              </button>
                              <button
                                onClick={() => { const f = firmalar.find(x => x.id === iz.firmaId); generateIsIzniPdf(iz, f, personeller.filter(p => iz.calisanlar?.includes(p.adSoyad))); }}
                                title="PDF"
                                className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                                style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}
                              >
                                <i className="ri-file-pdf-line text-xs" />
                              </button>
                              {canEdit && (
                                <button onClick={() => openEdit(iz)} title="Düzenle" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                                  <i className="ri-edit-line text-xs" />
                                </button>
                              )}
                              {canDelete && (
                                <button onClick={() => setDeleteId(iz.id)} title="Sil" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                                  <i className="ri-delete-bin-line text-xs" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Admin/Member Form Modal ── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'İş İzni Düzenle' : 'Yeni İş İzni Oluştur'}
        size="md"
        icon="ri-shield-keyhole-line"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={() => void handleSave()} disabled={formEvrakUploading} className="btn-primary whitespace-nowrap">
              {formEvrakUploading
                ? <><i className="ri-loader-4-line animate-spin mr-1" />Kaydediliyor...</>
                : <><i className={editId ? 'ri-refresh-line' : 'ri-send-plane-line'} /> {editId ? 'Güncelle ve Tekrar Gönder' : 'Kaydet ve Sahaya Gönder'}</>
              }
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* İzin no önizleme */}
          {!editId && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
              <i className="ri-barcode-line flex-shrink-0" style={{ color: '#60A5FA' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>İzin numarası otomatik üretilir</p>
                <p className="text-sm font-mono font-semibold" style={{ color: '#60A5FA' }}>{generateIsIzniNo(isIzinleri)}</p>
              </div>
            </div>
          )}

          {/* Reddedilmiş uyarı */}
          {editId && isIzinleri.find(i => i.id === editId)?.durum === 'Reddedildi' && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <i className="ri-error-warning-line flex-shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: '#EF4444' }}>Bu iş izni reddedildi</p>
                {isIzinleri.find(i => i.id === editId)?.sahaNotu && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Sebep: {isIzinleri.find(i => i.id === editId)?.sahaNotu}
                  </p>
                )}
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Düzenleyip kaydettiğinizde tekrar onaya gönderilecek.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">İzin Tipi</label>
              <select value={form.tip} onChange={e => sf('tip', e.target.value)} className={inp}>
                {TIPLER.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Firma <span style={{ color: '#EF4444' }}>*</span></label>
              <select value={form.firmaId} onChange={e => sf('firmaId', e.target.value)} className={inp}>
                <option value="">Firma Seçin</option>
                {aktivFirmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Başlangıç Tarihi <span style={{ color: '#EF4444' }}>*</span></label>
              <input type="date" value={form.baslamaTarihi} onChange={e => sf('baslamaTarihi', e.target.value)} className={inp} />
            </div>
            <div>
              <label className="form-label">Bitiş Tarihi <span style={{ color: '#EF4444' }}>*</span></label>
              <input type="date" value={form.bitisTarihi} onChange={e => sf('bitisTarihi', e.target.value)} className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Açıklama</label>
              <textarea
                value={form.aciklama}
                onChange={e => sf('aciklama', e.target.value)}
                placeholder="Çalışma detayları, özel notlar..."
                rows={3}
                maxLength={500}
                className="isg-input w-full resize-none"
              />
            </div>
          </div>

          {/* Evrak yükleme */}
          <div>
            <label className="form-label">
              Evrak Yükle {!editId && <span style={{ color: '#EF4444' }}>*</span>}
              {editId && <span className="text-[10px] ml-1" style={{ color: 'var(--text-muted)' }}>(opsiyonel — yeni evrak eklemek için)</span>}
            </label>
            <input
              ref={evrakInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              className="hidden"
              onChange={e => setFormEvrak(e.target.files?.[0] ?? null)}
            />
            {formEvrak ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <i className="ri-file-line text-sm" style={{ color: '#60A5FA' }} />
                <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{formEvrak.name}</span>
                <button onClick={() => setFormEvrak(null)} className="w-6 h-6 flex items-center justify-center rounded cursor-pointer" style={{ color: '#EF4444' }}>
                  <i className="ri-close-line text-xs" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => evrakInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl cursor-pointer text-sm"
                style={{ background: 'var(--bg-item)', border: '1px dashed var(--bg-item-border)', color: 'var(--text-muted)' }}
              >
                <i className="ri-upload-cloud-2-line text-base" />
                <span>Dosya seçin veya sürükleyin</span>
                <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>PDF, Word, Excel, Görsel — maks. 50MB</span>
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Admin/Member Detay Modal ── */}
      {viewRecord && (
        <Modal
          open={!!viewRecord}
          onClose={() => setViewRecordId(null)}
          title={`İzin Detayı — ${viewRecord.izinNo}`}
          size="md"
          icon="ri-shield-keyhole-line"
          footer={
            <>
              <button
                onClick={() => { const f = firmalar.find(x => x.id === viewRecord.firmaId); generateIsIzniPdf(viewRecord, f, personeller.filter(p => viewRecord.calisanlar?.includes(p.adSoyad))); }}
                className="btn-secondary whitespace-nowrap"
              >
                <i className="ri-file-pdf-line" /> PDF
              </button>
              <button onClick={() => setViewRecordId(null)} className="btn-primary whitespace-nowrap">Kapat</button>
            </>
          }
        >
          <div className="space-y-3">
            {/* Durum */}
            {(() => {
              const dur = DURUM_CONFIG[viewRecord.durum];
              return (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: dur.bg, border: `1px solid ${dur.border}` }}>
                  <i className={`${dur.icon} flex-shrink-0`} style={{ color: dur.color }} />
                  <div className="flex-1">
                    <p className="text-xs font-bold" style={{ color: dur.color }}>{dur.label}</p>
                    {viewRecord.durum === 'Onaylandı' && viewRecord.onaylayanKisi && (
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {viewRecord.onaylayanKisi} · {viewRecord.onayTarihi ? new Date(viewRecord.onayTarihi).toLocaleDateString('tr-TR') : ''}
                      </p>
                    )}
                    {viewRecord.durum === 'Reddedildi' && viewRecord.sahaNotu && (
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {viewRecord.sahaNotu}
                        {viewRecord.reddedenKisi && ` — ${viewRecord.reddedenKisi}`}
                      </p>
                    )}
                  </div>
                  {viewRecord.durum === 'Reddedildi' && canEdit && (
                    <button
                      onClick={() => { setViewRecordId(null); openEdit(viewRecord); }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}
                    >
                      <i className="ri-edit-line mr-1" />Düzenle
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Süresi geçmiş uyarı */}
            {isExpired(viewRecord.bitisTarihi) && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <i className="ri-alarm-warning-line flex-shrink-0" style={{ color: '#EF4444' }} />
                <p className="text-xs font-semibold" style={{ color: '#EF4444' }}>Bu iş izninin süresi geçmiş!</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'İzin No',   value: viewRecord.izinNo },
                { label: 'Tip',       value: viewRecord.tip },
                { label: 'Firma',     value: firmalar.find(f => f.id === viewRecord.firmaId)?.ad || '—' },
                { label: 'Oluşturan', value: viewRecord.olusturanKisi || '—' },
                { label: 'Başlangıç', value: viewRecord.baslamaTarihi ? new Date(viewRecord.baslamaTarihi).toLocaleDateString('tr-TR') : '—' },
                { label: 'Bitiş',     value: viewRecord.bitisTarihi ? new Date(viewRecord.bitisTarihi).toLocaleDateString('tr-TR') : '—' },
              ].map(item => (
                <div key={item.label} className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-item)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                </div>
              ))}
            </div>

            {viewRecord.aciklama && (
              <div className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-item)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Açıklama</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{viewRecord.aciklama}</p>
              </div>
            )}

            {/* Evraklar */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(96,165,250,0.2)' }}>
              <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: 'rgba(96,165,250,0.07)', borderBottom: '1px solid rgba(96,165,250,0.15)' }}>
                <i className="ri-attachment-2 text-sm" style={{ color: '#60A5FA' }} />
                <p className="text-xs font-bold" style={{ color: '#60A5FA' }}>Yüklü Evraklar</p>
              </div>
              <div className="p-3">
                <IsIzniEvraklari
                  izinId={viewRecord.id}
                  orgId={org?.id ?? 'unknown'}
                  firmaId={viewRecord.firmaId}
                  izinTuru={viewRecord.tip}
                  onRefresh={evrakRefresh}
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Denetçi Değerlendirme Modal — store'dan canlı okunuyor ── */}
      {denetciRecord && (
        <DenetciDegerlendirmeModal
          izin={denetciRecord}
          firma={firmalar.find(f => f.id === denetciRecord.firmaId)?.ad || '—'}
          orgId={org?.id ?? 'unknown'}
          onClose={() => setDenetciRecordId(null)}
          onUygun={() => handleUygun(denetciRecord)}
          onUygunDegil={(not, foto) => void handleUygunDegil(denetciRecord, not, foto)}
        />
      )}

      {/* ── Silme Modal ── */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="İş İzni Sil"
        size="sm"
        icon="ri-delete-bin-line"
        footer={
          <>
            <button onClick={() => setDeleteId(null)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleDelete} className="btn-danger whitespace-nowrap">Evet, Sil</button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Bu iş iznini silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>İş izni çöp kutusuna taşınacak, oradan geri yükleyebilirsiniz.</p>
        </div>
      </Modal>
    </div>
  );
}
