import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/base/Modal';
import type { Uygunsuzluk, UygunsuzlukSeverity, UygunsuzlukStatus } from '../../types';

const SEV_CONFIG: Record<UygunsuzlukSeverity, { color: string; bg: string }> = {
  'Düşük': { color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  'Orta': { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  'Yüksek': { color: '#FB923C', bg: 'rgba(251,146,60,0.12)' },
  'Kritik': { color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
};

const STS_CONFIG: Record<UygunsuzlukStatus, { color: string; bg: string; icon: string }> = {
  'Açık': { color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-error-warning-line' },
  'İncelemede': { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', icon: 'ri-search-eye-line' },
  'Kapatıldı': { color: '#34D399', bg: 'rgba(52,211,153,0.12)', icon: 'ri-checkbox-circle-line' },
};

const defaultForm: Omit<Uygunsuzluk, 'id' | 'olusturmaTarihi'> = {
  baslik: '',
  aciklama: '',
  firmaId: '',
  personelId: '',
  tarih: '',
  severity: 'Orta',
  durum: 'Açık',
  sorumlu: '',
  hedefTarih: '',
  kapatmaTarihi: '',
  notlar: '',
};

export default function UygunsuzluklarPage() {
  const { uygunsuzluklar, firmalar, personeller, addUygunsuzluk, updateUygunsuzluk, deleteUygunsuzluk, addToast, quickCreate, setQuickCreate } = useApp();

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Uygunsuzluk, 'id' | 'olusturmaTarihi'>>(defaultForm);

  useEffect(() => {
    if (quickCreate === 'uygunsuzluklar') {
      setEditId(null);
      setForm(defaultForm);
      setShowModal(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  const filteredPersoneller = useMemo(
    () => form.firmaId ? personeller.filter(p => p.firmaId === form.firmaId) : personeller,
    [personeller, form.firmaId]
  );

  const filtered = useMemo(() => {
    return uygunsuzluklar.filter(u => {
      if (u.silinmis) return false;
      const firma = firmalar.find(f => f.id === u.firmaId);
      const q = search.toLowerCase();
      const matchSearch = !q || u.baslik.toLowerCase().includes(q) || (firma?.ad.toLowerCase().includes(q) ?? false);
      const matchFirma = !firmaFilter || u.firmaId === firmaFilter;
      const matchStatus = !statusFilter || u.durum === statusFilter;
      return matchSearch && matchFirma && matchStatus;
    });
  }, [uygunsuzluklar, firmalar, search, firmaFilter, statusFilter]);

  const aktifUygunsuzluklar = useMemo(() => uygunsuzluklar.filter(u => !u.silinmis), [uygunsuzluklar]);
  const stats = useMemo(() => ({
    total: aktifUygunsuzluklar.length,
    acik: aktifUygunsuzluklar.filter(u => u.durum === 'Açık').length,
    kritik: aktifUygunsuzluklar.filter(u => u.severity === 'Kritik').length,
    kapali: aktifUygunsuzluklar.filter(u => u.durum === 'Kapatıldı').length,
  }), [aktifUygunsuzluklar]);

  const openAdd = () => { setEditId(null); setForm(defaultForm); setShowModal(true); };
  const openEdit = (u: Uygunsuzluk) => {
    setEditId(u.id);
    setForm({ baslik: u.baslik, aciklama: u.aciklama, firmaId: u.firmaId, personelId: u.personelId || '', tarih: u.tarih, severity: u.severity, durum: u.durum, sorumlu: u.sorumlu, hedefTarih: u.hedefTarih, kapatmaTarihi: u.kapatmaTarihi || '', notlar: u.notlar });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.baslik.trim()) { addToast('Başlık zorunludur.', 'error'); return; }
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (editId) {
      updateUygunsuzluk(editId, form);
      addToast('Uygunsuzluk güncellendi.', 'success');
    } else {
      addUygunsuzluk(form);
      addToast('Uygunsuzluk kaydı oluşturuldu.', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteUygunsuzluk(deleteId);
    addToast('Uygunsuzluk silindi.', 'success');
    setDeleteId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Saha Denetim</h2>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Sahada tespit edilen uygunsuzlukları kaydedin ve takip edin</p>
        </div>
        <button onClick={openAdd} className="btn-primary self-start sm:self-auto whitespace-nowrap">
          <i className="ri-add-line" /> Saha Kaydı Ekle
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Kayıt', value: stats.total, icon: 'ri-alert-line', color: '#FB923C', bg: 'rgba(251,146,60,0.1)' },
          { label: 'Açık', value: stats.acik, icon: 'ri-error-warning-line', color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
          { label: 'Kritik', value: stats.kritik, icon: 'ri-fire-line', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
          { label: 'Kapatıldı', value: stats.kapali, icon: 'ri-checkbox-circle-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
        ].map(s => (
          <div key={s.label} className="isg-card rounded-xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: s.bg }}>
              <i className={`${s.icon} text-xl`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="relative flex-1 min-w-[200px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Uygunsuzluk başlığı veya firma ara..." className="isg-input pl-9" />
        </div>
        <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input" style={{ minWidth: '180px' }}>
          <option value="">Tüm Firmalar</option>
          {firmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="isg-input" style={{ minWidth: '150px' }}>
          <option value="">Tüm Durumlar</option>
          {Object.keys(STS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="isg-card rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.15)' }}>
              <i className="ri-alert-line text-3xl" style={{ color: '#FB923C' }} />
            </div>
            <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>Uygunsuzluk kaydı bulunamadı</p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-faint)' }}>Yeni uygunsuzluk kaydı ekleyin</p>
            <button onClick={openAdd} className="btn-primary mt-5"><i className="ri-add-line" /> Uygunsuzluk Ekle</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-premium w-full">
              <thead>
                <tr>
                  <th className="text-left">Başlık</th>
                  <th className="text-left hidden md:table-cell">Firma</th>
                  <th className="text-left hidden lg:table-cell">Personel</th>
                  <th className="text-left hidden sm:table-cell">Tarih</th>
                  <th className="text-left">Önem</th>
                  <th className="text-left">Durum</th>
                  <th className="text-left hidden lg:table-cell">Sorumlu</th>
                  <th className="text-left hidden lg:table-cell">Hedef Tarih</th>
                  <th className="text-right w-20">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const firma = firmalar.find(f => f.id === u.firmaId);
                  const personel = personeller.find(p => p.id === u.personelId);
                  const sc = SEV_CONFIG[u.severity];
                  const stc = STS_CONFIG[u.durum];
                  return (
                    <tr key={u.id}>
                      <td>
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.baslik}</p>
                        {u.aciklama && <p className="text-xs mt-0.5 truncate max-w-[180px]" style={{ color: '#475569' }}>{u.aciklama}</p>}
                      </td>
                      <td className="hidden md:table-cell"><span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{firma?.ad || '—'}</span></td>
                      <td className="hidden lg:table-cell"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>{personel?.adSoyad || '—'}</span></td>
                      <td className="hidden sm:table-cell"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>{u.tarih ? new Date(u.tarih).toLocaleDateString('tr-TR') : '—'}</span></td>
                      <td><span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: sc.bg, color: sc.color }}>{u.severity}</span></td>
                      <td><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: stc.bg, color: stc.color }}><i className={stc.icon} />{u.durum}</span></td>
                      <td className="hidden lg:table-cell"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>{u.sorumlu || '—'}</span></td>
                      <td className="hidden lg:table-cell"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>{u.hedefTarih ? new Date(u.hedefTarih).toLocaleDateString('tr-TR') : '—'}</span></td>
                      <td>
                        <div className="flex items-center gap-1.5 justify-end">
                          <button onClick={() => openEdit(u)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}><i className="ri-edit-line text-sm" /></button>
                          <button onClick={() => setDeleteId(u.id)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}><i className="ri-delete-bin-line text-sm" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'Uygunsuzluk Düzenle' : 'Yeni Uygunsuzluk Ekle'}
        size="lg"
        icon="ri-alert-line"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleSave} className="btn-primary whitespace-nowrap">
              <i className={editId ? 'ri-save-line' : 'ri-add-line'} />{editId ? 'Güncelle' : 'Kaydet'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="form-label">Başlık *</label>
            <input value={form.baslik} onChange={e => setForm(p => ({ ...p, baslik: e.target.value }))} placeholder="Uygunsuzluk başlığı..." className="isg-input" />
          </div>
          <div>
            <label className="form-label">Firma *</label>
            <select value={form.firmaId} onChange={e => setForm(p => ({ ...p, firmaId: e.target.value, personelId: '' }))} className="isg-input">
              <option value="">Firma Seçin</option>
              {firmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">İlgili Personel</label>
            <select value={form.personelId} onChange={e => setForm(p => ({ ...p, personelId: e.target.value }))} className="isg-input">
              <option value="">Personel Seçin (İsteğe Bağlı)</option>
              {filteredPersoneller.map(p => <option key={p.id} value={p.id}>{p.adSoyad}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Tespit Tarihi</label>
            <input type="date" value={form.tarih} onChange={e => setForm(p => ({ ...p, tarih: e.target.value }))} className="isg-input" />
          </div>
          <div>
            <label className="form-label">Önem Derecesi</label>
            <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value as UygunsuzlukSeverity }))} className="isg-input">
              {Object.keys(SEV_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Durum</label>
            <select value={form.durum} onChange={e => setForm(p => ({ ...p, durum: e.target.value as UygunsuzlukStatus }))} className="isg-input">
              {Object.keys(STS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Sorumlu Kişi</label>
            <input value={form.sorumlu} onChange={e => setForm(p => ({ ...p, sorumlu: e.target.value }))} placeholder="Ad Soyad" className="isg-input" />
          </div>
          <div>
            <label className="form-label">Hedef Kapatma Tarihi</label>
            <input type="date" value={form.hedefTarih} onChange={e => setForm(p => ({ ...p, hedefTarih: e.target.value }))} className="isg-input" />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">Açıklama</label>
            <textarea value={form.aciklama} onChange={e => setForm(p => ({ ...p, aciklama: e.target.value }))} placeholder="Uygunsuzluk detayları..." rows={3} maxLength={500} className="isg-input" />
          </div>
        </div>
      </Modal>

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
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>Bu uygunsuzluk kaydını silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Bu işlem geri alınamaz.</p>
        </div>
      </Modal>
    </div>
  );
}
