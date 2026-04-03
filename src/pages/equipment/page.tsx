import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/base/Modal';
import QrModal from './components/QrModal';
import type { Ekipman, EkipmanStatus } from '../../types';
const EKIPMAN_TURLERI = [
  'İş Makinesi', 'Kaldırma Ekipmanı', 'Basınçlı Kap', 'Elektrikli Ekipman',
  'İskele / Platform', 'Koruyucu Donanım', 'Yangın Söndürücü', 'İlk Yardım Kiti',
  'Ölçüm Aleti', 'El Aleti', 'Diğer',
];

function parseTrDate(d: string): string {
  // Converts DD.MM.YYYY or DD/MM/YYYY to YYYY-MM-DD
  const parts = d.split(/[./]/);
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  // Already ISO
  if (d.match(/^\d{4}-\d{2}-\d{2}$/)) return d;
  return '';
}

function exportEkipmanToExcel(ekipmanlar: Ekipman[], firmalar: { id: string; ad: string }[]): void {
  const headers = ['Ekipman Adı', 'Ekipman Türü', 'Firma Adı', 'Bulunduğu Alan', 'Seri No', 'Marka', 'Model', 'Son Kontrol (GG.AA.YYYY)', 'Sonraki Kontrol (GG.AA.YYYY)', 'Durum', 'Açıklama'];
  const rows = ekipmanlar
    .filter(e => !e.silinmis)
    .map(e => {
      const firma = firmalar.find(f => f.id === e.firmaId);
      const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('tr-TR') : '';
      return [
        e.ad, e.tur, firma?.ad ?? '', e.bulunduguAlan, e.seriNo,
        e.marka, e.model, fmtDate(e.sonKontrolTarihi), fmtDate(e.sonrakiKontrolTarihi),
        e.durum, e.aciklama,
      ];
    });

  const csvRows = [headers, ...rows].map(row =>
    row.map(cell => {
      const str = String(cell ?? '');
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(','),
  );

  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Ekipmanlar-${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadEkipmanTemplate(): void {
  const headers = ['Ekipman Adı', 'Ekipman Türü', 'Firma Adı', 'Bulunduğu Alan', 'Seri No', 'Marka', 'Model', 'Son Kontrol (GG.AA.YYYY)', 'Sonraki Kontrol (GG.AA.YYYY)', 'Durum', 'Açıklama'];
  const example = ['Forklift', 'İş Makinesi', 'Örnek Firma A.Ş.', 'Depo', 'SN-001', 'Toyota', 'Model-X', '15.01.2025', '15.07.2025', 'Uygun', 'Yıllık bakım yapıldı'];
  const csvContent = '\uFEFF' + [headers, example].map(row => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Ekipman-Sablonu.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const STATUS_CONFIG: Record<EkipmanStatus, { label: string; color: string; bg: string; icon: string }> = {
  'Uygun': { label: 'Uygun', color: '#34D399', bg: 'rgba(52,211,153,0.12)', icon: 'ri-checkbox-circle-line' },
  'Uygun Değil': { label: 'Uygun Değil', color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line' },
  'Bakımda': { label: 'Bakımda', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', icon: 'ri-time-line' },
  'Hurda': { label: 'Hurda', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'ri-delete-bin-line' },
};

const defaultForm: Omit<Ekipman, 'id' | 'olusturmaTarihi'> = {
  ad: '',
  tur: '',
  firmaId: '',
  bulunduguAlan: '',
  seriNo: '',
  marka: '',
  model: '',
  sonKontrolTarihi: '',
  sonrakiKontrolTarihi: '',
  durum: 'Uygun',
  aciklama: '',
  belgeMevcut: false,
  dosyaAdi: '',
  dosyaBoyutu: 0,
  dosyaTipi: '',
  dosyaVeri: '',
  notlar: '',
};

function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function EkipmanlarPage() {
  const { ekipmanlar, firmalar, addEkipman, updateEkipman, deleteEkipman, getEkipmanFile, addToast, quickCreate, setQuickCreate } = useApp();

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Ekipman, 'id' | 'olusturmaTarihi'>>(defaultForm);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [qrEkipman, setQrEkipman] = useState<Ekipman | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quickCreate === 'ekipmanlar') {
      setEditId(null);
      setForm(defaultForm);
      setShowModal(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  const filtered = useMemo(() => {
    return ekipmanlar
      .filter(e => {
        if (e.silinmis) return false;
        const firma = firmalar.find(f => f.id === e.firmaId);
        const q = search.toLowerCase();
        const matchSearch = !q ||
          e.ad.toLowerCase().includes(q) ||
          e.tur.toLowerCase().includes(q) ||
          e.seriNo.toLowerCase().includes(q) ||
          (firma?.ad.toLowerCase().includes(q) ?? false);
        const matchFirma = !firmaFilter || e.firmaId === firmaFilter;
        const matchStatus = !statusFilter || e.durum === statusFilter;
        return matchSearch && matchFirma && matchStatus;
      })
      .sort((a, b) => {
        const ta = a.olusturmaTarihi ?? '';
        const tb = b.olusturmaTarihi ?? '';
        return tb.localeCompare(ta);
      });
  }, [ekipmanlar, firmalar, search, firmaFilter, statusFilter]);

  const aktifEkipmanlar = useMemo(() => ekipmanlar.filter(e => !e.silinmis), [ekipmanlar]);
  const stats = useMemo(() => {
    const total = aktifEkipmanlar.length;
    const uygun = aktifEkipmanlar.filter(e => e.durum === 'Uygun').length;
    const uygunDegil = aktifEkipmanlar.filter(e => e.durum === 'Uygun Değil').length;
    const yaklasan = aktifEkipmanlar.filter(e => {
      if (e.durum === 'Uygun Değil') return false; // kritik — tarih hesabı yapılmaz
      const days = getDaysUntil(e.sonrakiKontrolTarihi);
      return days >= 0 && days <= 30;
    }).length;
    return { total, uygun, uygunDegil, yaklasan };
  }, [aktifEkipmanlar]);

  const openAdd = () => {
    setEditId(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (ekipman: Ekipman) => {
    setEditId(ekipman.id);
    setForm({
      ad: ekipman.ad, tur: ekipman.tur, firmaId: ekipman.firmaId,
      bulunduguAlan: ekipman.bulunduguAlan, seriNo: ekipman.seriNo,
      marka: ekipman.marka, model: ekipman.model,
      sonKontrolTarihi: ekipman.sonKontrolTarihi, sonrakiKontrolTarihi: ekipman.sonrakiKontrolTarihi,
      durum: ekipman.durum, aciklama: ekipman.aciklama, belgeMevcut: ekipman.belgeMevcut,
      dosyaAdi: ekipman.dosyaAdi || '', dosyaBoyutu: ekipman.dosyaBoyutu || 0,
      dosyaTipi: ekipman.dosyaTipi || '', dosyaVeri: '', notlar: ekipman.notlar,
    });
    setShowModal(true);
  };

  const handleFileChange = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const veri = e.target?.result as string;
      setForm(prev => ({ ...prev, dosyaAdi: file.name, dosyaBoyutu: file.size, dosyaTipi: file.type, dosyaVeri: veri }));
    };
    reader.readAsDataURL(file);
  };

  const handleFileDownload = (ekipman: Ekipman) => {
    const veri = getEkipmanFile(ekipman.id);
    if (!veri) { addToast('Bu ekipman için yüklenmiş belge bulunamadı.', 'error'); return; }
    const link = document.createElement('a');
    link.href = veri;
    link.download = ekipman.dosyaAdi || 'ekipman-belgesi';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`"${ekipman.dosyaAdi}" indiriliyor...`, 'success');
  };

  const handleSave = () => {
    if (!form.ad.trim()) { addToast('Ekipman adı zorunludur.', 'error'); return; }
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (!form.tur) { addToast('Ekipman türü zorunludur.', 'error'); return; }

    if (editId) {
      updateEkipman(editId, form);
      addToast('Ekipman başarıyla güncellendi.', 'success');
    } else {
      addEkipman(form);
      addToast('Ekipman başarıyla eklendi.', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteEkipman(deleteId);
    addToast('Ekipman silindi.', 'success');
    setDeleteId(null);
  };

  const handleImportFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImportText(e.target?.result as string);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = () => {
    if (!importText.trim()) { addToast('Dosya içeriği boş.', 'error'); return; }
    setImporting(true);
    try {
      // Remove BOM if present
      const clean = importText.replace(/^\uFEFF/, '');
      const lines = clean.split('\n').filter(l => l.trim());
      if (lines.length < 2) { addToast('Dosya geçerli veri içermiyor.', 'error'); setImporting(false); return; }
      // Skip header row (index 0)
      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
        const [ad, tur, firmaAd, alan, seriNo, marka, model, sonKontrol, sonrakiKontrol, durum, aciklama] = cells;
        if (!ad) continue;
        const firma = firmalar.find(f => !f.silinmis && f.ad.toLowerCase() === firmaAd.toLowerCase());
        const durumTyped: EkipmanStatus = ['Uygun', 'Uygun Değil', 'Bakımda', 'Hurda'].includes(durum) ? (durum as EkipmanStatus) : 'Uygun';
        addEkipman({
          ad, tur: tur || '', firmaId: firma?.id ?? '',
          bulunduguAlan: alan || '', seriNo: seriNo || '',
          marka: marka || '', model: model || '',
          sonKontrolTarihi: parseTrDate(sonKontrol || ''),
          sonrakiKontrolTarihi: parseTrDate(sonrakiKontrol || ''),
          durum: durumTyped, aciklama: aciklama || '',
          belgeMevcut: false, dosyaAdi: '', dosyaBoyutu: 0, dosyaTipi: '', dosyaVeri: '', notlar: '',
        });
        count++;
      }
      addToast(`${count} ekipman başarıyla içe aktarıldı.`, 'success');
      setShowImport(false);
      setImportText('');
    } finally {
      setImporting(false);
    }
  };

  // inputStyle replaced by .isg-input CSS class

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Ekipman Kontrolleri</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Ekipman kayıtlarını ve kontrol durumlarını yönetin</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button onClick={() => exportEkipmanToExcel(ekipmanlar, firmalar)} className="btn-secondary whitespace-nowrap">
            <i className="ri-file-excel-2-line mr-1" />Excel İndir
          </button>
          <button onClick={() => setShowImport(true)} className="btn-secondary whitespace-nowrap">
            <i className="ri-upload-2-line mr-1" />Excel İçe Aktar
          </button>
          <button onClick={openAdd} className="btn-primary whitespace-nowrap self-start sm:self-auto">
            <i className="ri-add-line text-base" />
            Ekipman Ekle
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Ekipman', value: stats.total, icon: 'ri-tools-line', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
          { label: 'Uygun', value: stats.uygun, icon: 'ri-checkbox-circle-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Uygun Değil', value: stats.uygunDegil, icon: 'ri-close-circle-line', color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
          { label: 'Yaklaşan Kontrol', value: stats.yaklasan, icon: 'ri-time-line', color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
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

      {/* Filters */}
      <div className="isg-card rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Ekipman adı, tür veya seri no ara..."
            className="isg-input pl-9"
          />
        </div>
        <select
          value={firmaFilter}
          onChange={e => setFirmaFilter(e.target.value)}
          className="isg-input"
          style={{ width: 'auto', minWidth: '180px' }}
        >
          <option value="">Tüm Firmalar</option>
          {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="isg-input"
          style={{ width: 'auto', minWidth: '160px' }}
        >
          <option value="">Tüm Durumlar</option>
          {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || firmaFilter || statusFilter) && (
          <button onClick={() => { setSearch(''); setFirmaFilter(''); setStatusFilter(''); }} className="btn-secondary whitespace-nowrap">
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
      </div>

      {/* Table */}
      <div className="isg-card rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <i className="ri-tools-line text-3xl" style={{ color: '#3B82F6' }} />
            </div>
            <p className="font-semibold text-slate-400 text-base">Ekipman kaydı bulunamadı</p>
            <p className="text-sm mt-2" style={{ color: '#475569' }}>Yeni ekipman eklemek için "Ekipman Ekle" butonunu kullanın</p>
            <button onClick={openAdd} className="btn-primary mt-5">
              <i className="ri-add-line" /> Ekipman Ekle
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-premium w-full">
              <thead>
                <tr>
                  <th>Ekipman Adı</th>
                  <th>Tür</th>
                  <th>Firma</th>
                  <th>Bulunduğu Alan</th>
                  <th>Seri No</th>
                  <th>Son Kontrol</th>
                  <th>Sonraki Kontrol</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ekipman => {
                  const firma = firmalar.find(f => f.id === ekipman.firmaId);
                  const sc = STATUS_CONFIG[ekipman.durum];
                  const days = getDaysUntil(ekipman.sonrakiKontrolTarihi);
                  const isUrgent = days >= 0 && days <= 30;
                  const isOverdue = days < 0;
                  return (
                    <tr key={ekipman.id}>
                      <td>
                        <div>
                          <p className="font-semibold text-slate-200 text-sm">{ekipman.ad}</p>
                          {ekipman.marka && <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{ekipman.marka} {ekipman.model}</p>}
                        </div>
                      </td>
                      <td>
                        <span className="text-sm text-slate-400">{ekipman.tur || '—'}</span>
                      </td>
                      <td>
                        <span className="text-sm text-slate-300">{firma?.ad || '—'}</span>
                      </td>
                      <td>
                        <span className="text-sm text-slate-400">{ekipman.bulunduguAlan || '—'}</span>
                      </td>
                      <td>
                        <span className="text-xs font-mono text-slate-500">{ekipman.seriNo || '—'}</span>
                      </td>
                      <td>
                        <span className="text-sm text-slate-400">
                          {ekipman.sonKontrolTarihi ? new Date(ekipman.sonKontrolTarihi).toLocaleDateString('tr-TR') : '—'}
                        </span>
                      </td>
                      <td>
                        {ekipman.durum === 'Uygun Değil' ? (
                          /* Uygun Değil: tarih hesaplama yapma, kritik uyarı göster */
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md animate-pulse whitespace-nowrap"
                              style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                              <i className="ri-error-warning-fill mr-1" />KRİTİK
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className={`text-sm ${isOverdue ? 'text-red-400' : isUrgent ? 'text-yellow-400' : 'text-slate-400'}`}>
                              {ekipman.sonrakiKontrolTarihi ? new Date(ekipman.sonrakiKontrolTarihi).toLocaleDateString('tr-TR') : '—'}
                            </span>
                            {isOverdue && <p className="text-[10px] text-red-500 mt-0.5">Gecikmiş!</p>}
                            {isUrgent && !isOverdue && <p className="text-[10px] text-yellow-500 mt-0.5">{days} gün kaldı</p>}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                          style={{ background: sc.bg, color: sc.color }}
                        >
                          <i className={sc.icon} />
                          {sc.label}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {ekipman.dosyaAdi && (
                            <button onClick={() => handleFileDownload(ekipman)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200" style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.1)'; }} title="Belgeyi İndir"><i className="ri-download-2-line text-sm" /></button>
                          )}
                          <button onClick={() => setQrEkipman(ekipman)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200" style={{ background: 'rgba(168,85,247,0.1)', color: '#A855F7' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.1)'; }} title="QR Kod"><i className="ri-qr-code-line text-sm" /></button>
                          <button onClick={() => openEdit(ekipman)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }} title="Düzenle"><i className="ri-edit-line text-sm" /></button>
                          <button onClick={() => setDeleteId(ekipman.id)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }} title="Sil"><i className="ri-delete-bin-line text-sm" /></button>
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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'Ekipman Düzenle' : 'Yeni Ekipman Ekle'}
        size="lg"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Ekipman Adı */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Ekipman Adı *</label>
            <input
              value={form.ad}
              onChange={e => setForm(p => ({ ...p, ad: e.target.value }))}
              placeholder="Örn: Forklift, Kompresör, Yangın Söndürücü..."
              className="isg-input"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Ekipman Türü */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Ekipman Türü *</label>
            <select
              value={form.tur}
              onChange={e => setForm(p => ({ ...p, tur: e.target.value }))}
              className="isg-input cursor-pointer"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
            >
              <option value="">Tür Seçin</option>
              {EKIPMAN_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Firma */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Firma *</label>
            <select
              value={form.firmaId}
              onChange={e => setForm(p => ({ ...p, firmaId: e.target.value }))}
              className="isg-input cursor-pointer"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
            >
              <option value="">Firma Seçin</option>
              {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </div>

          {/* Bulunduğu Alan */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Bulunduğu Alan</label>
            <input
              value={form.bulunduguAlan}
              onChange={e => setForm(p => ({ ...p, bulunduguAlan: e.target.value }))}
              placeholder="Depo, Üretim Alanı, Ofis..."
              className="isg-input"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Seri No */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Seri Numarası</label>
            <input
              value={form.seriNo}
              onChange={e => setForm(p => ({ ...p, seriNo: e.target.value }))}
              placeholder="SN-001234"
              className="isg-input"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Marka */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Marka</label>
            <input
              value={form.marka}
              onChange={e => setForm(p => ({ ...p, marka: e.target.value }))}
              placeholder="Toyota, Bosch, Atlas Copco..."
              className="isg-input"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Model</label>
            <input
              value={form.model}
              onChange={e => setForm(p => ({ ...p, model: e.target.value }))}
              placeholder="Model adı veya kodu"
              className="isg-input"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Son Kontrol Tarihi */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Son Kontrol Tarihi</label>
            <input
              type="date"
              value={form.sonKontrolTarihi}
              onChange={e => setForm(p => ({ ...p, sonKontrolTarihi: e.target.value }))}
              className="isg-input"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Sonraki Kontrol Tarihi */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Sonraki Kontrol Tarihi</label>
            <input
              type="date"
              value={form.sonrakiKontrolTarihi}
              onChange={e => setForm(p => ({ ...p, sonrakiKontrolTarihi: e.target.value }))}
              className="isg-input"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Durum */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Durum</label>
            <select
              value={form.durum}
              onChange={e => setForm(p => ({ ...p, durum: e.target.value as Ekipman['durum'] }))}
              className="isg-input cursor-pointer"
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
            >
              {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Belge */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Belge Mevcut mu?</label>
            <div className="flex items-center gap-4 mt-2">
              {[true, false].map(v => (
                <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={form.belgeMevcut === v} onChange={() => setForm(p => ({ ...p, belgeMevcut: v, ...(v === false ? { dosyaAdi: '', dosyaBoyutu: 0, dosyaTipi: '', dosyaVeri: '' } : {}) }))} className="cursor-pointer" style={{ accentColor: '#3B82F6' }} />
                  <span className="text-sm text-slate-300">{v ? 'Evet' : 'Hayır'}</span>
                </label>
              ))}
            </div>
            {form.belgeMevcut && (
              <div className="mt-3">
                <div
                  className="rounded-xl p-4 text-center cursor-pointer transition-all duration-200"
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
                        <p className="text-xs" style={{ color: '#475569' }}>{form.dosyaBoyutu ? `${(form.dosyaBoyutu / 1024).toFixed(1)} KB` : ''} — Değiştirmek için tıklayın</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <i className="ri-upload-cloud-2-line text-2xl mb-1.5" style={{ color: '#334155' }} />
                      <p className="text-sm font-medium text-slate-400">Belgeyi sürükleyin veya tıklayın</p>
                      <p className="text-xs mt-1" style={{ color: '#334155' }}>PDF, JPG, PNG • Maks. 5MB</p>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => handleFileChange(e.target.files?.[0])} />
              </div>
            )}
          </div>

          {/* Açıklama */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>Açıklama</label>
            <textarea
              value={form.aciklama}
              onChange={e => setForm(p => ({ ...p, aciklama: e.target.value }))}
              placeholder="Ekipman hakkında açıklama veya notlar..."
              rows={3}
              maxLength={500}
              className="isg-input" style={{ resize: 'vertical' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5 pt-4" style={{ borderTop: '1px solid var(--border-main)' }}>
          <button
            onClick={() => setShowModal(false)}
            className="btn-secondary whitespace-nowrap"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            className="btn-primary whitespace-nowrap"
          >
            <i className={editId ? 'ri-save-line' : 'ri-add-line'} />
            {editId ? 'Güncelle' : 'Ekle'}
          </button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Ekipmanı Sil"
        size="sm"
      >
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-delete-bin-line text-2xl text-red-400" />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>Bu ekipmanı silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Bu işlem geri alınamaz.</p>
        </div>
        <div className="flex justify-center gap-3 mt-4">
          <button onClick={() => setDeleteId(null)} className="btn-secondary whitespace-nowrap">İptal</button>
          <button onClick={handleDelete} className="btn-danger whitespace-nowrap">Evet, Sil</button>
        </div>
      </Modal>

      {/* QR Modal */}
      <QrModal ekipman={qrEkipman} onClose={() => setQrEkipman(null)} />

      {/* Import Modal */}
      <Modal isOpen={showImport} onClose={() => { setShowImport(false); setImportText(''); }} title="Excel / CSV İçe Aktar" size="md" icon="ri-upload-2-line"
        footer={
          <>
            <button onClick={downloadEkipmanTemplate} className="btn-secondary whitespace-nowrap"><i className="ri-download-line mr-1" />Şablon İndir</button>
            <button onClick={() => { setShowImport(false); setImportText(''); }} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleImport} disabled={!importText || importing} className="btn-primary whitespace-nowrap disabled:opacity-50">
              <i className="ri-check-line mr-1" />{importing ? 'Aktarılıyor...' : 'İçe Aktar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl p-3.5" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#60A5FA' }}>Kullanım Kılavuzu</p>
            <ul className="text-xs space-y-1" style={{ color: '#94A3B8' }}>
              <li>• Önce <strong style={{ color: '#60A5FA' }}>Şablon İndir</strong> ile Excel şablonunu indirin</li>
              <li>• Şablonu Excel&apos;de doldurun, CSV olarak kaydedin</li>
              <li>• Durum değerleri: Uygun / Uygun Değil / Bakımda / Hurda</li>
              <li>• Tarih formatı: GG.AA.YYYY (örn: 15.03.2025)</li>
              <li>• Firma adı sistemdeki firma adıyla birebir eşleşmeli</li>
            </ul>
          </div>
          <div
            className="rounded-xl p-6 text-center cursor-pointer transition-all"
            style={{ border: '2px dashed var(--border-main)', background: 'var(--bg-item)' }}
            onClick={() => importFileRef.current?.click()}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(52,211,153,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-main)'; }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleImportFile(e.dataTransfer.files[0]); }}
          >
            {importText ? (
              <div className="flex items-center justify-center gap-3">
                <i className="ri-file-check-line text-2xl" style={{ color: '#34D399' }} />
                <div className="text-left">
                  <p className="text-sm font-semibold" style={{ color: '#34D399' }}>Dosya yüklendi</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>{importText.split('\n').length - 1} satır tespit edildi</p>
                </div>
              </div>
            ) : (
              <>
                <i className="ri-file-excel-2-line text-3xl mb-2" style={{ color: '#475569' }} />
                <p className="text-sm font-medium" style={{ color: '#64748B' }}>CSV dosyanızı sürükleyin veya tıklayın</p>
                <p className="text-xs mt-1" style={{ color: '#334155' }}>Excel&apos;den CSV olarak kaydedilmiş dosyalar desteklenir</p>
              </>
            )}
          </div>
          <input ref={importFileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => handleImportFile(e.target.files?.[0])} />
        </div>
      </Modal>
    </div>
  );
}
