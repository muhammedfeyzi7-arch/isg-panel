import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import type { IsIzni, IsIzniTip, IsIzniStatus } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { generateIsIzniNo } from '../../store/useStore';
import Modal from '../../components/base/Modal';

const TIP_CONFIG: Record<IsIzniTip, { color: string; bg: string; icon: string }> = {
  'Sıcak Çalışma':     { color: '#F97316', bg: 'rgba(249,115,22,0.12)',   icon: 'ri-fire-line' },
  'Yüksekte Çalışma':  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',   icon: 'ri-arrow-up-line' },
  'Kapalı Alan':       { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',   icon: 'ri-door-closed-line' },
  'Elektrikli Çalışma':{ color: '#EAB308', bg: 'rgba(234,179,8,0.12)',    icon: 'ri-flashlight-line' },
  'Kazı':              { color: '#A16207', bg: 'rgba(161,98,7,0.12)',     icon: 'ri-tools-line' },
  'Genel':             { color: '#64748B', bg: 'rgba(100,116,139,0.12)', icon: 'ri-file-shield-2-line' },
};

const DURUM_CONFIG: Record<IsIzniStatus, { color: string; bg: string; border: string; icon: string }> = {
  'Taslak':         { color: '#94A3B8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.2)', icon: 'ri-draft-line' },
  'Onay Bekliyor':  { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)', icon: 'ri-time-line' },
  'Onaylandı':      { color: '#34D399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.25)', icon: 'ri-checkbox-circle-line' },
  'Aktif':          { color: '#60A5FA', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.25)', icon: 'ri-play-circle-line' },
  'Tamamlandı':     { color: '#10B981', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.25)', icon: 'ri-shield-check-line' },
  'İptal':          { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)', icon: 'ri-close-circle-line' },
};

const TIPLER: IsIzniTip[] = ['Sıcak Çalışma', 'Yüksekte Çalışma', 'Kapalı Alan', 'Elektrikli Çalışma', 'Kazı', 'Genel'];
const DURUMLAR: IsIzniStatus[] = ['Taslak', 'Onay Bekliyor', 'Onaylandı', 'Aktif', 'Tamamlandı', 'İptal'];

const emptyForm = {
  tip: 'Genel' as IsIzniTip,
  firmaId: '',
  bolum: '',
  sorumlu: '',
  calisanlar: '',
  calisanSayisi: 1,
  aciklama: '',
  tehlikeler: '',
  onlemler: '',
  gerekliEkipman: '',
  baslamaTarihi: '',
  bitisTarihi: '',
  durum: 'Taslak' as IsIzniStatus,
  onaylayanKisi: '',
  onayTarihi: '',
  notlar: '',
  olusturanKisi: '',
};

export default function IsIzniPage() {
  const { isIzinleri, firmalar, currentUser, addIsIzni, updateIsIzni, deleteIsIzni, addToast, quickCreate, setQuickCreate } = useApp();
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

  const aktivFirmalar = useMemo(() => firmalar.filter(f => !f.silinmis), [firmalar]);

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
    return isIzinleri.filter(iz => {
      const firma = firmalar.find(f => f.id === iz.firmaId);
      return (
        (!q || iz.izinNo.toLowerCase().includes(q) || iz.aciklama.toLowerCase().includes(q) || iz.sorumlu.toLowerCase().includes(q) || (firma?.ad.toLowerCase().includes(q) ?? false))
        && (!tipFilter || iz.tip === tipFilter)
        && (!durumFilter || iz.durum === durumFilter)
        && (!firmaFilter || iz.firmaId === firmaFilter)
      );
    });
  }, [isIzinleri, firmalar, search, tipFilter, durumFilter, firmaFilter]);

  const stats = useMemo(() => ({
    total: isIzinleri.length,
    aktif: isIzinleri.filter(i => i.durum === 'Aktif').length,
    onayBekliyor: isIzinleri.filter(i => i.durum === 'Onay Bekliyor').length,
    tamamlandi: isIzinleri.filter(i => i.durum === 'Tamamlandı').length,
  }), [isIzinleri]);

  const sf = (field: string, value: unknown) => setForm(prev => ({ ...prev, [field]: value }));

  const openAdd = () => {
    setEditId(null);
    setForm({ ...emptyForm, olusturanKisi: currentUser.ad });
    setShowModal(true);
  };

  const openEdit = (iz: IsIzni) => {
    setEditId(iz.id);
    setForm({
      tip: iz.tip, firmaId: iz.firmaId, bolum: iz.bolum, sorumlu: iz.sorumlu,
      calisanlar: iz.calisanlar, calisanSayisi: iz.calisanSayisi, aciklama: iz.aciklama,
      tehlikeler: iz.tehlikeler, onlemler: iz.onlemler, gerekliEkipman: iz.gerekliEkipman,
      baslamaTarihi: iz.baslamaTarihi, bitisTarihi: iz.bitisTarihi, durum: iz.durum,
      onaylayanKisi: iz.onaylayanKisi, onayTarihi: iz.onayTarihi || '', notlar: iz.notlar,
      olusturanKisi: iz.olusturanKisi,
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.aciklama.trim()) { addToast('Açıklama zorunludur.', 'error'); return; }
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (!form.baslamaTarihi) { addToast('Başlama tarihi zorunludur.', 'error'); return; }
    if (editId) {
      updateIsIzni(editId, form);
      addToast('İş izni güncellendi.', 'success');
    } else {
      addIsIzni(form);
      addToast('İş izni oluşturuldu.', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteIsIzni(deleteId);
    addToast('İş izni silindi.', 'success');
    setDeleteId(null);
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>İş İzni Takip</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Sıcak çalışma, yüksekte çalışma ve diğer iş izinlerini yönetin</p>
        </div>
        {canCreate && (
          <button onClick={openAdd} className="btn-primary whitespace-nowrap self-start sm:self-auto">
            <i className="ri-add-line" /> Yeni İş İzni
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam İzin', value: stats.total, icon: 'ri-shield-keyhole-line', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
          { label: 'Aktif', value: stats.aktif, icon: 'ri-play-circle-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Onay Bekliyor', value: stats.onayBekliyor, icon: 'ri-time-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Tamamlandı', value: stats.tamamlandi, icon: 'ri-checkbox-circle-line', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
        ].map(s => (
          <div key={s.label} className="isg-card rounded-xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: s.bg }}>
              <i className={`${s.icon} text-xl`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

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
      </div>

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
                  const tip = TIP_CONFIG[iz.tip];
                  const dur = DURUM_CONFIG[iz.durum];
                  return (
                    <tr key={iz.id}>
                      <td><span className="text-sm font-mono font-semibold" style={{ color: '#60A5FA' }}>{iz.izinNo}</span></td>
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap" style={{ background: dur.bg, color: dur.color, border: `1px solid ${dur.border}` }}>
                          <i className={`${dur.icon} text-xs`} />{iz.durum}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setViewRecord(iz)} title="Detay" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>
                            <i className="ri-eye-line text-xs" />
                          </button>
                          {canEdit && (
                            <button onClick={() => openEdit(iz)} title="Düzenle" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                              <i className="ri-edit-line text-xs" />
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => setDeleteId(iz.id)} title="Sil" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
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
            <div>
              <label className="form-label">Durum</label>
              <select value={form.durum} onChange={e => sf('durum', e.target.value)} className={inp}>
                {DURUMLAR.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Çalışan Sayısı</label>
              <input type="number" min={1} value={form.calisanSayisi} onChange={e => sf('calisanSayisi', parseInt(e.target.value) || 1)} className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Çalışanlar</label>
              <input value={form.calisanlar} onChange={e => sf('calisanlar', e.target.value)} placeholder="Çalışan adları (virgülle ayırın)..." className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">İş Açıklaması *</label>
              <textarea value={form.aciklama} onChange={e => sf('aciklama', e.target.value)} placeholder="Yapılacak işin detaylı açıklaması..." rows={3} maxLength={500} className={`${inp} resize-y`} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Tehlikeler / Riskler</label>
              <textarea value={form.tehlikeler} onChange={e => sf('tehlikeler', e.target.value)} placeholder="Tespit edilen tehlikeler ve riskler..." rows={2} maxLength={500} className={`${inp} resize-y`} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Alınacak Önlemler</label>
              <textarea value={form.onlemler} onChange={e => sf('onlemler', e.target.value)} placeholder="Güvenlik önlemleri ve kontroller..." rows={2} maxLength={500} className={`${inp} resize-y`} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Gerekli Ekipman / KKD</label>
              <input value={form.gerekliEkipman} onChange={e => sf('gerekliEkipman', e.target.value)} placeholder="Baret, emniyet kemeri, eldiven..." className={inp} />
            </div>
            <div>
              <label className="form-label">Onaylayan Kişi</label>
              <input value={form.onaylayanKisi} onChange={e => sf('onaylayanKisi', e.target.value)} placeholder="Ad Soyad / Ünvan" className={inp} />
            </div>
            <div>
              <label className="form-label">Onay Tarihi</label>
              <input type="date" value={form.onayTarihi} onChange={e => sf('onayTarihi', e.target.value)} className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Notlar</label>
              <textarea value={form.notlar} onChange={e => sf('notlar', e.target.value)} placeholder="Ek notlar..." rows={2} maxLength={500} className={`${inp} resize-y`} />
            </div>
          </div>
        </div>
      </Modal>

      {/* Detay Modal */}
      {viewRecord && (
        <Modal open={!!viewRecord} onClose={() => setViewRecord(null)} title={`İzin Detayı — ${viewRecord.izinNo}`} size="lg" icon="ri-shield-keyhole-line"
          footer={<button onClick={() => setViewRecord(null)} className="btn-secondary whitespace-nowrap">Kapat</button>}>
          <div className="space-y-4">
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
            {viewRecord.aciklama && (
              <div className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-item)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Açıklama</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{viewRecord.aciklama}</p>
              </div>
            )}
            {viewRecord.tehlikeler && (
              <div className="px-3 py-2.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#EF4444' }}>Tehlikeler / Riskler</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{viewRecord.tehlikeler}</p>
              </div>
            )}
            {viewRecord.onlemler && (
              <div className="px-3 py-2.5 rounded-lg" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#22C55E' }}>Alınan Önlemler</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{viewRecord.onlemler}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Silme Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="İş İzni Sil" size="sm" icon="ri-delete-bin-line"
        footer={<><button onClick={() => setDeleteId(null)} className="btn-secondary whitespace-nowrap">İptal</button><button onClick={handleDelete} className="btn-danger whitespace-nowrap">Evet, Sil</button></>}>
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Bu iş iznini silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Bu işlem geri alınamaz.</p>
        </div>
      </Modal>
    </div>
  );
}
