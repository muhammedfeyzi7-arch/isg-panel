import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/base/Modal';
import type { Gorev, GorevStatus, GorevOncelik } from '../../types';

const STS_CONFIG: Record<GorevStatus, { color: string; bg: string; icon: string }> = {
  'Bekliyor': { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'ri-time-line' },
  'Devam Ediyor': { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)', icon: 'ri-loader-line' },
  'Tamamlandı': { color: '#34D399', bg: 'rgba(52,211,153,0.12)', icon: 'ri-checkbox-circle-line' },
  'İptal': { color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line' },
};

const PRI_CONFIG: Record<GorevOncelik, { color: string; bg: string }> = {
  'Düşük': { color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
  'Normal': { color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
  'Yüksek': { color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
  'Kritik': { color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
};

const defaultForm: Omit<Gorev, 'id' | 'olusturmaTarihi'> = {
  baslik: '',
  aciklama: '',
  firmaId: '',
  personelId: '',
  atananKisi: '',
  oncelik: 'Normal',
  durum: 'Bekliyor',
  baslangicTarihi: '',
  bitisTarihi: '',
  tamamlanmaTarihi: '',
  notlar: '',
};

export default function GorevlerPage() {
  const { gorevler, firmalar, personeller, addGorev, updateGorev, deleteGorev, addToast, quickCreate, setQuickCreate } = useApp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Gorev, 'id' | 'olusturmaTarihi'>>(defaultForm);

  useEffect(() => {
    if (quickCreate === 'gorevler') {
      setEditId(null);
      setForm(defaultForm);
      setShowModal(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  const filtered = useMemo(() => {
    return gorevler
      .filter(g => {
        if (g.silinmis) return false;
        const q = search.toLowerCase();
        const matchSearch = !q || g.baslik.toLowerCase().includes(q) || g.atananKisi.toLowerCase().includes(q);
        const matchStatus = !statusFilter || g.durum === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        const ta = a.olusturmaTarihi ?? '';
        const tb = b.olusturmaTarihi ?? '';
        return tb.localeCompare(ta);
      });
  }, [gorevler, search, statusFilter]);

  const aktifGorevler = useMemo(() => gorevler.filter(g => !g.silinmis), [gorevler]);
  const stats = useMemo(() => ({
    total: aktifGorevler.length,
    bekliyor: aktifGorevler.filter(g => g.durum === 'Bekliyor').length,
    devamEdiyor: aktifGorevler.filter(g => g.durum === 'Devam Ediyor').length,
    tamamlandi: aktifGorevler.filter(g => g.durum === 'Tamamlandı').length,
  }), [aktifGorevler]);

  const openAdd = () => { setEditId(null); setForm(defaultForm); setShowModal(true); };
  const openEdit = (g: Gorev) => {
    setEditId(g.id);
    setForm({ baslik: g.baslik, aciklama: g.aciklama, firmaId: g.firmaId || '', personelId: g.personelId || '', atananKisi: g.atananKisi, oncelik: g.oncelik, durum: g.durum, baslangicTarihi: g.baslangicTarihi, bitisTarihi: g.bitisTarihi, tamamlanmaTarihi: g.tamamlanmaTarihi || '', notlar: g.notlar });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.baslik.trim()) { addToast('Görev başlığı zorunludur.', 'error'); return; }
    if (editId) {
      updateGorev(editId, form);
      addToast('Görev güncellendi.', 'success');
    } else {
      addGorev(form);
      addToast('Görev oluşturuldu.', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteGorev(deleteId);
    addToast('Görev silindi.', 'success');
    setDeleteId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Görevler</h2>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Görev atamalarını oluşturun ve takip edin</p>
        </div>
        <button onClick={openAdd} className="btn-primary self-start sm:self-auto whitespace-nowrap">
          <i className="ri-add-line" /> Görev Ekle
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Görev', value: stats.total, icon: 'ri-task-line', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
          { label: 'Bekliyor', value: stats.bekliyor, icon: 'ri-time-line', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
          { label: 'Devam Ediyor', value: stats.devamEdiyor, icon: 'ri-loader-line', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
          { label: 'Tamamlandı', value: stats.tamamlandi, icon: 'ri-checkbox-circle-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Görev başlığı veya atanan kişi ara..." className="isg-input pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="isg-input" style={{ minWidth: '160px' }}>
          <option value="">Tüm Durumlar</option>
          {Object.keys(STS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Task Cards */}
      {filtered.length === 0 ? (
        <div className="isg-card rounded-xl py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <i className="ri-task-line text-3xl" style={{ color: '#8B5CF6' }} />
          </div>
          <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>Görev bulunamadı</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-faint)' }}>Yeni görev oluşturmak için butonu kullanın</p>
          <button onClick={openAdd} className="btn-primary mt-5"><i className="ri-add-line" /> Görev Ekle</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(g => {
            const firma = firmalar.find(f => f.id === g.firmaId);
            const personel = personeller.find(p => p.id === g.personelId);
            const stc = STS_CONFIG[g.durum];
            const prc = PRI_CONFIG[g.oncelik];
            return (
              <div
                key={g.id}
                className="isg-card rounded-xl p-5 flex flex-col gap-3 cursor-pointer transition-all duration-200"
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm leading-snug flex-1" style={{ color: 'var(--text-primary)' }}>{g.baslik}</h3>
                  <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap flex-shrink-0" style={{ background: prc.bg, color: prc.color }}>{g.oncelik}</span>
                </div>

                {g.aciklama && <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{g.aciklama}</p>}

                {/* Meta */}
                <div className="space-y-1.5">
                  {g.atananKisi && (
                    <div className="flex items-center gap-2">
                      <i className="ri-user-line text-xs" style={{ color: '#475569' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.atananKisi}</span>
                    </div>
                  )}
                  {firma && (
                    <div className="flex items-center gap-2">
                      <i className="ri-building-2-line text-xs" style={{ color: '#475569' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{firma.ad}</span>
                    </div>
                  )}
                  {personel && (
                    <div className="flex items-center gap-2">
                      <i className="ri-team-line text-xs" style={{ color: '#475569' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{personel.adSoyad}</span>
                    </div>
                  )}
                  {g.bitisTarihi && (
                    <div className="flex items-center gap-2">
                      <i className="ri-calendar-line text-xs" style={{ color: '#475569' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Bitiş: {new Date(g.bitisTarihi).toLocaleDateString('tr-TR')}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 mt-auto" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: stc.bg, color: stc.color }}>
                    <i className={stc.icon} />{g.durum}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(g)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}><i className="ri-edit-line text-xs" /></button>
                    <button onClick={() => setDeleteId(g.id)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}><i className="ri-delete-bin-line text-xs" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'Görevi Düzenle' : 'Yeni Görev Ekle'}
        size="lg"
        icon="ri-task-line"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleSave} className="btn-primary whitespace-nowrap">
              <i className={editId ? 'ri-save-line' : 'ri-add-line'} />{editId ? 'Güncelle' : 'Oluştur'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="form-label">Görev Başlığı *</label>
            <input value={form.baslik} onChange={e => setForm(p => ({ ...p, baslik: e.target.value }))} placeholder="Görev açıklaması..." className="isg-input" />
          </div>
          <div>
            <label className="form-label">Atanan Kişi</label>
            <input value={form.atananKisi} onChange={e => setForm(p => ({ ...p, atananKisi: e.target.value }))} placeholder="Ad Soyad" className="isg-input" />
          </div>
          <div>
            <label className="form-label">Öncelik</label>
            <select value={form.oncelik} onChange={e => setForm(p => ({ ...p, oncelik: e.target.value as GorevOncelik }))} className="isg-input">
              {Object.keys(PRI_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Durum</label>
            <select value={form.durum} onChange={e => setForm(p => ({ ...p, durum: e.target.value as GorevStatus }))} className="isg-input">
              {Object.keys(STS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">İlgili Firma</label>
            <select value={form.firmaId} onChange={e => setForm(p => ({ ...p, firmaId: e.target.value }))} className="isg-input">
              <option value="">Firma Seçin (İsteğe Bağlı)</option>
              {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">İlgili Personel</label>
            <select value={form.personelId} onChange={e => setForm(p => ({ ...p, personelId: e.target.value }))} className="isg-input">
              <option value="">Personel Seçin (İsteğe Bağlı)</option>
              {personeller.filter(p => !p.silinmis).map(p => <option key={p.id} value={p.id}>{p.adSoyad}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Başlangıç Tarihi</label>
            <input type="date" value={form.baslangicTarihi} onChange={e => setForm(p => ({ ...p, baslangicTarihi: e.target.value }))} className="isg-input" />
          </div>
          <div>
            <label className="form-label">Bitiş Tarihi</label>
            <input type="date" value={form.bitisTarihi} onChange={e => setForm(p => ({ ...p, bitisTarihi: e.target.value }))} className="isg-input" />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">Açıklama</label>
            <textarea value={form.aciklama} onChange={e => setForm(p => ({ ...p, aciklama: e.target.value }))} placeholder="Görev detayları..." rows={3} maxLength={500} className="isg-input" />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Görevi Sil"
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
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>Bu görevi silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Bu işlem geri alınamaz.</p>
        </div>
      </Modal>
    </div>
  );
}
