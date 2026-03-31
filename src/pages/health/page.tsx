import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/base/Modal';
import Badge, { getEvrakStatusColor } from '../../components/base/Badge';
import type { Muayene, MuayeneResult } from '../../types';
import { getEvrakKategori } from '../../utils/evrakKategori';

const RESULT_CONFIG: Record<MuayeneResult, { label: string; color: string; bg: string; icon: string }> = {
  'Çalışabilir': { label: 'Çalışabilir', color: '#34D399', bg: 'rgba(52,211,153,0.12)', icon: 'ri-checkbox-circle-line' },
  'Kısıtlı Çalışabilir': { label: 'Kısıtlı', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', icon: 'ri-error-warning-line' },
  'Çalışamaz': { label: 'Çalışamaz', color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line' },
};

const defaultForm: Omit<Muayene, 'id' | 'olusturmaTarihi'> = {
  personelId: '',
  firmaId: '',
  muayeneTarihi: '',
  sonrakiTarih: '',
  sonuc: 'Çalışabilir',
  hastane: '',
  doktor: '',
  notlar: '',
  belgeMevcut: false,
  dosyaAdi: '',
  dosyaBoyutu: 0,
  dosyaTipi: '',
  dosyaVeri: '',
};

function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function MuayenelerPage() {
  const { muayeneler, evraklar, personeller, firmalar, addMuayene, updateMuayene, deleteMuayene, addToast, quickCreate, setQuickCreate } = useApp();

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Muayene, 'id' | 'olusturmaTarihi'>>(defaultForm);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quickCreate === 'muayeneler') {
      setEditId(null);
      setForm(defaultForm);
      setShowModal(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  const filteredPersoneller = useMemo(
    () => form.firmaId ? personeller.filter(p => p.firmaId === form.firmaId && p.durum === 'Aktif' && !p.silinmis) : personeller.filter(p => p.durum === 'Aktif' && !p.silinmis),
    [personeller, form.firmaId]
  );

  const filtered = useMemo(() => {
    return muayeneler.filter(m => {
      if (m.silinmis) return false;
      const personel = personeller.find(p => p.id === m.personelId);
      const firma = firmalar.find(f => f.id === m.firmaId);
      const q = search.toLowerCase();
      const matchSearch = !q || (personel?.adSoyad.toLowerCase().includes(q) ?? false) || (firma?.ad.toLowerCase().includes(q) ?? false);
      const matchFirma = !firmaFilter || m.firmaId === firmaFilter;
      return matchSearch && matchFirma;
    });
  }, [muayeneler, personeller, firmalar, search, firmaFilter]);

  // Sağlık kategorisindeki evraklar (EK-2, Sağlık Raporu vb.)
  // Üç katmanlı kontrol: kayıtlı kategori → tur direkt eşleşme → keyword fallback
  const SAGLIK_TURLERI = ['EK-2', 'Sağlık Raporu', 'ek-2', 'sağlık raporu', 'saglik raporu'];
  const saglikEvraklar = useMemo(() => {
    return evraklar.filter(e => {
      if (e.silinmis) return false;
      if (e.kategori === 'saglik') return true;
      if (SAGLIK_TURLERI.some(t => e.tur?.toLowerCase() === t.toLowerCase())) return true;
      return getEvrakKategori(e.tur ?? '', e.ad ?? '') === 'saglik';
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evraklar]);

  // Filtrelenmiş sağlık evrakları
  const filteredSaglikEvraklar = useMemo(() => {
    return saglikEvraklar.filter(e => {
      const personel = personeller.find(p => p.id === e.personelId);
      const firma = firmalar.find(f => f.id === e.firmaId);
      const q = search.toLowerCase();
      const matchSearch = !q
        || (personel?.adSoyad.toLowerCase().includes(q) ?? false)
        || (firma?.ad.toLowerCase().includes(q) ?? false)
        || e.ad.toLowerCase().includes(q);
      const matchFirma = !firmaFilter || e.firmaId === firmaFilter;
      return matchSearch && matchFirma;
    });
  }, [saglikEvraklar, personeller, firmalar, search, firmaFilter]);

  const aktifMuayeneler = useMemo(() => muayeneler.filter(m => !m.silinmis), [muayeneler]);
  const stats = useMemo(() => {
    const total = aktifMuayeneler.length;
    const uygun = aktifMuayeneler.filter(m => m.sonuc === 'Çalışabilir').length;
    const yaklasan = aktifMuayeneler.filter(m => { const d = getDaysUntil(m.sonrakiTarih); return d >= 0 && d <= 30; }).length;
    const gecmis = aktifMuayeneler.filter(m => getDaysUntil(m.sonrakiTarih) < 0).length;
    return { total, uygun, yaklasan, gecmis };
  }, [aktifMuayeneler]);

  const openAdd = () => { setEditId(null); setForm(defaultForm); setShowModal(true); };
  const openEdit = (m: Muayene) => {
    setEditId(m.id);
    setForm({
      personelId: m.personelId, firmaId: m.firmaId, muayeneTarihi: m.muayeneTarihi,
      sonrakiTarih: m.sonrakiTarih, sonuc: m.sonuc, hastane: m.hastane,
      doktor: m.doktor, notlar: m.notlar, belgeMevcut: m.belgeMevcut,
      dosyaAdi: m.dosyaAdi || '', dosyaBoyutu: m.dosyaBoyutu || 0,
      dosyaTipi: m.dosyaTipi || '', dosyaVeri: m.dosyaVeri || '',
    });
    setShowModal(true);
  };

  const handleFileChange = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const veri = e.target?.result as string;
      setForm(p => ({
        ...p, dosyaAdi: file.name, dosyaBoyutu: file.size,
        dosyaTipi: file.type, dosyaVeri: veri, belgeMevcut: true,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!form.personelId) { addToast('Personel seçimi zorunludur.', 'error'); return; }
    if (!form.muayeneTarihi) { addToast('Muayene tarihi zorunludur.', 'error'); return; }
    if (editId) {
      updateMuayene(editId, form);
      addToast('Sağlık evrakı güncellendi.', 'success');
    } else {
      addMuayene(form);
      addToast('Sağlık evrakı eklendi.', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMuayene(deleteId);
    addToast('Sağlık evrakı silindi.', 'success');
    setDeleteId(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Sağlık Evrakları</h2>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Personel sağlık muayene kayıtlarını takip edin</p>
        </div>
        <button onClick={openAdd} className="btn-primary self-start sm:self-auto whitespace-nowrap">
          <i className="ri-add-line" /> Sağlık Evrakı Ekle
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Kayıt', value: stats.total, icon: 'ri-heart-pulse-line', color: '#F43F5E', bg: 'rgba(244,63,94,0.1)' },
          { label: 'Çalışabilir', value: stats.uygun, icon: 'ri-checkbox-circle-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Yaklaşan Kontrol', value: stats.yaklasan, icon: 'ri-time-line', color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
          { label: 'Süresi Geçmiş', value: stats.gecmis, icon: 'ri-alert-line', color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
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
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Personel veya firma ara..."
            className="isg-input pl-9"
          />
        </div>
        <select
          value={firmaFilter}
          onChange={e => setFirmaFilter(e.target.value)}
          className="isg-input"
          style={{ minWidth: '180px' }}
        >
          <option value="">Tüm Firmalar</option>
          {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="isg-card rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)' }}>
              <i className="ri-heart-pulse-line text-3xl" style={{ color: '#F43F5E' }} />
            </div>
            <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>Sağlık evrakı kaydı bulunamadı</p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-faint)' }}>Yeni kayıt eklemek için butonu kullanın</p>
            <button onClick={openAdd} className="btn-primary mt-5"><i className="ri-add-line" /> Sağlık Evrakı Ekle</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-premium w-full">
              <thead>
                <tr>
                  <th className="text-left">Personel</th>
                  <th className="text-left hidden md:table-cell">Firma</th>
                  <th className="text-left hidden sm:table-cell">Muayene Tarihi</th>
                  <th className="text-left hidden lg:table-cell">Sonraki Muayene</th>
                  <th className="text-left hidden lg:table-cell">Hastane / Doktor</th>
                  <th className="text-left">Sonuç</th>
                  <th className="text-left hidden md:table-cell">Belge</th>
                  <th className="text-right w-20">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const personel = personeller.find(p => p.id === m.personelId);
                  const firma = firmalar.find(f => f.id === m.firmaId);
                  const rc = RESULT_CONFIG[m.sonuc];
                  const days = getDaysUntil(m.sonrakiTarih);
                  const isOverdue = days < 0;
                  const isUrgent = days >= 0 && days <= 30;
                  return (
                    <tr key={m.id}>
                      <td>
                        <div>
                          <p className="font-semibold text-sm truncate max-w-[150px]" style={{ color: 'var(--text-primary)' }}>{personel?.adSoyad || '—'}</p>
                          <p className="text-xs mt-0.5 truncate max-w-[150px]" style={{ color: '#475569' }}>{personel?.gorev || ''}</p>
                        </div>
                      </td>
                      <td className="hidden md:table-cell"><span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{firma?.ad || '—'}</span></td>
                      <td className="hidden sm:table-cell"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>{m.muayeneTarihi ? new Date(m.muayeneTarihi).toLocaleDateString('tr-TR') : '—'}</span></td>
                      <td className="hidden lg:table-cell">
                        <div>
                          <span className={`text-sm ${isOverdue ? 'text-red-400' : isUrgent ? 'text-yellow-400' : ''}`} style={!isOverdue && !isUrgent ? { color: 'var(--text-muted)' } : {}}>
                            {m.sonrakiTarih ? new Date(m.sonrakiTarih).toLocaleDateString('tr-TR') : '—'}
                          </span>
                          {isOverdue && <p className="text-[10px] text-red-500 mt-0.5">Gecikmiş!</p>}
                          {isUrgent && !isOverdue && <p className="text-[10px] text-yellow-500 mt-0.5">{days} gün kaldı</p>}
                        </div>
                      </td>
                      <td className="hidden lg:table-cell">
                        <div>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{m.hastane || '—'}</p>
                          {m.doktor && <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Dr. {m.doktor}</p>}
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: rc.bg, color: rc.color }}>
                          <i className={rc.icon} />{rc.label}
                        </span>
                      </td>
                      <td className="hidden md:table-cell">
                        {m.belgeMevcut
                          ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }}><i className="ri-file-check-line" />Mevcut</span>
                          : <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Yok</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 justify-end">
                          <button onClick={() => openEdit(m)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }} title="Düzenle"><i className="ri-edit-line text-sm" /></button>
                          <button onClick={() => setDeleteId(m.id)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }} title="Sil"><i className="ri-delete-bin-line text-sm" /></button>
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

      {/* ── Sağlık Evrakları (EK-2, Sağlık Raporu vb.) ──────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(248,113,113,0.12)' }}>
            <i className="ri-file-text-line text-sm" style={{ color: '#F87171' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Sağlık Evrakları</h3>
            <p className="text-xs" style={{ color: '#64748B' }}>EK-2, Sağlık Raporu ve sağlık kategorisindeki tüm belgeler</p>
          </div>
          <span
            className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid rgba(248,113,113,0.2)' }}
          >
            {filteredSaglikEvraklar.length}
          </span>
        </div>

        <div className="isg-card rounded-xl overflow-hidden">
          {filteredSaglikEvraklar.length === 0 ? (
            <div className="py-10 text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)' }}>
                <i className="ri-file-text-line text-2xl" style={{ color: '#F87171' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                {search || firmaFilter ? 'Filtreyle eşleşen sağlık evrakı yok' : 'Henüz sağlık kategorisinde evrak eklenmedi'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                Evrak modülünde EK-2 veya Sağlık Raporu türünde evrak eklendiğinde burada görünür
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-premium w-full">
                <thead>
                  <tr>
                    <th className="text-left">Evrak Adı / Tür</th>
                    <th className="text-left hidden md:table-cell">Personel</th>
                    <th className="text-left hidden md:table-cell">Firma</th>
                    <th className="text-left">Durum</th>
                    <th className="text-left hidden lg:table-cell">Geçerlilik</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSaglikEvraklar.map(ev => {
                    const personel = personeller.find(p => p.id === ev.personelId);
                    const firma = firmalar.find(f => f.id === ev.firmaId);
                    return (
                      <tr key={ev.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.2)' }}>
                              <i className="ri-file-text-line text-xs" style={{ color: '#F87171' }} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-200">{ev.ad}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{ev.tur}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell">
                          <p className="text-sm text-slate-300">{personel?.adSoyad || <span className="italic" style={{ color: '#475569' }}>Firma Evrakı</span>}</p>
                        </td>
                        <td className="hidden md:table-cell">
                          <p className="text-sm text-slate-400">{firma?.ad || '—'}</p>
                        </td>
                        <td>
                          <Badge label={ev.durum} color={getEvrakStatusColor(ev.durum)} />
                        </td>
                        <td className="hidden lg:table-cell">
                          <p className="text-sm text-slate-400">
                            {ev.gecerlilikTarihi ? new Date(ev.gecerlilikTarihi).toLocaleDateString('tr-TR') : '—'}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'Sağlık Evrakı Düzenle' : 'Yeni Sağlık Evrakı Ekle'}
        size="lg"
        icon="ri-heart-pulse-line"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleSave} className="btn-primary whitespace-nowrap">
              <i className={editId ? 'ri-save-line' : 'ri-add-line'} />{editId ? 'Güncelle' : 'Ekle'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Firma</label>
            <select value={form.firmaId} onChange={e => setForm(p => ({ ...p, firmaId: e.target.value, personelId: '' }))} className="isg-input">
              <option value="">Firma Seçin</option>
              {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Personel *</label>
            <select value={form.personelId} onChange={e => setForm(p => ({ ...p, personelId: e.target.value }))} className="isg-input">
              <option value="">Personel Seçin</option>
              {filteredPersoneller.map(p => <option key={p.id} value={p.id}>{p.adSoyad}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Muayene Tarihi *</label>
            <input type="date" value={form.muayeneTarihi} onChange={e => setForm(p => ({ ...p, muayeneTarihi: e.target.value }))} className="isg-input" />
          </div>
          <div>
            <label className="form-label">Sonraki Muayene Tarihi</label>
            <input type="date" value={form.sonrakiTarih} onChange={e => setForm(p => ({ ...p, sonrakiTarih: e.target.value }))} className="isg-input" />
          </div>
          <div>
            <label className="form-label">Hastane / Klinik</label>
            <input value={form.hastane} onChange={e => setForm(p => ({ ...p, hastane: e.target.value }))} placeholder="Hastane adı" className="isg-input" />
          </div>
          <div>
            <label className="form-label">Doktor</label>
            <input value={form.doktor} onChange={e => setForm(p => ({ ...p, doktor: e.target.value }))} placeholder="Doktor adı" className="isg-input" />
          </div>
          <div>
            <label className="form-label">Muayene Sonucu</label>
            <select value={form.sonuc} onChange={e => setForm(p => ({ ...p, sonuc: e.target.value as MuayeneResult }))} className="isg-input">
              {Object.keys(RESULT_CONFIG).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Belge Mevcut mu?</label>
            <div className="flex items-center gap-4 mt-2">
              {[true, false].map(v => (
                <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={form.belgeMevcut === v} onChange={() => setForm(p => ({ ...p, belgeMevcut: v }))} style={{ accentColor: '#3B82F6' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{v ? 'Evet' : 'Hayır'}</span>
                </label>
              ))}
            </div>
          </div>
          {form.belgeMevcut && (
            <div className="sm:col-span-2">
              <label className="form-label">Belge Dosyası (PDF / JPG / PNG)</label>
              <div
                className="rounded-xl p-5 text-center cursor-pointer transition-all duration-200"
                style={{ border: '2px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
                onClick={() => fileRef.current?.click()}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.background = 'rgba(59,130,246,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0]); }}
              >
                {form.dosyaAdi ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(16,185,129,0.12)' }}>
                      <i className="ri-file-check-line text-lg" style={{ color: '#10B981' }} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-200">{form.dosyaAdi}</p>
                      <p className="text-xs" style={{ color: '#475569' }}>{form.dosyaBoyutu ? `${(form.dosyaBoyutu / 1024).toFixed(1)} KB` : ''}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setForm(p => ({ ...p, dosyaAdi: '', dosyaBoyutu: 0, dosyaTipi: '', dosyaVeri: '' })); }} className="ml-2 w-6 h-6 flex items-center justify-center rounded-full cursor-pointer" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                      <i className="ri-close-line text-xs" />
                    </button>
                  </div>
                ) : (
                  <>
                    <i className="ri-upload-cloud-2-line text-2xl mb-2" style={{ color: '#334155' }} />
                    <p className="text-sm text-slate-400">Dosyayı buraya sürükleyin veya tıklayın</p>
                    <p className="text-xs mt-1" style={{ color: '#334155' }}>PDF, JPG, PNG — Maks. 10MB</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => handleFileChange(e.target.files?.[0])} />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="form-label">Notlar</label>
            <textarea value={form.notlar} onChange={e => setForm(p => ({ ...p, notlar: e.target.value }))} placeholder="Ek notlar..." rows={3} maxLength={500} className="isg-input" />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
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
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>Bu sağlık muayene kaydını silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Bu işlem geri alınamaz.</p>
        </div>
      </Modal>
    </div>
  );
}
