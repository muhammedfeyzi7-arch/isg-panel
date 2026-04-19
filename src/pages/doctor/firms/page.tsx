import { useState, useEffect } from 'react';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/base/PageHeader';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import Drawer from '@/components/base/Drawer';
import type { AppFirm, VerificationType } from '@/types/database';
import { getAssignedFirms } from '@/services/firmService';

const verificationLabels: Record<VerificationType, { label: string; icon: string }> = {
  qr: { label: 'Sadece QR', icon: 'ri-qr-code-line' },
  qr_gprs: { label: 'QR + GPRS', icon: 'ri-map-pin-line' },
};

export default function DoctorFirmsPage() {
  const { session } = useAuth();
  const [firms, setFirms] = useState<AppFirm[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFirm, setSelectedFirm] = useState<AppFirm | null>(null);

  useEffect(() => {
    if (!session?.userId) return;
    setLoading(true);
    getAssignedFirms(session.userId)
      .then(setFirms)
      .catch(() => setFirms([]))
      .finally(() => setLoading(false));
  }, [session?.userId]);

  const filtered = firms.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.address.toLowerCase().includes(search.toLowerCase())
  );

  const mapUrl = selectedFirm?.latitude && selectedFirm?.longitude
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${selectedFirm.longitude - 0.01},${selectedFirm.latitude - 0.01},${selectedFirm.longitude + 0.01},${selectedFirm.latitude + 0.01}&layer=mapnik&marker=${selectedFirm.latitude},${selectedFirm.longitude}`
    : null;

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Firmalar" description="Size atanmış firmaların listesi" />

      <div className="filter-bar mb-5">
        <div className="relative flex-1 max-w-sm">
          <div className="w-4 h-4 flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <i className="ri-search-line text-sm" />
          </div>
          <input className="input pl-9" placeholder="Firma ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{filtered.length} firma</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <i className="ri-loader-4-line animate-spin text-2xl" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState
            icon="ri-building-2-line"
            title={search ? 'Firma bulunamadı' : 'Firma atanmamış'}
            description={search ? 'Arama kriterlerinize uygun firma yok.' : 'Yöneticiniz size firma atadığında burada görünecek.'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f) => {
            const vInfo = verificationLabels[f.verificationType] ?? verificationLabels.qr;
            return (
              <button key={f.id} onClick={() => setSelectedFirm(f)}
                className="text-left rounded-xl p-5 transition-colors cursor-pointer"
                style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--text-secondary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <i className="ri-building-2-line text-base" style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{f.name}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{f.sector}</p>
                  </div>
                </div>
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2">
                    <i className="ri-map-pin-line text-xs" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{f.address}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="ri-team-line text-xs" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{f.employeeCount} çalışan</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={f.dangerClass} />
                  <StatusBadge status={f.status} />
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <i className={`${vInfo.icon} text-xs`} />{vInfo.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Firm Detail Drawer */}
      <Drawer open={!!selectedFirm} onClose={() => setSelectedFirm(null)} title="Firma Detayı" width="w-[500px]">
        {selectedFirm && (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <i className="ri-building-2-line text-xl" style={{ color: 'var(--text-muted)' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedFirm.name}</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{selectedFirm.sector}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <StatusBadge status={selectedFirm.status} />
                  <StatusBadge status={selectedFirm.dangerClass} />
                </div>
              </div>
            </div>

            <div>
              <p className="drawer-section-title">İletişim</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Yetkili', value: selectedFirm.contact, icon: 'ri-user-line' },
                  { label: 'Telefon', value: selectedFirm.phone, icon: 'ri-phone-line' },
                  { label: 'E-posta', value: selectedFirm.email, icon: 'ri-mail-line' },
                  { label: 'Çalışan', value: `${selectedFirm.employeeCount} kişi`, icon: 'ri-team-line' },
                ].map((item) => (
                  <div key={item.label} className="drawer-info-grid">
                    <div className="flex items-center gap-1.5 mb-1">
                      <i className={`${item.icon} text-xs`} style={{ color: 'var(--text-muted)' }} />
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                    </div>
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="drawer-section-title">Sözleşme</p>
              <div className="rounded-lg p-4 space-y-2.5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                {[
                  { label: 'Durum', value: selectedFirm.contractStatus, isBadge: true },
                  { label: 'Başlangıç', value: selectedFirm.contractStart },
                  { label: 'Bitiş', value: selectedFirm.contractEnd },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    {item.isBadge ? <StatusBadge status={item.value} /> : <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="drawer-section-title">Doğrulama Tipi</p>
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                  <i className={`${verificationLabels[selectedFirm.verificationType]?.icon} text-sm`} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{verificationLabels[selectedFirm.verificationType]?.label}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="drawer-section-title">Konum</p>
              <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selectedFirm.address}</p>
                {selectedFirm.latitude && selectedFirm.longitude && (
                  <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
                    {selectedFirm.latitude.toFixed(5)}, {selectedFirm.longitude.toFixed(5)}
                  </p>
                )}
              </div>
              {mapUrl ? (
                <div className="rounded-lg overflow-hidden" style={{ height: '160px', border: '1px solid var(--border)' }}>
                  <iframe src={mapUrl} width="100%" height="100%" style={{ border: 0 }} loading="lazy" title="Firma Konumu" />
                </div>
              ) : (
                <div className="h-20 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Konum tanımlı değil</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
