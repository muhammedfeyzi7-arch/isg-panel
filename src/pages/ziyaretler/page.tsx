import { useState, useMemo, useEffect } from 'react';
import PageHeader from '@/components/base/PageHeader';
import SummaryCard from '@/components/base/SummaryCard';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import Button from '@/components/base/Button';
import Drawer from '@/components/base/Drawer';
import type { AppVisit } from '@/types/database';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { getVisits } from '@/services/visitService';

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  padding: '8px 12px',
  borderRadius: '8px',
  fontSize: '14px',
  outline: 'none',
  cursor: 'pointer',
};

const todayStr = new Date().toISOString().split('T')[0];

function calcDuration(startTime: string, endTime: string): string {
  if (!endTime) return '—';
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return '—';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

function calcDistance(visit: AppVisit): string {
  if (!visit.locationVerified) return '—';
  return '<1 km';
}

export default function ZiyaretlerPage() {
  const { visits, deleteVisit, endVisit, showToast, organizationId } = useApp();
  const { session } = useAuth();
  const [search, setSearch] = useState('');
  const [personnelFilter, setPersonnelFilter] = useState('');
  const [firmFilter, setFirmFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedVisit, setSelectedVisit] = useState<AppVisit | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [endTimeInput, setEndTimeInput] = useState('');
  const [endingVisit, setEndingVisit] = useState(false);
  const [liveVisits, setLiveVisits] = useState<AppVisit[]>(visits);
  const [refreshing, setRefreshing] = useState(false);

  // Canlı veri çek — QR ile oluşturulan ziyaretler otomatik görünsün
  const loadVisits = async () => {
    if (!organizationId) return;
    setRefreshing(true);
    try {
      const data = await getVisits(organizationId);
      setLiveVisits(data);
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (organizationId) loadVisits();
  }, [organizationId]);

  // Context'ten gelen visits değişince de güncelle
  useEffect(() => {
    setLiveVisits(visits);
  }, [visits]);

  // 30 saniyede bir otomatik yenile (QR ile gelen ziyaretler için)
  useEffect(() => {
    if (!organizationId) return;
    const interval = setInterval(loadVisits, 30000);
    return () => clearInterval(interval);
  }, [organizationId]);

  const filtered = useMemo(() => {
    return liveVisits.filter((v) => {
      const q = search.toLowerCase();
      const matchSearch = !search || v.personnel.toLowerCase().includes(q) || v.firm.toLowerCase().includes(q);
      const matchPersonnel = !personnelFilter || v.personnel === personnelFilter;
      const matchFirm = !firmFilter || v.firm === firmFilter;
      const matchStatus = !statusFilter || v.status === statusFilter;
      const matchFrom = !dateFrom || v.date >= dateFrom;
      const matchTo = !dateTo || v.date <= dateTo;
      return matchSearch && matchPersonnel && matchFirm && matchStatus && matchFrom && matchTo;
    });
  }, [liveVisits, search, personnelFilter, firmFilter, statusFilter, dateFrom, dateTo]);

  const todayCount = liveVisits.filter((v) => v.date === todayStr).length;
  const activeCount = liveVisits.filter((v) => v.status === 'active').length;
  const completedCount = liveVisits.filter((v) => v.status === 'completed').length;
  const qrCount = liveVisits.filter((v) => v.startedViaQr).length;

  const uniquePersonnel = [...new Set(liveVisits.map((v) => v.personnel))];
  const uniqueFirms = [...new Set(liveVisits.map((v) => v.firm))];

  const currentSelectedVisit = selectedVisit ? liveVisits.find((v) => v.id === selectedVisit.id) || null : null;

  const handleEndVisit = async () => {
    if (!currentSelectedVisit || !endTimeInput) return;
    try {
      await endVisit(currentSelectedVisit.id, currentSelectedVisit.startTime, endTimeInput);
      showToast('Ziyaret tamamlandı');
      setEndingVisit(false);
      setEndTimeInput('');
      setSelectedVisit(null);
      await loadVisits();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
    }
  };

  const handleDeleteVisit = async () => {
    if (!currentSelectedVisit) return;
    try {
      await deleteVisit(currentSelectedVisit.id);
      showToast('Ziyaret kaydı silindi', 'error');
      setConfirmDelete(false);
      setSelectedVisit(null);
      await loadVisits();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Silme başarısız', 'error');
    }
  };

  const statusLabel = (s: string) => s; // StatusBadge artık 'active' ve 'completed' lowercase değerlerini destekliyor

  const gpsLabel = (v: AppVisit) => {
    if (v.verificationType === 'qr_gprs') return v.locationVerified ? 'Doğrulandı' : 'Doğrulanamadı';
    return 'QR';
  };

  const gpsColor = (v: AppVisit) => {
    if (v.verificationType === 'qr_gprs') return v.locationVerified ? 'var(--success)' : 'var(--danger)';
    return 'var(--text-muted)';
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Ziyaretler"
        description="QR kodu okutularak başlatılan saha ziyaret kayıtları — otomatik güncellenir"
        action={
          <button
            onClick={loadVisits}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer whitespace-nowrap transition-colors"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--card)' }}
          >
            <i className={`ri-refresh-line text-sm ${refreshing ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        <SummaryCard label="Bugün" value={todayCount} icon="ri-calendar-check-line" iconColor="var(--info)" />
        <SummaryCard label="Aktif Ziyaret" value={activeCount} icon="ri-map-pin-time-line" iconColor="var(--success)" />
        <SummaryCard label="Tamamlanan" value={completedCount} icon="ri-checkbox-circle-line" iconColor="var(--purple)" />
        <SummaryCard label="QR ile Başlanan" value={qrCount} icon="ri-qr-code-line" iconColor="var(--warning)" />
      </div>

      {liveVisits.length > 0 && (
        <div className="filter-bar flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <div className="w-4 h-4 flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              <i className="ri-search-line text-sm" />
            </div>
            <input type="text" placeholder="Personel veya firma ara..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg outline-none transition-colors"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <input type="date" style={selectStyle} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Başlangıç" />
          <input type="date" style={selectStyle} value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Bitiş" />
          <select style={selectStyle} value={personnelFilter} onChange={(e) => setPersonnelFilter(e.target.value)}>
            <option value="">Tüm Personel</option>
            {uniquePersonnel.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select style={selectStyle} value={firmFilter} onChange={(e) => setFirmFilter(e.target.value)}>
            <option value="">Tüm Firmalar</option>
            {uniqueFirms.map((f) => <option key={f}>{f}</option>)}
          </select>
          <select style={selectStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="completed">Tamamlandı</option>
          </select>
        </div>
      )}

      {/* Desktop Table */}
      <div className="table-wrap hidden md:block">
        {liveVisits.length === 0 ? (
          <EmptyState
            icon="ri-map-pin-time-line"
            title="Henüz ziyaret kaydı yok"
            description="Ziyaretler, uzman ve hekim panelinden QR kodu okutularak otomatik oluşturulur."
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon="ri-search-line" title="Sonuç bulunamadı" description="Filtre kriterlerinizi değiştirmeyi deneyin." />
        ) : (
          <table className="w-full">
            <thead className="table-head">
              <tr>
                {['Personel', 'Firma', 'Giriş', 'Çıkış', 'Süre', 'Mesafe', 'GPS', 'Durum', ''].map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((visit) => (
                <tr key={visit.id} className="table-row" onClick={() => setSelectedVisit(visit)}>
                  <td className="table-cell-primary">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <i className={`text-xs ${visit.role === 'Hekim' ? 'ri-stethoscope-line' : 'ri-shield-check-line'}`} style={{ color: visit.role === 'Hekim' ? 'var(--purple)' : 'var(--info)' }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{visit.personnel}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{visit.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell whitespace-nowrap">{visit.firm}</td>
                  <td className="table-cell">
                    <div>
                      <p className="text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{visit.startTime}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{visit.date}</p>
                    </div>
                  </td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{visit.endTime || '—'}</td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)' }}>
                    {visit.duration !== '—' ? visit.duration : calcDuration(visit.startTime, visit.endTime)}
                  </td>
                  <td className="table-cell">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {visit.verificationType === 'qr_gprs' ? (visit.locationVerified ? '<1 km' : 'Bilinmiyor') : '—'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs font-medium" style={{ color: gpsColor(visit) }}>{gpsLabel(visit)}</span>
                  </td>
                  <td className="table-cell"><StatusBadge status={statusLabel(visit.status)} /></td>
                  <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedVisit(visit); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer" style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    ><i className="ri-eye-line text-sm" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-2 mt-2">
        {liveVisits.length === 0 ? (
          <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <EmptyState icon="ri-map-pin-time-line" title="Henüz ziyaret kaydı yok" description="Ziyaretler, uzman ve hekim panelinden QR kodu okutularak otomatik oluşturulur." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <EmptyState icon="ri-search-line" title="Sonuç bulunamadı" description="Filtre kriterlerinizi değiştirmeyi deneyin." />
          </div>
        ) : (
          filtered.map((visit) => (
            <button
              key={visit.id}
              onClick={() => setSelectedVisit(visit)}
              className="w-full text-left rounded-xl p-4 transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <i className={`text-base ${visit.role === 'Hekim' ? 'ri-stethoscope-line' : 'ri-shield-check-line'}`} style={{ color: visit.role === 'Hekim' ? 'var(--purple)' : 'var(--info)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{visit.personnel}</p>
                    <StatusBadge status={statusLabel(visit.status)} />
                  </div>
                  <p className="text-xs mb-2 truncate" style={{ color: 'var(--text-muted)' }}>{visit.firm} · {visit.role}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Giriş</p>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{visit.startTime}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Çıkış</p>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{visit.endTime || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Süre</p>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                        {visit.duration !== '—' ? visit.duration : calcDuration(visit.startTime, visit.endTime)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <span className="text-xs font-medium" style={{ color: gpsColor(visit) }}>
                  <i className="ri-map-pin-line mr-1" />
                  {gpsLabel(visit)} · {visit.verificationType === 'qr_gprs' ? 'QR+GPRS' : 'QR'}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{visit.date}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Visit Detail Drawer */}
      <Drawer
        open={!!currentSelectedVisit}
        onClose={() => { setSelectedVisit(null); setConfirmDelete(false); setEndingVisit(false); setEndTimeInput(''); }}
        title="Ziyaret Detayı"
        footer={currentSelectedVisit ? (
          <>
            <button onClick={() => setConfirmDelete(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer flex-shrink-0"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            ><i className="ri-delete-bin-line text-sm" /></button>
            {currentSelectedVisit.status === 'active' && !endingVisit && (
              <Button variant="primary" className="flex-1" onClick={() => setEndingVisit(true)}>Ziyareti Bitir</Button>
            )}
            {endingVisit && (
              <>
                <Button variant="secondary" onClick={() => { setEndingVisit(false); setEndTimeInput(''); }}>İptal</Button>
                <Button variant="primary" className="flex-1" onClick={handleEndVisit}>Kaydet</Button>
              </>
            )}
          </>
        ) : undefined}
      >
        {currentSelectedVisit && (
          <div className="p-6 space-y-5">
            {confirmDelete && (
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--danger-text)' }}>Bu ziyaret kaydını silmek istediğinize emin misiniz?</p>
                <div className="flex gap-2 mt-2">
                  <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>İptal</Button>
                  <button onClick={handleDeleteVisit} className="px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap" style={{ backgroundColor: 'var(--danger)', color: '#fff' }}>Evet, Sil</button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-full" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <i className={`text-lg ${currentSelectedVisit.role === 'Hekim' ? 'ri-stethoscope-line' : 'ri-shield-check-line'}`} style={{ color: currentSelectedVisit.role === 'Hekim' ? 'var(--purple)' : 'var(--info)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{currentSelectedVisit.personnel}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{currentSelectedVisit.role}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Firma', value: currentSelectedVisit.firm },
                { label: 'Tarih', value: currentSelectedVisit.date },
                { label: 'Giriş Saati', value: currentSelectedVisit.startTime },
                { label: 'Çıkış Saati', value: currentSelectedVisit.endTime || '—' },
                { label: 'Toplam Süre', value: currentSelectedVisit.duration !== '—' ? currentSelectedVisit.duration : calcDuration(currentSelectedVisit.startTime, currentSelectedVisit.endTime) },
                { label: 'Durum', value: statusLabel(currentSelectedVisit.status) },
              ].map((item) => (
                <div key={item.label} className="drawer-info-grid">
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  {item.label === 'Durum' ? <StatusBadge status={item.value} /> : <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</p>}
                </div>
              ))}
            </div>

            <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Doğrulama Tipi</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {currentSelectedVisit.verificationType === 'qr_gprs' ? 'QR + GPRS' : 'QR'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>GPS Durumu</span>
                <span className="text-xs font-medium" style={{ color: gpsColor(currentSelectedVisit) }}>
                  {gpsLabel(currentSelectedVisit)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Mesafe</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {currentSelectedVisit.verificationType === 'qr_gprs' ? (currentSelectedVisit.locationVerified ? '<1 km' : 'Bilinmiyor') : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>QR ile Başlatıldı</span>
                <span className="text-xs font-medium" style={{ color: currentSelectedVisit.startedViaQr ? 'var(--success)' : 'var(--text-muted)' }}>
                  {currentSelectedVisit.startedViaQr ? 'Evet' : 'Hayır'}
                </span>
              </div>
            </div>

            {currentSelectedVisit.notes && (
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Notlar</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{currentSelectedVisit.notes}</p>
              </div>
            )}

            {endingVisit && (
              <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Çıkış Saatini Girin</p>
                <input type="time" className="input" value={endTimeInput} onChange={(e) => setEndTimeInput(e.target.value)} />
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
