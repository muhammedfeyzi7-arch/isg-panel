import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import type { Firma, TehlikeSinifi, FirmaStatus } from '../../types';
import Modal from '../../components/base/Modal';
import Badge, { getFirmaStatusColor, getTehlikeColor, getPersonelStatusColor } from '../../components/base/Badge';
import PersonelDetayModal from '../personnel/components/PersonelDetayModal';

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

export default function FirmalarPage() {
  const {
    firmalar, personeller, evraklar, egitimler, muayeneler, uygunsuzluklar,
    addFirma, updateFirma, deleteFirma, addToast, quickCreate, setQuickCreate,
    getFirmaLogo, setFirmaLogo, getEvrakFile,
  } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tehlikeFilter, setTehlikeFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyFirma });
  const [logoVeri, setLogoVeri] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [personelDetailId, setPersonelDetailId] = useState<string | null>(null);
  const [personelDetailTab, setPersonelDetailTab] = useState('bilgiler');

  useEffect(() => {
    if (quickCreate === 'firmalar') {
      setForm({ ...emptyFirma });
      setEditingId(null);
      setLogoVeri('');
      setFormOpen(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  const filtered = useMemo(() => firmalar.filter(f => {
    if (f.silinmis) return false;
    const q = search.toLowerCase();
    return (!search || f.ad.toLowerCase().includes(q) || f.yetkiliKisi.toLowerCase().includes(q) || f.vergiNo.includes(q))
      && (!statusFilter || f.durum === statusFilter)
      && (!tehlikeFilter || f.tehlikeSinifi === tehlikeFilter);
  }), [firmalar, search, statusFilter, tehlikeFilter]);

  const openAdd = () => { setForm({ ...emptyFirma }); setEditingId(null); setLogoVeri(''); setFormOpen(true); };
  const openEdit = (f: Firma) => {
    setForm({ ...f });
    setEditingId(f.id);
    setLogoVeri(getFirmaLogo(f.id) || '');
    setFormOpen(true);
  };

  const handleLogoChange = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setLogoVeri(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!form.ad.trim()) { addToast('Firma adı zorunludur.', 'error'); return; }
    if (editingId) {
      updateFirma(editingId, form);
      if (logoVeri) setFirmaLogo(editingId, logoVeri);
      addToast('Firma başarıyla güncellendi.', 'success');
    } else {
      const yeniFirma = addFirma(form);
      if (logoVeri) setFirmaLogo(yeniFirma.id, logoVeri);
      addToast('Firma başarıyla eklendi.', 'success');
    }
    setFormOpen(false);
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

  const aktifCount = firmalar.filter(f => f.durum === 'Aktif').length;
  const cokTehlikeliCount = firmalar.filter(f => f.tehlikeSinifi === 'Çok Tehlikeli').length;



  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Firmalar</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{firmalar.length} firma kayıtlı</span>
            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--border-main)' }} />
            <span className="text-xs font-medium" style={{ color: '#34D399' }}>{aktifCount} aktif</span>
            {cokTehlikeliCount > 0 && (
              <>
                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--border-main)' }} />
                <span className="text-xs font-medium" style={{ color: '#F87171' }}>{cokTehlikeliCount} çok tehlikeli</span>
              </>
            )}
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <i className="ri-add-circle-line text-base" />
          Yeni Firma Ekle
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 px-4 py-3 rounded-2xl isg-card">
        <div className="relative flex-1 min-w-[180px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Firma adı, yetkili kişi veya vergi no..."
            className="isg-input pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="isg-input"
          style={{ width: 'auto', minWidth: '150px' }}
        >
          <option value="">Tüm Durumlar</option>
          <option value="Aktif">Aktif</option>
          <option value="Pasif">Pasif</option>
          <option value="Askıda">Askıda</option>
        </select>
        <select
          value={tehlikeFilter}
          onChange={e => setTehlikeFilter(e.target.value)}
          className="isg-input"
          style={{ width: 'auto', minWidth: '170px' }}
        >
          <option value="">Tüm Tehlike Sınıfları</option>
          <option value="Az Tehlikeli">Az Tehlikeli</option>
          <option value="Tehlikeli">Tehlikeli</option>
          <option value="Çok Tehlikeli">Çok Tehlikeli</option>
        </select>
        {(search || statusFilter || tehlikeFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setTehlikeFilter(''); }}
            className="btn-secondary"
          >
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
      </div>

      {/* Table */}
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
        <div className="rounded-2xl overflow-hidden isg-card">
          <div className="overflow-x-auto">
            <table className="w-full table-premium">
              <thead>
                <tr>
                  <th className="text-left">Firma Adı</th>
                  <th className="text-left hidden md:table-cell">Yetkili Kişi</th>
                  <th className="text-left hidden lg:table-cell">İletişim</th>
                  <th className="text-left hidden md:table-cell">Tehlike Sınıfı</th>
                  <th className="text-left">Durum</th>
                  <th className="text-left hidden lg:table-cell">Sözleşme Bitiş</th>
                  <th className="w-20 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((firma) => (
                  <tr key={firma.id}>
                    <td>
                      <button
                        onClick={() => setDetailId(firma.id)}
                        className="group cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 text-xs font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
                          >
                            {firma.ad.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">{firma.ad}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{firma.vergiNo || 'Vergi no yok'}</p>
                          </div>
                        </div>
                      </button>
                    </td>
                    <td className="hidden md:table-cell">
                      <p className="text-sm text-slate-300">{firma.yetkiliKisi || '—'}</p>
                    </td>
                    <td className="hidden lg:table-cell">
                      <p className="text-sm text-slate-400">{firma.telefon || '—'}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{firma.email || ''}</p>
                    </td>
                    <td className="hidden md:table-cell">
                      <Badge label={firma.tehlikeSinifi} color={getTehlikeColor(firma.tehlikeSinifi)} />
                    </td>
                    <td>
                      <Badge label={firma.durum} color={getFirmaStatusColor(firma.durum)} />
                    </td>
                    <td className="hidden lg:table-cell">
                      <p className="text-sm text-slate-400">
                        {firma.sozlesmeBit ? new Date(firma.sozlesmeBit).toLocaleDateString('tr-TR') : '—'}
                      </p>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        <ActionBtn icon="ri-eye-line" color="#3B82F6" onClick={() => setDetailId(firma.id)} title="Detay" />
                        <ActionBtn icon="ri-edit-line" color="#F59E0B" onClick={() => openEdit(firma)} title="Düzenle" />
                        <ActionBtn icon="ri-delete-bin-line" color="#EF4444" onClick={() => setDeleteConfirm(firma.id)} title="Sil" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Firma Düzenle' : 'Yeni Firma Ekle'}
        size="lg"
        icon="ri-building-2-line"
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="btn-secondary">İptal</button>
            <button onClick={handleSave} className="btn-primary">
              <i className="ri-save-line" /> Kaydet
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Firma Adı *" value={f('ad')} onChange={v => set('ad', v)} placeholder="Firma adı giriniz" />
          <FormField label="Yetkili Kişi" value={f('yetkiliKisi')} onChange={v => set('yetkiliKisi', v)} placeholder="Yetkili kişi adı" />
          <FormField label="Telefon" value={f('telefon')} onChange={v => set('telefon', v)} placeholder="0212 000 00 00" />
          <FormField label="E-posta" value={f('email')} onChange={v => set('email', v)} placeholder="info@firma.com" type="email" />
          <FormField label="SGK Sicil No" value={f('sgkSicil')} onChange={v => set('sgkSicil', v)} placeholder="SGK sicil numarası" />
          <div className="md:col-span-2">
            <FormField label="Adres" value={f('adres')} onChange={v => set('adres', v)} placeholder="Firma adresi" />
          </div>
          <FormSelect label="Tehlike Sınıfı" value={f('tehlikeSinifi')} onChange={v => set('tehlikeSinifi', v)} options={['Az Tehlikeli', 'Tehlikeli', 'Çok Tehlikeli']} />
          <FormSelect label="Firma Durumu" value={f('durum')} onChange={v => set('durum', v)} options={['Aktif', 'Pasif', 'Askıda']} />
          <FormField label="Sözleşme Başlangıcı" value={f('sozlesmeBas')} onChange={v => set('sozlesmeBas', v)} type="date" />
          <FormField label="Sözleşme Bitişi" value={f('sozlesmeBit')} onChange={v => set('sozlesmeBit', v)} type="date" />
          {/* Logo Upload */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Firma Logosu (PNG / JPG)</label>
            <div
              className="rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all duration-200"
              style={{ border: '2px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
              onClick={() => logoRef.current?.click()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.background = 'rgba(59,130,246,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
            >
              {logoVeri ? (
                <>
                  <img src={logoVeri} alt="Logo önizleme" className="w-12 h-12 object-contain rounded-lg" style={{ background: 'white', padding: '4px' }} />
                  <div>
                    <p className="text-sm font-medium text-slate-200">Logo yüklendi</p>
                    <p className="text-xs" style={{ color: '#475569' }}>Değiştirmek için tıklayın</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <i className="ri-image-add-line text-2xl" style={{ color: '#334155' }} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Logo yüklemek için tıklayın</p>
                    <p className="text-xs mt-0.5" style={{ color: '#334155' }}>PNG, JPG — Tutanak Word belgesinde kullanılır</p>
                  </div>
                </>
              )}
            </div>
            <input ref={logoRef} type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={e => handleLogoChange(e.target.files?.[0])} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Notlar</label>
            <textarea
              value={f('notlar')}
              onChange={e => set('notlar', e.target.value)}
              rows={3}
              placeholder="Firma hakkında notlar..."
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#E2E8F0' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
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
              <button onClick={() => { setDetailId(null); openEdit(detailFirma); }} className="btn-secondary">
                <i className="ri-edit-line" /> Düzenle
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <InfoRow label="Yetkili Kişi" value={detailFirma.yetkiliKisi} />
              <InfoRow label="Telefon" value={detailFirma.telefon} />
              <InfoRow label="E-posta" value={detailFirma.email} />
              <InfoRow label="Vergi No" value={detailFirma.vergiNo} />
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
                <i className="ri-team-line" style={{ color: '#3B82F6' }} />
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
                        e.currentTarget.style.background = 'rgba(59,130,246,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)';
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
                      <i className="ri-arrow-right-s-line text-xs flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#60A5FA' }} />
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
    </div>
  );
}

function ActionBtn({ icon, color, onClick, title }: { icon: string; color: string; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 hover:scale-110"
      style={{ color: '#475569' }}
      onMouseEnter={e => {
        e.currentTarget.style.color = color;
        e.currentTarget.style.background = `${color}18`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = '#475569';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <i className={`${icon} text-sm`} />
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
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <i className={`${icon} text-3xl`} style={{ color: '#1E293B' }} />
      </div>
      <p className="text-base font-bold text-slate-400">{title}</p>
      <p className="text-sm mt-1 max-w-sm" style={{ color: '#334155' }}>{description}</p>
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
      <i className={`${icon} text-3xl`} style={{ color: '#1E293B' }} />
      <p className="text-sm mt-2" style={{ color: '#334155' }}>{text}</p>
    </div>
  );
}
