import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import type { IsIzni, IsIzniTip, IsIzniStatus } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import { generateIsIzniNo } from '@/store/useStore';
import Modal from '@/components/base/Modal';
import { generateIsIzniPdf } from './utils/isIzniPdfGenerator';
import IsIzniImport from './components/IsIzniImport';
import IsIzniKartlar from './components/IsIzniKartlar';
import IsIzniTakvim from './components/IsIzniTakvim';
import IsIzniTipAlanlari from './components/IsIzniTipAlanlari';
import { uploadFileToStorage } from '@/utils/fileUpload';

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

type ViewMode = 'tablo' | 'kart' | 'takvim';

const emptyForm: Record<string, string | boolean | number | string[]> = {
  tip: 'Genel' as IsIzniTip,
  firmaId: '',
  bolum: '',
  sorumlu: '',
  calisanlar: '',
  selectedCalisanIds: [] as string[],
  calisanSayisi: 1,
  aciklama: '',
  tehlikeler: '',
  onlemler: '',
  gerekliEkipman: '',
  baslamaTarihi: '',
  bitisTarihi: '',
  durum: 'Onay Bekliyor' as IsIzniStatus,
  onaylayanKisi: '',
  onayTarihi: '',
  notlar: '',
  olusturanKisi: '',
  belgeMevcut: false,
  belgeDosyaAdi: '',
  belgeDosyaBoyutu: 0,
  belgeDosyaTipi: '',
  // Tip bazlı özel alanlar
  atesBolgesi: '', yanginSondurme: '', gazOlcum: '', nobetci: '',
  yukseklik: '', iskeleTipi: '', emniyet: '', ankraj: '',
  alanBoyutu: '', havalandirma: '', oksijen: '', kurtarmaEkip: '',
  gerilim: '', devreDisi: '', yalitim: '', elektrikci: '',
  kazıDerinligi: '', zeminTipi: '', iksa: '', altyapi: '',
};

function getDaysLeft(bitisTarihi: string): number | null {
  if (!bitisTarihi) return null;
  const end = new Date(bitisTarihi);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
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
  const [viewMode, setViewMode] = useState<ViewMode>('kart');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewRecord, setViewRecord] = useState<IsIzni | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean | number | string[]>>({ ...emptyForm });
  const [refreshing, setRefreshing] = useState(false);
  const [showBelgeModal, setShowBelgeModal] = useState(false);
  const [savedIsIzni, setSavedIsIzni] = useState<IsIzni | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [statusChangeId, setStatusChangeId] = useState<string | null>(null);
  const [showEvrakModal, setShowEvrakModal] = useState<string | null>(null);
  const [evrakForm, setEvrakForm] = useState({ ad: '', tur: '', notlar: '', dosya: null as File | null });
  const [pendingBelge, setPendingBelge] = useState<File | null>(null);
  const evrakFileRef = useRef<HTMLInputElement>(null);
  const formFileRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef<boolean>(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const aktivFirmalar = useMemo(() => firmalar.filter(f => !f.silinmis), [firmalar]);

  const firmaPersonelleri = useMemo(() => {
    if (!form.firmaId) return [];
    return personeller.filter(p => p.firmaId === form.firmaId && !p.silinmis && p.durum === 'Aktif');
  }, [personeller, form.firmaId]);

  useEffect(() => {
    if (quickCreate === 'is-izinleri') {
      setEditId(null);
      setForm({ ...emptyForm, olusturanKisi: currentUser.ad });
      setShowModal(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate, currentUser.ad]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return isIzinleri
      .filter(iz => !(iz as unknown as { silinmis?: boolean }).silinmis)
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

  const aktifIsIzinleri = useMemo(() => isIzinleri.filter(i => !(i as unknown as { silinmis?: boolean }).silinmis), [isIzinleri]);

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

  const sf = (field: string, value: string | boolean | number | string[]) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleCalisan = (id: string) => {
    setForm(prev => {
      const ids = (prev.selectedCalisanIds as string[]).includes(id)
        ? (prev.selectedCalisanIds as string[]).filter(x => x !== id)
        : [...(prev.selectedCalisanIds as string[]), id];
      const names = ids.map(i => personeller.find(p => p.id === i)?.adSoyad ?? '').filter(Boolean).join(', ');
      return { ...prev, selectedCalisanIds: ids, calisanlar: names, calisanSayisi: ids.length || (prev.calisanSayisi as number) };
    });
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ ...emptyForm, olusturanKisi: currentUser.ad });
    setShowModal(true);
  };

  const openEdit = (iz: IsIzni) => {
    setEditId(iz.id);
    setPendingBelge(null);
    setForm({
      ...emptyForm,
      tip: iz.tip, firmaId: iz.firmaId, bolum: iz.bolum, sorumlu: iz.sorumlu,
      calisanlar: iz.calisanlar, selectedCalisanIds: [], calisanSayisi: iz.calisanSayisi,
      aciklama: iz.aciklama, tehlikeler: iz.tehlikeler, onlemler: iz.onlemler,
      gerekliEkipman: iz.gerekliEkipman, baslamaTarihi: iz.baslamaTarihi,
      bitisTarihi: iz.bitisTarihi, durum: iz.durum, onaylayanKisi: iz.onaylayanKisi,
      onayTarihi: iz.onayTarihi || '', notlar: iz.notlar, olusturanKisi: iz.olusturanKisi,
      belgeMevcut: iz.belgeMevcut ?? false,
      belgeDosyaAdi: iz.belgeDosyaAdi ?? '',
      belgeDosyaBoyutu: iz.belgeDosyaBoyutu ?? 0,
      belgeDosyaTipi: iz.belgeDosyaTipi ?? '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!String(form.aciklama).trim()) { addToast('Açıklama zorunludur.', 'error'); return; }
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (!form.baslamaTarihi) { addToast('Başlama tarihi zorunludur.', 'error'); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;

    const { selectedCalisanIds: _ids, ...saveData } = form as Record<string, unknown> & { selectedCalisanIds: string[] };
    const orgId = org?.id ?? 'unknown';

    try {
      if (editId) {
        updateIsIzni(editId, saveData as Partial<IsIzni>);
        if (pendingBelge) {
          const url = await uploadFileToStorage(pendingBelge, orgId, 'is-izni', editId);
          if (url) updateIsIzni(editId, { belgeDosyaUrl: url });
        }
        addToast('İş izni güncellendi.', 'success');
        setShowModal(false); setPendingBelge(null);
      } else {
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
    const calisanlarList = (form.selectedCalisanIds as string[]).length > 0
      ? personeller.filter(p => (form.selectedCalisanIds as string[]).includes(p.id))
      : [];
    generateIsIzniPdf(savedIsIzni, firma, calisanlarList);
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

  const handleEvrakEkle = async () => {
    if (!showEvrakModal || !evrakForm.ad.trim() || !evrakForm.dosya) {
      addToast('Evrak adı ve dosya zorunludur.', 'error'); return;
    }
    const iz = isIzinleri.find(i => i.id === showEvrakModal);
    if (!iz) return;
    const orgId = org?.id ?? 'unknown';
    const evrakId = Math.random().toString(36).substring(2);
    const yeniEvrak = {
      id: evrakId, ad: evrakForm.ad, tur: evrakForm.tur || 'Belge',
      yuklemeTarihi: new Date().toISOString(), dosyaAdi: evrakForm.dosya.name,
      dosyaBoyutu: evrakForm.dosya.size, dosyaTipi: evrakForm.dosya.type,
      dosyaUrl: '', notlar: evrakForm.notlar,
    };
    updateIsIzni(iz.id, { evraklar: [...(iz.evraklar || []), yeniEvrak] });
    const url = await uploadFileToStorage(evrakForm.dosya, orgId, 'is-izni-evrak', evrakId);
    if (url) {
      const guncelIz = isIzinleri.find(i => i.id === showEvrakModal);
      if (guncelIz) {
        updateIsIzni(iz.id, { evraklar: (guncelIz.evraklar || []).map(e => e.id === evrakId ? { ...e, dosyaUrl: url } : e) });
      }
    }
    addToast(`"${evrakForm.ad}" evrakı eklendi.`, 'success');
    setShowEvrakModal(null); setEvrakForm({ ad: '', tur: '', notlar: '', dosya: null });
  };

  const handleEvrakSil = (izId: string, evrakId: string) => {
    const iz = isIzinleri.find(i => i.id === izId);
    if (!iz) return;
    updateIsIzni(izId, { evraklar: (iz.evraklar || []).filter(e => e.id !== evrakId) });
    addToast('Evrak silindi.', 'success');
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
          {/* View mode toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--border-main)' }}>
            {([
              { mode: 'kart' as ViewMode, icon: 'ri-layout-grid-line', label: 'Kart' },
              { mode: 'tablo' as ViewMode, icon: 'ri-list-check', label: 'Tablo' },
              { mode: 'takvim' as ViewMode, icon: 'ri-calendar-line', label: 'Takvim' },
            ]).map(v => (
              <button
                key={v.mode}
                onClick={() => setViewMode(v.mode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                style={viewMode === v.mode
                  ? { background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: 'white' }
                  : { color: 'var(--text-muted)', background: 'transparent' }
                }
              >
                <i className={v.icon} />{v.label}
              </button>
            ))}
          </div>

          <button onClick={async () => { setRefreshing(true); await refreshData(); setRefreshing(false); }} disabled={refreshing} className="btn-secondary whitespace-nowrap">
            <i className={`ri-refresh-line mr-1 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Yenileniyor...' : 'Yenile'}
          </button>
          {canCreate && (
            <>
              <button onClick={() => setShowImport(true)} className="btn-secondary whitespace-nowrap">
                <i className="ri-file-excel-2-line mr-1" />Excel İçe Aktar
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
          { label: 'Toplam',       value: stats.total,        icon: 'ri-shield-keyhole-line',  color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
          { label: 'Onay Bekliyor', value: stats.onayBekliyor, icon: 'ri-lock-line',            color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Onaylandı',    value: stats.onaylandi,    icon: 'ri-checkbox-circle-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Reddedildi',   value: stats.reddedildi,   icon: 'ri-close-circle-line',    color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
          { label: 'Süresi Dolan', value: stats.suresiDolan,  icon: 'ri-alarm-warning-line',   color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
          { label: 'Yaklaşan',     value: stats.yaklasan,     icon: 'ri-timer-line',           color: '#FB923C', bg: 'rgba(251,146,60,0.1)' },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="İzin no, açıklama, sorumlu ara..." className="isg-input pl-9" />
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

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="isg-card rounded-xl py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <i className="ri-shield-keyhole-line text-3xl" style={{ color: '#60A5FA' }} />
          </div>
          <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>İş izni kaydı bulunamadı</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-faint)' }}>Yeni iş izni oluşturmak için butonu kullanın</p>
          {canCreate && <button onClick={openAdd} className="btn-primary mt-5"><i className="ri-add-line" /> Yeni İş İzni</button>}
        </div>
      ) : viewMode === 'takvim' ? (
        <IsIzniTakvim izinler={filtered} firmalar={firmalar} onView={setViewRecord} />
      ) : viewMode === 'kart' ? (
        <IsIzniKartlar
          izinler={filtered}
          firmalar={firmalar}
          canEdit={canEdit}
          canDelete={canDelete}
          onView={setViewRecord}
          onEdit={openEdit}
          onDelete={setDeleteId}
          onStatusChange={handleStatusChange}
          onPdf={iz => { const f = firmalar.find(x => x.id === iz.firmaId); generateIsIzniPdf(iz, f, personeller.filter(p => iz.calisanlar.includes(p.adSoyad))); }}
          onEvrak={setShowEvrakModal}
        />
      ) : (
        /* Tablo görünümü */
        <div className="isg-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-premium w-full">
              <thead>
                <tr>
                  {canDelete && <th className="w-10 text-center"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" /></th>}
                  <th className="text-left">İzin No</th>
                  <th className="text-left">Tip</th>
                  <th className="text-left hidden md:table-cell">Firma / Bölüm</th>
                  <th className="text-left hidden lg:table-cell">Sorumlu</th>
                  <th className="text-left hidden lg:table-cell">Tarih Aralığı</th>
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
                      <td className="hidden md:table-cell">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{firma?.ad || '—'}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{iz.bolum || '—'}</p>
                      </td>
                      <td className="hidden lg:table-cell"><span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{iz.sorumlu || '—'}</span></td>
                      <td className="hidden lg:table-cell">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {iz.baslamaTarihi ? new Date(iz.baslamaTarihi).toLocaleDateString('tr-TR') : '—'}
                          {iz.bitisTarihi ? ` → ${new Date(iz.bitisTarihi).toLocaleDateString('tr-TR')}` : ''}
                        </span>
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
                          <button onClick={() => setShowEvrakModal(iz.id)} title="Evrak Ekle" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}><i className="ri-attachment-2 text-xs" /></button>
                          <button onClick={() => { const f = firmalar.find(x => x.id === iz.firmaId); generateIsIzniPdf(iz, f, personeller.filter(p => iz.calisanlar.includes(p.adSoyad))); }} title="PDF" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}><i className="ri-file-pdf-line text-xs" /></button>
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

      {/* Form Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'İş İzni Düzenle' : 'Yeni İş İzni Oluştur'} size="lg" icon="ri-shield-keyhole-line"
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary whitespace-nowrap">İptal</button><button onClick={handleSave} className="btn-primary whitespace-nowrap"><i className={editId ? 'ri-save-line' : 'ri-add-line'} /> {editId ? 'Güncelle' : 'Oluştur'}</button></>}>
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

          {/* Onay akışı uyarısı */}
          {form.durum === 'Onay Bekliyor' && !editId && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <i className="ri-lock-line flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: '#F59E0B' }}>Onay Akışı Aktif</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>İş izni "Onay Bekliyor" durumunda oluşturulacak. Yetkili kişi onaylayana kadar kilitli kalır.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">İzin Tipi *</label>
              <select value={String(form.tip)} onChange={e => sf('tip', e.target.value)} className={inp}>
                {TIPLER.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Firma *</label>
              <select value={String(form.firmaId)} onChange={e => { sf('firmaId', e.target.value); setForm(prev => ({ ...prev, firmaId: e.target.value, selectedCalisanIds: [], calisanlar: '' })); }} className={inp}>
                <option value="">Firma Seçin</option>
                {aktivFirmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Bölüm / Alan</label>
              <input value={String(form.bolum)} onChange={e => sf('bolum', e.target.value)} placeholder="Çalışma alanı..." className={inp} />
            </div>
            <div>
              <label className="form-label">Sorumlu Kişi</label>
              <input value={String(form.sorumlu)} onChange={e => sf('sorumlu', e.target.value)} placeholder="Ad Soyad" className={inp} />
            </div>
            <div>
              <label className="form-label">Başlama Tarihi *</label>
              <input type="date" value={String(form.baslamaTarihi)} onChange={e => sf('baslamaTarihi', e.target.value)} className={inp} />
            </div>
            <div>
              <label className="form-label">Bitiş Tarihi</label>
              <input type="date" value={String(form.bitisTarihi)} onChange={e => sf('bitisTarihi', e.target.value)} className={inp} />
            </div>
            <div>
              <label className="form-label">Durum</label>
              <select value={String(form.durum)} onChange={e => sf('durum', e.target.value as IsIzniStatus)} className={inp}>
                {DURUMLAR.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Çalışan Sayısı</label>
              <input type="number" min={1} value={Number(form.calisanSayisi)} onChange={e => sf('calisanSayisi', parseInt(e.target.value) || 1)} className={inp} />
            </div>

            {/* Çalışanlar */}
            <div className="sm:col-span-2">
              <label className="form-label">
                Çalışanlar
                {form.firmaId && firmaPersonelleri.length > 0 && (
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>({(form.selectedCalisanIds as string[]).length}/{firmaPersonelleri.length} seçildi)</span>
                )}
              </label>
              {form.firmaId && firmaPersonelleri.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1 mb-3">
                  {firmaPersonelleri.map(p => (
                    <label key={p.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-150"
                      style={{ background: (form.selectedCalisanIds as string[]).includes(p.id) ? 'rgba(96,165,250,0.1)' : 'var(--bg-item)', border: (form.selectedCalisanIds as string[]).includes(p.id) ? '1px solid rgba(96,165,250,0.3)' : '1px solid var(--bg-item-border)' }}>
                      <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                        style={(form.selectedCalisanIds as string[]).includes(p.id) ? { background: 'linear-gradient(135deg, #60A5FA, #818CF8)' } : { background: 'var(--bg-input)', border: '1.5px solid var(--border-main)' }}>
                        {(form.selectedCalisanIds as string[]).includes(p.id) && <i className="ri-check-line text-white text-[10px]" />}
                      </div>
                      <input type="checkbox" checked={(form.selectedCalisanIds as string[]).includes(p.id)} onChange={() => toggleCalisan(p.id)} className="hidden" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{p.adSoyad}</p>
                        {(p.gorev || p.departman) && <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{p.gorev || p.departman}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <label className="flex items-center gap-2 text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  <i className="ri-edit-line" />Elle Giriş (Listede olmayanları buraya yazın)
                </label>
                <textarea value={String(form.calisanlar)} onChange={e => sf('calisanlar', e.target.value)} placeholder="Çalışan adlarını virgülle ayırarak yazın..." rows={2} maxLength={500} className={`${inp} resize-y`} />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="form-label">İş Açıklaması *</label>
              <textarea value={String(form.aciklama)} onChange={e => sf('aciklama', e.target.value)} placeholder="Yapılacak işin detaylı açıklaması..." rows={3} maxLength={500} className={`${inp} resize-y`} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Tehlikeler / Riskler</label>
              <textarea value={String(form.tehlikeler)} onChange={e => sf('tehlikeler', e.target.value)} placeholder="Tespit edilen tehlikeler ve riskler..." rows={2} maxLength={500} className={`${inp} resize-y`} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Alınacak Önlemler</label>
              <textarea value={String(form.onlemler)} onChange={e => sf('onlemler', e.target.value)} placeholder="Güvenlik önlemleri ve kontroller..." rows={2} maxLength={500} className={`${inp} resize-y`} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Gerekli Ekipman / KKD</label>
              <input value={String(form.gerekliEkipman)} onChange={e => sf('gerekliEkipman', e.target.value)} placeholder="Baret, emniyet kemeri, eldiven..." className={inp} />
            </div>

            {/* Tip bazlı özel alanlar */}
            {form.tip !== 'Genel' && (
              <div className="sm:col-span-2">
                <IsIzniTipAlanlari tip={form.tip as IsIzniTip} form={form as Record<string, string | boolean | number>} onChange={sf} inp={inp} />
              </div>
            )}

            <div>
              <label className="form-label">Onaylayan Kişi</label>
              <input value={String(form.onaylayanKisi)} onChange={e => sf('onaylayanKisi', e.target.value)} placeholder="Ad Soyad / Ünvan" className={inp} />
            </div>
            <div>
              <label className="form-label">Onay Tarihi</label>
              <input type="date" value={String(form.onayTarihi)} onChange={e => sf('onayTarihi', e.target.value)} className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Notlar</label>
              <textarea value={String(form.notlar)} onChange={e => sf('notlar', e.target.value)} placeholder="Ek notlar..." rows={2} maxLength={500} className={`${inp} resize-y`} />
            </div>

            {/* Belge */}
            <div className="sm:col-span-2">
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.1)' }}>
                      <i className="ri-file-text-line text-sm" style={{ color: '#3B82F6' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Belge Mevcut mu?</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>İş iznine ait fiziksel veya dijital belge var mı?</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {(['Evet', 'Hayır'] as const).map(opt => (
                      <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                        <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
                          style={{ borderColor: (opt === 'Evet' ? form.belgeMevcut : !form.belgeMevcut) ? '#3B82F6' : 'var(--border-main)', background: (opt === 'Evet' ? form.belgeMevcut : !form.belgeMevcut) ? '#3B82F6' : 'transparent' }}
                          onClick={() => sf('belgeMevcut', opt === 'Evet')}>
                          {(opt === 'Evet' ? form.belgeMevcut : !form.belgeMevcut) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {form.belgeMevcut && (
                  <div className="rounded-xl p-4 text-center cursor-pointer transition-all mt-2" style={{ border: '2px dashed rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.03)' }}
                    onClick={() => formFileRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { addToast('Dosya 10MB\'ı aşamaz.', 'error'); return; } setPendingBelge(file); sf('belgeDosyaAdi', file.name); sf('belgeDosyaBoyutu', file.size); sf('belgeDosyaTipi', file.type); }}>
                    {form.belgeDosyaAdi ? (
                      <div className="flex items-center justify-center gap-2">
                        <i className="ri-file-check-line text-xl" style={{ color: '#10B981' }} />
                        <div className="text-left">
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{String(form.belgeDosyaAdi)}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{form.belgeDosyaBoyutu ? `${(Number(form.belgeDosyaBoyutu) / 1024).toFixed(1)} KB` : ''} — Değiştirmek için tıklayın</p>
                        </div>
                      </div>
                    ) : (
                      <><i className="ri-upload-cloud-2-line text-2xl mb-1" style={{ color: '#3B82F6' }} /><p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Belgeyi yükleyin</p><p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>PDF, Word, Excel, JPG, PNG • Maks. 10MB</p></>
                    )}
                  </div>
                )}
                <input ref={formFileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" className="hidden"
                  onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { addToast('Dosya 10MB\'ı aşamaz.', 'error'); return; } setPendingBelge(file); sf('belgeDosyaAdi', file.name); sf('belgeDosyaBoyutu', file.size); sf('belgeDosyaTipi', file.type); e.target.value = ''; }} />
              </div>
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
        <Modal open={!!viewRecord} onClose={() => setViewRecord(null)} title={`İzin Detayı — ${viewRecord.izinNo}`} size="lg" icon="ri-shield-keyhole-line"
          footer={<><button onClick={() => { const f = firmalar.find(x => x.id === viewRecord.firmaId); generateIsIzniPdf(viewRecord, f, personeller.filter(p => viewRecord.calisanlar.includes(p.adSoyad))); }} className="btn-secondary whitespace-nowrap"><i className="ri-file-pdf-line" /> PDF Oluştur</button><button onClick={() => setViewRecord(null)} className="btn-primary whitespace-nowrap">Kapat</button></>}>
          <div className="space-y-4">
            {/* Onay durumu banner */}
            {viewRecord.durum === 'Onay Bekliyor' && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <i className="ri-lock-line flex-shrink-0" style={{ color: '#F59E0B' }} />
                <div className="flex-1">
                  <p className="text-xs font-semibold" style={{ color: '#F59E0B' }}>Bu iş izni onay bekliyor</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Yetkili kişi onaylayana kadar kilitli durumda.</p>
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
                { label: 'İzin No', value: viewRecord.izinNo },
                { label: 'Tip', value: viewRecord.tip },
                { label: 'Firma', value: firmalar.find(f => f.id === viewRecord.firmaId)?.ad || '—' },
                { label: 'Bölüm', value: viewRecord.bolum || '—' },
                { label: 'Sorumlu', value: viewRecord.sorumlu || '—' },
                { label: 'Çalışan Sayısı', value: String(viewRecord.calisanSayisi) },
                { label: 'Başlama', value: viewRecord.baslamaTarihi ? new Date(viewRecord.baslamaTarihi).toLocaleDateString('tr-TR') : '—' },
                { label: 'Bitiş', value: viewRecord.bitisTarihi ? new Date(viewRecord.bitisTarihi).toLocaleDateString('tr-TR') : '—' },
                { label: 'Onaylayan', value: viewRecord.onaylayanKisi || '—' },
                { label: 'Durum', value: viewRecord.durum },
              ].map(item => (
                <div key={item.label} className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-item)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                </div>
              ))}
            </div>
            {viewRecord.aciklama && <div className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-item)' }}><p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Açıklama</p><p className="text-sm" style={{ color: 'var(--text-primary)' }}>{viewRecord.aciklama}</p></div>}
            {viewRecord.tehlikeler && <div className="px-3 py-2.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}><p className="text-xs font-semibold mb-1" style={{ color: '#EF4444' }}>Tehlikeler / Riskler</p><p className="text-sm" style={{ color: 'var(--text-primary)' }}>{viewRecord.tehlikeler}</p></div>}
            {viewRecord.onlemler && <div className="px-3 py-2.5 rounded-lg" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}><p className="text-xs font-semibold mb-1" style={{ color: '#22C55E' }}>Alınan Önlemler</p><p className="text-sm" style={{ color: 'var(--text-primary)' }}>{viewRecord.onlemler}</p></div>}

            {(viewRecord.evraklar?.length ?? 0) > 0 && (
              <div className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-item)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Ekli Evraklar ({viewRecord.evraklar!.length})</p>
                  {canEdit && <button onClick={() => { setViewRecord(null); setShowEvrakModal(viewRecord.id); }} className="text-xs px-2 py-1 rounded cursor-pointer" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}>+ Ekle</button>}
                </div>
                <div className="space-y-2">
                  {viewRecord.evraklar!.map(evrak => (
                    <div key={evrak.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(59,130,246,0.12)' }}><i className="ri-file-text-line text-sm" style={{ color: '#3B82F6' }} /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{evrak.ad}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{evrak.tur} • {(evrak.dosyaBoyutu / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {evrak.dosyaUrl && <a href={evrak.dosyaUrl} target="_blank" rel="noopener noreferrer" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }} title="İndir"><i className="ri-download-line text-xs" /></a>}
                        {canEdit && <button onClick={() => handleEvrakSil(viewRecord.id, evrak.id)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }} title="Sil"><i className="ri-delete-bin-line text-xs" /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}><strong>{selected.size}</strong> iş izni çöp kutusuna taşınacak.</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Çöp kutusundan geri yükleyebilirsiniz.</p>
        </div>
      </Modal>

      <IsIzniImport open={showImport} onClose={() => setShowImport(false)} firmalar={aktivFirmalar}
        onImport={(rows) => {
          let count = 0;
          rows.forEach(row => { addIsIzni({ tip: row.tip, firmaId: row.firmaId, bolum: row.bolum, sorumlu: row.sorumlu, calisanlar: row.calisanlar, calisanSayisi: row.calisanSayisi, aciklama: row.aciklama, tehlikeler: row.tehlikeler, onlemler: row.onlemler, gerekliEkipman: row.gerekliEkipman, baslamaTarihi: row.baslamaTarihi, bitisTarihi: row.bitisTarihi, durum: row.durum, onaylayanKisi: row.onaylayanKisi, onayTarihi: row.onayTarihi, notlar: row.notlar, olusturanKisi: row.olusturanKisi }); count++; });
          addToast(`${count} iş izni başarıyla içe aktarıldı.`, 'success');
        }}
      />

      {/* Evrak Ekleme Modal */}
      {showEvrakModal && (
        <Modal open={!!showEvrakModal} onClose={() => { setShowEvrakModal(null); setEvrakForm({ ad: '', tur: '', notlar: '', dosya: null }); }} title="İş İznine Evrak Ekle" size="md" icon="ri-attachment-2"
          footer={<><button onClick={() => { setShowEvrakModal(null); setEvrakForm({ ad: '', tur: '', notlar: '', dosya: null }); }} className="btn-secondary whitespace-nowrap">İptal</button><button onClick={handleEvrakEkle} disabled={!evrakForm.ad.trim() || !evrakForm.dosya} className="btn-primary whitespace-nowrap"><i className="ri-upload-line mr-1" /> Evrak Ekle</button></>}>
          <div className="space-y-4">
            <div>
              <label className="form-label">Evrak Adı *</label>
              <input value={evrakForm.ad} onChange={e => setEvrakForm(prev => ({ ...prev, ad: e.target.value }))} placeholder="Örn: Risk Analizi, Çalışma Talimatı..." className={inp} />
            </div>
            <div>
              <label className="form-label">Evrak Türü</label>
              <select value={evrakForm.tur} onChange={e => setEvrakForm(prev => ({ ...prev, tur: e.target.value }))} className={inp}>
                <option value="">Tür Seçin</option>
                <option value="Risk Analizi">Risk Analizi</option>
                <option value="Çalışma Talimatı">Çalışma Talimatı</option>
                <option value="Eğitim Belgesi">Eğitim Belgesi</option>
                <option value="Yöntem Belgesi">Yöntem Belgesi</option>
                <option value="Onay Belgesi">Onay Belgesi</option>
                <option value="Diğer">Diğer</option>
              </select>
            </div>
            <div>
              <label className="form-label">Dosya *</label>
              <div className="rounded-xl p-4 text-center cursor-pointer transition-all" style={{ border: '2px dashed var(--border-subtle)', background: 'var(--bg-item)' }} onClick={() => evrakFileRef.current?.click()}>
                {evrakForm.dosya ? (
                  <div className="flex items-center justify-center gap-2">
                    <i className="ri-file-check-line text-xl" style={{ color: '#10B981' }} />
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{evrakForm.dosya.name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({(evrakForm.dosya.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <><i className="ri-upload-cloud-2-line text-2xl mb-1" style={{ color: 'var(--text-faint)' }} /><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Dosya yüklemek için tıklayın</p><p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>PDF, JPG, PNG • Maks. 10MB</p></>
                )}
              </div>
              <input ref={evrakFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f && f.size <= 10 * 1024 * 1024) { setEvrakForm(prev => ({ ...prev, dosya: f })); } else if (f) { addToast('Dosya boyutu 10MB\'ı aşamaz.', 'error'); } }} />
            </div>
            <div>
              <label className="form-label">Notlar</label>
              <textarea value={evrakForm.notlar} onChange={e => setEvrakForm(prev => ({ ...prev, notlar: e.target.value }))} placeholder="Evrak hakkında notlar..." rows={2} className={`${inp} resize-y`} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
