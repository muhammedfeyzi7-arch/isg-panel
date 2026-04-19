import { useRef } from 'react';
import Drawer from '@/components/base/Drawer';
import Button from '@/components/base/Button';
import type { EquipmentRow } from '@/services/specialistService';

interface Props {
  open: boolean;
  onClose: () => void;
  equipment: EquipmentRow | null;
  onEdit: () => void;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function QRCodeDisplay({ token }: { token: string }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(token)}`;
  return (
    <div className="flex flex-col items-center gap-2">
      <img src={qrUrl} alt="QR Kod" className="w-40 h-40 rounded-lg" style={{ border: '1px solid var(--border)' }} />
      <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{token}</p>
    </div>
  );
}

export default function EquipmentDetailDrawer({ open, onClose, equipment: eq, onEdit }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!eq) return null;

  const isOk = eq.status === 'Uygun';

  const handlePrintQR = () => {
    if (!eq.qr_token) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(eq.qr_token)}`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>QR - ${eq.name}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px}img{width:300px;height:300px}h2{margin-bottom:8px}p{color:#666;font-size:14px}</style>
      </head><body>
      <h2>${eq.name}</h2>
      <p>${eq.equipment_type ?? ''} ${eq.serial_no ? '| SN: ' + eq.serial_no : ''}</p>
      <img src="${qrUrl}" />
      <p style="margin-top:12px;font-size:12px;color:#999">${eq.qr_token}</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Ekipman Detayı"
      width="w-[520px]"
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>Kapat</Button>
          <Button variant="primary" className="flex-1" icon="ri-edit-line" onClick={onEdit}>Düzenle</Button>
        </>
      }
    >
      <div className="p-6 space-y-6" ref={printRef}>
        {/* Başlık */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: '#EEF2FF' }}>
            <i className="ri-tools-line text-2xl" style={{ color: '#6366F1' }} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{eq.name}</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{eq.category} {eq.equipment_type ? `· ${eq.equipment_type}` : ''}</p>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold mt-2"
              style={{ backgroundColor: isOk ? '#16A34A' : '#DC2626', color: '#fff' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
              {eq.status}
            </span>
          </div>
        </div>

        {/* Bilgiler */}
        <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          {[
            { label: 'Firma', value: eq.firm?.name ?? '—', icon: 'ri-building-line' },
            { label: 'Bulunduğu Alan', value: eq.area ?? '—', icon: 'ri-map-pin-line' },
            { label: 'Seri Numarası', value: eq.serial_no ?? '—', icon: 'ri-barcode-line', mono: true },
            { label: 'Marka', value: eq.brand ?? '—', icon: 'ri-price-tag-3-line' },
            { label: 'Son Kontrol', value: formatDate(eq.last_control_date), icon: 'ri-calendar-check-line' },
            { label: 'Sonraki Kontrol', value: formatDate(eq.next_control_date), icon: 'ri-calendar-event-line' },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--card)' }}>
                <i className={`${row.icon} text-xs`} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                <span className={`text-sm font-medium ${row.mono ? 'font-mono' : ''}`} style={{ color: 'var(--text-primary)' }}>{row.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Belge */}
        {eq.has_document && (
          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Belge</p>
            {eq.document_url ? (
              <a
                href={eq.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                style={{ backgroundColor: '#DCFCE7', border: '1px solid #86EFAC' }}
              >
                <i className="ri-file-text-line text-xl" style={{ color: '#16A34A' }} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: '#15803D' }}>Belgeyi Görüntüle</p>
                  <p className="text-xs" style={{ color: '#16A34A' }}>Tıklayarak aç</p>
                </div>
                <i className="ri-external-link-line" style={{ color: '#16A34A' }} />
              </a>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <i className="ri-file-warning-line text-xl" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Belge yüklenmemiş</p>
              </div>
            )}
          </div>
        )}

        {/* Notlar */}
        {eq.notes && (
          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Notlar</p>
            <p className="text-sm p-3 rounded-lg" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              {eq.notes}
            </p>
          </div>
        )}

        {/* QR Kod */}
        {eq.qr_token && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>QR Kod</p>
              <button
                onClick={handlePrintQR}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                <i className="ri-printer-line" /> Yazdır
              </button>
            </div>
            <div className="flex justify-center p-4 rounded-xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <QRCodeDisplay token={eq.qr_token} />
            </div>
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Bu QR kodu okutunca ekipman bilgileri görüntülenir
            </p>
          </div>
        )}
      </div>
    </Drawer>
  );
}
