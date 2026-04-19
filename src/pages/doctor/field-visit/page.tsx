import { useState, useCallback } from 'react';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import PageHeader from '@/components/base/PageHeader';
import Button from '@/components/base/Button';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import Drawer from '@/components/base/Drawer';
import { startVisitViaQr, endVisitViaQr } from '@/services/visitService';

// ─── QR Mode ─────────────────────────────────────────────────────────────────
type QrMode = 'start' | 'end';

interface QrDrawerState {
  open: boolean;
  mode: QrMode;
  targetVisitId?: string;
  targetCheckIn?: string;
}

// ─── Geolocation helper ───────────────────────────────────────────────────────
async function getUserLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 6000 }
    );
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DoctorFieldVisitPage() {
  const { session } = useAuth();
  const { visits, showToast, refresh, organizationId, userId, userRole } = useApp();

  const [qrDrawer, setQrDrawer] = useState<QrDrawerState>({ open: false, mode: 'start' });
  const [qrInput, setQrInput] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');

  const myVisits = visits.filter((v) => v.personnelId === session?.userId);
  const activeVisits = myVisits.filter((v) => v.status === 'active');
  const recentCompleted = myVisits.filter((v) => v.status === 'completed').slice(0, 10);

  // ── Open drawers ────────────────────────────────────────────────────────────
  const openStartDrawer = useCallback(() => {
    setQrDrawer({ open: true, mode: 'start' });
    setQrInput('');
    setQrError('');
  }, []);

  const openEndDrawer = useCallback((visitId: string, checkIn: string) => {
    setQrDrawer({ open: true, mode: 'end', targetVisitId: visitId, targetCheckIn: checkIn });
    setQrInput('');
    setQrError('');
  }, []);

  const closeDrawer = useCallback(() => {
    setQrDrawer((prev) => ({ ...prev, open: false }));
    setQrInput('');
    setQrError('');
  }, []);

  // ── Refresh helper ──────────────────────────────────────────────────────────
  const doRefresh = useCallback(() => {
    if (organizationId) refresh(organizationId, userId ?? undefined, userRole ?? undefined);
  }, [organizationId, userId, userRole, refresh]);

  // ── QR Submit ───────────────────────────────────────────────────────────────
  const handleQrSubmit = async () => {
    if (!qrInput.trim() || !session) return;
    setQrLoading(true);
    setQrError('');

    const loc = await getUserLocation();

    if (qrDrawer.mode === 'start') {
      const result = await startVisitViaQr({
        qrToken: qrInput.trim(),
        personnelId: session.userId,
        organizationId: session.organizationId,
        userLat: loc?.lat,
        userLng: loc?.lng,
      });

      setQrLoading(false);
      if (result.success) {
        showToast('Saha ziyareti başlatıldı');
        closeDrawer();
        doRefresh();
      } else {
        setQrError(result.error ?? 'Ziyaret başlatılamadı');
      }
    } else {
      // mode === 'end'
      if (!qrDrawer.targetVisitId) {
        setQrLoading(false);
        setQrError('Ziyaret bilgisi bulunamadı.');
        return;
      }

      const result = await endVisitViaQr({
        qrToken: qrInput.trim(),
        visitId: qrDrawer.targetVisitId,
        personnelId: session.userId,
        organizationId: session.organizationId,
        userLat: loc?.lat,
        userLng: loc?.lng,
      });

      setQrLoading(false);
      if (result.success) {
        showToast('Ziyaret başarıyla tamamlandı');
        closeDrawer();
        doRefresh();
      } else {
        setQrError(result.error ?? 'Ziyaret bitirilemedi');
      }
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Saha Ziyareti"
        description="Aktif saha ziyaretleri ve QR ile ziyaret yönetimi"
        action={
          activeVisits.length === 0 ? (
            <Button variant="primary" icon="ri-qr-code-line" onClick={openStartDrawer}>
              QR ile Ziyaret Başlat
            </Button>
          ) : undefined
        }
      />

      {/* ── Active Visits ─────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          Aktif Ziyaretler
        </h3>

        {activeVisits.length === 0 ? (
          <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <EmptyState
              icon="ri-stethoscope-line"
              title="Aktif ziyaret yok"
              description="Firmadaki QR kodu okutarak saha ziyareti başlatın."
              actionLabel="QR ile Başlat"
              onAction={openStartDrawer}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeVisits.map((v) => (
              <ActiveVisitCard
                key={v.id}
                visit={v}
                onEndViaQr={() => openEndDrawer(v.id, v.startTime)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Completed ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          Son Tamamlanan Ziyaretler
        </h3>

        {recentCompleted.length === 0 ? (
          <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <EmptyState
              icon="ri-checkbox-circle-line"
              title="Henüz tamamlanan ziyaret yok"
              description="Tamamlanan ziyaretler burada listelenecek."
            />
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <table className="w-full">
              <thead className="table-head">
                <tr>
                  {['Firma', 'Tarih', 'Giriş', 'Çıkış', 'Süre', 'Başlatma', 'Bitiş'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentCompleted.map((v) => (
                  <tr key={v.id} className="table-row">
                    <td className="table-cell-primary">{v.firm}</td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{v.date}</td>
                    <td className="table-cell">{v.startTime}</td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{v.endTime || '—'}</td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{v.duration}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={v.startedViaQr ? 'QR' : 'Manuel'} />
                        {v.locationVerified && <StatusBadge status="GPRS" />}
                      </div>
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={v.endedViaQr ? 'QR' : 'Manuel'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── QR Drawer ─────────────────────────────────────────────────────── */}
      <Drawer
        open={qrDrawer.open}
        onClose={closeDrawer}
        title={qrDrawer.mode === 'start' ? 'QR ile Ziyaret Başlat' : 'QR ile Ziyareti Bitir'}
        width="w-[440px]"
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={closeDrawer}>
              İptal
            </Button>
            <Button
              variant={qrDrawer.mode === 'end' ? 'danger' : 'primary'}
              className="flex-1"
              onClick={handleQrSubmit}
              disabled={qrLoading || !qrInput.trim()}
            >
              {qrLoading
                ? 'Doğrulanıyor...'
                : qrDrawer.mode === 'start'
                ? 'Ziyareti Başlat'
                : 'Ziyareti Bitir'}
            </Button>
          </>
        }
      >
        <QrDrawerContent
          mode={qrDrawer.mode}
          qrInput={qrInput}
          qrError={qrError}
          onQrChange={(val) => { setQrInput(val); setQrError(''); }}
        />
      </Drawer>
    </div>
  );
}

// ─── Active Visit Card ────────────────────────────────────────────────────────
interface ActiveVisitCardProps {
  visit: {
    id: string;
    firm: string;
    startTime: string;
    date: string;
    verificationType: string | null;
    locationVerified: boolean;
  };
  onEndViaQr: () => void;
}

function ActiveVisitCard({ visit, onEndViaQr }: ActiveVisitCardProps) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: 'var(--green-bg, #f0fdf4)', border: '1px solid rgba(34,197,94,0.25)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center rounded-xl"
            style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}
          >
            <i className="ri-stethoscope-line text-lg" style={{ color: '#16a34a' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#15803d' }}>{visit.firm}</p>
            <p className="text-xs" style={{ color: '#16a34a', opacity: 0.8 }}>
              Giriş: {visit.startTime} · {visit.date}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium animate-pulse"
            style={{ backgroundColor: 'rgba(34,197,94,0.2)', color: '#16a34a' }}
          >
            Aktif
          </span>
          {visit.verificationType === 'qr_gprs' && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#a16207' }}
            >
              GPRS
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          icon="ri-qr-code-line"
          className="flex-1"
          onClick={onEndViaQr}
        >
          QR ile Ziyareti Bitir
        </Button>
      </div>

      <p className="text-xs mt-2" style={{ color: '#16a34a', opacity: 0.7 }}>
        Firmadaki QR kodu okutarak ziyareti güvenli şekilde tamamlayın
      </p>
    </div>
  );
}

// ─── QR Drawer Content ────────────────────────────────────────────────────────
interface QrDrawerContentProps {
  mode: QrMode;
  qrInput: string;
  qrError: string;
  onQrChange: (val: string) => void;
}

function QrDrawerContent({ mode, qrInput, qrError, onQrChange }: QrDrawerContentProps) {
  const isEnd = mode === 'end';

  return (
    <div className="p-6 space-y-4">
      {/* Icon area */}
      <div
        className="p-5 rounded-xl text-center"
        style={{
          backgroundColor: isEnd ? 'rgba(239,68,68,0.05)' : 'var(--surface)',
          border: `1px solid ${isEnd ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
        }}
      >
        <i
          className={`${isEnd ? 'ri-qr-scan-2-line' : 'ri-qr-code-line'} text-4xl mb-2`}
          style={{ color: isEnd ? 'var(--danger)' : 'var(--text-muted)' }}
        />
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {isEnd ? 'Ziyareti Bitirmek İçin QR Okutun' : 'Firma QR Kodunu Okutun'}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {isEnd
            ? 'Aktif ziyaretin firmasındaki QR kodu okutmanız gerekiyor'
            : 'QR token\'ı manuel girin veya tarayıcı ile okutun'}
        </p>
      </div>

      {/* Input */}
      <div>
        <label className="form-label">QR Token</label>
        <input
          className="input font-mono text-sm"
          placeholder="QR token buraya yapıştırın..."
          value={qrInput}
          onChange={(e) => onQrChange(e.target.value)}
          autoFocus
        />
      </div>

      {/* Error */}
      {qrError && (
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <div className="flex items-start gap-2">
            <i className="ri-error-warning-line text-sm mt-0.5" style={{ color: 'var(--danger)' }} />
            <p className="text-xs" style={{ color: 'var(--danger-text)' }}>{qrError}</p>
          </div>
        </div>
      )}

      {/* Info box */}
      <div
        className="p-3 rounded-lg space-y-1"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
      >
        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          {isEnd ? 'Bitirme kuralları' : 'Nasıl çalışır?'}
        </p>
        {isEnd ? (
          <ul className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
            <li>• Aktif ziyaretin firmasındaki QR kodu okutun</li>
            <li>• Yanlış firma QR kodu kabul edilmez</li>
            <li>• QR+GPRS firmalar için konum kontrolü yapılır (1 km)</li>
            <li>• Başarılı okutmada ziyaret otomatik tamamlanır</li>
          </ul>
        ) : (
          <ul className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
            <li>• Firmadaki QR kodu okutun</li>
            <li>• Sistem firmayı ve atamanızı doğrular</li>
            <li>• QR+GPRS firmalar için konum kontrolü yapılır (1 km)</li>
            <li>• Doğrulama başarılıysa ziyaret otomatik başlar</li>
          </ul>
        )}
      </div>
    </div>
  );
}
