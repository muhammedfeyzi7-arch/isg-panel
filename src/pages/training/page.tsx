import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import type { Egitim, EgitimStatus } from '../../types';
import Modal from '../../components/base/Modal';
import Badge from '../../components/base/Badge';

const EGITIM_TURLERI = [
  'İşe Giriş ve Oryantasyon Eğitimi',
  'İSG Temel Eğitimi',
  'Yangın Güvenliği Eğitimi',
  'İlk Yardım Eğitimi',
  'Kişisel Koruyucu Donanım Eğitimi',
  'Acil Durum ve Tahliye Eğitimi',
  'Tehlikeli Madde Eğitimi',
  'Yüksekte Çalışma Güvenliği',
  'Elektrik Güvenliği Eğitimi',
  'Diğer',
];

const STATUS_CFG: Record<EgitimStatus, { color: string; bg: string; border: string; icon: string }> = {
  'Planlandı': { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.2)', icon: 'ri-calendar-schedule-line' },
  'Tamamlandı': { color: '#34D399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.2)', icon: 'ri-checkbox-circle-line' },
  'Eksik': { color: '#F97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.2)', icon: 'ri-error-warning-line' },
};

function getStatusColor(s: string): 'sky' | 'green' | 'amber' {
  if (s === 'Tamamlandı') return 'green';
  if (s === 'Eksik') return 'amber';
  return 'sky';
}

const emptyEgitim: Omit<Egitim, 'id' | 'olusturmaTarihi'> = {
  ad: '', firmaId: '', katilimciIds: [], tarih: '', gecerlilikSuresi: 12,
  egitmen: '', yer: '', sure: 0, durum: 'Planlandı', belgeMevcut: false,
  aciklama: '', belgeDosyaAdi: '', belgeDosyaBoyutu: 0, belgeDosyaTipi: '', belgeDosyaVeri: '', notlar: '',
};

function downloadFromDataUrl(dataUrl: string, filename: string): void {
  try {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || '';
    const bstr = atob(arr[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
    const blob = new Blob([u8arr], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export default function EgitimlerPage() {
  const { egitimler, firmalar, personeller, addEgitim, updateEgitim, deleteEgitim, getEgitimFile, addToast, quickCreate, setQuickCreate } = useApp();
  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyEgitim });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quickCreate === 'egitimler') {
      setForm({ ...emptyEgitim });
      setEditingId(null);
      setFormOpen(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  const firmaPersoneller = useMemo(() => {
    if (!form.firmaId) return [];
    return personeller.filter(p => p.firmaId === form.firmaId);
  }, [form.firmaId, personeller]);

  const filtered = useMemo(() => egitimler.filter(e => {
    if (e.silinmis) return false;
    const q = search.toLowerCase();
    return (!search || e.ad.toLowerCase().includes(q) || (e.aciklama || '').toLowerCase().includes(q))
      && (!firmaFilter || e.firmaId === firmaFilter)
      && (!statusFilter || e.durum === statusFilter);
  }), [egitimler, search, firmaFilter, statusFilter]);

  const getFirmaAd = (id: string) => firmalar.find(fi => fi.id === id)?.ad || '—';

  const openAdd = () => { setForm({ ...emptyEgitim }); setEditingId(null); setFormOpen(true); };
  const openEdit = (e: Egitim) => {
    setForm({ ...e, belgeDosyaVeri: '' });
    setEditingId(e.id);
    setFormOpen(true);
  };

  const handleFileChange = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const veri = ev.target?.result as string;
      setForm(prev => ({ ...prev, belgeDosyaAdi: file.name, belgeDosyaBoyutu: file.size, belgeDosyaTipi: file.type, belgeDosyaVeri: veri, belgeMevcut: true }));
    };
    reader.readAsDataURL(file);
  };

  const handleBelgeIndir = (e: Egitim) => {
    const veri = getEgitimFile(e.id) || e.belgeDosyaVeri;
    if (!veri) { addToast('Bu eğitim için indirilebilir belge bulunamadı.', 'error'); return; }
    downloadFromDataUrl(veri, e.belgeDosyaAdi || 'egitim-belgesi');
    addToast(`"${e.belgeDosyaAdi}" indiriliyor...`, 'success');
  };

  const toggleKatilimci = (id: string) => {
    setForm(prev => ({
      ...prev,
      katilimciIds: prev.katilimciIds.includes(id)
        ? prev.katilimciIds.filter(k => k !== id)
        : [...prev.katilimciIds, id],
    }));
  };

  const handleSave = () => {
    if (!form.ad.trim()) { addToast('Eğitim türü/adı zorunludur.', 'error'); return; }
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (editingId) {
      updateEgitim(editingId, form);
      addToast('Eğitim güncellendi.', 'success');
    } else {
      addEgitim(form);
      addToast('Eğitim eklendi.', 'success');
    }
    setFormOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteEgitim(id);
    setDeleteConfirm(null);
    addToast('Eğitim silindi.', 'info');
  };

  const aktifEgitimler = useMemo(() => egitimler.filter(e => !e.silinmis), [egitimler]);
  const stats = useMemo(() => ({
    toplam: aktifEgitimler.length,
    planlandi: aktifEgitimler.filter(e => e.durum === 'Planlandı').length,
    tamamlandi: aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length,
    eksik: aktifEgitimler.filter(e => e.durum === 'Eksik').length,
  }), [aktifEgitimler]);

  const detailEgitim = egitimler.find(e => e.id === detailId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Eğitim Yönetimi</h1>
          <p className="text-sm mt-1" style={{ color: '#475569' }}>Personel eğitim ve belge takibi</p>
        </div>
        <button onClick={openAdd} className="btn-primary whitespace-nowrap">
          <i className="ri-add-circle-line text-base" />
          Yeni Eğitim Ekle
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Eğitim', value: stats.toplam, icon: 'ri-graduation-cap-line', color: 'var(--text-primary)', bg: 'var(--bg-input)', border: 'var(--border-main)' },
          { label: 'Planlandı', value: stats.planlandi, icon: 'ri-calendar-schedule-line', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)' },
          { label: 'Tamamlandı', value: stats.tamamlandi, icon: 'ri-checkbox-circle-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
          { label: 'Eksik / Belgesi Yok', value: stats.eksik, icon: 'ri-error-warning-line', color: '#F97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)' },
        ].map(s => (
          <div key={s.label} className="isg-card rounded-xl p-4 flex items-center gap-4 transition-all duration-200 hover:scale-[1.02] cursor-pointer" style={{ border: `1px solid ${s.border}`, background: s.bg }} onClick={() => setStatusFilter(s.label === 'Toplam Eğitim' ? '' : s.label === 'Eksik / Belgesi Yok' ? 'Eksik' : s.label)}>
            <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${s.color}18` }}>
              <i className={`${s.icon} text-xl`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: s.color }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="relative flex-1 min-w-[160px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Eğitim türü veya açıklama ara..."
            className="isg-input pl-9"
          />
        </div>
        <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input" style={{ minWidth: '160px' }}>
          <option value="">Tüm Firmalar</option>
          {firmalar.map(fi => <option key={fi.id} value={fi.id}>{fi.ad}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="isg-input" style={{ minWidth: '140px' }}>
          <option value="">Tüm Durumlar</option>
          {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || firmaFilter || statusFilter) && (
          <button onClick={() => { setSearch(''); setFirmaFilter(''); setStatusFilter(''); }} className="btn-secondary whitespace-nowrap">
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="isg-card rounded-2xl p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-main)' }}>
            <i className="ri-graduation-cap-line text-3xl" style={{ color: 'var(--text-faint)' }} />
          </div>
          <p className="text-base font-bold" style={{ color: 'var(--text-muted)' }}>
            {search || firmaFilter || statusFilter ? 'Sonuç bulunamadı' : 'Henüz eğitim kaydı eklenmedi'}
          </p>
          <button onClick={openAdd} className="btn-primary mt-5"><i className="ri-add-line" /> Yeni Eğitim Ekle</button>
        </div>
      ) : (
        <div className="isg-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-premium">
              <thead>
                <tr>
                  <th className="text-left">Eğitim Türü</th>
                  <th className="text-left hidden md:table-cell">Firma</th>
                  <th className="text-left hidden lg:table-cell">Katılımcılar</th>
                  <th className="text-left hidden sm:table-cell">Tarih</th>
                  <th className="text-left">Durum</th>
                  <th className="text-left hidden lg:table-cell">Belge</th>
                  <th className="w-28 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(eg => {
                  const stc = STATUS_CFG[eg.durum as EgitimStatus] || STATUS_CFG['Planlandı'];
                  const hasBelge = eg.belgeDosyaAdi || eg.belgeMevcut;
                  return (
                    <tr key={eg.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: stc.bg, border: `1px solid ${stc.border}` }}>
                            <i className="ri-graduation-cap-line text-sm" style={{ color: stc.color }} />
                          </div>
                          <div className="min-w-0">
                            <button onClick={() => setDetailId(eg.id)} className="text-sm font-semibold hover:text-blue-400 transition-colors cursor-pointer block text-left" style={{ color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {eg.ad}
                            </button>
                            {eg.aciklama && <p className="text-xs mt-0.5 truncate max-w-[180px]" style={{ color: '#475569' }}>{eg.aciklama}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell"><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getFirmaAd(eg.firmaId)}</p></td>
                      <td className="hidden lg:table-cell">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                          {eg.katilimciIds.length} kişi
                        </span>
                      </td>
                      <td className="hidden sm:table-cell"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>{eg.tarih ? new Date(eg.tarih).toLocaleDateString('tr-TR') : '—'}</span></td>
                      <td><Badge label={eg.durum} color={getStatusColor(eg.durum)} /></td>
                      <td className="hidden lg:table-cell">
                        {hasBelge ? (
                          <button onClick={() => handleBelgeIndir(eg)} className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all whitespace-nowrap" style={{ color: '#34D399' }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }} onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                            <i className="ri-file-check-line text-sm" />
                            {eg.belgeDosyaAdi ? <span className="max-w-[80px] truncate">{eg.belgeDosyaAdi}</span> : <span>Mevcut</span>}
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Belge yok</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <ABtn icon="ri-eye-line" color="#60A5FA" onClick={() => setDetailId(eg.id)} title="Detay" />
                          <ABtn icon="ri-edit-line" color="#F59E0B" onClick={() => openEdit(eg)} title="Düzenle" />
                          <ABtn icon="ri-delete-bin-line" color="#EF4444" onClick={() => setDeleteConfirm(eg.id)} title="Sil" />
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
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Eğitim Düzenle' : 'Yeni Eğitim Ekle'}
        size="lg"
        icon="ri-graduation-cap-line"
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleSave} className="btn-primary whitespace-nowrap">
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'} />
              {editingId ? 'Güncelle' : 'Eğitim Ekle'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Firma */}
          <div>
            <label className="form-label">Firma *</label>
            <select value={form.firmaId} onChange={e => setForm(p => ({ ...p, firmaId: e.target.value, katilimciIds: [] }))} className="isg-input">
              <option value="">Firma Seçin</option>
              {firmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </div>

          {/* Eğitim Türü */}
          <div>
            <label className="form-label">Eğitim Türü *</label>
            <select value={EGITIM_TURLERI.includes(form.ad) ? form.ad : (form.ad ? 'Diğer' : '')} onChange={e => setForm(p => ({ ...p, ad: e.target.value === 'Diğer' ? '' : e.target.value }))} className="isg-input">
              <option value="">Seçin...</option>
              {EGITIM_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(!EGITIM_TURLERI.includes(form.ad) || form.ad === '' || form.ad === 'Diğer') && (
              <input
                value={EGITIM_TURLERI.includes(form.ad) ? '' : form.ad}
                onChange={e => setForm(p => ({ ...p, ad: e.target.value }))}
                placeholder="Özel eğitim türü yazın..."
                className="isg-input mt-2"
              />
            )}
          </div>

          {/* Tarih */}
          <div>
            <label className="form-label">Eğitim Tarihi</label>
            <input type="date" value={form.tarih} onChange={e => setForm(p => ({ ...p, tarih: e.target.value }))} className="isg-input" />
          </div>

          {/* Durum */}
          <div>
            <label className="form-label">Durum</label>
            <select value={form.durum} onChange={e => setForm(p => ({ ...p, durum: e.target.value as EgitimStatus }))} className="isg-input">
              <option value="Planlandı">Planlandı</option>
              <option value="Tamamlandı">Tamamlandı</option>
              <option value="Eksik">Eksik</option>
            </select>
          </div>

          {/* Açıklama */}
          <div className="sm:col-span-2">
            <label className="form-label">Açıklama</label>
            <textarea value={form.aciklama || ''} onChange={e => setForm(p => ({ ...p, aciklama: e.target.value }))} placeholder="Eğitim detayları, notlar..." rows={3} maxLength={500} className="isg-input" />
          </div>

          {/* Katılımcı Seçimi */}
          {firmaPersoneller.length > 0 && (
            <div className="sm:col-span-2">
              <label className="form-label">
                Katılımcı Seçimi ({form.katilimciIds.length}/{firmaPersoneller.length})
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                {firmaPersoneller.map(p => (
                  <label key={p.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-150"
                    style={{ background: form.katilimciIds.includes(p.id) ? 'rgba(59,130,246,0.1)' : 'var(--bg-item)', border: form.katilimciIds.includes(p.id) ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--bg-item-border)' }}
                  >
                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                      style={form.katilimciIds.includes(p.id) ? { background: 'linear-gradient(135deg, #3B82F6, #6366F1)' } : { background: 'var(--bg-input)', border: '1.5px solid var(--border-main)' }}
                    >
                      {form.katilimciIds.includes(p.id) && <i className="ri-check-line text-white text-[10px]" />}
                    </div>
                    <input type="checkbox" checked={form.katilimciIds.includes(p.id)} onChange={() => toggleKatilimci(p.id)} className="hidden" />
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{p.adSoyad}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Belge / Evrak Yükleme */}
          <div className="sm:col-span-2">
            <label className="form-label">Eğitim Belgesi / Evrak (PDF / JPG / PNG)</label>
            <div
              className="rounded-xl p-5 text-center cursor-pointer transition-all duration-200"
              style={{ border: '2px dashed var(--border-main)', background: 'var(--bg-item)' }}
              onClick={() => fileRef.current?.click()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.background = 'rgba(59,130,246,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-main)'; e.currentTarget.style.background = 'var(--bg-item)'; }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0]); }}
            >
              {form.belgeDosyaAdi ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(16,185,129,0.12)' }}>
                    <i className="ri-file-check-line text-xl" style={{ color: '#10B981' }} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{form.belgeDosyaAdi}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{form.belgeDosyaBoyutu ? `${(form.belgeDosyaBoyutu / 1024).toFixed(1)} KB` : ''} — Değiştirmek için tıklayın</p>
                  </div>
                </div>
              ) : (
                <>
                  <i className="ri-upload-cloud-2-line text-2xl mb-2" style={{ color: 'var(--text-faint)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Belge sürükleyin veya tıklayın</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>PDF, JPG, PNG • Maks. 5MB</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => handleFileChange(e.target.files?.[0])} />
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      {detailEgitim && (
        <Modal
          open={!!detailId}
          onClose={() => setDetailId(null)}
          title={detailEgitim.ad}
          size="lg"
          icon="ri-graduation-cap-line"
          footer={
            <button onClick={() => { setDetailId(null); openEdit(detailEgitim); }} className="btn-secondary whitespace-nowrap">
              <i className="ri-edit-line" /> Düzenle
            </button>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge label={detailEgitim.durum} color={getStatusColor(detailEgitim.durum)} />
              <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.2)' }}>
                {getFirmaAd(detailEgitim.firmaId)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Tarih</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{detailEgitim.tarih ? new Date(detailEgitim.tarih).toLocaleDateString('tr-TR') : '—'}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Katılımcı Sayısı</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{detailEgitim.katilimciIds.length} kişi</p>
              </div>
            </div>
            {detailEgitim.aciklama && (
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Açıklama</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{detailEgitim.aciklama}</p>
              </div>
            )}
            {detailEgitim.katilimciIds.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Katılımcılar</p>
                <div className="flex flex-wrap gap-2">
                  {detailEgitim.katilimciIds.map(pid => {
                    const p = personeller.find(x => x.id === pid);
                    return p ? (
                      <span key={pid} className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                        {p.adSoyad}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
            {detailEgitim.belgeDosyaAdi && (
              <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <i className="ri-file-check-line text-xl" style={{ color: '#10B981' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{detailEgitim.belgeDosyaAdi}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{detailEgitim.belgeDosyaBoyutu ? `${(detailEgitim.belgeDosyaBoyutu / 1024).toFixed(1)} KB` : ''}</p>
                </div>
                <button onClick={() => handleBelgeIndir(detailEgitim)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.22)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}>
                  <i className="ri-download-line" /> İndir
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Eğitimi Sil"
        size="sm"
        icon="ri-delete-bin-line"
        footer={
          <>
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={() => handleDelete(deleteConfirm!)} className="btn-danger whitespace-nowrap"><i className="ri-delete-bin-line" /> Evet, Sil</button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>Bu eğitim kaydını silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Bu işlem geri alınamaz.</p>
        </div>
      </Modal>
    </div>
  );
}

function ABtn({ icon, color, onClick, title }: { icon: string; color: string; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200"
      style={{ color: '#475569' }}
      onMouseEnter={e => { e.currentTarget.style.color = color; e.currentTarget.style.background = `${color}18`; }}
      onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent'; }}
    >
      <i className={`${icon} text-sm`} />
    </button>
  );
}


