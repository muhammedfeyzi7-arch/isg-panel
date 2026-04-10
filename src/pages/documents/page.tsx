import { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { EvrakListSkeleton } from '../../components/base/Skeleton';
import type { Evrak, EvrakStatus } from '../../types';
import Modal from '../../components/base/Modal';
import Badge, { getEvrakStatusColor } from '../../components/base/Badge';
import { getEvrakKategori, KATEGORI_META } from '../../utils/evrakKategori';
import BulkEvrakUpload from './components/BulkEvrakUpload';
import { getSignedUrlFromPath } from '@/utils/fileUpload';

const EVRAK_TURLERI = ['Kimlik', 'EK-2', 'Sağlık Raporu', 'Sürücü Belgesi', 'SRC', 'Sertifika / MYK / Diploma', 'Oryantasyon Eğitimi', 'İşbaşı Eğitimi', 'İş Sözleşmesi', 'Diğer'];

const emptyEvrak: Omit<Evrak, 'id' | 'olusturmaTarihi'> = {
  ad: '', tur: 'Kimlik', firmaId: '', personelId: '', durum: 'Eksik',
  yuklemeTarihi: '', gecerlilikTarihi: '', dosyaAdi: '', dosyaBoyutu: 0, dosyaTipi: '', dosyaVeri: '', notlar: '',
};

// Auto-calculate evrak durum based on dates and file
function calcEvrakDurum(dosyaAdi: string | undefined, gecerlilikTarihi: string | undefined): EvrakStatus {
  if (!dosyaAdi) return 'Eksik';
  if (!gecerlilikTarihi) return 'Yüklü';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const gecerlilik = new Date(gecerlilikTarihi);
  gecerlilik.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((gecerlilik.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Süre Dolmuş';
  if (diffDays <= 7) return 'Süre Yaklaşıyor';
  return 'Yüklü';
}

const statusConfig = {
  'Yüklü': { icon: 'ri-checkbox-circle-fill', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.2)' },
  'Eksik': { icon: 'ri-close-circle-fill', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.2)' },
  'Süre Yaklaşıyor': { icon: 'ri-time-fill', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.2)' },
  'Süre Dolmuş': { icon: 'ri-error-warning-fill', color: '#F97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.2)' },
};

export default function EvraklarPage() {
  const { evraklar, firmalar, personeller, addEvrak, updateEvrak, deleteEvrak, addToast, quickCreate, setQuickCreate, org, refreshData, pageLoading } = useApp();
  const isGeziciUzman = org?.osgbRole === 'gezici_uzman';
  // Gezici uzman için atanan firmayı listeye ekle (firmalar listesi boş olabilir)
  const firmaListesiEvrak = isGeziciUzman && org?.id
    ? (firmalar.some(f => !f.silinmis && f.id === org.id)
        ? firmalar.filter(f => !f.silinmis)
        : [{ id: org.id, ad: org.name, silinmis: false } as typeof firmalar[0], ...firmalar.filter(f => !f.silinmis)])
    : firmalar.filter(f => !f.silinmis);
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [turFilter, setTurFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyEvrak });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Toplu silme state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // PersonelDetayModal'dan "Evrak Ekle" butonuyla gelindiğinde pre-fill
  useEffect(() => {
    const state = location.state as { personelId?: string; firmaId?: string; autoOpen?: boolean } | null;
    if (state?.autoOpen) {
      const preForm = {
        ...emptyEvrak,
        personelId: state.personelId || '',
        firmaId: state.firmaId || '',
      };
      setForm(preForm);
      setEditingId(null);
      setFormOpen(true);
      // State'i temizle (sayfayı yenileme senaryosu)
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => {
    if (quickCreate === 'evraklar') {
      setForm({ ...emptyEvrak });
      setEditingId(null);
      setFormOpen(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  // Bildirimden gelen kayıt açma
  useEffect(() => {
    const handleOpenRecord = (e: Event) => {
      const detail = (e as CustomEvent).detail as { module: string; recordId: string };
      if (detail.module !== 'evraklar') return;
      const evrak = evraklar.find(ev => ev.id === detail.recordId);
      if (evrak) openEdit(evrak);
    };
    window.addEventListener('isg_open_record', handleOpenRecord);
    // Sayfa yüklenince localStorage'dan da kontrol et
    try {
      const saved = localStorage.getItem('isg_open_record');
      if (saved) {
        const { module, recordId, ts } = JSON.parse(saved);
        if (module === 'evraklar' && recordId && Date.now() - ts < 5000) {
          const evrak = evraklar.find(ev => ev.id === recordId);
          if (evrak) { openEdit(evrak); localStorage.removeItem('isg_open_record'); }
        }
      }
    } catch { /* ignore */ }
    return () => window.removeEventListener('isg_open_record', handleOpenRecord);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evraklar]);

  const filtPersonel = useMemo(() => {
    if (!form.firmaId) return [];
    return personeller.filter(p => p.firmaId === form.firmaId && !p.silinmis);
  }, [form.firmaId, personeller]);

  // Evrakları gösterirken durumu otomatik hesapla
  const evraklarWithDurum = useMemo(() => evraklar.filter(e => !e.silinmis).map(e => ({
    ...e,
    durum: calcEvrakDurum(e.dosyaAdi, e.gecerlilikTarihi),
  })), [evraklar]);

  const filtered = useMemo(() => evraklarWithDurum
    .filter(e => {
      const q = search.toLowerCase();
      return (!search || e.ad.toLowerCase().includes(q) || e.tur.toLowerCase().includes(q))
        && (!firmaFilter || e.firmaId === firmaFilter)
        && (!statusFilter || e.durum === statusFilter)
        && (!turFilter || e.tur === turFilter);
    })
    .sort((a, b) => {
      const ta = a.olusturmaTarihi ?? '';
      const tb = b.olusturmaTarihi ?? '';
      return tb.localeCompare(ta);
    }), [evraklarWithDurum, search, firmaFilter, statusFilter, turFilter]);

  const allSelected = filtered.length > 0 && filtered.every(e => selected.has(e.id));
  const toggleAll = () => allSelected ? setSelected(new Set()) : setSelected(new Set(filtered.map(e => e.id)));
  const toggleOne = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleBulkDelete = () => {
    selected.forEach(id => deleteEvrak(id));
    addToast(`${selected.size} evrak silindi.`, 'info');
    setSelected(new Set());
    setBulkDeleteConfirm(false);
  };

  const getFirmaAd = (id: string) => firmalar.find(f => f.id === id)?.ad || '—';
  const getPersonelAd = (id?: string) => id ? (personeller.find(p => p.id === id)?.adSoyad || '—') : 'Firma Evrakı';

  const openAdd = () => {
    const defaultFirmaId = isGeziciUzman && org?.id ? org.id : '';
    setForm({ ...emptyEvrak, firmaId: defaultFirmaId });
    setEditingId(null);
    setPendingFile(null);
    setFormOpen(true);
  };
  const openEdit = (e: Evrak) => { setForm({ ...e }); setEditingId(e.id); setPendingFile(null); setFormOpen(true); };

  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleFileChange = (file?: File) => {
    if (!file) return;
    setPendingFile(file);
    setForm(prev => ({
      ...prev,
      dosyaAdi: file.name,
      dosyaBoyutu: file.size,
      dosyaTipi: file.type,
      yuklemeTarihi: new Date().toISOString().split('T')[0],
    }));
  };

  const handleDownload = async (ev: typeof filtered[0]) => {
    if (!ev.dosyaUrl) { addToast('İndirilebilir dosya bulunamadı. Lütfen evrakı tekrar yükleyin.', 'error'); return; }
    try {
      // dosyaUrl filePath veya signed URL olabilir — her iki durumu destekle
      const resolvedUrl = await getSignedUrlFromPath(ev.dosyaUrl);
      if (!resolvedUrl) { addToast('Dosya erişim linki alınamadı.', 'error'); return; }
      const res = await fetch(resolvedUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = ev.dosyaAdi || 'evrak';
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      addToast(`"${ev.dosyaAdi}" indiriliyor...`, 'success');
    } catch { addToast('Dosya indirilemedi.', 'error'); }
  };

  const handlePreview = async (ev: typeof filtered[0]) => {
    if (!ev.dosyaUrl) { addToast('Önizlenecek dosya bulunamadı.', 'error'); return; }
    // dosyaUrl filePath veya signed URL olabilir — her iki durumu destekle
    const resolvedUrl = await getSignedUrlFromPath(ev.dosyaUrl);
    if (!resolvedUrl) { addToast('Dosya erişim linki alınamadı.', 'error'); return; }
    window.open(resolvedUrl, '_blank');
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.ad.trim()) { addToast('Evrak adı zorunludur.', 'error'); return; }
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    setSaving(true);
    try {
      const autoDurum = calcEvrakDurum(form.dosyaAdi, form.gecerlilikTarihi);
      const kategori = getEvrakKategori(form.tur, form.ad);
      const savedForm = { ...form, durum: autoDurum, kategori };

      const { uploadFileToStorage } = await import('@/utils/fileUpload');
      const orgId = org?.id ?? 'unknown';

      if (editingId) {
        let dosyaUrl: string | undefined;
        if (pendingFile) {
          dosyaUrl = await uploadFileToStorage(pendingFile, orgId, 'evrak', editingId) ?? undefined;
          if (!dosyaUrl) {
            addToast('Dosya yüklenemedi. Lütfen tekrar deneyin.', 'error');
            return;
          }
        }
        updateEvrak(editingId, { ...savedForm, ...(dosyaUrl ? { dosyaUrl } : {}) });
        addToast('Evrak güncellendi.', 'success');
      } else {
        let dosyaUrl: string | undefined;
        if (pendingFile) {
          const tempId = crypto.randomUUID();
          dosyaUrl = await uploadFileToStorage(pendingFile, orgId, 'evrak', tempId) ?? undefined;
          if (!dosyaUrl) {
            addToast('Dosya yüklenemedi. Evrak kaydı oluşturulmadı.', 'error');
            return;
          }
        }
        addEvrak({ ...savedForm, ...(dosyaUrl ? { dosyaUrl } : {}) });
        addToast('Evrak eklendi.', 'success');
      }
      setPendingFile(null);
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    deleteEvrak(id); setDeleteConfirm(null);
    addToast('Evrak silindi.', 'info');
  };

  const f = (field: keyof typeof form) => form[field] as string;
  const set = (field: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const statusCounts = useMemo(() => ({
    'Yüklü': evraklarWithDurum.filter(e => e.durum === 'Yüklü').length,
    'Eksik': evraklarWithDurum.filter(e => e.durum === 'Eksik').length,
    'Süre Yaklaşıyor': evraklarWithDurum.filter(e => e.durum === 'Süre Yaklaşıyor').length,
    'Süre Dolmuş': evraklarWithDurum.filter(e => e.durum === 'Süre Dolmuş').length,
  }), [evraklarWithDurum]);

  if (pageLoading) return <EvrakListSkeleton rows={7} />;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Belge Takibi</h1>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>{evraklar.length} toplam evrak — durum otomatik hesaplanır</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={openAdd} className="btn-primary" style={{ fontSize: '12.5px', padding: '7px 14px' }}>
            <i className="ri-file-add-line text-sm" />
            Yeni Evrak
          </button>
          <button
            onClick={() => setBulkOpen(true)}
            className="whitespace-nowrap flex items-center gap-1.5 px-3.5 py-[7px] rounded-xl text-[12.5px] font-semibold text-white transition-all duration-200 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
          >
            <i className="ri-upload-cloud-2-line text-sm" />
            Toplu Yükle
          </button>

        </div>
      </div>

      {/* ── Status Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(statusCounts) as Array<keyof typeof statusCounts>).map(key => {
          const cfg = statusConfig[key] ?? { icon: 'ri-question-line', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.2)' };
          const isActive = statusFilter === key;
          return (
            <div
              key={key}
              className="rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
              style={{
                background: cfg.bg,
                border: `1px solid ${isActive ? cfg.color : cfg.border}`,
                boxShadow: isActive ? `0 0 0 2px ${cfg.color}25` : 'none',
              }}
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${cfg.color}20` }}>
                <i className={`${cfg.icon} text-sm`} style={{ color: cfg.color }} />
              </div>
              <div>
                <p className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>{statusCounts[key]}</p>
                <p className="text-[10.5px] font-medium" style={{ color: cfg.color }}>{key}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2.5 px-4 py-3 rounded-xl isg-card">
        <div className="relative flex-1 min-w-[160px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Evrak adı veya tür ara..." className="isg-input pl-8 text-[12.5px]" />
        </div>
        <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input text-[12.5px]" style={{ width: 'auto', minWidth: '150px' }}>
          <option value="">Tüm Firmalar</option>
          {firmaListesiEvrak.map(fi => <option key={fi.id} value={fi.id}>{fi.ad}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="isg-input text-[12.5px]" style={{ width: 'auto', minWidth: '150px' }}>
          <option value="">Tüm Durumlar</option>
          {['Yüklü', 'Eksik', 'Süre Yaklaşıyor', 'Süre Dolmuş'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={turFilter} onChange={e => setTurFilter(e.target.value)} className="isg-input text-[12.5px]" style={{ width: 'auto', minWidth: '150px' }}>
          <option value="">Tüm Türler</option>
          {EVRAK_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(search || firmaFilter || statusFilter || turFilter) && (
          <button onClick={() => { setSearch(''); setFirmaFilter(''); setStatusFilter(''); setTurFilter(''); }} className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
            <i className="ri-filter-off-line text-xs" /> Temizle
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <i className="ri-list-check text-xs" />
          {filtered.length} sonuç
        </div>
      </div>

      {/* Toplu seçim aksiyonları */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <span className="text-sm font-semibold" style={{ color: '#F87171' }}>{selected.size} evrak seçildi</span>
          <button
            onClick={() => setBulkDeleteConfirm(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <i className="ri-delete-bin-line" /> Seçilenleri Sil
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap ml-auto" style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8' }}>
            Seçimi Kaldır
          </button>
        </div>
      )}

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl p-14 flex flex-col items-center text-center isg-card">
          <div className="w-14 h-14 flex items-center justify-center rounded-xl mb-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
            <i className="ri-file-list-3-line text-2xl" style={{ color: 'var(--text-faint)' }} />
          </div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
            {search || firmaFilter || statusFilter || turFilter ? 'Filtrelerle eşleşen evrak yok' : 'Henüz evrak eklenmedi'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobil kart görünümü */}
          <div className="md:hidden space-y-3">
            {filtered.map(ev => (
              <div key={ev.id} className="isg-card rounded-xl p-4" style={{ background: selected.has(ev.id) ? 'rgba(239,68,68,0.04)' : undefined }}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selected.has(ev.id)} onChange={() => toggleOne(ev.id)} className="cursor-pointer mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ev.ad}</p>
                      <Badge label={ev.durum} color={getEvrakStatusColor(ev.durum)} />
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ev.tur} · {getFirmaAd(ev.firmaId)}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{getPersonelAd(ev.personelId)}</p>
                    {ev.gecerlilikTarihi && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Geçerlilik: {new Date(ev.gecerlilikTarihi).toLocaleDateString('tr-TR')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 justify-end mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <ABtn icon="ri-eye-line" color={ev.dosyaUrl ? '#60A5FA' : '#475569'} onClick={() => handlePreview(ev)} title="Görüntüle" />
                  <ABtn icon="ri-download-line" color={ev.dosyaUrl ? '#10B981' : '#475569'} onClick={() => handleDownload(ev)} title="İndir" />
                  <ABtn icon="ri-edit-line" color="#F59E0B" onClick={() => openEdit(ev)} title="Düzenle" />
                  <ABtn icon="ri-delete-bin-line" color="#EF4444" onClick={() => setDeleteConfirm(ev.id)} title="Sil" />
                </div>
              </div>
            ))}
          </div>

          {/* Masaüstü tablo görünümü */}
          <div className="hidden md:block rounded-xl overflow-hidden isg-card">
            <div className="overflow-x-auto">
              <table className="w-full table-premium">
                <thead>
                  <tr>
                    <th className="w-10 text-center">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" />
                    </th>
                    <th className="text-left">Evrak Adı / Tür</th>
                    <th className="text-left hidden md:table-cell">Firma</th>
                    <th className="text-left hidden lg:table-cell">Personel</th>
                    <th className="text-left">Durum</th>
                    <th className="text-left hidden lg:table-cell">Geçerlilik</th>
                    <th className="w-20 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(ev => (
                    <tr key={ev.id} style={{ background: selected.has(ev.id) ? 'rgba(239,68,68,0.04)' : undefined }}>
                      <td className="text-center">
                        <input type="checkbox" checked={selected.has(ev.id)} onChange={() => toggleOne(ev.id)} className="cursor-pointer" />
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                            style={{ background: ev.dosyaUrl ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${ev.dosyaUrl ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.2)'}` }}>
                            <i className={ev.dosyaUrl ? 'ri-file-text-line text-xs' : 'ri-file-warning-line text-xs'}
                              style={{ color: ev.dosyaUrl ? '#60A5FA' : '#F59E0B' }} />
                          </div>
                          <div>
                            <p className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{ev.ad}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{ev.tur}</p>
                              {ev.dosyaUrl && (
                                <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md"
                                  style={{ background: 'rgba(16,185,129,0.1)', color: '#34D399', border: '1px solid rgba(16,185,129,0.15)' }}>
                                  <i className="ri-cloud-line mr-0.5" />Bulutta
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell"><p className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>{getFirmaAd(ev.firmaId)}</p></td>
                      <td className="hidden lg:table-cell"><p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{getPersonelAd(ev.personelId)}</p></td>
                      <td><Badge label={ev.durum} color={getEvrakStatusColor(ev.durum)} /></td>
                      <td className="hidden lg:table-cell">
                        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                          {ev.gecerlilikTarihi ? new Date(ev.gecerlilikTarihi).toLocaleDateString('tr-TR') : '—'}
                        </p>
                      </td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <ABtn icon="ri-eye-line" color={ev.dosyaAdi || ev.dosyaUrl ? '#60A5FA' : '#475569'} onClick={() => handlePreview(ev)} title="Görüntüle" />
                          <ABtn icon="ri-download-line" color={ev.dosyaAdi || ev.dosyaUrl ? '#10B981' : '#475569'} onClick={() => handleDownload(ev)} title="Dosyayı İndir" />
                          <ABtn icon="ri-edit-line" color="#F59E0B" onClick={() => openEdit(ev)} title="Düzenle" />
                          <ABtn icon="ri-delete-bin-line" color="#EF4444" onClick={() => setDeleteConfirm(ev.id)} title="Sil" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Form Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'Evrak Düzenle' : 'Yeni Evrak Ekle'} size="lg" icon="ri-file-add-line"
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="btn-secondary">İptal</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary"><i className="ri-save-line" /> Kaydet</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Evrak Adı *</label>
            <input value={f('ad')} onChange={e => set('ad', e.target.value)} placeholder="Evrak adı giriniz" className="input-premium" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Firma *</label>
            <select
              value={f('firmaId')}
              onChange={e => set('firmaId', e.target.value)}
              disabled={isGeziciUzman}
              className="input-premium cursor-pointer disabled:opacity-70"
            >
              <option value="">Firma Seçin...</option>
              {firmaListesiEvrak.map(fi => <option key={fi.id} value={fi.id}>{fi.ad}</option>)}
            </select>
            {isGeziciUzman && (
              <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: '#64748B' }}>
                <i className="ri-lock-line" /> Atanan firma otomatik seçildi
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Personel (Opsiyonel)</label>
            <select value={f('personelId')} onChange={e => set('personelId', e.target.value)} disabled={!form.firmaId} className="input-premium cursor-pointer disabled:opacity-40">
              <option value="">Firma Evrakı (Kişisel Değil)</option>
              {filtPersonel.map(p => <option key={p.id} value={p.id}>{p.adSoyad}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Evrak Türü</label>
            <select value={f('tur')} onChange={e => set('tur', e.target.value)} className="input-premium cursor-pointer">
              {EVRAK_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {/* Kategori göstergesi — hangi bölüme gideceğini anlık göster */}
            {(() => {
              const kat = getEvrakKategori(form.tur, form.ad);
              const meta = KATEGORI_META[kat];
              return (
                <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: meta.bgColor, border: `1px solid ${meta.borderColor}` }}>
                  <i className={`${meta.icon} text-xs`} style={{ color: meta.color }} />
                  <span className="text-xs font-medium" style={{ color: meta.color }}>
                    → {meta.label} olarak kaydedilecek
                  </span>
                </div>
              );
            })()}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Evrak Tarihi</label>
            <input type="date" value={f('yuklemeTarihi')} onChange={e => set('yuklemeTarihi', e.target.value)} className="input-premium" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Geçerlilik Süresi (Otomatik Hesapla)</label>
            <select
              className="input-premium cursor-pointer"
              onChange={e => {
                const sure = e.target.value;
                if (!form.yuklemeTarihi || !sure) return;
                const d = new Date(form.yuklemeTarihi);
                if (sure === '3ay') d.setMonth(d.getMonth() + 3);
                else if (sure === '6ay') d.setMonth(d.getMonth() + 6);
                else if (sure === '1yil') d.setFullYear(d.getFullYear() + 1);
                else if (sure === '5yil') d.setFullYear(d.getFullYear() + 5);
                set('gecerlilikTarihi', d.toISOString().split('T')[0]);
              }}
            >
              <option value="">Süre Seçin...</option>
              <option value="3ay">3 Ay</option>
              <option value="6ay">6 Ay</option>
              <option value="1yil">1 Yıl</option>
              <option value="5yil">5 Yıl</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Geçerlilik Tarihi</label>
            <input type="date" value={f('gecerlilikTarihi')} onChange={e => set('gecerlilikTarihi', e.target.value)} className="input-premium" />
          </div>
          {/* Durum bilgi satırı */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <i className="ri-information-line text-sm" style={{ color: '#818CF8' }} />
              <p className="text-xs" style={{ color: '#94A3B8' }}>
                Durum otomatik hesaplanır: dosya yoksa <strong className="text-red-400">Eksik</strong>, geçerlilik tarihi 7 günden az kaldıysa <strong className="text-amber-400">Süre Yaklaşıyor</strong>, geçtiyse <strong className="text-orange-400">Süre Dolmuş</strong>, aksi halde <strong className="text-green-400">Yüklü</strong>.
              </p>
            </div>
          </div>
          {/* File Upload */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Dosya Yükle (PDF / JPG / PNG)</label>
            <div
              className="rounded-xl p-6 text-center cursor-pointer transition-all duration-200"
              style={{ border: '2px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
              onClick={() => fileRef.current?.click()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.background = 'rgba(59,130,246,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0]); }}
            >
              {form.dosyaAdi ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(16,185,129,0.12)' }}>
                    <i className="ri-file-check-line text-xl" style={{ color: '#10B981' }} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-200">{form.dosyaAdi}</p>
                    <p className="text-xs" style={{ color: '#475569' }}>{form.dosyaBoyutu ? `${(form.dosyaBoyutu / 1024).toFixed(1)} KB` : ''}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 flex items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <i className="ri-upload-cloud-2-line text-2xl" style={{ color: '#334155' }} />
                  </div>
                  <p className="text-sm font-medium text-slate-400">Dosyayı buraya sürükleyin veya tıklayın</p>
                  <p className="text-xs mt-1" style={{ color: '#334155' }}>PDF, JPG, PNG desteklenir • Maks. 50MB</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => handleFileChange(e.target.files?.[0])} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Notlar</label>
            <textarea
              value={f('notlar')}
              onChange={e => set('notlar', e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#E2E8F0' }}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Evrakı Sil" size="sm" icon="ri-delete-bin-line"
        footer={
          <>
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">İptal</button>
            <button onClick={() => handleDelete(deleteConfirm!)} className="btn-danger"><i className="ri-delete-bin-line" /> Evet, Sil</button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>Bu evrakı silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Evrak çöp kutusuna taşınacak, oradan geri yükleyebilirsiniz.</p>
        </div>
      </Modal>

      {/* Toplu Silme Onay Modal */}
      <Modal open={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)} title="Toplu Silme Onayı" size="sm" icon="ri-delete-bin-2-line"
        footer={
          <>
            <button onClick={() => setBulkDeleteConfirm(false)} className="btn-secondary">İptal</button>
            <button onClick={handleBulkDelete} className="btn-danger">
              <i className="ri-delete-bin-line" /> {selected.size} Evrakı Sil
            </button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>
            <strong>{selected.size}</strong> evrak çöp kutusuna taşınacak.
          </p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Çöp kutusundan geri yükleyebilirsiniz.</p>
        </div>
      </Modal>

      {/* Bulk Upload Modal */}
      <BulkEvrakUpload open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </div>
  );
}

function ABtn({ icon, color, onClick, title }: { icon: string; color: string; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 hover:scale-110"
      style={{ color: '#475569' }}
      onMouseEnter={e => { e.currentTarget.style.color = color; e.currentTarget.style.background = `${color}18`; }}
      onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent'; }}
    >
      <i className={`${icon} text-sm`} />
    </button>
  );
}
