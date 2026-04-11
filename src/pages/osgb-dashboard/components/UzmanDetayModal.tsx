import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AltFirma {
  id: string;
  name: string;
}

interface UzmanDetayModalProps {
  uzman: {
    user_id: string;
    display_name: string;
    email: string;
    is_active: boolean;
    active_firm_id: string | null;
    active_firm_ids: string[] | null;
    active_firm_name: string | null;
  };
  orgId: string;
  altFirmalar: AltFirma[];
  onClose: () => void;
  onRefresh: () => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
}

interface ZiyaretRow {
  id: string;
  firma_ad: string | null;
  firma_org_id: string;
  giris_saati: string;
  cikis_saati: string | null;
  durum: 'aktif' | 'tamamlandi';
  qr_ile_giris: boolean;
  sure_dakika: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatSaat(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatTarih(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Bugün';
  if (d.toDateString() === yesterday.toDateString()) return 'Dün';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatSure(dk: number | null) {
  if (!dk || dk < 0) return '—';
  const h = Math.floor(dk / 60);
  const m = dk % 60;
  return h > 0 ? `${h}s ${m}d` : `${m}d`;
}

// ─── Live timer ───────────────────────────────────────────────────────────────
function ElapsedTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(since).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h > 0 ? h + 's ' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [since]);
  return <span className="font-mono text-xs font-bold" style={{ color: '#22C55E' }}>{elapsed}</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function UzmanDetayModal({
  uzman, orgId, altFirmalar, onClose, onRefresh, addToast,
}: UzmanDetayModalProps) {
  const [activeTab, setActiveTab] = useState<'ozet' | 'ziyaret' | 'ayarlar'>('ozet');
  const [isActive, setIsActive] = useState(uzman.is_active);
  const [secilenFirmaIds, setSecilenFirmaIds] = useState<string[]>(
    uzman.active_firm_ids?.length
      ? uzman.active_firm_ids
      : uzman.active_firm_id ? [uzman.active_firm_id] : []
  );
  const [loading, setLoading] = useState(false);

  // Stats
  const [personelSayisi, setPersonelSayisi] = useState(0);
  const [ziyaretler, setZiyaretler] = useState<ZiyaretRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const firmIds = (uzman.active_firm_ids?.length)
        ? uzman.active_firm_ids
        : uzman.active_firm_id ? [uzman.active_firm_id] : [];

      // Personel sayısı (tüm atanmış firmalardaki)
      if (firmIds.length > 0) {
        const { count } = await supabase
          .from('personeller')
          .select('id', { count: 'exact', head: true })
          .in('organization_id', firmIds);
        setPersonelSayisi(count ?? 0);
      }

      // Uzmanın ziyaret geçmişi
      const { data: zData } = await supabase
        .from('osgb_ziyaretler')
        .select('id, firma_ad, firma_org_id, giris_saati, cikis_saati, durum, qr_ile_giris, sure_dakika')
        .eq('uzman_user_id', uzman.user_id)
        .order('giris_saati', { ascending: false })
        .limit(50);
      setZiyaretler((zData ?? []) as ZiyaretRow[]);
    } catch (err) {
      console.error('[UzmanDetay] fetchData error:', err);
    } finally {
      setDataLoading(false);
    }
  }, [uzman.user_id, uzman.active_firm_id, uzman.active_firm_ids]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const toggleFirma = (firmaId: string) => {
    setSecilenFirmaIds(prev =>
      prev.includes(firmaId) ? prev.filter(id => id !== firmaId) : [...prev, firmaId]
    );
  };

  const handleKaydet = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');

      const res = await fetch('https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/admin-user-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'update',
          organization_id: orgId,
          target_user_id: uzman.user_id,
          is_active: isActive,
          active_firm_id: secilenFirmaIds[0] ?? null,
          active_firm_ids: secilenFirmaIds.length > 0 ? secilenFirmaIds : null,
        }),
      });
      const json = await res.json() as { error?: string; success?: boolean };
      if (json.error) throw new Error(json.error);

      addToast('Uzman bilgileri güncellendi!', 'success');
      onRefresh();
      onClose();
    } catch (err) {
      addToast(`Güncelleme yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Derived stats
  const toplamZiyaret = ziyaretler.length;
  const aktifZiyaret = ziyaretler.find(z => z.durum === 'aktif');
  const sonZiyaret = ziyaretler.find(z => z.durum === 'tamamlandi' || z.giris_saati);
  const sonZiyaretGun = sonZiyaret
    ? Math.floor((Date.now() - new Date(sonZiyaret.giris_saati).getTime()) / 86400000)
    : null;
  const tamamlananZiyaretler = ziyaretler.filter(z => z.sure_dakika && z.sure_dakika > 0);
  const ortSure = tamamlananZiyaretler.length > 0
    ? Math.round(tamamlananZiyaretler.reduce((s, z) => s + (z.sure_dakika ?? 0), 0) / tamamlananZiyaretler.length)
    : 0;

  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';
  const cardBg = 'var(--bg-item)';
  const border = 'var(--border-subtle)';

  const kpiCards = [
    {
      label: 'Toplam Personel', value: personelSayisi,
      icon: 'ri-group-line', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)',
    },
    {
      label: 'Toplam Ziyaret', value: toplamZiyaret,
      icon: 'ri-map-pin-2-line', color: '#10B981', bg: 'rgba(16,185,129,0.1)',
    },
    {
      label: 'Son Ziyaret',
      value: aktifZiyaret ? 'Şu an sahada' : sonZiyaretGun === null ? 'Hiç' : sonZiyaretGun === 0 ? 'Bugün' : `${sonZiyaretGun}g önce`,
      icon: 'ri-time-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',
      pulse: !!aktifZiyaret,
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col"
        style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', maxHeight: '90vh' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0"
          style={{ borderBottom: `1px solid ${border}` }}>
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-extrabold text-white"
                style={{ background: isActive ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #94a3b8, #64748b)' }}>
                {(uzman.display_name ?? uzman.email ?? '?').charAt(0).toUpperCase()}
              </div>
              {aktifZiyaret && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 animate-pulse"
                  style={{ background: '#22C55E', borderColor: 'var(--modal-bg)' }} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold" style={{ color: textPrimary }}>{uzman.display_name}</h3>
                {/* Aktif ziyaret badge */}
                {aktifZiyaret && (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.25)' }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-ping inline-block" style={{ background: '#22C55E' }} />
                    Sahada
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: textMuted }}>{uzman.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Status badge */}
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl"
              style={{
                background: isActive ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                color: isActive ? '#10B981' : '#64748b',
                border: `1px solid ${isActive ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.2)'}`,
              }}>
              {isActive ? '● Aktif' : '○ Pasif'}
            </span>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all"
              style={{ background: 'var(--bg-item)', color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}>
              <i className="ri-close-line text-sm" />
            </button>
          </div>
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#10B981' }} />
            <span className="text-sm" style={{ color: textMuted }}>Yükleniyor...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">

            {/* ── Atanmış Firmalar Bandı ── */}
            <div className="px-6 py-4" style={{ background: 'var(--bg-item)', borderBottom: `1px solid ${border}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <i className="ri-building-2-line text-sm" style={{ color: '#10B981' }} />
                  <span className="text-xs font-bold" style={{ color: textPrimary }}>
                    Atanmış Firmalar
                  </span>
                  {secilenFirmaIds.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
                      {secilenFirmaIds.length} firma sorumluluğu
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {secilenFirmaIds.length > 0
                  ? secilenFirmaIds.map((id, idx) => {
                      const f = altFirmalar.find(af => af.id === id);
                      return f ? (
                        <span key={id} className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-xl"
                          style={{
                            background: 'rgba(16,185,129,0.1)',
                            color: '#059669',
                            border: '1px solid rgba(16,185,129,0.25)',
                          }}>
                          <i className="ri-building-2-line text-[9px]" />
                          {f.name}
                          {idx === 0 && <span style={{ color: 'rgba(5,150,105,0.6)', fontWeight: 400 }}>(birincil)</span>}
                        </span>
                      ) : null;
                    })
                  : <span className="text-xs" style={{ color: textMuted }}>Henüz firma atanmadı</span>
                }
              </div>
            </div>

            {/* ── KPI Kartları ── */}
            <div className="grid grid-cols-3 gap-3 px-6 py-4">
              {kpiCards.map(k => (
                <div key={k.label}
                  className="rounded-2xl p-4 flex flex-col gap-2"
                  style={{ background: 'var(--bg-item)', border: `1px solid ${border}` }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: k.bg }}>
                    {k.pulse ? (
                      <div className="relative w-4 h-4 flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full animate-ping absolute" style={{ background: k.color, opacity: 0.5 }} />
                        <span className="w-2 h-2 rounded-full" style={{ background: k.color }} />
                      </div>
                    ) : (
                      <i className={`${k.icon} text-base`} style={{ color: k.color }} />
                    )}
                  </div>
                  <div>
                    <p className="text-xl font-extrabold leading-none" style={{ color: textPrimary }}>{k.value}</p>
                    <p className="text-[10px] mt-1 font-medium" style={{ color: textMuted }}>{k.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-0 px-6" style={{ borderBottom: `1px solid ${border}` }}>
              {[
                { id: 'ozet' as const, label: 'Özet', icon: 'ri-dashboard-line' },
                { id: 'ziyaret' as const, label: `Ziyaret Geçmişi (${toplamZiyaret})`, icon: 'ri-map-pin-2-line' },
                { id: 'ayarlar' as const, label: 'Düzenle', icon: 'ri-settings-4-line' },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors"
                  style={{
                    color: activeTab === t.id ? '#10B981' : textMuted,
                    borderBottom: activeTab === t.id ? '2px solid #10B981' : '2px solid transparent',
                  }}>
                  <i className={`${t.icon} text-xs`} />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="px-6 py-4">

              {/* ── Özet Tab ── */}
              {activeTab === 'ozet' && (
                <div className="space-y-3">
                  {/* Uzman Bilgileri */}
                  <div className="rounded-2xl p-4 space-y-3" style={{ background: cardBg, border: `1px solid ${border}` }}>
                    <p className="text-xs font-bold" style={{ color: textPrimary }}>Uzman Bilgileri</p>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                          style={{ background: 'rgba(16,185,129,0.08)' }}>
                          <i className="ri-mail-line text-xs" style={{ color: '#10B981' }} />
                        </div>
                        <span className="text-xs" style={{ color: '#475569' }}>{uzman.email}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                          style={{ background: 'rgba(16,185,129,0.08)' }}>
                          <i className="ri-user-star-line text-xs" style={{ color: '#10B981' }} />
                        </div>
                        <span className="text-xs" style={{ color: '#475569' }}>Gezici Uzman</span>
                      </div>
                      {secilenFirmaIds.length > 0 && (
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                            style={{ background: 'rgba(16,185,129,0.08)' }}>
                            <i className="ri-building-2-line text-xs" style={{ color: '#10B981' }} />
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {secilenFirmaIds.map(id => {
                              const f = altFirmalar.find(af => af.id === id);
                              return f ? (
                                <span key={id} className="text-xs font-semibold" style={{ color: '#475569' }}>
                                  {f.name}
                                </span>
                              ) : null;
                            }).reduce((acc: JSX.Element[], el, i) => {
                              if (i > 0) acc.push(<span key={`sep-${i}`} style={{ color: textMuted }}>, </span>);
                              if (el) acc.push(el);
                              return acc;
                            }, [])}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Aktif ziyaret varsa canlı satır */}
                  {aktifZiyaret && (
                    <div className="rounded-2xl p-4 flex items-center gap-3"
                      style={{ background: 'rgba(34,197,94,0.04)', border: '1.5px solid rgba(34,197,94,0.25)' }}>
                      <div className="relative flex-shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#22C55E' }} />
                        <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(34,197,94,0.4)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold" style={{ color: '#16A34A' }}>Şu an sahada</p>
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: '#475569' }}>
                          {aktifZiyaret.firma_ad ?? '—'} · <ElapsedTimer since={aktifZiyaret.giris_saati} />
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl whitespace-nowrap"
                        style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <i className="ri-map-pin-user-line mr-0.5" />Devam ediyor
                      </span>
                    </div>
                  )}

                  {/* Firma atanmadı uyarısı */}
                  {secilenFirmaIds.length === 0 && (
                    <div className="flex items-start gap-2.5 p-4 rounded-2xl"
                      style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <i className="ri-alert-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                      <p className="text-xs leading-relaxed" style={{ color: '#92400e' }}>
                        Bu uzmana henüz firma atanmadı. &quot;Düzenle&quot; sekmesinden firma atayabilirsiniz.
                      </p>
                    </div>
                  )}

                  {/* Son 3 ziyaret önizleme */}
                  {ziyaretler.length > 0 && (
                    <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${border}` }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold" style={{ color: textPrimary }}>Son Ziyaretler</p>
                        <button onClick={() => setActiveTab('ziyaret')}
                          className="text-[10px] font-semibold cursor-pointer"
                          style={{ color: '#10B981' }}>
                          Tümünü gör →
                        </button>
                      </div>
                      <div className="space-y-2">
                        {ziyaretler.slice(0, 3).map(z => (
                          <div key={z.id} className="flex items-center gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: z.durum === 'aktif' ? '#22C55E' : 'var(--border-main)' }} />
                            <span className="text-xs font-medium truncate flex-1" style={{ color: textMuted }}>
                              {z.firma_ad ?? '—'}
                            </span>
                            <span className="text-[10px] flex-shrink-0" style={{ color: textMuted }}>
                              {formatTarih(z.giris_saati)}
                            </span>
                            {z.sure_dakika && (
                              <span className="text-[10px] font-semibold flex-shrink-0 px-1.5 py-0.5 rounded-lg"
                                style={{ background: 'rgba(6,182,212,0.08)', color: '#06B6D4' }}>
                                {formatSure(z.sure_dakika)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Ziyaret Geçmişi Tab ── */}
              {activeTab === 'ziyaret' && (
                <div className="space-y-2">
                  {ziyaretler.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                        <i className="ri-map-pin-2-line text-xl" style={{ color: '#10B981' }} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold" style={{ color: textPrimary }}>Henüz ziyaret yok</p>
                        <p className="text-xs mt-1" style={{ color: textMuted }}>
                          Uzman QR ile ziyaret başlattığında burada görünecek
                        </p>
                      </div>
                    </div>
                  ) : (
                    ziyaretler.map(z => {
                      const isAktif = z.durum === 'aktif';
                      return (
                        <div key={z.id}
                          className="flex items-center gap-3 p-3.5 rounded-2xl transition-all"
                          style={{
                            background: isAktif ? 'rgba(34,197,94,0.04)' : cardBg,
                            border: isAktif ? '1.5px solid rgba(34,197,94,0.2)' : `1px solid ${border}`,
                          }}>
                          {/* Status dot */}
                          <div className="flex-shrink-0">
                            {isAktif ? (
                              <div className="relative w-3 h-3">
                                <span className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(34,197,94,0.4)' }} />
                                <span className="w-3 h-3 rounded-full block" style={{ background: '#22C55E' }} />
                              </div>
                            ) : (
                              <div className="w-3 h-3 rounded-full" style={{ background: '#e2e8f0' }} />
                            )}
                          </div>

                          {/* Firma */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>
                              {z.firma_ad ?? '—'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px]" style={{ color: textMuted }}>
                                {formatTarih(z.giris_saati)} · {formatSaat(z.giris_saati)}
                              </span>
                              {z.cikis_saati && (
                                <span className="text-[10px]" style={{ color: textMuted }}>
                                  → {formatSaat(z.cikis_saati)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Süre */}
                          <div className="flex-shrink-0">
                            {isAktif ? (
                              <ElapsedTimer since={z.giris_saati} />
                            ) : z.sure_dakika ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                                style={{ background: 'rgba(6,182,212,0.08)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.15)' }}>
                                {formatSure(z.sure_dakika)}
                              </span>
                            ) : null}
                          </div>

                          {/* Durum badge */}
                          {isAktif ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-xl whitespace-nowrap flex-shrink-0"
                              style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }}>
                              Devam ediyor
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-xl whitespace-nowrap flex-shrink-0"
                              style={{ background: 'rgba(148,163,184,0.1)', color: '#64748b', border: '1px solid rgba(148,163,184,0.2)' }}>
                              Tamamlandı
                            </span>
                          )}

                          {/* QR badge */}
                          {z.qr_ile_giris && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-lg whitespace-nowrap flex-shrink-0"
                              style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
                              <i className="ri-qr-code-line mr-0.5" />QR
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ── Düzenle Tab ── */}
              {activeTab === 'ayarlar' && (
                <div className="space-y-4">
                  {/* Aktif/Pasif Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-2xl"
                    style={{ background: cardBg, border: `1px solid ${border}` }}>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: textPrimary }}>Hesap Durumu</p>
                      <p className="text-[10px] mt-0.5" style={{ color: textMuted }}>
                        {isActive ? 'Uzman sisteme giriş yapabilir' : 'Uzmanın erişimi kısıtlı'}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsActive(p => !p)}
                      className="relative cursor-pointer flex-shrink-0"
                      style={{ width: '44px', height: '24px' }}>
                      <div className="w-full h-full rounded-full transition-colors"
                        style={{ background: isActive ? '#10B981' : 'var(--border-main)' }} />
                      <div className="absolute top-1 transition-all rounded-full"
                        style={{ width: '16px', height: '16px', background: 'var(--modal-bg)', left: isActive ? '24px' : '4px' }} />
                    </button>
                  </div>

                  {/* Firma Atama */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold" style={{ color: '#475569' }}>
                        Atanacak Firma(lar)
                        <span className="ml-1.5 text-[10px] font-normal" style={{ color: textMuted }}>
                          ({secilenFirmaIds.length} seçili)
                        </span>
                      </label>
                      {secilenFirmaIds.length > 0 && (
                        <button onClick={() => setSecilenFirmaIds([])}
                          className="text-[10px] cursor-pointer" style={{ color: '#EF4444' }}>
                          Tümünü kaldır
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {altFirmalar.map(f => {
                        const secili = secilenFirmaIds.includes(f.id);
                        return (
                          <button key={f.id} type="button" onClick={() => toggleFirma(f.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-left"
                            style={{
                              background: secili ? 'rgba(16,185,129,0.08)' : cardBg,
                              border: secili ? '1.5px solid rgba(16,185,129,0.3)' : `1.5px solid ${border}`,
                            }}>
                            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                              style={secili
                                ? { background: 'linear-gradient(135deg, #10B981, #059669)' }
                                : { background: 'var(--bg-card-solid)', border: `1.5px solid ${border}` }}>
                              {secili && <i className="ri-check-line text-white text-[10px]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate"
                                style={{ color: secili ? '#059669' : textPrimary }}>
                                {f.name}
                              </p>
                            </div>
                            {secili && secilenFirmaIds[0] === f.id && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                                Birincil
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {altFirmalar.length === 0 && (
                        <p className="text-xs text-center py-4" style={{ color: textMuted }}>Henüz firma eklenmedi</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={onClose}
                      className="flex-1 whitespace-nowrap py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                      style={{ background: 'var(--bg-item)', border: `1px solid ${border}`, color: textMuted }}>
                      İptal
                    </button>
                    <button onClick={handleKaydet} disabled={loading}
                      className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer"
                      style={{ background: 'linear-gradient(135deg, #10B981, #059669)', opacity: loading ? 0.7 : 1 }}>
                      {loading
                        ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</>
                        : <><i className="ri-save-line" />Kaydet</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
