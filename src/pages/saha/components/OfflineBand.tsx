import type { OfflineQueueItem } from '@/hooks/useOfflineQueue';
import Modal from '@/components/base/Modal';

interface OfflineBandProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  syncError: string | null;
  onSyncNow: () => void;
  onShowDetails: () => void;
}

export function OfflineBand({ isOnline, isSyncing, pendingCount, lastSyncAt, syncError, onSyncNow, onShowDetails }: OfflineBandProps) {
  const fmtTime = (d: Date) => d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  if (isOnline && pendingCount === 0 && !syncError) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#34D399', boxShadow: '0 0 6px rgba(52,211,153,0.6)' }} />
        <span className="text-xs font-medium flex-1" style={{ color: '#34D399' }}>Çevrimiçi</span>
        {lastSyncAt && <span className="text-[10px]" style={{ color: '#334155' }}>Son sync: {fmtTime(lastSyncAt)}</span>}
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }} onClick={onShowDetails}>
        <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(251,191,36,0.15)' }}>
          <i className="ri-wifi-off-line text-sm" style={{ color: '#FBBF24' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: '#FCD34D' }}>Çevrimdışı Mod</p>
          <p className="text-xs" style={{ color: '#92400E' }}>
            {pendingCount > 0 ? `${pendingCount} işlem bekliyor — bağlantı gelince otomatik gönderilir` : 'İşlemler kaydedilir, bağlantı gelince gönderilir'}
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: 'rgba(251,191,36,0.2)', color: '#FBBF24' }}>{pendingCount}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: syncError ? 'rgba(239,68,68,0.06)' : 'rgba(99,102,241,0.06)', border: `1px solid ${syncError ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)'}` }}>
      <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: syncError ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)' }}>
        {isSyncing ? <i className="ri-loader-4-line text-sm animate-spin" style={{ color: '#818CF8' }} /> : syncError ? <i className="ri-error-warning-line text-sm" style={{ color: '#EF4444' }} /> : <i className="ri-upload-cloud-2-line text-sm" style={{ color: '#818CF8' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: syncError ? '#F87171' : '#A5B4FC' }}>
          {isSyncing ? 'Senkronize ediliyor...' : syncError ? 'Sync hatası' : `${pendingCount} işlem bekliyor`}
        </p>
        <p className="text-xs truncate" style={{ color: '#475569' }}>{syncError ?? 'Çevrimdışıyken kaydedilen işlemler gönderiliyor'}</p>
      </div>
      {!isSyncing && (
        <button onClick={onSyncNow} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap flex-shrink-0" style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
          Şimdi Gönder
        </button>
      )}
      {pendingCount > 0 && (
        <button onClick={onShowDetails} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)', color: '#64748B' }}>
          <i className="ri-list-check text-xs" />
        </button>
      )}
    </div>
  );
}

interface PendingModalProps {
  open: boolean;
  onClose: () => void;
  items: OfflineQueueItem[];
  isOnline: boolean;
  isSyncing: boolean;
  onSyncNow: () => void;
  onClear: () => void;
}

export function PendingModal({ open, onClose, items, isOnline, isSyncing, onSyncNow, onClear }: PendingModalProps) {
  const fmtTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins} dk önce`;
    return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };
  const typeLabel = (type: string) => type === 'ekipman_kontrol' ? 'Kontrol Kaydı' : type === 'ekipman_durum' ? 'Durum Değişikliği' : type;

  return (
    <Modal isOpen={open} onClose={onClose} title="Bekleyen İşlemler" size="md" icon="ri-time-line">
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: isOnline ? 'rgba(52,211,153,0.06)' : 'rgba(251,191,36,0.06)', border: `1px solid ${isOnline ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'}` }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isOnline ? '#34D399' : '#FBBF24' }} />
          <p className="text-sm font-semibold flex-1" style={{ color: isOnline ? '#34D399' : '#FCD34D' }}>
            {isOnline ? 'Çevrimiçi — işlemler gönderilebilir' : 'Çevrimdışı — bağlantı bekleniyor'}
          </p>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>{items.length} işlem</span>
        </div>
        {items.length === 0 ? (
          <div className="text-center py-8">
            <i className="ri-checkbox-circle-line text-3xl" style={{ color: '#34D399' }} />
            <p className="text-sm mt-2 font-medium" style={{ color: '#34D399' }}>Tüm işlemler gönderildi!</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '320px' }}>
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(251,191,36,0.1)' }}>
                  <i className="ri-time-line text-sm" style={{ color: '#FBBF24' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>{typeLabel(item.type)}</span>
                    {item.retryCount > 0 && <span className="text-[10px]" style={{ color: '#EF4444' }}>{item.retryCount} deneme</span>}
                  </div>
                </div>
                <span className="text-[10px] flex-shrink-0" style={{ color: '#334155' }}>{fmtTime(item.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          {items.length > 0 && (
            <button onClick={onClear} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444' }}>
              <i className="ri-delete-bin-line text-xs" />Kuyruğu Temizle
            </button>
          )}
          <div className="flex-1" />
          {isOnline && items.length > 0 && (
            <button onClick={() => { onSyncNow(); onClose(); }} disabled={isSyncing} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', opacity: isSyncing ? 0.7 : 1 }}>
              {isSyncing ? <><i className="ri-loader-4-line animate-spin text-xs" />Gönderiliyor...</> : <><i className="ri-upload-cloud-2-line text-xs" />Şimdi Gönder</>}
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}>Kapat</button>
        </div>
      </div>
    </Modal>
  );
}
