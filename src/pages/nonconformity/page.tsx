import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import type { Uygunsuzluk } from '../../types';
import { STATUS_CONFIG, SEV_CONFIG } from './utils/statusHelper';
import NonconformityForm from './components/NonconformityForm';
import KapatmaModal from './components/KapatmaModal';
import DetailModal from './components/DetailModal';
import ReportBuilder from './components/ReportBuilder';
import DofImport from './components/DofImport';
import Modal from '../../components/base/Modal';
import { usePermissions } from '../../hooks/usePermissions';

export default function UygunsuzluklarPage() {
  const {
    uygunsuzluklar, firmalar, personeller,
    deleteUygunsuzluk, addUygunsuzluk, addToast, quickCreate, setQuickCreate,
    org, dataLoading, refreshData,
  } = useApp();
  const { canEdit, canCreate, canDelete, isReadOnly, role } = usePermissions();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (refreshing || dataLoading) return;
    setRefreshing(true);
    try {
      await refreshData();
      addToast('Veriler güncellendi.', 'success');
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, dataLoading, refreshData, addToast]);

  const canCreateNonconformity = canCreate || role === 'denetci';
  const canCloseNonconformity = canEdit || role === 'denetci';

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<Uygunsuzluk | null>(null);
  const [kapatmaRecord, setKapatmaRecord] = useState<Uygunsuzluk | null>(null);
  const [detailRecord, setDetailRecord] = useState<Uygunsuzluk | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    if (quickCreate === 'uygunsuzluklar') {
      setEditRecord(null);
      setShowForm(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  const aktif = useMemo(() => uygunsuzluklar.filter(u => !u.silinmis && !u.cascadeSilindi), [uygunsuzluklar]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return aktif
      .filter(u => {
        if (firmaFilter && u.firmaId !== firmaFilter) return false;
        if (statusFilter && u.durum !== statusFilter) return false;
        if (dateFrom && u.tarih && u.tarih < dateFrom) return false;
        if (dateTo && u.tarih && u.tarih > dateTo) return false;
        if (q) {
          const firma = firmalar.find(f => f.id === u.firmaId);
          if (
            !u.baslik.toLowerCase().includes(q) &&
            !(firma?.ad.toLowerCase().includes(q) ?? false) &&
            !(u.acilisNo?.toLowerCase().includes(q) ?? false)
          ) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ta = a.olusturmaTarihi ?? '';
        const tb = b.olusturmaTarihi ?? '';
        return tb.localeCompare(ta);
      });
  }, [aktif, search, firmaFilter, statusFilter, dateFrom, dateTo, firmalar]);

  const stats = useMemo(() => ({
    total: aktif.length,
    acik: aktif.filter(u => u.durum === 'Açık').length,
    kapandi: aktif.filter(u => u.durum === 'Kapandı').length,
    kritik: aktif.filter(u => u.severity === 'Kritik' && u.durum === 'Açık').length,
  }), [aktif]);

  const allSelected = filtered.length > 0 && filtered.every(u => selected.has(u.id));
  const toggleAll = () => allSelected ? setSelected(new Set()) : setSelected(new Set(filtered.map(u => u.id)));
  const toggleOne = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const openEdit = (u: Uygunsuzluk) => { setEditRecord(u); setShowForm(true); };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteUygunsuzluk(deleteId);
    if (detailRecord?.id === deleteId) setDetailRecord(null);
    if (kapatmaRecord?.id === deleteId) setKapatmaRecord(null);
    addToast('Uygunsuzluk silindi.', 'success');
    setDeleteId(null);
  };

  const handleBulkDelete = () => {
    Array.from(selected).forEach(id => deleteUygunsuzluk(id));
    addToast(`${selected.size} kayıt silindi.`, 'success');
    setSelected(new Set());
    setBulkDeleteConfirm(false);
  };

  const resetFilters = () => { setSearch(''); setFirmaFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); };
  const hasFilters = search || firmaFilter || statusFilter || dateFrom || dateTo;

  const handleDofImport = (rows: { baslik: string; aciklama: string; tarih: string; firmaAd: string; personelAd: string; severity: string; bolum: string; notlar: string }[]) => {
    let importedCount = 0;
    rows.forEach(row => {
      if (!row.baslik) return;
      const firma = firmalar.find(f => !f.silinmis && f.ad.toLowerCase() === row.firmaAd.toLowerCase());
      const personel = personeller.find(p => !p.silinmis && p.adSoyad.toLowerCase() === row.personelAd.toLowerCase());
      const sevMapping: Record<string, 'Düşük' | 'Orta' | 'Yüksek' | 'Kritik'> = {
        'Düşük': 'Düşük', 'Orta': 'Orta', 'Yüksek': 'Yüksek', 'Kritik': 'Kritik',
      };
      addUygunsuzluk({
        baslik: row.baslik,
        aciklama: row.aciklama || '',
        tarih: row.tarih || new Date().toISOString().split('T')[0],
        firmaId: firma?.id ?? '',
        personelId: personel?.id,
        severity: sevMapping[row.severity] ?? 'Orta',
        bolum: row.bolum || '',
        notlar: row.notlar || '',
        durum: 'Açık',
        acilisFotoMevcut: false,
        kapatmaFotoMevcut: false,
      });
      importedCount++;
    });
    addToast(`${importedCount} DÖF kaydı başarıyla içe aktarıldı.`, 'success');
  };

  const statCards = [
    { label: 'Toplam Kayıt', val: stats.total, icon: 'ri-file-list-3-line', c: '#F97316', bg: 'rgba(249,115,22,0.1)' },
    { label: 'Açık Uygunsuzluk', val: stats.acik, icon: 'ri-error-warning-line', c: '#EF4444', bg: 'rgba(239,68,68,0.1)', badge: stats.acik > 0 },
    { label: 'Kapandı', val: stats.kapandi, icon: 'ri-checkbox-circle-line', c: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    { label: 'Kritik Açık', val: stats.kritik, icon: 'ri-fire-line', c: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header — Hekim UI tarzı ── */}
      <div className="rounded-2xl overflow-hidden isg-card">
        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #F97316, #EF4444, #F43F5E)' }} />
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #F97316, #DC2626)' }}>
              <i className="ri-map-pin-user-line text-white text-sm" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                Saha Denetimleri
              </h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{stats.total} kayıt</span>
                {stats.acik > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.18)', color: '#F87171' }}>
                    {stats.acik} açık
                  </span>
                )}
                {isReadOnly && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(6,182,212,0.1)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.2)' }}>
                    <i className="ri-search-eye-line" /> Denetçi
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={() => setShowReport(true)} className="btn-secondary whitespace-nowrap" style={{ fontSize: '12px', padding: '6px 10px', height: 'auto' }}>
              <i className="ri-file-chart-line text-xs" />DÖF Raporu
            </button>
            {canCreate && (
              <button onClick={() => setShowImport(true)} className="btn-secondary whitespace-nowrap" style={{ fontSize: '12px', padding: '6px 10px', height: 'auto' }}>
                <i className="ri-file-excel-2-line text-xs" />İçe Aktar
              </button>
            )}
            {canCreateNonconformity && (
              <button onClick={() => { setEditRecord(null); setShowForm(true); }} className="btn-primary whitespace-nowrap" style={{ fontSize: '12px', padding: '8px 16px', height: 'auto', background: 'linear-gradient(135deg, #F97316, #DC2626)', border: '1px solid rgba(249,115,22,0.4)' }}>
                <i className="ri-add-line" />Yeni Kayıt
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {dataLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="isg-card rounded-xl p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl skeleton flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-6 w-12 rounded" />
                  <div className="skeleton h-3 w-20 rounded" />
                </div>
              </div>
            ))}
          </div>
          <div className="isg-card rounded-xl p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4">
                <div className="skeleton h-4 w-4 rounded" />
                <div className="skeleton h-4 flex-1 rounded" />
                <div className="skeleton h-4 w-24 rounded hidden md:block" />
                <div className="skeleton h-4 w-20 rounded hidden lg:block" />
                <div className="skeleton h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content — only show when loaded */}
      {!dataLoading && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map(s => (
              <div key={s.label} className="isg-card rounded-xl p-4 flex items-center gap-4">
                <div className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: s.bg }}>
                  <i className={`${s.icon} text-xl`} style={{ color: s.c }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.val}</p>
                    {s.badge && s.val > 0 && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#EF4444', color: '#fff' }}>!</span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="isg-card rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#475569' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="DÖF no, başlık veya firma ara..." className="isg-input pl-9" />
              </div>
              <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input" style={{ minWidth: '160px' }}>
                <option value="">Tüm Firmalar</option>
                {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="isg-input" style={{ minWidth: '140px' }}>
                <option value="">Tüm Durumlar</option>
                <option value="Açık">Açık</option>
                <option value="Kapandı">Kapandı</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium whitespace-nowrap" style={{ color: '#64748B' }}>Tarih:</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="isg-input text-sm" style={{ width: '140px' }} />
                <span className="text-xs" style={{ color: '#475569' }}>—</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="isg-input text-sm" style={{ width: '140px' }} />
              </div>
              {hasFilters && (
                <button onClick={resetFilters} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-all whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                  <i className="ri-close-line mr-1" />Filtreleri Temizle
                </button>
              )}
              <span className="text-xs ml-auto" style={{ color: '#64748B' }}>{filtered.length} kayıt gösteriliyor</span>
            </div>
          </div>

          {/* Bulk selection bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <span className="text-sm font-semibold" style={{ color: '#818CF8' }}>{selected.size} kayıt seçildi</span>
              <button onClick={() => setShowReport(true)} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap" style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8' }}>
                <i className="ri-file-chart-line mr-1" />Seçilenlerden Rapor
              </button>
              {canDelete && (
                <button
                  onClick={() => setBulkDeleteConfirm(true)}
                  className="text-xs px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  <i className="ri-delete-bin-line mr-1" />Seçilenleri Sil
                </button>
              )}
              <button onClick={() => setSelected(new Set())} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap ml-auto" style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8' }}>
                Seçimi Kaldır
              </button>
            </div>
          )}

          {/* Table / Cards */}
          <div className="isg-card rounded-xl overflow-hidden">
            {filtered.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}>
                  <i className="ri-alert-line text-3xl" style={{ color: '#F97316' }} />
                </div>
                <p className="font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                  {hasFilters ? 'Arama kriterlerine uygun kayıt bulunamadı' : 'Henüz uygunsuzluk kaydı yok'}
                </p>
                {!hasFilters && (
                  <button onClick={() => { setEditRecord(null); setShowForm(true); }} className="btn-primary mt-4">
                    <i className="ri-add-line" />Yeni Kayıt Ekle
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Mobil kart görünümü */}
                <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {filtered.map(u => {
                    const firma = firmalar.find(f => f.id === u.firmaId);
                    const sc = STATUS_CONFIG[u.durum] ?? { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: 'rgba(100,116,139,0.2)', icon: 'ri-question-line', label: u.durum };
                    const sev = SEV_CONFIG[u.severity] ?? { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8' };
                    const isChecked = selected.has(u.id);
                    return (
                      <div key={u.id} className="p-4" style={{ background: isChecked ? 'rgba(99,102,241,0.04)' : undefined }}>
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={isChecked} onChange={() => toggleOne(u.id)} className="cursor-pointer mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-mono text-xs font-bold" style={{ color: '#6366F1' }}>{u.acilisNo ?? '—'}</span>
                              <span className="inline-block px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap" style={{ background: sev.bg, color: sev.color }}>{u.severity}</span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold whitespace-nowrap" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                                <i className={sc.icon + ' text-xs'} />{u.durum}
                              </span>
                            </div>
                            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{u.baslik}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                              {firma && <span><i className="ri-building-2-line mr-1" />{firma.ad}</span>}
                              {u.tarih && <span><i className="ri-calendar-line mr-1" />{new Date(u.tarih).toLocaleDateString('tr-TR')}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 justify-end">
                          <button onClick={() => setDetailRecord(u)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap" style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8' }}>
                            <i className="ri-eye-line" />Detay
                          </button>
                          {u.durum !== 'Kapandı' && canCloseNonconformity && (
                            <button onClick={() => setKapatmaRecord(u)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
                              <i className="ri-checkbox-circle-line" />Kapat
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={() => openEdit(u)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>
                              <i className="ri-edit-line text-sm" />
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => setDeleteId(u.id)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                              <i className="ri-delete-bin-line text-sm" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Masaüstü tablo görünümü */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="table-premium w-full">
                    <thead>
                      <tr>
                        <th className="w-10 text-center">
                          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" />
                        </th>
                        <th className="text-left">DÖF No / Başlık</th>
                        <th className="text-left hidden md:table-cell">Firma</th>
                        <th className="text-left hidden lg:table-cell">Personel</th>
                        <th className="text-left hidden sm:table-cell">Tarih</th>
                        <th className="text-left">Önem</th>
                        <th className="text-left">Durum</th>
                        <th className="text-center hidden lg:table-cell">Foto</th>
                        <th className="text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(u => {
                        const firma = firmalar.find(f => f.id === u.firmaId);
                        const personel = personeller.find(p => p.id === u.personelId);
                        const sc = STATUS_CONFIG[u.durum] ?? { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: 'rgba(100,116,139,0.2)', icon: 'ri-question-line', label: u.durum };
                        const sev = SEV_CONFIG[u.severity] ?? { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8' };
                        const isChecked = selected.has(u.id);
                        return (
                          <tr key={u.id} style={{ background: isChecked ? 'rgba(99,102,241,0.04)' : undefined }}>
                            <td className="text-center">
                              <input type="checkbox" checked={isChecked} onChange={() => toggleOne(u.id)} className="cursor-pointer" />
                            </td>
                            <td>
                              <p className="font-mono text-xs font-bold mb-0.5" style={{ color: '#6366F1' }}>{u.acilisNo ?? '—'}</p>
                              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.baslik}</p>
                            </td>
                            <td className="hidden md:table-cell">
                              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{firma?.ad ?? '—'}</span>
                            </td>
                            <td className="hidden lg:table-cell">
                              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{personel?.adSoyad ?? '—'}</span>
                            </td>
                            <td className="hidden sm:table-cell">
                              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{u.tarih ? new Date(u.tarih).toLocaleDateString('tr-TR') : '—'}</span>
                            </td>
                            <td>
                              <span className="inline-block px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: sev.bg, color: sev.color }}>{u.severity}</span>
                            </td>
                            <td>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                                <i className={sc.icon + ' text-xs'} />{u.durum}
                              </span>
                            </td>
                            <td className="hidden lg:table-cell text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <span title="Açılış fotoğrafı" className={`w-6 h-6 flex items-center justify-center rounded-md text-xs ${u.acilisFotoMevcut ? 'opacity-100' : 'opacity-25'}`} style={{ background: u.acilisFotoMevcut ? 'rgba(249,115,22,0.15)' : 'rgba(71,85,105,0.1)', color: u.acilisFotoMevcut ? '#F97316' : '#64748B' }}>
                                  <i className="ri-camera-line" />
                                </span>
                                <span title="Kapatma fotoğrafı" className={`w-6 h-6 flex items-center justify-center rounded-md text-xs ${u.kapatmaFotoMevcut ? 'opacity-100' : 'opacity-25'}`} style={{ background: u.kapatmaFotoMevcut ? 'rgba(34,197,94,0.15)' : 'rgba(71,85,105,0.1)', color: u.kapatmaFotoMevcut ? '#22C55E' : '#64748B' }}>
                                  <i className="ri-camera-line" />
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => setDetailRecord(u)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8' }} title="Detay">
                                  <i className="ri-eye-line text-xs" />
                                </button>
                                {u.durum !== 'Kapandı' && canCloseNonconformity && (
                                  <button onClick={() => setKapatmaRecord(u)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }} title="Kapatma Yap">
                                    <i className="ri-checkbox-circle-line text-xs" />
                                  </button>
                                )}
                                {canEdit && (
                                  <button onClick={() => openEdit(u)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }} title="Düzenle">
                                    <i className="ri-edit-line text-xs" />
                                  </button>
                                )}
                                {canDelete && (
                                  <button onClick={() => setDeleteId(u.id)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }} title="Sil">
                                    <i className="ri-delete-bin-line text-xs" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Modals — always mounted */}
      <NonconformityForm isOpen={showForm} onClose={() => { setShowForm(false); setEditRecord(null); }} editRecord={editRecord} />
      <KapatmaModal record={kapatmaRecord} onClose={() => setKapatmaRecord(null)} />
      <DetailModal record={detailRecord} onClose={() => setDetailRecord(null)} onKapat={r => { setDetailRecord(null); setKapatmaRecord(r); }} onEdit={r => { setDetailRecord(null); openEdit(r); }} />
      <ReportBuilder isOpen={showReport} onClose={() => setShowReport(false)} />
      <DofImport isOpen={showImport} onClose={() => setShowImport(false)} onImport={handleDofImport} />

      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Kaydı Sil"
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
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Bu uygunsuzluk kaydını silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Bu işlem geri alınamaz. Tüm fotoğraflar da silinecektir.</p>
        </div>
      </Modal>

      <Modal
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        title="Toplu Silme"
        size="sm"
        icon="ri-delete-bin-2-line"
        footer={
          <>
            <button onClick={() => setBulkDeleteConfirm(false)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleBulkDelete} className="btn-danger whitespace-nowrap">
              <i className="ri-delete-bin-line" /> {selected.size} Kaydı Sil
            </button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            <strong>{selected.size}</strong> saha denetim kaydı silinecek.
          </p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Bu işlem geri alınamaz.</p>
        </div>
      </Modal>
    </div>
  );
}
