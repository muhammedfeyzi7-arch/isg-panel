import { useState, useMemo } from 'react';
import Modal from '../../../components/base/Modal';
import { useApp } from '../../../store/AppContext';
import type { Uygunsuzluk } from '../../../types';
import { STATUS_CONFIG, SEV_CONFIG } from '../utils/statusHelper';
import { printDofRaporu, exportDofToExcel } from '../utils/dofPdfGenerator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReportBuilder({ isOpen, onClose }: Props) {
  const { uygunsuzluklar, firmalar, personeller, getUygunsuzlukPhoto } = useApp();
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const aktif = useMemo(() => uygunsuzluklar.filter(u => !u.silinmis && !u.cascadeSilindi), [uygunsuzluklar]);

  const filtered = useMemo(() => {
    return aktif.filter(u => {
      if (firmaFilter && u.firmaId !== firmaFilter) return false;
      if (statusFilter && u.durum !== statusFilter) return false;
      if (baslangic && u.tarih && u.tarih < baslangic) return false;
      if (bitis && u.tarih && u.tarih > bitis) return false;
      return true;
    });
  }, [aktif, firmaFilter, statusFilter, baslangic, bitis]);

  const selectAll = () => setSelected(new Set(filtered.map(u => u.id)));
  const clearAll = () => setSelected(new Set());

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedRecords = useMemo(() => {
    return filtered.filter(u => selected.has(u.id));
  }, [filtered, selected]);

  const handleGenerate = async () => {
    if (selectedRecords.length === 0) return;
    setGenerating(true);
    try {
      await printDofRaporu(selectedRecords, firmalar, personeller, getUygunsuzlukPhoto);
    } finally {
      setTimeout(() => setGenerating(false), 1500);
    }
  };

  const handleExcelExport = async () => {
    if (selectedRecords.length === 0) return;
    setExporting(true);
    try {
      await exportDofToExcel(selectedRecords, firmalar, personeller, getUygunsuzlukPhoto);
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  };

  const allSelected = filtered.length > 0 && filtered.every(u => selected.has(u.id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="DÖF Raporu Oluştur" size="lg" icon="ri-file-chart-line"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary whitespace-nowrap">Kapat</button>
          <div className="flex items-center gap-2">
            {selectedRecords.length > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>
                {selectedRecords.length} kayıt seçildi
              </span>
            )}
            <button
              onClick={handleExcelExport}
              disabled={selectedRecords.length === 0 || exporting}
              className="whitespace-nowrap px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer disabled:opacity-50"
              style={{ background: '#16A34A', color: '#fff' }}
            >
              <i className="ri-file-excel-2-line mr-1.5" />
              {exporting ? 'İndiriliyor...' : 'Excel İndir'}
            </button>
            <button
              onClick={handleGenerate}
              disabled={selectedRecords.length === 0 || generating}
              className="whitespace-nowrap px-5 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer disabled:opacity-50"
              style={{ background: '#EF4444', color: '#fff' }}
            >
              <i className="ri-download-line mr-1.5" />
              {generating ? 'Oluşturuluyor...' : 'PDF Oluştur ve İndir'}
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="form-label text-xs">Başlangıç Tarihi</label>
            <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)} className="isg-input" />
          </div>
          <div>
            <label className="form-label text-xs">Bitiş Tarihi</label>
            <input type="date" value={bitis} onChange={e => setBitis(e.target.value)} className="isg-input" />
          </div>
          <div>
            <label className="form-label text-xs">Firma</label>
            <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input">
              <option value="">Tüm Firmalar</option>
              {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Durum</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="isg-input">
              <option value="">Tüm Durumlar</option>
              <option value="Açık">Açık</option>
              <option value="Kapandı">Kapandı</option>
            </select>
          </div>
        </div>

        {/* Select all toolbar */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--bg-item)', border: '1px solid var(--border-main)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {filtered.length} kayıt bulundu
          </span>
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-xs px-2.5 py-1 rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>
              Tümünü Seç
            </button>
            {selected.size > 0 && (
              <button onClick={clearAll} className="text-xs px-2.5 py-1 rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                Seçimi Temizle
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)', maxHeight: '360px', overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <i className="ri-file-list-line text-3xl block mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Filtre kriterlerine uygun kayıt bulunamadı</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--table-head-bg)', borderBottom: '1px solid var(--table-border)' }}>
                  <th className="px-3 py-2 w-10">
                    <input type="checkbox" checked={allSelected} onChange={allSelected ? clearAll : selectAll} className="cursor-pointer" />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>DÖF No / Başlık</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Firma</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Tarih</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const firma = firmalar.find(f => f.id === u.firmaId);
                  const sc = STATUS_CONFIG[u.durum];
                  const sev = SEV_CONFIG[u.severity];
                  const isChecked = selected.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      onClick={() => toggleOne(u.id)}
                      className="cursor-pointer transition-all"
                      style={{
                        borderBottom: '1px solid var(--table-row-border)',
                        background: isChecked ? 'rgba(99,102,241,0.08)' : 'transparent',
                      }}
                    >
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={isChecked} onChange={() => toggleOne(u.id)} className="cursor-pointer" onClick={e => e.stopPropagation()} />
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-mono text-xs font-bold mb-0.5" style={{ color: '#6366F1' }}>{u.acilisNo ?? '—'}</p>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{u.baslik}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded inline-block mt-0.5" style={{ background: sev.bg, color: sev.color }}>{u.severity}</span>
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{firma?.ad ?? '—'}</span>
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <span className="text-xs" style={{ color: '#64748B' }}>{u.tarih ? new Date(u.tarih).toLocaleDateString('tr-TR') : '—'}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: sc.bg, color: sc.color }}>
                          <i className={sc.icon + ' text-xs'} />{u.durum}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {selectedRecords.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <i className="ri-information-line text-sm" style={{ color: '#818CF8' }} />
            <span className="text-xs" style={{ color: '#94A3B8' }}>
              <strong style={{ color: '#818CF8' }}>{selectedRecords.length}</strong> kayıt rapora eklenecek.
              Açılış/kapatma fotoğrafları varsa PDF&apos;e dahil edilir.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
