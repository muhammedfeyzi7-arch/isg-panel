import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/store/AppContext';
import Modal from '@/components/base/Modal';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { uploadFileToStorage, downloadFromUrl } from '@/utils/fileUpload';

/* ── Tipler ─────────────────────────────────────────────────── */
type FormKategori = 'Tümü' | 'Ekipman Kontrolleri' | 'Çalışma Alanı Kontrolleri' | 'Personel ve KKD Kontrolleri' | 'Çevre ve Hijyen Kontrolleri' | 'Periyodik Kontroller' | 'Diğer';

interface KontrolFormu {
  id: string;
  ad: string;
  kategori: Exclude<FormKategori, 'Tümü'>;
  aciklama: string;
  firmaId: string;
  yuklemeTarihi: string;
  dosyaAdi: string;
  dosyaBoyutu: number;
  dosyaTipi: string;
  dosyaUrl?: string;
  etiketler: string[];
  olusturanKisi: string;
  olusturmaTarihi: string;
  sonKontrolTarihi?: string;
  sonrakiKontrolTarihi?: string;
}

const KAT_CONFIG: Record<Exclude<FormKategori, 'Tümü'>, { color: string; bg: string; icon: string }> = {
  'Ekipman Kontrolleri':         { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',   icon: 'ri-tools-line' },
  'Çalışma Alanı Kontrolleri':   { color: '#10B981', bg: 'rgba(16,185,129,0.1)',   icon: 'ri-building-4-line' },
  'Personel ve KKD Kontrolleri': { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',   icon: 'ri-shield-user-line' },
  'Çevre ve Hijyen Kontrolleri': { color: '#06B6D4', bg: 'rgba(6,182,212,0.1)',    icon: 'ri-leaf-line' },
  'Periyodik Kontroller':        { color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)',   icon: 'ri-calendar-check-line' },
  'Diğer':                       { color: '#64748B', bg: 'rgba(100,116,139,0.1)',  icon: 'ri-file-text-line' },
};

const KATEGORILER: Exclude<FormKategori, 'Tümü'>[] = [
  'Ekipman Kontrolleri', 'Çalışma Alanı Kontrolleri', 'Personel ve KKD Kontrolleri',
  'Çevre ve Hijyen Kontrolleri', 'Periyodik Kontroller', 'Diğer',
];

function dosyaIkonu(tip: string): string {
  if (tip.includes('pdf')) return 'ri-file-pdf-line';
  if (tip.includes('word') || tip.includes('doc')) return 'ri-file-word-line';
  if (tip.includes('excel') || tip.includes('sheet') || tip.includes('xls')) return 'ri-file-excel-line';
  if (tip.includes('image') || tip.includes('jpg') || tip.includes('png')) return 'ri-image-line';
  return 'ri-file-text-line';
}

function dosyaRengi(tip: string): string {
  if (tip.includes('pdf')) return '#EF4444';
  if (tip.includes('word') || tip.includes('doc')) return '#3B82F6';
  if (tip.includes('excel') || tip.includes('sheet') || tip.includes('xls')) return '#10B981';
  if (tip.includes('image')) return '#F59E0B';
  return '#64748B';
}

function formatBoyut(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Tarih yardımcıları ─────────────────────────────────────── */
function kontrolDurumu(sonrakiTarih?: string): { label: string; color: string; bg: string; icon: string } | null {
  if (!sonrakiTarih) return null;
  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  const hedef = new Date(sonrakiTarih);
  hedef.setHours(0, 0, 0, 0);
  const fark = Math.ceil((hedef.getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24));

  if (fark < 0) return { label: `${Math.abs(fark)} gün gecikti`, color: '#EF4444', bg: 'rgba(239,68,68,0.1)', icon: 'ri-alarm-warning-line' };
  if (fark === 0) return { label: 'Bugün son gün', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: 'ri-time-line' };
  if (fark <= 7) return { label: `${fark} gün kaldı`, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: 'ri-timer-line' };
  return { label: `${fark} gün kaldı`, color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: 'ri-calendar-check-line' };
}

/* ── Ana Bileşen ─────────────────────────────────────────────── */
export default function KontrolFormlariPage() {
  const { firmalar, currentUser, addToast, org } = useApp();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const [formlar, setFormlar] = useState<KontrolFormu[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [katFilter, setKatFilter] = useState<FormKategori>('Tümü');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewForm, setViewForm] = useState<KontrolFormu | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    ad: '', kategori: 'Ekipman Kontrolleri' as Exclude<FormKategori, 'Tümü'>,
    aciklama: '', firmaId: '',
    etiketler: [] as string[], etiketInput: '',
    dosyaAdi: '', dosyaBoyutu: 0, dosyaTipi: '',
    sonKontrolTarihi: '', sonrakiKontrolTarihi: '',
  });

  const aktivFirmalar = useMemo(() => firmalar.filter(f => !f.silinmis), [firmalar]);
  const orgId = org?.id ?? null;

  /* ── Supabase yükle ── */
  const loadFormlar = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('kontrol_formlari')
      .select('id, data, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      addToast('Kontrol formları yüklenemedi.', 'error');
      setLoading(false);
      return;
    }
    setFormlar((data ?? []).map(r => r.data as KontrolFormu));
    setLoading(false);
  }, [orgId, addToast]);

  useEffect(() => { loadFormlar(); }, [loadFormlar]);

  /* ── Supabase kaydet ── */
  const saveForm = useCallback(async (item: KontrolFormu) => {
    if (!orgId) return;
    const { error } = await supabase.from('kontrol_formlari').upsert({
      id: item.id,
      organization_id: orgId,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      data: item,
      updated_at: new Date().toISOString(),
    });
    if (error) addToast('Form kaydedilemedi: ' + error.message, 'error');
  }, [orgId, addToast]);

  /* ── Supabase sil ── */
  const deleteFormFromDb = useCallback(async (id: string) => {
    if (!orgId) return;
    const { error } = await supabase.from('kontrol_formlari').delete().eq('id', id);
    if (error) addToast('Form silinemedi.', 'error');
  }, [orgId, addToast]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return formlar.filter(f => {
      const firma = firmalar.find(x => x.id === f.firmaId);
      return (
        (!q || f.ad.toLowerCase().includes(q) || f.aciklama.toLowerCase().includes(q) || (firma?.ad.toLowerCase().includes(q) ?? false))
        && (katFilter === 'Tümü' || f.kategori === katFilter)
        && (!firmaFilter || f.firmaId === firmaFilter)
      );
    }).sort((a, b) => b.olusturmaTarihi.localeCompare(a.olusturmaTarihi));
  }, [formlar, firmalar, search, katFilter, firmaFilter]);

  const stats = useMemo(() => ({
    total: formlar.length,
    byKat: KATEGORILER.map(k => ({ k, count: formlar.filter(f => f.kategori === k).length })),
  }), [formlar]);

  const sf = (field: string, value: unknown) => setForm(prev => ({ ...prev, [field]: value }));

  const handleFileChange = (file: File) => {
    if (file.size > 20 * 1024 * 1024) { addToast('Dosya 20MB\'ı aşamaz.', 'error'); return; }
    setPendingFile(file);
    sf('dosyaAdi', file.name);
    sf('dosyaBoyutu', file.size);
    sf('dosyaTipi', file.type);
  };

  const openAdd = () => {
    setEditId(null);
    setPendingFile(null);
    setForm({ ad: '', kategori: 'Ekipman Kontrolleri', aciklama: '', firmaId: '', etiketler: [], etiketInput: '', dosyaAdi: '', dosyaBoyutu: 0, dosyaTipi: '', sonKontrolTarihi: '', sonrakiKontrolTarihi: '' });
    setShowModal(true);
  };

  const openEdit = (f: KontrolFormu) => {
    setEditId(f.id);
    setPendingFile(null);
    setForm({ ad: f.ad, kategori: f.kategori, aciklama: f.aciklama, firmaId: f.firmaId, etiketler: f.etiketler, etiketInput: '', dosyaAdi: f.dosyaAdi, dosyaBoyutu: f.dosyaBoyutu, dosyaTipi: f.dosyaTipi, sonKontrolTarihi: f.sonKontrolTarihi ?? '', sonrakiKontrolTarihi: f.sonrakiKontrolTarihi ?? '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.ad.trim()) { addToast('Form adı zorunludur.', 'error'); return; }
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (!editId && !pendingFile) { addToast('Dosya yüklenmesi zorunludur.', 'error'); return; }

    setUploading(true);
    const now = new Date().toISOString();

    try {
      if (editId) {
        const existing = formlar.find(f => f.id === editId);
        if (!existing) return;
        let dosyaUrl = existing.dosyaUrl;
        let dosyaAdi = existing.dosyaAdi;
        let dosyaBoyutu = existing.dosyaBoyutu;
        let dosyaTipi = existing.dosyaTipi;

        if (pendingFile && orgId) {
          const url = await uploadFileToStorage(pendingFile, orgId, 'kontrol-formu', editId);
          if (url) {
            dosyaUrl = url;
            dosyaAdi = form.dosyaAdi;
            dosyaBoyutu = form.dosyaBoyutu;
            dosyaTipi = form.dosyaTipi;
          }
        }

        const updated: KontrolFormu = {
          ...existing,
          ad: form.ad, kategori: form.kategori, aciklama: form.aciklama,
          firmaId: form.firmaId, etiketler: form.etiketler,
          sonKontrolTarihi: form.sonKontrolTarihi || undefined,
          sonrakiKontrolTarihi: form.sonrakiKontrolTarihi || undefined,
          dosyaAdi, dosyaBoyutu, dosyaTipi, dosyaUrl,
        };
        setFormlar(prev => prev.map(f => f.id === editId ? updated : f));
        await saveForm(updated);
        addToast('Form güncellendi.', 'success');
      } else {
        const id = crypto.randomUUID();
        let dosyaUrl: string | undefined;

        if (pendingFile && orgId) {
          const url = await uploadFileToStorage(pendingFile, orgId, 'kontrol-formu', id);
          dosyaUrl = url ?? undefined;
        }

        const yeni: KontrolFormu = {
          id,
          ad: form.ad, kategori: form.kategori, aciklama: form.aciklama,
          firmaId: form.firmaId,
          yuklemeTarihi: now, dosyaAdi: form.dosyaAdi, dosyaBoyutu: form.dosyaBoyutu,
          dosyaTipi: form.dosyaTipi, dosyaUrl,
          etiketler: form.etiketler, olusturanKisi: currentUser.ad,
          olusturmaTarihi: now,
          sonKontrolTarihi: form.sonKontrolTarihi || undefined,
          sonrakiKontrolTarihi: form.sonrakiKontrolTarihi || undefined,
        };
        setFormlar(prev => [yeni, ...prev]);
        await saveForm(yeni);
        addToast(`"${form.ad}" formu yüklendi.`, 'success');
      }
    } finally {
      setUploading(false);
      setPendingFile(null);
      setShowModal(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setFormlar(prev => prev.filter(f => f.id !== deleteId));
    await deleteFormFromDb(deleteId);
    addToast('Form silindi.', 'success');
    setDeleteId(null);
  };

  const handleDownload = async (f: KontrolFormu) => {
    if (!f.dosyaUrl) { addToast('Dosya bulunamadı.', 'error'); return; }
    const ok = await downloadFromUrl(f.dosyaUrl, f.dosyaAdi);
    if (ok) {
      addToast(`"${f.dosyaAdi}" indiriliyor...`, 'success');
    } else {
      addToast('Dosya indirilemedi.', 'error');
    }
  };

  const addEtiket = () => {
    const t = form.etiketInput.trim();
    if (!t || form.etiketler.includes(t)) return;
    sf('etiketler', [...form.etiketler, t]);
    sf('etiketInput', '');
  };

  const inp = 'isg-input w-full';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Kontrol Formları</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Personel kontrol formlarını, risk analizlerini ve denetim belgelerini yönetin
          </p>
        </div>
        {canCreate && (
          <button onClick={openAdd} className="btn-primary whitespace-nowrap self-start sm:self-auto">
            <i className="ri-upload-cloud-2-line mr-1" /> Form Yükle
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="isg-card rounded-xl p-4 flex items-center gap-4 lg:col-span-1">
          <div className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(99,102,241,0.1)' }}>
            <i className="ri-folder-shield-2-line text-xl" style={{ color: '#6366F1' }} />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.total}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Toplam Form</p>
          </div>
        </div>
        {stats.byKat.slice(0, 3).map(({ k, count }) => {
          const cfg = KAT_CONFIG[k];
          return (
            <div key={k} className="isg-card rounded-xl p-4 flex items-center gap-4">
              <div className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: cfg.bg }}>
                <i className={`${cfg.icon} text-xl`} style={{ color: cfg.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{count}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{k}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Kategori Sekmeleri */}
      <div className="flex flex-wrap gap-2">
        {(['Tümü', ...KATEGORILER] as FormKategori[]).map(k => {
          const isActive = katFilter === k;
          const cfg = k !== 'Tümü' ? KAT_CONFIG[k] : null;
          return (
            <button
              key={k}
              onClick={() => setKatFilter(k)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
              style={{
                background: isActive ? (cfg?.bg ?? 'rgba(99,102,241,0.15)') : 'var(--bg-item)',
                color: isActive ? (cfg?.color ?? '#6366F1') : 'var(--text-muted)',
                border: `1px solid ${isActive ? (cfg?.color ?? '#6366F1') + '40' : 'var(--border-subtle)'}`,
              }}
            >
              {cfg && <i className={`${cfg.icon} text-xs`} />}
              {k}
              {k !== 'Tümü' && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg-card)' }}>
                  {formlar.filter(f => f.kategori === k).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-3 px-4 py-3 rounded-2xl isg-card">
        <div className="relative flex-1 min-w-[200px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Form adı, açıklama veya firma ara..." className="isg-input pl-9" />
        </div>
        <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input" style={{ minWidth: '180px' }}>
          <option value="">Tüm Firmalar</option>
          {aktivFirmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
        </select>
        {(search || firmaFilter || katFilter !== 'Tümü') && (
          <button onClick={() => { setSearch(''); setFirmaFilter(''); setKatFilter('Tümü'); }} className="btn-secondary whitespace-nowrap">
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
      </div>

      {/* Form Listesi */}
      {loading ? (
        <div className="isg-card rounded-xl py-20 text-center">
          <i className="ri-loader-4-line animate-spin text-3xl" style={{ color: '#6366F1' }} />
          <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>Yükleniyor...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="isg-card rounded-xl py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <i className="ri-folder-shield-2-line text-3xl" style={{ color: '#6366F1' }} />
          </div>
          <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>Kontrol formu bulunamadı</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-faint)' }}>PDF, Word veya Excel formatında form yükleyin</p>
          {canCreate && (
            <button onClick={openAdd} className="btn-primary mt-5">
              <i className="ri-upload-cloud-2-line mr-1" /> Form Yükle
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(f => {
            const firma = firmalar.find(x => x.id === f.firmaId);
            const cfg = KAT_CONFIG[f.kategori];
            const fileColor = dosyaRengi(f.dosyaTipi);
            const fileIcon = dosyaIkonu(f.dosyaTipi);
            const durum = kontrolDurumu(f.sonrakiKontrolTarihi);
            return (
              <div
                key={f.id}
                className="isg-card rounded-xl overflow-hidden flex flex-col transition-all duration-200 cursor-pointer"
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                onClick={() => setViewForm(f)}
              >
                <div className="h-1.5 w-full" style={{ background: cfg.color }} />
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ background: `${fileColor}18`, border: `1px solid ${fileColor}30` }}>
                      <i className={`${fileIcon} text-lg`} style={{ color: fileColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold leading-snug truncate" style={{ color: 'var(--text-primary)' }}>{f.ad}</h3>
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: cfg.bg, color: cfg.color }}>
                        <i className={`${cfg.icon} text-[10px]`} />{f.kategori}
                      </span>
                    </div>
                  </div>

                  {f.aciklama && (
                    <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>{f.aciklama}</p>
                  )}

                  <div className="space-y-1.5">
                    {firma && (
                      <div className="flex items-center gap-2">
                        <i className="ri-building-2-line text-xs flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{firma.ad}</span>
                      </div>
                    )}
                    {f.sonKontrolTarihi && (
                      <div className="flex items-center gap-2">
                        <i className="ri-history-line text-xs flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Son: {new Date(f.sonKontrolTarihi).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                    )}
                    {f.sonrakiKontrolTarihi && (
                      <div className="flex items-center gap-2">
                        <i className="ri-calendar-2-line text-xs flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Sonraki: {new Date(f.sonrakiKontrolTarihi).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                    )}
                    {!f.sonKontrolTarihi && !f.sonrakiKontrolTarihi && (
                      <div className="flex items-center gap-2">
                        <i className="ri-calendar-line text-xs flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(f.olusturmaTarihi).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                    )}
                  </div>

                  {durum && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                      style={{ background: durum.bg, border: `1px solid ${durum.color}25` }}>
                      <i className={`${durum.icon} text-xs`} style={{ color: durum.color }} />
                      <span className="text-xs font-semibold" style={{ color: durum.color }}>{durum.label}</span>
                    </div>
                  )}

                  {f.etiketler.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {f.etiketler.slice(0, 3).map(et => (
                        <span key={et} className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: 'var(--bg-item)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                          #{et}
                        </span>
                      ))}
                      {f.etiketler.length > 3 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ color: 'var(--text-faint)' }}>
                          +{f.etiketler.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 mt-auto"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <i className={`${fileIcon} text-xs flex-shrink-0`} style={{ color: fileColor }} />
                      <span className="text-xs truncate max-w-[100px]" style={{ color: 'var(--text-muted)' }}>{f.dosyaAdi}</span>
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-faint)' }}>
                        {formatBoyut(f.dosyaBoyutu)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleDownload(f)}
                        title="İndir"
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                        style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}
                      >
                        <i className="ri-download-line text-xs" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => openEdit(f)}
                          title="Düzenle"
                          className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                          style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}
                        >
                          <i className="ri-edit-line text-xs" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteId(f.id)}
                          title="Sil"
                          className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                        >
                          <i className="ri-delete-bin-line text-xs" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Yükleme / Düzenleme Modal ── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'Formu Düzenle' : 'Kontrol Formu Yükle'}
        size="lg"
        icon="ri-upload-cloud-2-line"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleSave} disabled={uploading} className="btn-primary whitespace-nowrap">
              <i className={uploading ? 'ri-loader-4-line animate-spin' : editId ? 'ri-save-line' : 'ri-upload-line'} />
              {uploading ? 'Yükleniyor...' : editId ? 'Güncelle' : 'Yükle'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="form-label">Form Adı *</label>
              <input value={form.ad} onChange={e => sf('ad', e.target.value)} placeholder="Örn: Yüksekte Çalışma Risk Analizi..." className={inp} />
            </div>
            <div>
              <label className="form-label">Kategori *</label>
              <select value={form.kategori} onChange={e => sf('kategori', e.target.value)} className={inp}>
                {KATEGORILER.map(k => <option key={k} value={k}>{k}</option>)}
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
              <label className="form-label">Son Kontrol Tarihi</label>
              <input type="date" value={form.sonKontrolTarihi} onChange={e => sf('sonKontrolTarihi', e.target.value)} className={inp} />
            </div>
            <div>
              <label className="form-label">Sonraki Kontrol Tarihi</label>
              <input type="date" value={form.sonrakiKontrolTarihi} onChange={e => sf('sonrakiKontrolTarihi', e.target.value)} className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Açıklama</label>
              <textarea value={form.aciklama} onChange={e => sf('aciklama', e.target.value)} placeholder="Form hakkında kısa açıklama..." rows={2} maxLength={500} className={`${inp} resize-y`} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Etiketler</label>
              <div className="flex gap-2">
                <input
                  value={form.etiketInput}
                  onChange={e => sf('etiketInput', e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEtiket(); } }}
                  placeholder="Etiket yazın ve Enter'a basın..."
                  className={inp}
                />
                <button onClick={addEtiket} className="btn-secondary whitespace-nowrap px-3">
                  <i className="ri-add-line" />
                </button>
              </div>
              {form.etiketler.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.etiketler.map(et => (
                    <span key={et} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.2)' }}>
                      #{et}
                      <button onClick={() => sf('etiketler', form.etiketler.filter(x => x !== et))} className="cursor-pointer ml-0.5">
                        <i className="ri-close-line text-[10px]" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">
                Dosya {!editId && '*'}
                <span className="ml-1 text-xs font-normal" style={{ color: 'var(--text-faint)' }}>
                  (PDF, Word, Excel, JPG, PNG — Maks. 20MB)
                </span>
              </label>
              <div
                className="rounded-xl p-5 text-center cursor-pointer transition-all duration-200"
                style={{ border: '2px dashed var(--border-subtle)', background: 'var(--bg-item)' }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f); }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.background = 'rgba(99,102,241,0.03)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-item)'; }}
              >
                {form.dosyaAdi ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl"
                      style={{ background: `${dosyaRengi(form.dosyaTipi)}18` }}>
                      <i className={`${dosyaIkonu(form.dosyaTipi)} text-xl`} style={{ color: dosyaRengi(form.dosyaTipi) }} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{form.dosyaAdi}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {formatBoyut(form.dosyaBoyutu)} — Değiştirmek için tıklayın
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl mx-auto mb-3"
                      style={{ background: 'rgba(99,102,241,0.1)' }}>
                      <i className="ri-upload-cloud-2-line text-2xl" style={{ color: '#6366F1' }} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      Dosyayı sürükleyin veya tıklayın
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                      PDF, Word (.docx), Excel (.xlsx), JPG, PNG
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); e.target.value = ''; }}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Detay Modal ── */}
      {viewForm && (
        <Modal
          open={!!viewForm}
          onClose={() => setViewForm(null)}
          title={viewForm.ad}
          size="lg"
          icon={KAT_CONFIG[viewForm.kategori].icon}
          footer={
            <div className="flex items-center gap-2 w-full flex-wrap">
              <button onClick={() => setViewForm(null)} className="btn-secondary whitespace-nowrap mr-auto">Kapat</button>
              {canEdit && (
                <button onClick={() => { setViewForm(null); openEdit(viewForm); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <i className="ri-edit-line" /> Düzenle
                </button>
              )}
              <button onClick={() => handleDownload(viewForm)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
                <i className="ri-download-line" /> İndir
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{ background: KAT_CONFIG[viewForm.kategori].bg, color: KAT_CONFIG[viewForm.kategori].color }}>
                <i className={KAT_CONFIG[viewForm.kategori].icon} />{viewForm.kategori}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{ background: `${dosyaRengi(viewForm.dosyaTipi)}15`, color: dosyaRengi(viewForm.dosyaTipi) }}>
                <i className={dosyaIkonu(viewForm.dosyaTipi)} />{viewForm.dosyaAdi.split('.').pop()?.toUpperCase()}
              </span>
              {(() => {
                const d = kontrolDurumu(viewForm.sonrakiKontrolTarihi);
                return d ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                    style={{ background: d.bg, color: d.color }}>
                    <i className={d.icon} />{d.label}
                  </span>
                ) : null;
              })()}
            </div>

            {(viewForm.sonKontrolTarihi || viewForm.sonrakiKontrolTarihi) && (
              <div className="grid grid-cols-2 gap-3">
                {viewForm.sonKontrolTarihi && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ background: 'rgba(16,185,129,0.12)' }}>
                      <i className="ri-history-line text-base" style={{ color: '#10B981' }} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#10B981' }}>Son Kontrol</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                        {new Date(viewForm.sonKontrolTarihi).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  </div>
                )}
                {viewForm.sonrakiKontrolTarihi && (() => {
                  const d = kontrolDurumu(viewForm.sonrakiKontrolTarihi);
                  return (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                      style={{ background: d ? d.bg : 'rgba(99,102,241,0.06)', border: `1px solid ${d ? d.color + '30' : 'rgba(99,102,241,0.2)'}` }}>
                      <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                        style={{ background: d ? d.bg : 'rgba(99,102,241,0.12)' }}>
                        <i className="ri-calendar-2-line text-base" style={{ color: d?.color ?? '#6366F1' }} />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: d?.color ?? '#6366F1' }}>Sonraki Kontrol</p>
                        <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {new Date(viewForm.sonrakiKontrolTarihi).toLocaleDateString('tr-TR')}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Firma', value: firmalar.find(x => x.id === viewForm.firmaId)?.ad ?? '—', icon: 'ri-building-2-line' },
                { label: 'Yükleme Tarihi', value: new Date(viewForm.olusturmaTarihi).toLocaleDateString('tr-TR'), icon: 'ri-calendar-line' },
                { label: 'Yükleyen', value: viewForm.olusturanKisi || '—', icon: 'ri-user-star-line' },
                { label: 'Dosya Adı', value: viewForm.dosyaAdi, icon: 'ri-file-line' },
                { label: 'Dosya Boyutu', value: formatBoyut(viewForm.dosyaBoyutu), icon: 'ri-hard-drive-2-line' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(99,102,241,0.1)' }}>
                    <i className={`${item.icon} text-xs`} style={{ color: '#6366F1' }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{item.label}</p>
                    <p className="text-sm font-medium mt-0.5 break-all" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {viewForm.aciklama && (
              <div className="px-4 py-3 rounded-xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-faint)' }}>Açıklama</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{viewForm.aciklama}</p>
              </div>
            )}

            {viewForm.etiketler.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>Etiketler</p>
                <div className="flex flex-wrap gap-1.5">
                  {viewForm.etiketler.map(et => (
                    <span key={et} className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.2)' }}>
                      #{et}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Silme Modal ── */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Formu Sil"
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
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Bu formu silmek istediğinizden emin misiniz?
          </p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Yüklenen dosya da kalıcı olarak silinecektir.</p>
        </div>
      </Modal>
    </div>
  );
}
