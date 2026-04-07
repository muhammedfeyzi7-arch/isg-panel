import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/store/AppContext';
import type { IsIzni, IsIzniTip, IsIzniStatus } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import { generateIsIzniNo } from '@/store/useStore';
import Modal from '@/components/base/Modal';
import { generateIsIzniPdf } from './utils/isIzniPdfGenerator';
import TopluEvrakYukle from './components/TopluEvrakYukle';
import { uploadFileToStorage, getSignedUrl } from '@/utils/fileUpload';
import { supabase } from '@/lib/supabase';

const TIP_CONFIG: Record<IsIzniTip, { color: string; bg: string; icon: string }> = {
  'Sıcak Çalışma':      { color: '#F97316', bg: 'rgba(249,115,22,0.12)',   icon: 'ri-fire-line' },
  'Yüksekte Çalışma':   { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',   icon: 'ri-arrow-up-line' },
  'Kapalı Alan':        { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',   icon: 'ri-door-closed-line' },
  'Elektrikli Çalışma': { color: '#EAB308', bg: 'rgba(234,179,8,0.12)',    icon: 'ri-flashlight-line' },
  'Kazı':               { color: '#A16207', bg: 'rgba(161,98,7,0.12)',     icon: 'ri-tools-line' },
  'Genel':              { color: '#64748B', bg: 'rgba(100,116,139,0.12)', icon: 'ri-file-shield-2-line' },
};

const DURUM_CONFIG: Record<IsIzniStatus, { color: string; bg: string; border: string; icon: string }> = {
  'Onay Bekliyor': { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)', icon: 'ri-time-line' },
  'Onaylandı':     { color: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)', icon: 'ri-checkbox-circle-line' },
  'Reddedildi':    { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)', icon: 'ri-close-circle-line' },
};

const TIPLER: IsIzniTip[] = ['Sıcak Çalışma', 'Yüksekte Çalışma', 'Kapalı Alan', 'Elektrikli Çalışma', 'Kazı', 'Genel'];
const DURUMLAR: IsIzniStatus[] = ['Onay Bekliyor', 'Onaylandı', 'Reddedildi'];

const emptyForm = {
  tip: 'Genel' as IsIzniTip,
  firmaId: '',
  bolum: '',
  sorumlu: '',
  baslamaTarihi: '',
  bitisTarihi: '',
  durum: 'Onay Bekliyor' as IsIzniStatus,
};

function getDaysLeft(bitisTarihi: string): number | null {
  if (!bitisTarihi) return null;
  const end = new Date(bitisTarihi);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

// ── Yüklü Evraklar bileşeni ──
interface EvrakDosya {
  name: string;
  id: string;
  updated_at: string;
  metadata?: { size?: number; mimetype?: string };
}

function IsIzniEvraklari({ izinId, orgId, firmaId, izinTuru }: {
  izinId: string;
  orgId: string;
  firmaId: string;
  izinTuru: string;
}) {
  const [dosyalar, setDosyalar] = useState<EvrakDosya[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [acikUrl, setAcikUrl] = useState<string | null>(null);
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
      // Sadece bu izin ID'sine ait dosyaları filtrele
      const filtered = data.filter(f => f.name.startsWith(izinId));
      setDosyalar(filtered as EvrakDosya[]);
    } catch {
      setDosyalar([]);
    } finally {
      setYukleniyor(false);
    }
  }, [orgId, firmaId, izinTuruSlug, izinId]);

  useEffect(() => { void fetchDosyalar(); }, [fetchDosyalar]);

  const handleAc = async (dosya: EvrakDosya) => {
    setAcikDosya(dosya.name);
    const prefix = `${orgId}/is-izni-evrak/${firmaId}/${izinTuruSlug}`;
    const filePath = `${prefix}/${dosya.name}`;
    const url = await getSignedUrl(filePath);
    if (url) {
      setAcikUrl(url);
      window.open(url, '_blank');
    }
    setAcikDosya(null);
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return { icon: 'ri-file-pdf-line', color: '#EF4444' };
    if (['doc', 'docx'].includes(ext)) return { icon: 'ri-file-word-line', color: '#3B82F6' };
    if (['xls', 'xlsx'].includes(ext)) return { icon: 'ri-file-excel-line', color: '#10B981' };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { icon: 'ri-image-line', color: '#F59E0B' };
    if (['zip', 'rar', '7z'].includes(ext)) return { icon: 'ri-file-zip-line', color: '#8B5CF6' };
    return { icon: 'ri-file-line', color: '#64748B' };
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTarih = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch { return '—'; }
  };

  if (yukleniyor) {
    return (
      <div className="flex items-center gap-2 py-4 px-3 rounded-xl" style={{ background: 'var(--bg-item)' }}>
        <i className="ri-loader-4-line animate-spin text-sm" style={{ color: 'var(--text-muted)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Evraklar yükleniyor...</span>
      </div>
    );
  }

  if (dosyalar.length === 0) {
    return (
      <div className="flex items-center gap-3 py-4 px-3 rounded-xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
        <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(100,116,139,0.1)' }}>
          <i className="ri-folder-open-line text-sm" style={{ color: '#64748B' }} />
        </div>
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Henüz evrak yüklenmedi</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>Toplu Evrak Yükle butonu ile dosya ekleyebilirsiniz</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {dosyalar.map(dosya => {
        const { icon, color } = getFileIcon(dosya.name);
        const isLoading = acikDosya === dosya.name;
        // Dosya adından uzantıyı al, ID prefix'ini temizle
        const displayName = dosya.name.includes('.') ? dosya.name : dosya.name;
        return (
          <div key={dosya.id || dosya.name}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
            style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
            <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ background: `${color}15` }}>
              <i className={`${icon} text-sm`} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {dosya.metadata?.size && (
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatSize(dosya.metadata.size)}</span>
                )}
                {dosya.updated_at && (
                  <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{formatTarih(dosya.updated_at)}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => void handleAc(dosya)}
              disabled={isLoading}
              className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0 transition-all"
              style={{ background: 'rgba(96,165,250,0.1)', color: '#60A5FA' }}
              title="Dosyayı Aç"
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.1)'; }}
            >
              {isLoading
                ? <i className="ri-loader-4-line animate-spin text-xs" />
                : <i className="ri-external-link-line text-xs" />
              }
            </button>
          </div>
        );
      })}
      {acikUrl && <span className="hidden">{acikUrl}</span>}
    </div>
  );
}

export default function IsIzniPage() {
  const {
    isIzinleri, firmalar, personeller, currentUser,
    addIsIzni, updateIsIzni, deleteIsIzni, addToast, quickCreate, setQuickCreate, org, refreshData,
  } = useApp();
  const { canCreate, canEdit, canDelete, isReadOnly } = usePermissions();

  const [search, setSearch] = useState('');
  const [tipFilter, setTipFilter] = useState('');
  const [durumFilter, setDurumFilter] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewRecord, setViewRecord] = useState<IsIzni | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [refreshing, setRefreshing] = useState(false);
  const [showBelgeModal, setShowBelgeModal] = useState(false);
  const [savedIsIzni, setSavedIsIzni] = useState<IsIzni | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [statusChangeId, setStatusChangeId] = useState<string | null>(null);
  const [pendingBelge, setPendingBelge] = useState<File | null>(null);
  const submittingRef = useRef<boolean>(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const aktivFirmalar = useMemo(() => firmalar.filter(f => !f.silinmis), [firmalar]);

  useEffect(() => {
    if (quickCreate === 'is-izinleri') {
      setEditId(null);
      setForm({ ...emptyForm });
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
          (!q || iz.izinNo.toLowerCase().includes(q) || iz.aciklama.toLowerCase().includes(q) || iz.sorumlu.toLowerCase().includes(q) || (firma?.ad.toLowerCase().includes(q) ?? false))
          && (!tipFilter || iz.tip === tipFilter)
          && (!durumFilter || iz.durum === durumFilter)
          && (!firmaFilter || iz.firmaId === firmaFilter)
        );
      })
      .sort((a, b) => (b.olusturmaTarihi ?? '').localeCompare(a.olusturmaTarihi ?? ''));
  }, [isIzinleri, firmalar, search, tipFilter, durumFilter, firmaFilter]);

  const allSelected = filtered.length > 0 && filtered.every(iz => selected.has(iz.id));
  const toggleAll = () => allSelected ? setSelected(new Set()) : setSelected(new Set(filtered.map(iz => iz.id)));
  const toggleOne = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleBulkDelete = () => {
    selected.forEach(id => deleteIsIzni(id));
    addToast(`${selected.size} iş izni silindi.`, 'info');
    setSelected(new Set()); setBulkDeleteConfirm(false);
  };

  const aktifIsIzinleri = useMemo(() => isIzinleri.filter(i => !i.silinmis), [isIzinleri]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return {
      total: aktifIsIzinleri.length,
      onayBekliyor: aktifIsIzinleri.filter(i => i.durum === 'Onay Bekliyor').length,
      onaylandi: aktifIsIzinleri.filter(i => i.durum === 'Onaylandı').length,
      reddedildi: aktifIsIzinleri.filter(i => i.durum === 'Reddedildi').length,
      suresiDolan: aktifIsIzinleri.filter(i => {
        if (!i.bitisTarihi) return false;
        return new Date(i.bitisTarihi) < today;
      }).length,
      yaklasan: aktifIsIzinleri.filter(i => {
        if (!i.bitisTarihi) return false;
        const d = getDaysLeft(i.bitisTarihi);
        return d !== null && d >= 0 && d <= 2;
      }).length,
    };
  }, [aktifIsIzinleri]);

  const sf = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const openAdd = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (iz: IsIzni) => {
    setEditId(iz.id);
    setPendingBelge(null);
    setForm({
      tip: iz.tip,
      firmaId: iz.firmaId,
      bolum: iz.bolum,
      sorumlu: iz.sorumlu,
      baslamaTarihi: iz.baslamaTarihi,
      bitisTarihi: iz.bitisTarihi,
      durum: iz.durum,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (!form.baslamaTarihi) { addToast('Başlama tarihi zorunludur.', 'error'); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;

    const orgId = org?.id ?? 'unknown';

    try {
      if (editId) {
        updateIsIzni(editId, form as Partial<IsIzni>);
        if (pendingBelge) {
          const url = await uploadFileToStorage(pendingBelge, orgId, 'is-izni', editId);
          if (url) updateIsIzni(editId, { belgeDosyaUrl: url });
        }
        addToast('İş izni güncellendi.', 'success');
        setShowModal(false); setPendingBelge(null);
      } else {
        const saveData = {
          ...form,
          aciklama: '',
          tehlikeler: '',
          onlemler: '',
          gerekliEkipman: '',
          calisanlar: '',
          calisanSayisi: 1,
          onaylayanKisi: '',
          onayTarihi: '',
          notlar: '',
          olusturanKisi: currentUser.ad,
          belgeMevcut: false,
        };
        const newIz = await addIsIzni(saveData as Omit<IsIzni, 'id' | 'izinNo' | 'olusturmaTarihi' | 'guncellemeTarihi'>);
        if (!newIz?.id) { addToast('İş izni oluşturulurken hata oluştu.', 'error'); return; }
        if (pendingBelge) {
          const url = await uploadFileToStorage(pendingBelge, orgId, 'is-izni', newIz.id);
          if (url) updateIsIzni(newIz.id, { belgeDosyaUrl: url });
        }
        setPendingBelge(null); setShowModal(false);
        setSavedIsIzni(newIz); setShowBelgeModal(true);
      }
    } finally {
      submittingRef.current = false;
    }
  };

  const handleBelgeYes = () => {
    if (!savedIsIzni) return;
    const firma = firmalar.find(f => f.id === savedIsIzni.firmaId);
    generateIsIzniPdf(savedIsIzni, firma, []);
    setShowBelgeModal(false); setSavedIsIzni(null);
    addToast('İş izni belgesi oluşturuldu.', 'success');
  };

  const handleBelgeNo = () => { setShowBelgeModal(false); setSavedIsIzni(null); addToast('İş izni oluşturuldu.', 'success'); };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteIsIzni(deleteId); addToast('İş izni silindi.', 'success'); setDeleteId(null);
  };

  const handleStatusChange = (iz: IsIzni, yeniDurum: IsIzniStatus) => {
    const updates: Partial<IsIzni> = { durum: yeniDurum };
    if (yeniDurum === 'Onaylandı') {
      updates.onaylayanKisi = currentUser.ad;
      updates.onayTarihi = new Date().toISOString().split('T')[0];
    }
    updateIsIzni(iz.id, updates);
    addToast(`İş izni durumu "${yeniDurum}" olarak güncellendi.`, 'success');
    setStatusChangeId(null);
  };

  const inp = 'isg-input w-full';

  return (
    <div className="space-y-5">
      {isReadOnly && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)' }}>
          <i className="ri-search-eye-line flex-shrink-0" style={{ color: '#06B6D4' }} />
          <p className="text-sm" style={{ color: '#06B6D4' }}><strong>Denetçi Modu:</strong> İş izinleri yalnızca görüntüleme amaçlıdır.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>İş İzni Takip</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Sıcak çalışma, yüksekte çalışma ve diğer iş izinlerini yönetin</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button onClick={async () => { setRefreshing(true); await refreshData(); setRefreshing(false); }} disabled={refreshing} className="btn-secondary whitespace-nowrap">
            <i className={`ri-refresh-line mr-1 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Yenileniyor...' : 'Yenile'}
          </button>
          {canCreate && (
            <>
              <button onClick={() => setShowImport(true)} className="btn-secondary whitespace-nowrap">
                <i className="ri-upload-cloud-2-line mr-1" />Toplu Evrak Yükle
              </button>
              <button onClick={openAdd} className="btn-primary whitespace-nowrap">
                <i className="ri-add-line" /> Yeni İş İzni
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Toplam',        value: stats.total,        icon: 'ri-shield-keyhole-line',  color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
          { label: 'Onay Bekliyor', value: stats.onayBekliyor, icon: 'ri-lock-line',            color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Onaylandı',     value: stats.onaylandi,    icon: 'ri-checkbox-circle-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Reddedildi',    value: stats.reddedildi,   icon: 'ri-close-circle-line',    color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
          { label: 'Süresi Dolan',  value: stats.suresiDolan,  icon: 'ri-alarm-warning-line',   color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
          { label: 'Yaklaşan',      value: stats.yaklasan,     icon: 'ri-timer-line',           color: '#FB923C', bg: 'rgba(251,146,60,0.1)' },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="İzin no, sorumlu ara..." className="isg-input pl-9" />
        </div>
        <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input" style={{ minWidth: '160px' }}>
          <option value="">Tüm Firmalar</option>
          {aktivFirmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
        </select>
        <select value={tipFilter} onChange={e => setTipFilter(e.target.value)} className="isg-input" style={{ minWidth: '160px' }}>
          <option value="">Tüm Tipler</option>
          {TIPLER.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={durumFilter} onChange={e => setDurumFilter(e.target.value)} className="isg-input" style={{ minWidth: '140px' }}>
          <option value="">Tüm Durumlar</option>
          {DURUMLAR.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {(search || tipFilter || durumFilter || firmaFilter) && (
          <button onClick={() => { setSearch(''); setTipFilter(''); setDurumFilter(''); setFirmaFilter(''); }} className="btn-secondary whitespace-nowrap">
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <i className="ri-list-check text-xs" />{filtered.length} sonuç
        </div>
      </div>

      {/* Toplu seçim */}
      {selected.size > 0 && canDelete && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <span className="text-sm font-semibold" style={{ color: '#F87171' }}>{selected.size} iş izni seçildi</span>
          <button onClick={() => setBulkDeleteConfirm(true)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
            <i className="ri-delete-bin-line" /> Seçilenleri Sil
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap ml-auto" style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8' }}>Seçimi Kaldır</button>
        </div>
      )}

      {/* Tablo */}
      {filtered.length === 0 ? (
        <div className="isg-card rounded-xl py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <i className="ri-shield-keyhole-line text-3xl" style={{ color: '#60A5FA' }} />
          </div>
          <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>İş izni kaydı bulunamadı</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-faint)' }}>Yeni iş izni oluşturmak için butonu kullanın</p>
          {canCreate && <button onClick={openAdd} className="btn-primary mt-5"><i className="ri-add-line" /> Yeni İş İzni</button>}
        </div>
      ) : (
        <div className="isg-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-premium w-full">
              <thead>
                <tr>
                  {canDelete && <th className="w-10 text-center"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" /></th>}
                  <th className="text-left">İzin No</th>
                  <th className="text-left">Tip</th>
                  <th className="text-left">Firma / Bölüm</th>
                  <th className="text-left hidden lg:table-cell">Sorumlu</th>
                  <th className="text-left">Tarih Aralığı</th>
                  <th className="text-left">Durum</th>
                  <th className="text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(iz => {
                  const firma = firmalar.find(f => f.id === iz.firmaId);
                  const tip = TIP_CONFIG[iz.tip] || { color: '#64748B', bg: 'rgba(100,116,139,0.12)', icon: 'ri-question-line' };
                  const dur = DURUM_CONFIG[iz.durum] || { color: '#64748B', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)', icon: 'ri-question-line' };
                  const daysLeft = getDaysLeft(iz.bitisTarihi);
                  const isExpired = daysLeft !== null && daysLeft < 0;
                  const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 2;
                  return (
                    <tr key={iz.id} style={{ background: selected.has(iz.id) ? 'rgba(239,68,68,0.04)' : undefined }}>
                      {canDelete && <td className="text-center"><input type="checkbox" checked={selected.has(iz.id)} onChange={() => toggleOne(iz.id)} className="cursor-pointer" /></td>}
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-semibold" style={{ color: '#60A5FA' }}>{iz.izinNo}</span>
                          {isExpired && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>Süresi Doldu</span>}
                          {isExpiringSoon && !isExpired && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>{daysLeft === 0 ? 'Bugün' : `${daysLeft}g`}</span>}
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: tip.bg, color: tip.color }}>
                          <i className={tip.icon} />{iz.tip}
                        </span>
                      </td>
                      <td>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{firma?.ad || '—'}</p>
                        {iz.bolum && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{iz.bolum}</p>}
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{iz.sorumlu || '—'}</span>
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
                        {statusChangeId === iz.id ? (
                          <select value={iz.durum} onChange={e => handleStatusChange(iz, e.target.value as IsIzniStatus)} onBlur={() => setStatusChangeId(null)} autoFocus className="text-xs py-1 px-2 rounded border" style={{ background: dur.bg, color: dur.color, borderColor: dur.border }}>
                            {DURUMLAR.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        ) : (
                          <button onClick={() => canEdit && setStatusChangeId(iz.id)} disabled={!canEdit} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all" style={{ background: dur.bg, color: dur.color, border: `1px solid ${dur.border}`, opacity: canEdit ? 1 : 0.7 }}>
                            <i className={`${dur.icon} text-xs`} />{iz.durum}
                            {canEdit && <i className="ri-arrow-down-s-line text-[10px] ml-0.5" />}
                          </button>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setViewRecord(iz)} title="Detay" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}><i className="ri-eye-line text-xs" /></button>
                          <button onClick={() => { const f = firmalar.find(x => x.id === iz.firmaId); generateIsIzniPdf(iz, f, personeller.filter(p => iz.calisanlar?.includes(p.adSoyad))); }} title="PDF" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}><i className="ri-file-pdf-line text-xs" /></button>
                          {canEdit && <button onClick={() => openEdit(iz)} title="Düzenle" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}><i className="ri-edit-line text-xs" /></button>}
                          {canDelete && <button onClick={() => setDeleteId(iz.id)} title="Sil" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}><i className="ri-delete-bin-line text-xs" /></button>}
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

      {/* Form Modal — sadece 6 alan */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'İş İzni Düzenle' : 'Yeni İş İzni Oluştur'}
        size="md"
        icon="ri-shield-keyhole-line"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleSave} className="btn-primary whitespace-nowrap">
              <i className={editId ? 'ri-save-line' : 'ri-add-line'} /> {editId ? 'Güncelle' : 'Oluştur'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {!editId && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
              <i className="ri-barcode-line flex-shrink-0" style={{ color: '#60A5FA' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>İzin numarası otomatik üretilir</p>
                <p className="text-sm font-mono font-semibold" style={{ color: '#60A5FA' }}>{generateIsIzniNo(isIzinleri)}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">İzin Tipi *</label>
              <select value={form.tip} onChange={e => sf('tip', e.target.value)} className={inp}>
                {TIPLER.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Firma *</label>
              <select value={form.firmaId} onChange={e => sf('firmaId', e.target.value)} className={inp}>
                <option value="">Firma Seçin</option>
                {aktivFirmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Bölüm / Alan</label>
              <input value={form.bolum} onChange={e => sf('bolum', e.target.value)} placeholder="Çalışma alanı..." className={inp} />
            </div>
            <div>
              <label className="form-label">Sorumlu Kişi</label>
              <input value={form.sorumlu} onChange={e => sf('sorumlu', e.target.value)} placeholder="Ad Soyad" className={inp} />
            </div>
            <div>
              <label className="form-label">Başlama Tarihi *</label>
              <input type="date" value={form.baslamaTarihi} onChange={e => sf('baslamaTarihi', e.target.value)} className={inp} />
            </div>
            <div>
              <label className="form-label">Bitiş Tarihi</label>
              <input type="date" value={form.bitisTarihi} onChange={e => sf('bitisTarihi', e.target.value)} className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Durum</label>
              <select value={form.durum} onChange={e => sf('durum', e.target.value as IsIzniStatus)} className={inp}>
                {DURUMLAR.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Belge Ver mi? Modal */}
      <Modal open={showBelgeModal} onClose={handleBelgeNo} title="İş İzni Belgesi" size="sm" icon="ri-file-pdf-line"
        footer={<><button onClick={handleBelgeNo} className="btn-secondary whitespace-nowrap">Hayır, Geç</button><button onClick={handleBelgeYes} className="btn-primary whitespace-nowrap"><i className="ri-printer-line" /> Evet, Belge Oluştur</button></>}>
        <div className="py-2 text-center">
          <div className="w-14 h-14 flex items-center justify-center rounded-2xl mx-auto mb-4" style={{ background: 'rgba(16,185,129,0.12)' }}>
            <i className="ri-file-pdf-line text-2xl" style={{ color: '#10B981' }} />
          </div>
          <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>İş izni başarıyla oluşturuldu!</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}><strong style={{ color: '#60A5FA' }}>{savedIsIzni?.izinNo}</strong> numaralı iş izni için belge (PDF) oluşturmak ister misiniz?</p>
        </div>
      </Modal>

      {/* Detay Modal */}
      {viewRecord && (
        <Modal open={!!viewRecord} onClose={() => setViewRecord(null)} title={`İzin Detayı — ${viewRecord.izinNo}`} size="md" icon="ri-shield-keyhole-line"
          footer={<><button onClick={() => { const f = firmalar.find(x => x.id === viewRecord.firmaId); generateIsIzniPdf(viewRecord, f, personeller.filter(p => viewRecord.calisanlar?.includes(p.adSoyad))); }} className="btn-secondary whitespace-nowrap"><i className="ri-file-pdf-line" /> PDF Oluştur</button><button onClick={() => setViewRecord(null)} className="btn-primary whitespace-nowrap">Kapat</button></>}>
          <div className="space-y-3">
            {viewRecord.durum === 'Onay Bekliyor' && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <i className="ri-lock-line flex-shrink-0" style={{ color: '#F59E0B' }} />
                <div className="flex-1">
                  <p className="text-xs font-semibold" style={{ color: '#F59E0B' }}>Bu iş izni onay bekliyor</p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { handleStatusChange(viewRecord, 'Onaylandı'); setViewRecord(prev => prev ? { ...prev, durum: 'Onaylandı' } : null); }} className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap" style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)' }}>
                      <i className="ri-checkbox-circle-line mr-1" />Onayla
                    </button>
                    <button onClick={() => { handleStatusChange(viewRecord, 'Reddedildi'); setViewRecord(prev => prev ? { ...prev, durum: 'Reddedildi' } : null); }} className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <i className="ri-close-circle-line mr-1" />Reddet
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'İzin No',      value: viewRecord.izinNo },
                { label: 'Tip',          value: viewRecord.tip },
                { label: 'Firma',        value: firmalar.find(f => f.id === viewRecord.firmaId)?.ad || '—' },
                { label: 'Bölüm',        value: viewRecord.bolum || '—' },
                { label: 'Sorumlu',      value: viewRecord.sorumlu || '—' },
                { label: 'Durum',        value: viewRecord.durum },
                { label: 'Başlama',      value: viewRecord.baslamaTarihi ? new Date(viewRecord.baslamaTarihi).toLocaleDateString('tr-TR') : '—' },
                { label: 'Bitiş',        value: viewRecord.bitisTarihi ? new Date(viewRecord.bitisTarihi).toLocaleDateString('tr-TR') : '—' },
              ].map(item => (
                <div key={item.label} className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-item)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                </div>
              ))}
            </div>
            {/* Yüklü Evraklar */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(96,165,250,0.2)' }}>
              <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: 'rgba(96,165,250,0.07)', borderBottom: '1px solid rgba(96,165,250,0.15)' }}>
                <i className="ri-attachment-2 text-sm" style={{ color: '#60A5FA' }} />
                <p className="text-xs font-bold" style={{ color: '#60A5FA' }}>Yüklü Evraklar</p>
                <span className="text-[10px] ml-1" style={{ color: 'var(--text-muted)' }}>— Toplu Evrak Yükle ile eklenenler</span>
              </div>
              <div className="p-3">
                <IsIzniEvraklari
                  izinId={viewRecord.id}
                  orgId={org?.id ?? 'unknown'}
                  firmaId={viewRecord.firmaId}
                  izinTuru={viewRecord.tip}
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Silme Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="İş İzni Sil" size="sm" icon="ri-delete-bin-line"
        footer={<><button onClick={() => setDeleteId(null)} className="btn-secondary whitespace-nowrap">İptal</button><button onClick={handleDelete} className="btn-danger whitespace-nowrap">Evet, Sil</button></>}>
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)' }}><i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} /></div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Bu iş iznini silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>İş izni çöp kutusuna taşınacak, oradan geri yükleyebilirsiniz.</p>
        </div>
      </Modal>

      {/* Toplu Silme */}
      <Modal open={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)} title="Toplu Silme Onayı" size="sm" icon="ri-delete-bin-2-line"
        footer={<><button onClick={() => setBulkDeleteConfirm(false)} className="btn-secondary whitespace-nowrap">İptal</button><button onClick={handleBulkDelete} className="btn-danger whitespace-nowrap"><i className="ri-delete-bin-line" /> {selected.size} İş İznini Sil</button></>}>
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}><i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} /></div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}><strong>{selected.size}</strong> iş izni çöp kutusuna taşınacak.</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Çöp kutusundan geri yükleyebilirsiniz.</p>
        </div>
      </Modal>

      <TopluEvrakYukle open={showImport} onClose={() => setShowImport(false)} firmalar={aktivFirmalar} />
    </div>
  );
}
