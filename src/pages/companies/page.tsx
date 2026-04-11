import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { FirmaListSkeleton } from '../../components/base/Skeleton';
import { usePermissions } from '../../hooks/usePermissions';
import type { Firma, TehlikeSinifi, FirmaStatus } from '../../types';
import Modal from '../../components/base/Modal';
import Badge, { getFirmaStatusColor, getTehlikeColor, getPersonelStatusColor } from '../../components/base/Badge';
import PersonelDetayModal from '../personnel/components/PersonelDetayModal';
import { getSignedUrlFromPath } from '@/utils/fileUpload';

const emptyFirma: Omit<Firma, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'> = {
  ad: '', yetkiliKisi: '', telefon: '', email: '', vergiNo: '', sgkSicil: '',
  adres: '', tehlikeSinifi: 'Tehlikeli', sozlesmeBas: '', sozlesmeBit: '',
  durum: 'Aktif', notlar: '',
};

function FormField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-premium"
      />
    </div>
  );
}

function FormSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input-premium cursor-pointer"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{value || '—'}</p>
    </div>
  );
}

/**
 * Firma logo resmi — path veya URL olabilir, ikisini de handle eder.
 * Path ise signed URL üretir, kırık olursa fallback gösterir.
 */
function FirmaLogoImg({ logoUrl, firmaAd, size = 'md' }: { logoUrl: string; firmaAd: string; size?: 'sm' | 'md' }) {
  const [src, setSrc] = useState<string>(logoUrl);
  const [error, setError] = useState(false);
  const wh = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

  useEffect(() => {
    setError(false);
    // Path mi yoksa URL mi?
    if (
      logoUrl &&
      !logoUrl.startsWith('http://') &&
      !logoUrl.startsWith('https://') &&
      !logoUrl.startsWith('data:') &&
      !logoUrl.startsWith('blob:')
    ) {
      // Storage path — signed URL üret
      getSignedUrlFromPath(logoUrl).then(url => {
        if (url) setSrc(url);
        else setError(true);
      });
    } else {
      setSrc(logoUrl);
    }
  }, [logoUrl]);

  if (error || !src) {
    return (
      <div className={`${wh} flex items-center justify-center rounded-lg flex-shrink-0 text-[11px] font-bold text-white`}
        style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
        {firmaAd.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div className={`${wh} rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center`}
      style={{ background: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
      <img
        src={src}
        alt={firmaAd}
        className="w-full h-full object-contain p-0.5"
        onError={() => setError(true)}
      />
    </div>
  );
}

export default function FirmalarPage() {
  const {
    firmalar, personeller, evraklar, egitimler, muayeneler, uygunsuzluklar,
    addFirma, updateFirma, deleteFirma, addToast, quickCreate, setQuickCreate,
    setFirmaLogo, org,
  } = useApp();
  const { canCreate, canEdit, canDelete, isReadOnly, isGeziciUzman, canManageFirma } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tehlikeFilter, setTehlikeFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyFirma });
  const [logoVeri, setLogoVeri] = useState<string>('');
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [personelDetailId, setPersonelDetailId] = useState<string | null>(null);
  const [personelDetailTab, setPersonelDetailTab] = useState('bilgiler');
  const [saving, setSaving] = useState(false);

  // Toplu silme state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    if (quickCreate === 'firmalar') {
      setForm({ ...emptyFirma });
      setEditingId(null);
      setLogoVeri('');
      setFormOpen(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  const filtered = useMemo(() => firmalar
    .filter(f => {
      if (f.silinmis) return false;
      const q = search.toLowerCase();
      return (!search || f.ad.toLowerCase().includes(q) || f.yetkiliKisi.toLowerCase().includes(q) || f.vergiNo.includes(q))
        && (!statusFilter || f.durum === statusFilter)
        && (!tehlikeFilter || f.tehlikeSinifi === tehlikeFilter);
    })
    .sort((a, b) => {
      const ta = a.olusturmaTarihi ?? '';
      const tb = b.olusturmaTarihi ?? '';
      return tb.localeCompare(ta);
    }), [firmalar, search, statusFilter, tehlikeFilter]);

  const allSelected = filtered.length > 0 && filtered.every(f => selected.has(f.id));
  const toggleAll = () => allSelected ? setSelected(new Set()) : setSelected(new Set(filtered.map(f => f.id)));
  const toggleOne = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleBulkDelete = () => {
    selected.forEach(id => deleteFirma(id));
    addToast(`${selected.size} firma silindi.`, 'info');
    setSelected(new Set());
    setBulkDeleteConfirm(false);
  };

  const openAdd = () => { setForm({ ...emptyFirma }); setEditingId(null); setLogoVeri(''); setPendingLogoFile(null); setFormOpen(true); };
  const openEdit = async (f: Firma) => {
    setForm({ ...f });
    setEditingId(f.id);
    setPendingLogoFile(null);
    const rawLogoUrl = f.logoUrl || '';
    if (rawLogoUrl) {
      // Path ise signed URL çevir, URL ise direkt kullan
      if (
        !rawLogoUrl.startsWith('http://') &&
        !rawLogoUrl.startsWith('https://') &&
        !rawLogoUrl.startsWith('data:') &&
        !rawLogoUrl.startsWith('blob:')
      ) {
        const signed = await getSignedUrlFromPath(rawLogoUrl);
        setLogoVeri(signed ?? rawLogoUrl);
      } else {
        setLogoVeri(rawLogoUrl);
      }
    } else {
      setLogoVeri('');
    }
    setFormOpen(true);
  };

  const handleLogoChange = (file?: File) => {
    if (!file) return;
    setPendingLogoFile(file);
    // Önizleme için geçici object URL
    const previewUrl = URL.createObjectURL(file);
    setLogoVeri(previewUrl);
  };

  const handleSave = async () => {
    if (!form.ad.trim()) { addToast('Firma adı zorunludur.', 'error'); return; }
    if (saving) return;
    setSaving(true);
    try {
      // logoUrl'yi form'dan ayır — ayrı olarak yönetilir
      const { logoUrl: _logoUrl, ...formData } = form as typeof form & { logoUrl?: string };

      if (editingId) {
        updateFirma(editingId, formData);
        if (pendingLogoFile) {
          await setFirmaLogo(editingId, pendingLogoFile);
        }
        addToast('Firma başarıyla güncellendi.', 'success');
      } else {
        const yeniFirma = addFirma(formData);
        if (pendingLogoFile) {
          await setFirmaLogo(yeniFirma.id, pendingLogoFile);
        }
        addToast('Firma başarıyla eklendi.', 'success');
      }
      setPendingLogoFile(null);
      setFormOpen(false);
    } catch (err) {
      console.error('[FirmalarPage] handleSave error:', err);
      addToast('Kaydetme sırasında bir hata oluştu.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    deleteFirma(id); setDeleteConfirm(null); setDetailId(null);
    addToast('Firma silindi.', 'info');
  };

  const detailFirma = firmalar.find(f => f.id === detailId);
  const firmaPersoneller = personeller.filter(p => p.firmaId === detailId && !p.silinmis);

  // Silme onayı için ilişkili kayıt sayıları
  const deleteConfirmPersonelIds = useMemo(
    () => (deleteConfirm ? personeller.filter(p => p.firmaId === deleteConfirm && !p.silinmis).map(p => p.id) : []),
    [deleteConfirm, personeller],
  );
  const deleteConfirmPersonelSayisi = deleteConfirmPersonelIds.length;
  const deleteConfirmEvrakSayisi = useMemo(
    () => (deleteConfirm
      ? evraklar.filter(e => !e.silinmis && (
        (e.firmaId === deleteConfirm && !e.personelId) ||
        (e.personelId ? deleteConfirmPersonelIds.includes(e.personelId) : false)
      )).length
      : 0),
    [deleteConfirm, evraklar, deleteConfirmPersonelIds],
  );

  const f = (field: keyof typeof form) => form[field] as string;
  const set = (field: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const aktifFirmalarSayisi = useMemo(() => firmalar.filter(f => !f.silinmis).length, [firmalar]);
  const aktifCount = firmalar.filter(f => !f.silinmis && f.durum === 'Aktif').length;
  const cokTehlikeliCount = firmalar.filter(f => !f.silinmis && f.tehlikeSinifi === 'Çok Tehlikeli').length;

  const { refreshData, dataLoading, pageLoading } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (refreshing || dataLoading) return;
    setRefreshing(true);
    try { await refreshData(); addToast('Veriler güncellendi.', 'success'); }
    finally { setRefreshing(false); }
  };



  if (pageLoading) return <FirmaListSkeleton rows={6} />;

  return (
    <div className="space-y-4">
      {/* ── Header — Hekim UI tarzı ── */}
      <div className="rounded-2xl overflow-hidden isg-card">
        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #10B981, #059669, #34D399)' }} />
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
              <i className="ri-building-2-line text-white text-sm" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                Firmalar
              </h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{aktifFirmalarSayisi} firma kayıtlı</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.18)', color: '#34D399' }}>
                  {aktifCount} aktif
                </span>
                {cokTehlikeliCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.18)', color: '#F87171' }}>
                    {cokTehlikeliCount} çok tehlikeli
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {canManageFirma && (
              <button onClick={openAdd} className="btn-primary whitespace-nowrap" style={{ fontSize: '12.5px', padding: '8px 16px', height: 'auto', background: 'linear-gradient(135deg, #10B981, #059669)', border: '1px solid rgba(16,185,129,0.4)' }}>
                <i className="ri-add-line text-sm" />
                Yeni Firma Ekle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
          style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}>
          <i className="ri-eye-line text-xs flex-shrink-0" style={{ color: '#06B6D4' }} />
          <p className="text-[12px]" style={{ color: '#06B6D4' }}>
            <strong>Denetçi modunda görüntülüyorsunuz</strong> — Bu sayfada yalnızca okuma yetkisine sahipsiniz.
          </p>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2.5 px-4 py-3 rounded-xl isg-card">
        <div className="relative flex-1 min-w-[180px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Firma adı, yetkili kişi veya vergi no..."
            className="isg-input pl-8 text-[12.5px]"
            onFocus={e => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.12)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="isg-input text-[12.5px]" style={{ width: 'auto', minWidth: '140px' }}>
          <option value="">Tüm Durumlar</option>
          <option value="Aktif">Aktif</option>
          <option value="Pasif">Pasif</option>
          <option value="Askıda">Askıda</option>
        </select>
        <select value={tehlikeFilter} onChange={e => setTehlikeFilter(e.target.value)} className="isg-input text-[12.5px]" style={{ width: 'auto', minWidth: '160px' }}>
          <option value="">Tüm Tehlike Sınıfları</option>
          <option value="Az Tehlikeli">Az Tehlikeli</option>
          <option value="Tehlikeli">Tehlikeli</option>
          <option value="Çok Tehlikeli">Çok Tehlikeli</option>
        </select>
        {(search || statusFilter || tehlikeFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setTehlikeFilter(''); }} className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
            <i className="ri-filter-off-line text-xs" /> Temizle
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <i className="ri-list-check text-xs" />
          {filtered.length} sonuç
        </div>
      </div>

      {/* Toplu seçim aksiyonları */}
      {selected.size > 0 && canManageFirma && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <span className="text-sm font-semibold" style={{ color: '#F87171' }}>{selected.size} firma seçildi</span>
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
        <EmptyState
          icon="ri-building-2-line"
          title={search || statusFilter || tehlikeFilter ? 'Sonuç bulunamadı' : 'Henüz firma eklenmedi'}
          description={search || statusFilter || tehlikeFilter
            ? 'Arama kriterlerinizi değiştirin veya filtreleri temizleyin.'
            : 'İlk firmanızı eklemek için "Yeni Firma Ekle" butonunu kullanın.'}
          onAction={!(search || statusFilter || tehlikeFilter) ? openAdd : undefined}
          actionLabel="Yeni Firma Ekle"
        />
      ) : (
        <>
          {/* Mobil kart görünümü */}
          <div className="md:hidden space-y-3">
            {filtered.map((firma) => {
              const logoUrl = firma.logoUrl;
              return (
                <div key={firma.id} className="isg-card rounded-xl p-4" style={{ background: selected.has(firma.id) ? 'rgba(16,185,129,0.04)' : undefined }}>
                  <div className="flex items-start gap-3">
                    {canDelete && (
                      <input type="checkbox" checked={selected.has(firma.id)} onChange={() => toggleOne(firma.id)} className="cursor-pointer mt-1 flex-shrink-0" />
                    )}
                    <button onClick={() => setDetailId(firma.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer">
                      {logoUrl ? (
                        <FirmaLogoImg logoUrl={logoUrl} firmaAd={firma.ad} size="md" />
                      ) : (
                        <div className="w-10 h-10 flex items-center justify-center rounded-lg flex-shrink-0 text-sm font-bold text-white"
                          style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                          {firma.ad.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{firma.ad}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{firma.yetkiliKisi || '—'}</p>
                      </div>
                    </button>
                    <Badge label={firma.durum} color={getFirmaStatusColor(firma.durum)} />
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge label={firma.tehlikeSinifi} color={getTehlikeColor(firma.tehlikeSinifi)} />
                      {firma.telefon && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{firma.telefon}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <ActionBtn icon="ri-eye-line" color="#10B981" onClick={() => setDetailId(firma.id)} title="Detay" />
                      {canManageFirma && <ActionBtn icon="ri-edit-line" color="#F59E0B" onClick={() => openEdit(firma)} title="Düzenle" />}
                      {canManageFirma && <ActionBtn icon="ri-delete-bin-line" color="#EF4444" onClick={() => setDeleteConfirm(firma.id)} title="Sil" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Masaüstü liste görünümü */}
          <div className="hidden md:block space-y-1">
            {/* Sütun başlıkları */}
            <div className="grid items-center px-4 py-2"
              style={{
                gridTemplateColumns: canManageFirma ? '32px 2.5fr 1.5fr 1.5fr 1fr 1fr 1.2fr 100px' : '2.5fr 1.5fr 1.5fr 1fr 1fr 1.2fr 100px',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
              {canManageFirma && (
                <div className="flex items-center justify-center">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" />
                </div>
              )}
              {['FİRMA ADI', 'YETKİLİ KİŞİ', 'İLETİŞİM', 'TEHLİKE SINIFI', 'DURUM', 'SÖZLEŞME BİTİŞ', 'İŞLEMLER'].map(h => (
                <span key={h} className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</span>
              ))}
            </div>

            {/* Satırlar — her biri ayrı kart */}
            <div className="space-y-1.5 pt-1">
              {filtered.map((firma) => {
                const logoUrl = firma.logoUrl;
                return (
                  <div
                    key={firma.id}
                    className="grid items-center px-4 py-3 rounded-xl transition-all"
                    style={{
                      gridTemplateColumns: canManageFirma ? '32px 2.5fr 1.5fr 1.5fr 1fr 1fr 1.2fr 100px' : '2.5fr 1.5fr 1.5fr 1fr 1fr 1.2fr 100px',
                      background: selected.has(firma.id) ? 'rgba(16,185,129,0.04)' : 'var(--bg-card-solid)',
                      border: selected.has(firma.id) ? '1px solid rgba(16,185,129,0.2)' : '1px solid var(--border-subtle)',
                    }}
                    onMouseEnter={e => {
                      if (!selected.has(firma.id)) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.03)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.15)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!selected.has(firma.id)) {
                        (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-solid)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                      }
                    }}
                  >
                    {canManageFirma && (
                      <div className="flex items-center justify-center">
                        <input type="checkbox" checked={selected.has(firma.id)} onChange={() => toggleOne(firma.id)} className="cursor-pointer" />
                      </div>
                    )}
                    {/* Firma adı */}
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      {logoUrl ? (
                        <FirmaLogoImg logoUrl={logoUrl} firmaAd={firma.ad} size="sm" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                          style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                          {firma.ad.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <button onClick={() => setDetailId(firma.id)} className="text-xs font-semibold cursor-pointer block text-left truncate transition-colors"
                          style={{ color: 'var(--text-primary)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#10B981'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}>
                          {firma.ad}
                        </button>
                        {firma.sgkSicil && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>SGK: {firma.sgkSicil}</p>}
                      </div>
                    </div>
                    {/* Yetkili kişi */}
                    <div className="min-w-0 pr-2">
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{firma.yetkiliKisi || '—'}</p>
                    </div>
                    {/* İletişim */}
                    <div className="min-w-0 pr-2">
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{firma.telefon || '—'}</p>
                      {firma.email && <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-faint)' }}>{firma.email}</p>}
                    </div>
                    {/* Tehlike sınıfı */}
                    <div>
                      <Badge label={firma.tehlikeSinifi} color={getTehlikeColor(firma.tehlikeSinifi)} />
                    </div>
                    {/* Durum */}
                    <div>
                      <Badge label={firma.durum} color={getFirmaStatusColor(firma.durum)} />
                    </div>
                    {/* Sözleşme bitiş */}
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {firma.sozlesmeBit ? new Date(firma.sozlesmeBit).toLocaleDateString('tr-TR') : '—'}
                      </p>
                    </div>
                    {/* İşlemler */}
                    <div className="flex items-center gap-1 justify-end">
                      <ActionBtn icon="ri-eye-line" color="#10B981" onClick={() => setDetailId(firma.id)} title="Detay" />
                      {canEdit && <ActionBtn icon="ri-edit-line" color="#F59E0B" onClick={() => openEdit(firma)} title="Düzenle" />}
                      {canDelete && <ActionBtn icon="ri-delete-bin-line" color="#EF4444" onClick={() => setDeleteConfirm(firma.id)} title="Sil" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => { if (!saving) setFormOpen(false); }}
        title={editingId ? 'Firma Düzenle' : 'Yeni Firma Ekle'}
        size="lg"
        icon="ri-building-2-line"
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="btn-secondary" disabled={saving}>İptal</button>
            <button onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? (
                <><i className="ri-loader-4-line animate-spin" /> Kaydediliyor...</>
              ) : (
                <><i className="ri-save-line" /> Kaydet</>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Bölüm 1: Temel Bilgiler */}
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-icon" style={{ background: 'rgba(59,130,246,0.12)', color: '#60A5FA' }}>
                <i className="ri-building-2-line text-sm" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Temel Bilgiler</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Firma kimlik ve iletişim bilgileri</p>
              </div>
            </div>
            <div className="form-grid-2">
              <FormField label="Firma Adı *" value={f('ad')} onChange={v => set('ad', v)} placeholder="Firma adı giriniz" />
              <FormField label="Yetkili Kişi" value={f('yetkiliKisi')} onChange={v => set('yetkiliKisi', v)} placeholder="Yetkili kişi adı" />
              <FormField label="Telefon" value={f('telefon')} onChange={v => set('telefon', v)} placeholder="0212 000 00 00" />
              <FormField label="E-posta" value={f('email')} onChange={v => set('email', v)} placeholder="info@firma.com" type="email" />
              <FormField label="SGK Sicil No" value={f('sgkSicil')} onChange={v => set('sgkSicil', v)} placeholder="SGK sicil numarası" />
              <div className="col-span-2">
                <FormField label="Adres" value={f('adres')} onChange={v => set('adres', v)} placeholder="Firma adresi" />
              </div>
            </div>
          </div>

          {/* Bölüm 2: Sözleşme & Durum */}
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#34D399' }}>
                <i className="ri-file-text-line text-sm" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Sözleşme & Durum</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tehlike sınıfı, durum ve sözleşme tarihleri</p>
              </div>
            </div>
            <div className="form-grid-2">
              <FormSelect label="Tehlike Sınıfı" value={f('tehlikeSinifi')} onChange={v => set('tehlikeSinifi', v)} options={['Az Tehlikeli', 'Tehlikeli', 'Çok Tehlikeli']} />
              <FormSelect label="Firma Durumu" value={f('durum')} onChange={v => set('durum', v)} options={['Aktif', 'Pasif', 'Askıda']} />
              <FormField label="Sözleşme Başlangıcı" value={f('sozlesmeBas')} onChange={v => set('sozlesmeBas', v)} type="date" />
              <FormField label="Sözleşme Bitişi" value={f('sozlesmeBit')} onChange={v => set('sozlesmeBit', v)} type="date" />
            </div>
          </div>

          {/* Bölüm 3: Logo & Notlar */}
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#FBBF24' }}>
                <i className="ri-image-line text-sm" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Logo & Notlar</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Firma logosu ve ek açıklamalar</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Firma Logosu (PNG / JPG)</label>
                <div
                  className="rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all duration-200"
                  style={{ border: '2px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
                  onClick={() => logoRef.current?.click()}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.35)'; e.currentTarget.style.background = 'rgba(245,158,11,0.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                >
                  {logoVeri ? (
                    <>
                      <img src={logoVeri} alt="Logo önizleme" className="w-12 h-12 object-contain rounded-lg" style={{ background: 'white', padding: '4px' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Logo yüklendi</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Değiştirmek için tıklayın</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                        <i className="ri-image-add-line text-2xl" style={{ color: '#FBBF24' }} />
                      </div>
                      <div>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Logo yüklemek için tıklayın</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>PNG, JPG — Tutanak Word belgesinde kullanılır</p>
                      </div>
                    </>
                  )}
                </div>
                <input ref={logoRef} type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={e => handleLogoChange(e.target.files?.[0])} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Notlar</label>
                <textarea
                  value={f('notlar')}
                  onChange={e => set('notlar', e.target.value)}
                  rows={3}
                  placeholder="Firma hakkında notlar..."
                  className="input-premium resize-none"
                  style={{ height: 'auto' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3.5px rgba(59,130,246,0.08)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      {detailFirma && (
        <Modal open={!!detailId} onClose={() => setDetailId(null)} title={detailFirma.ad} size="xl" icon="ri-building-2-line">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge label={detailFirma.durum} color={getFirmaStatusColor(detailFirma.durum)} />
              <Badge label={detailFirma.tehlikeSinifi} color={getTehlikeColor(detailFirma.tehlikeSinifi)} />
              <div className="flex-1" />
              {canEdit && (
                <button onClick={() => { setDetailId(null); openEdit(detailFirma); }} className="btn-secondary">
                  <i className="ri-edit-line" /> Düzenle
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <InfoRow label="Yetkili Kişi" value={detailFirma.yetkiliKisi} />
              <InfoRow label="Telefon" value={detailFirma.telefon} />
              <InfoRow label="E-posta" value={detailFirma.email} />
              <InfoRow label="SGK Sicil" value={detailFirma.sgkSicil} />
              <InfoRow label="Sözleşme Başlangıç" value={detailFirma.sozlesmeBas ? new Date(detailFirma.sozlesmeBas).toLocaleDateString('tr-TR') : '—'} />
              <InfoRow label="Sözleşme Bitiş" value={detailFirma.sozlesmeBit ? new Date(detailFirma.sozlesmeBit).toLocaleDateString('tr-TR') : '—'} />
              <div className="col-span-2">
                <InfoRow label="Adres" value={detailFirma.adres} />
              </div>
            </div>
            {detailFirma.notlar && (
              <div className="rounded-xl p-3.5" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#60A5FA' }}>Notlar</p>
                <p className="text-sm text-slate-300">{detailFirma.notlar}</p>
              </div>
            )}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <i className="ri-team-line" style={{ color: '#10B981' }} />
                <h4 className="text-sm font-bold text-slate-200">Firma Personelleri</h4>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.2)' }}
                >
                  {firmaPersoneller.length}
                </span>
              </div>
              {firmaPersoneller.length === 0 ? (
                <p className="text-sm" style={{ color: '#334155' }}>Bu firmaya ait personel bulunmuyor.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {firmaPersoneller.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setPersonelDetailId(p.id); setPersonelDetailTab('bilgiler'); }}
                      className="rounded-xl px-3.5 py-3 flex items-center gap-2.5 text-left w-full cursor-pointer transition-all duration-200 group"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(16,185,129,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(16,185,129,0.2)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                      }}
                    >
                      <div
                        className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                      >
                        {p.adSoyad.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-blue-400 transition-colors">{p.adSoyad}</p>
                        <p className="text-[10px] truncate" style={{ color: '#475569' }}>{p.gorev || '—'}</p>
                      </div>
                      <i className="ri-arrow-right-s-line text-xs flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#10B981' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Personel Detay Modal — merkezi bileşen */}
      <PersonelDetayModal personelId={personelDetailId} onClose={() => setPersonelDetailId(null)} />

      {/* Delete Modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Firmayı Sil"
        size="sm"
        icon="ri-delete-bin-line"
        footer={
          <>
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">İptal</button>
            <button onClick={() => handleDelete(deleteConfirm!)} className="btn-danger">
              <i className="ri-delete-bin-line" /> Evet, Sil
            </button>
          </>
        }
      >
        <div className="py-1 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 flex items-center justify-center rounded-2xl flex-shrink-0 mt-0.5" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <i className="ri-error-warning-line text-lg" style={{ color: '#EF4444' }} />
            </div>
            <div>
              <p className="text-sm font-semibold leading-snug" style={{ color: '#E2E8F0' }}>
                Bu firmayı silmek istediğinizden emin misiniz?
              </p>
              <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#94A3B8' }}>
                Firma çöp kutusuna taşınacak. İsterseniz daha sonra geri yükleyebilirsiniz.
              </p>
            </div>
          </div>

          {(deleteConfirmPersonelSayisi > 0 || deleteConfirmEvrakSayisi > 0) && (
            <div className="rounded-xl p-3.5 space-y-2.5" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div className="flex items-center gap-2">
                <i className="ri-links-line text-sm flex-shrink-0" style={{ color: '#F59E0B' }} />
                <p className="text-xs font-semibold" style={{ color: '#F59E0B' }}>Birlikte çöp kutusuna taşınacak:</p>
              </div>
              <div className="space-y-1.5 pl-5">
                {deleteConfirmPersonelSayisi > 0 && (
                  <div className="flex items-center gap-2">
                    <i className="ri-team-line text-xs" style={{ color: '#CBD5E1' }} />
                    <p className="text-xs" style={{ color: '#CBD5E1' }}>
                      <span className="font-bold" style={{ color: '#E2E8F0' }}>{deleteConfirmPersonelSayisi}</span> personel
                    </p>
                  </div>
                )}
                {deleteConfirmEvrakSayisi > 0 && (
                  <div className="flex items-center gap-2">
                    <i className="ri-file-list-3-line text-xs" style={{ color: '#CBD5E1' }} />
                    <p className="text-xs" style={{ color: '#CBD5E1' }}>
                      <span className="font-bold" style={{ color: '#E2E8F0' }}>{deleteConfirmEvrakSayisi}</span> evrak
                    </p>
                  </div>
                )}
              </div>
              <p className="text-[11px] pl-5 leading-relaxed" style={{ color: '#94A3B8' }}>
                Firma geri yüklendiğinde bu kayıtlar da otomatik olarak geri yüklenir.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Toplu Silme Onay Modal */}
      <Modal
        open={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        title="Toplu Silme Onayı"
        size="sm"
        icon="ri-delete-bin-2-line"
        footer={
          <>
            <button onClick={() => setBulkDeleteConfirm(false)} className="btn-secondary">İptal</button>
            <button onClick={handleBulkDelete} className="btn-danger">
              <i className="ri-delete-bin-line" /> {selected.size} Firmayı Sil
            </button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>
            <strong>{selected.size}</strong> firma çöp kutusuna taşınacak.
          </p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>İlgili personel ve evraklar da birlikte taşınır. Çöp kutusundan geri yükleyebilirsiniz.</p>
        </div>
      </Modal>
    </div>
  );
}

function ActionBtn({ icon, color, onClick, title }: { icon: string; color: string; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200"
      style={{ color: 'var(--text-muted)', background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}
      onMouseEnter={e => {
        e.currentTarget.style.color = color;
        e.currentTarget.style.background = `${color}18`;
        e.currentTarget.style.borderColor = `${color}38`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--text-muted)';
        e.currentTarget.style.background = 'var(--bg-item)';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}
    >
      <i className={`${icon} text-xs`} />
    </button>
  );
}

function EmptyState({ icon, title, description, onAction, actionLabel }: {
  icon: string; title: string; description: string; onAction?: () => void; actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl p-16 flex flex-col items-center text-center isg-card">
      <div
        className="w-16 h-16 flex items-center justify-center rounded-2xl mb-4"
        style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}
      >
        <i className={`${icon} text-3xl`} style={{ color: 'rgba(96,165,250,0.6)' }} />
      </div>
      <p className="text-base font-bold" style={{ color: 'var(--text-secondary)' }}>{title}</p>
      <p className="text-sm mt-1.5 max-w-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{description}</p>
      {onAction && actionLabel && (
        <button onClick={onAction} className="btn-primary mt-5">
          <i className="ri-add-circle-line" /> {actionLabel}
        </button>
      )}
    </div>
  );
}

function PDetayEmpty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-8">
      <div className="w-12 h-12 flex items-center justify-center rounded-xl mx-auto mb-3"
        style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.12)' }}>
        <i className={`${icon} text-xl`} style={{ color: 'rgba(96,165,250,0.6)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{text}</p>
    </div>
  );
}
