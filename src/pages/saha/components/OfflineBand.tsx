/**
 * OfflineBand, PendingModal, SyncHistoryPanel, QueueInspector
 *
 * v3 — Kullanıcı Güveni & Veri Bütünlüğü
 * - Sync History: son 10 sync logu görünür
 * - Force Sync butonu
 * - Queue Inspector (debug/admin)
 * - Aktif ziyaret lock uyarısı
 */

import { useState } from 'react';
import { getSyncFailLog, getSyncHistory, type OfflineQueueItem, type SyncHistoryEntry } from '@/hooks/useOfflineQueue';
import Modal from '@/components/base/Modal';

// ─── OfflineBand ──────────────────────────────────────────────────────────────
interface OfflineBandProps {
  isOnline:        boolean;
  isSyncing:       boolean;
  pendingCount:    number;
  lastSyncAt:      Date | null;
  syncError:       string | null;
  queueLimitWarn?: boolean;
  isAdmin?:        boolean;
  onSyncNow:       () => void;
  onForceSyncAll:  () => void;
  onShowDetails:   () => void;
}

export function OfflineBand({
  isOnline,
  isSyncing,
  pendingCount,
  lastSyncAt,
  syncError,
  queueLimitWarn = false,
  isAdmin = false,
  onSyncNow,
  onForceSyncAll,
  onShowDetails,
}: OfflineBandProps) {
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  // ── Normal kullanıcı için sade görünüm ──────────────────────────────────
  if (!isAdmin) {
    // Çevrimdışı — sadece bu gösterilsin
    if (!isOnline) {
      return (
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)' }}
        >
          <i className="ri-wifi-off-line text-sm flex-shrink-0" style={{ color: '#F59E0B' }} />
          <span className="text-xs font-semibold flex-1" style={{ color: '#D97706' }}>
            Çevrimdışısınız
          </span>
          {pendingCount > 0 && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#D97706', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              {pendingCount} bekliyor
            </span>
          )}
        </div>
      );
    }
    // Syncing
    if (isSyncing) {
      return (
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
          style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.18)' }}
        >
          <i className="ri-loader-4-line text-sm animate-spin flex-shrink-0" style={{ color: '#0EA5E9' }} />
          <span className="text-xs font-semibold" style={{ color: '#0284C7' }}>Senkronize ediliyor...</span>
        </div>
      );
    }
    // Bekleyen var ama online
    if (pendingCount > 0) {
      return (
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl cursor-pointer"
          style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)' }}
          onClick={onSyncNow}
        >
          <i className="ri-upload-cloud-2-line text-sm flex-shrink-0" style={{ color: '#818CF8' }} />
          <span className="text-xs font-semibold flex-1" style={{ color: '#818CF8' }}>
            {pendingCount} işlem bekliyor
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>
            Gönder
          </span>
        </div>
      );
    }
    // Hata
    if (syncError) {
      return (
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
        >
          <i className="ri-error-warning-line text-sm flex-shrink-0" style={{ color: '#EF4444' }} />
          <span className="text-xs font-semibold flex-1" style={{ color: '#F87171' }}>Bazı işlemler gönderilemedi</span>
          <button onClick={onForceSyncAll} className="text-[10px] font-bold px-2 py-0.5 rounded-lg cursor-pointer whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
            Tekrar Dene
          </button>
        </div>
      );
    }
    // Temiz
    return null;
  }

  // ── Admin görünümü (tam özellikli) ─────────────────────────────────────

  // 1. Queue limit uyarısı
  if (queueLimitWarn && isOnline) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
        style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)' }}
        onClick={onShowDetails}
      >
        <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: 'rgba(249,115,22,0.15)' }}>
          <i className="ri-alert-line text-sm" style={{ color: '#F97316' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: '#F97316' }}>Queue dolmak üzere</p>
          <p className="text-xs" style={{ color: '#7C3309' }}>
            {pendingCount} bekleyen işlem — senkronize et
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onForceSyncAll(); }}
          className="text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap flex-shrink-0"
          style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316', border: '1px solid rgba(249,115,22,0.25)' }}
        >
          Tümünü Gönder
        </button>
      </div>
    );
  }

  // 2. Çevrimdışı
  if (!isOnline) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}
        onClick={onShowDetails}
      >
        <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: 'rgba(251,191,36,0.15)' }}>
          <i className="ri-wifi-off-line text-sm" style={{ color: '#FBBF24' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: '#FCD34D' }}>Çevrimdışı Mod</p>
          <p className="text-xs" style={{ color: '#92400E' }}>
            {pendingCount > 0
              ? `${pendingCount} işlem bekliyor — bağlantı gelince otomatik gönderilir`
              : 'İşlemler kaydedilir, bağlantı gelince gönderilir'}
          </p>
        </div>
        {pendingCount > 0 && (
          <span
            className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0"
            style={{ background: 'rgba(251,191,36,0.2)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.3)' }}
          >
            {pendingCount} bekliyor
          </span>
        )}
      </div>
    );
  }

  // 3. Syncing
  if (isSyncing) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
        style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}
      >
        <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.1)' }}>
          <i className="ri-loader-4-line text-sm animate-spin" style={{ color: '#818CF8' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: '#A5B4FC' }}>Senkronize ediliyor...</p>
          <p className="text-xs" style={{ color: '#475569' }}>
            {pendingCount} işlem gönderiliyor
          </p>
        </div>
      </div>
    );
  }

  // 4. Sync hatası
  if (syncError) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
      >
        <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: 'rgba(239,68,68,0.1)' }}>
          <i className="ri-error-warning-line text-sm" style={{ color: '#EF4444' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: '#F87171' }}>Sync hatası</p>
          <p className="text-xs truncate" style={{ color: '#475569' }}>{syncError}</p>
        </div>
        <button
          onClick={onForceSyncAll}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap flex-shrink-0"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          Zorla Dene
        </button>
        {pendingCount > 0 && (
          <button
            onClick={onShowDetails}
            className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#64748B' }}
          >
            <i className="ri-list-check text-xs" />
          </button>
        )}
      </div>
    );
  }

  // 5. Bekleyen işlemler (online, hata yok)
  if (pendingCount > 0) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
        style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}
      >
        <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.1)' }}>
          <i className="ri-upload-cloud-2-line text-sm" style={{ color: '#818CF8' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: '#A5B4FC' }}>
            {pendingCount} işlem bekliyor
          </p>
          <p className="text-xs" style={{ color: '#475569' }}>Çevrimdışıyken kaydedilen işlemler</p>
        </div>
        <button
          onClick={onSyncNow}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          Gönder
        </button>
        <button
          onClick={onShowDetails}
          className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', color: '#64748B' }}
        >
          <i className="ri-list-check text-xs" />
        </button>
      </div>
    );
  }

  // 6. Temiz — çevrimiçi
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: '#34D399', boxShadow: '0 0 6px rgba(52,211,153,0.6)' }}
      />
      <span className="text-xs font-medium flex-1" style={{ color: '#34D399' }}>Çevrimiçi</span>
      {lastSyncAt && (
        <span className="text-[10px]" style={{ color: '#334155' }}>
          Son sync: {fmtTime(lastSyncAt)}
        </span>
      )}
      <button
        onClick={onForceSyncAll}
        className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap"
        style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.2)' }}
      >
        <i className="ri-refresh-line text-[10px]" />
        Sync
      </button>
    </div>
  );
}

// ─── SyncHistoryPanel ─────────────────────────────────────────────────────────
interface SyncHistoryPanelProps {
  open:    boolean;
  onClose: () => void;
}

export function SyncHistoryPanel({ open, onClose }: SyncHistoryPanelProps) {
  const history = getSyncHistory();

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const triggerLabel = (t: SyncHistoryEntry['trigger']) => {
    if (t === 'online')     return 'İnternet geldi';
    if (t === 'startup')    return 'Uygulama açıldı';
    if (t === 'visibility') return 'Sekme aktif';
    return 'Manuel';
  };

  const triggerColor = (t: SyncHistoryEntry['trigger']) => {
    if (t === 'online')     return '#34D399';
    if (t === 'startup')    return '#818CF8';
    if (t === 'visibility') return '#0EA5E9';
    return '#FBBF24';
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Senkronizasyon Geçmişi" size="md" icon="ri-history-line">
      <div className="space-y-3">
        {history.length === 0 ? (
          <div className="text-center py-10">
            <i className="ri-time-line text-3xl" style={{ color: '#334155' }} />
            <p className="text-sm mt-2" style={{ color: '#475569' }}>Henüz sync yapılmadı</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '420px' }}>
            {history.map((entry) => {
              const isSuccess = entry.failCount === 0;
              const color     = isSuccess ? '#34D399' : entry.successCount > 0 ? '#FBBF24' : '#EF4444';
              const bg        = isSuccess ? 'rgba(52,211,153,0.06)' : entry.successCount > 0 ? 'rgba(251,191,36,0.06)' : 'rgba(239,68,68,0.06)';
              const border    = isSuccess ? 'rgba(52,211,153,0.2)' : entry.successCount > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(239,68,68,0.2)';
              return (
                <div
                  key={entry.id}
                  className="px-3 py-3 rounded-xl"
                  style={{ background: bg, border: `1px solid ${border}` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <i
                        className={`${isSuccess ? 'ri-checkbox-circle-line' : entry.successCount > 0 ? 'ri-alert-line' : 'ri-close-circle-line'} text-sm`}
                        style={{ color }}
                      />
                      <span className="text-xs font-bold" style={{ color }}>
                        {isSuccess ? 'Başarılı' : entry.successCount > 0 ? 'Kısmi Başarı' : 'Hatalı'}
                      </span>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: `${triggerColor(entry.trigger)}18`, color: triggerColor(entry.trigger) }}
                      >
                        {triggerLabel(entry.trigger)}
                      </span>
                    </div>
                    <span className="text-[10px]" style={{ color: '#334155' }}>
                      {entry.durationMs}ms
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[10px]" style={{ color: '#475569' }}>Toplam</p>
                      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{entry.totalItems}</p>
                    </div>
                    <div>
                      <p className="text-[10px]" style={{ color: '#475569' }}>Başarılı</p>
                      <p className="text-sm font-bold" style={{ color: '#34D399' }}>{entry.successCount}</p>
                    </div>
                    {entry.failCount > 0 && (
                      <div>
                        <p className="text-[10px]" style={{ color: '#475569' }}>Hatalı</p>
                        <p className="text-sm font-bold" style={{ color: '#EF4444' }}>{entry.failCount}</p>
                      </div>
                    )}
                    {entry.droppedCount > 0 && (
                      <div>
                        <p className="text-[10px]" style={{ color: '#475569' }}>Silinen</p>
                        <p className="text-sm font-bold" style={{ color: '#F97316' }}>{entry.droppedCount}</p>
                      </div>
                    )}
                    <div className="flex-1" />
                    <div className="text-right">
                      <p className="text-[10px]" style={{ color: '#334155' }}>{fmtTime(entry.startedAt)}</p>
                      <p className="text-[9px] mt-0.5 font-mono" style={{ color: '#1E293B' }}>
                        {entry.sessionId.slice(0, 14)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}
          >
            Kapat
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── QueueInspector (Debug/Admin Panel) ──────────────────────────────────────
interface QueueInspectorProps {
  open:       boolean;
  onClose:    () => void;
  items:      OfflineQueueItem[];
  onRetry:    (id: string) => void;
  onClear:    () => void;
  isSyncing:  boolean;
  isOnline:   boolean;
  sessionId:  string;
  isAdmin?:   boolean;
}

export function QueueInspector({
  open,
  onClose,
  items,
  onRetry,
  onClear,
  isSyncing,
  isOnline,
  sessionId,
  isAdmin = false,
}: QueueInspectorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const failLog = getSyncFailLog();

  const fmtTs = (ts: number) =>
    new Date(ts).toLocaleString('tr-TR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

  return (
    <Modal isOpen={open} onClose={onClose} title="Queue Inspector" size="lg" icon="ri-bug-line">
      <div className="space-y-4">

        {/* Durum başlığı */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <i className="ri-database-2-line text-sm" style={{ color: '#818CF8' }} />
          <div className="flex-1">
            <p className="text-xs font-bold" style={{ color: '#A5B4FC' }}>
              IndexedDB Queue — {items.length} kayıt
            </p>
            <p className="text-[10px] mt-0.5 font-mono" style={{ color: '#334155' }}>
              session: {sessionId}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: isOnline ? '#34D399' : '#FBBF24' }}
            />
            <span className="text-[10px] font-bold" style={{ color: isOnline ? '#34D399' : '#FBBF24' }}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Item listesi */}
        {items.length === 0 ? (
          <div className="text-center py-8">
            <i className="ri-inbox-line text-3xl" style={{ color: '#334155' }} />
            <p className="text-sm mt-2" style={{ color: '#475569' }}>Queue boş</p>
          </div>
        ) : (
          <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: '320px' }}>
            {items.map(item => {
              const isExpanded = expandedId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
                >
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <div
                      className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{ background: 'rgba(129,140,248,0.1)' }}
                    >
                      <i className="ri-code-line text-xs" style={{ color: '#818CF8' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.label}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="text-[9px] font-bold px-1 py-0.5 rounded"
                          style={{ background: 'rgba(129,140,248,0.15)', color: '#818CF8' }}
                        >
                          {item.type}
                        </span>
                        {item.retryCount > 0 && (
                          <span className="text-[9px]" style={{ color: '#EF4444' }}>
                            retry: {item.retryCount}
                          </span>
                        )}
                        {item.sessionId && (
                          <span className="text-[9px] font-mono" style={{ color: '#334155' }}>
                            {item.sessionId.slice(5, 14)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[9px]" style={{ color: '#334155' }}>
                        {fmtTs(item.createdAt)}
                      </span>
                      {isOnline && !isSyncing && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRetry(item.id); }}
                          className="text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap"
                          style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.2)' }}
                        >
                          Retry
                        </button>
                      )}
                      <i
                        className={`${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-xs`}
                        style={{ color: '#334155' }}
                      />
                    </div>
                  </div>
                  {isExpanded && (
                    <div
                      className="px-3 pb-3 pt-1"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <p className="text-[9px] font-bold mb-1.5" style={{ color: '#475569' }}>PAYLOAD</p>
                      <pre
                        className="text-[9px] overflow-x-auto whitespace-pre-wrap break-all rounded-lg p-2"
                        style={{ background: 'rgba(0,0,0,0.3)', color: '#94A3B8', maxHeight: '120px' }}
                      >
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                      {item.lastError && (
                        <>
                          <p className="text-[9px] font-bold mt-2 mb-1" style={{ color: '#EF4444' }}>LAST ERROR</p>
                          <p className="text-[9px] rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.08)', color: '#F87171' }}>
                            {item.lastError}
                          </p>
                        </>
                      )}
                      <p className="text-[9px] mt-2 font-mono" style={{ color: '#1E293B' }}>
                        id: {item.id}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Fail Log özeti */}
        {failLog.length > 0 && (
          <div
            className="px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}
          >
            <p className="text-xs font-bold mb-2" style={{ color: '#F87171' }}>
              {failLog.length} Sync Hatası (Oturum)
            </p>
            <div className="space-y-1 overflow-y-auto" style={{ maxHeight: '100px' }}>
              {failLog.map((log, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[9px] font-mono w-4 flex-shrink-0" style={{ color: '#334155' }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold truncate" style={{ color: '#F87171' }}>
                      [{log.itemType}] {log.itemLabel}
                      {log.droppedAt && <span className="ml-1 font-normal text-orange-400">DROPPED</span>}
                    </p>
                    <p className="text-[9px] truncate" style={{ color: '#64748B' }}>{log.errorMsg}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aksiyon butonları */}
        <div className="flex gap-3 pt-1">
          {items.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444' }}
            >
              <i className="ri-delete-bin-line text-xs" />
              Queue Temizle
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}
          >
            Kapat
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── PendingModal ─────────────────────────────────────────────────────────────
interface PendingModalProps {
  open:           boolean;
  onClose:        () => void;
  items:          OfflineQueueItem[];
  isOnline:       boolean;
  isSyncing:      boolean;
  onSyncNow:      () => void;
  onForceSyncAll: () => void;
  onClear:        () => void;
  onShowHistory:  () => void;
  onShowInspector:() => void;
  sessionId:      string;
  isAdmin?:      boolean;
}

export function PendingModal({
  open,
  onClose,
  items,
  isOnline,
  isSyncing,
  onSyncNow,
  onForceSyncAll,
  onClear,
  onShowHistory,
  onShowInspector,
  sessionId,
  isAdmin = false,
}: PendingModalProps) {
  const [showFailLog, setShowFailLog] = useState(false);
  const failLog    = getSyncFailLog();
  const history    = getSyncHistory();
  const lastSync   = history[0] ?? null;

  const fmtTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Az önce';
    if (mins < 60) return `${mins} dk önce`;
    return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const typeIcon = (type: string) => {
    if (type === 'ziyaret_checkin')  return 'ri-login-box-line';
    if (type === 'ziyaret_checkout') return 'ri-logout-box-r-line';
    if (type === 'ekipman_kontrol')  return 'ri-checkbox-circle-line';
    if (type === 'ekipman_durum')    return 'ri-settings-3-line';
    return 'ri-time-line';
  };

  const typeColor = (type: string) => {
    if (type === 'ziyaret_checkin')  return { bg: 'rgba(14,165,233,0.1)',  color: '#0EA5E9' };
    if (type === 'ziyaret_checkout') return { bg: 'rgba(52,211,153,0.1)',  color: '#34D399' };
    if (type === 'ekipman_kontrol')  return { bg: 'rgba(129,140,248,0.1)', color: '#818CF8' };
    if (type === 'ekipman_durum')    return { bg: 'rgba(251,191,36,0.1)',  color: '#FBBF24' };
    return { bg: 'rgba(255,255,255,0.06)', color: '#94A3B8' };
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Bekleyen İşlemler" size="md" icon="ri-time-line">
      <div className="space-y-4">

        {/* Durum satırı */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{
            background: isOnline ? 'rgba(52,211,153,0.06)' : 'rgba(251,191,36,0.06)',
            border:     `1px solid ${isOnline ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'}`,
          }}
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: isOnline ? '#34D399' : '#FBBF24' }}
          />
          <p className="text-sm font-semibold flex-1" style={{ color: isOnline ? '#34D399' : '#FCD34D' }}>
            {isOnline ? 'Çevrimiçi — işlemler gönderilebilir' : 'Çevrimdışı — bağlantı bekleniyor'}
          </p>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}
          >
            {items.length} işlem
          </span>
        </div>

        {/* Son sync özeti */}
        {lastSync && (
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
            onClick={onShowHistory}
          >
            <i className="ri-history-line text-sm flex-shrink-0" style={{ color: '#475569' }} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold" style={{ color: '#94A3B8' }}>
                Son sync: {lastSync.successCount}/{lastSync.totalItems} başarılı
                {lastSync.failCount > 0 && ` · ${lastSync.failCount} hata`}
              </p>
              <p className="text-[10px]" style={{ color: '#334155' }}>
                {new Date(lastSync.startedAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                {' · '}{lastSync.durationMs}ms
              </p>
            </div>
            <i className="ri-arrow-right-s-line text-xs flex-shrink-0" style={{ color: '#334155' }} />
          </div>
        )}

        {/* Session ID — sadece admin */}
        {isAdmin && (
          <div className="flex items-center gap-2 px-2">
            <i className="ri-fingerprint-line text-[10px]" style={{ color: '#1E293B' }} />
            <p className="text-[9px] font-mono" style={{ color: '#1E293B' }}>
              session: {sessionId}
            </p>
          </div>
        )}

        {/* Liste */}
        {items.length === 0 ? (
          <div className="text-center py-8">
            <i className="ri-checkbox-circle-line text-3xl" style={{ color: '#34D399' }} />
            <p className="text-sm mt-2 font-medium" style={{ color: '#34D399' }}>Tüm işlemler gönderildi!</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '240px' }}>
            {items.map(item => {
              const tc = typeColor(item.type);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div
                    className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: tc.bg }}
                  >
                    <i className={`${typeIcon(item.type)} text-sm`} style={{ color: tc.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {item.label}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: tc.bg, color: tc.color }}
                      >
                        {item.type}
                      </span>
                      {item.retryCount > 0 && (
                        <span className="text-[10px]" style={{ color: '#EF4444' }}>
                          {item.retryCount} deneme
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] flex-shrink-0" style={{ color: '#334155' }}>
                    {fmtTime(item.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Fail log */}
        {failLog.length > 0 && (
          <div>
            <button
              onClick={() => setShowFailLog(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              style={{ color: '#EF4444' }}
            >
              <i className={`${showFailLog ? 'ri-eye-off-line' : 'ri-eye-line'} text-xs`} />
              {showFailLog ? 'Hata logunu gizle' : `${failLog.length} sync hatası`}
            </button>
            {showFailLog && (
              <div
                className="mt-2 space-y-1.5 overflow-y-auto rounded-xl p-3"
                style={{ maxHeight: '140px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)' }}
              >
                {failLog.map((log, i) => (
                  <div key={i} className="space-y-0.5">
                    <p className="text-[10px] font-bold" style={{ color: '#F87171' }}>
                      [{log.itemType}] {log.itemLabel}
                      {log.droppedAt && <span className="ml-1 font-normal" style={{ color: '#94A3B8' }}>— DROPPED</span>}
                    </p>
                    <p className="text-[10px]" style={{ color: '#64748B' }}>{log.errorMsg}</p>
                    <p className="text-[9px]" style={{ color: '#334155' }}>{log.ts}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Aksiyon butonları */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={onShowHistory}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
            style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', color: '#818CF8' }}
          >
            <i className="ri-history-line text-xs" />
            Geçmiş
          </button>
          {isAdmin && (
            <button
              onClick={onShowInspector}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#6366F1' }}
            >
              <i className="ri-bug-line text-xs" />
              Inspector
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444' }}
            >
              <i className="ri-delete-bin-line text-xs" />
              Temizle
            </button>
          )}
          <div className="flex-1" />
          {isOnline && items.length > 0 && (
            <>
              <button
                onClick={() => { onSyncNow(); onClose(); }}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white cursor-pointer whitespace-nowrap"
                style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)', color: '#34D399', opacity: isSyncing ? 0.7 : 1 }}
              >
                {isSyncing
                  ? <><i className="ri-loader-4-line animate-spin text-xs" />Gönderiliyor...</>
                  : <><i className="ri-upload-cloud-2-line text-xs" />Gönder</>}
              </button>
              <button
                onClick={() => { onForceSyncAll(); onClose(); }}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', opacity: isSyncing ? 0.7 : 1 }}
              >
                <i className="ri-refresh-line text-xs" />
                Tümünü Senkronize Et
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}
          >
            Kapat
          </button>
        </div>
      </div>
    </Modal>
  );
}
