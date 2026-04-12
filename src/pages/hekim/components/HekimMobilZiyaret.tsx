import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import QrScanner from '@/pages/saha/components/QrScanner';

const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';

interface AktifZiyaret {
  id: string;
  firma_org_id: string;
  firma_ad: string | null;
  giris_saati: string;
  qr_ile_giris: boolean;
}

interface AtanmisOrg {
  id: string;
  name: string;
}

interface Props {
  isDark: boolean;
}

export default function HekimMobilZiyaret({ isDark }: Props) {
  const { user } = useAuth();
  const { org, addToast } = useApp();

  const [aktifZiyaret, setAktifZiyaret] = useState<AktifZiyaret | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [manuelFirmaId, setManuelFirmaId] = useState('');
  const [atanmisFirmalar, setAtanmisFirmalar] = useState<AtanmisOrg[]>([]);
  const [gecmis, setGecmis] = useState<AktifZiyaret[]>([]);
  const [elapsed, setElapsed] = useState('');

  const bg = isDark ? '#0a0f1a' : '#f0f9ff';
  const cardBg = isDark ? 'rgba(17,24,39,0.85)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#64748b' : '#64748b';

  // Elapsed timer
  useEffect(() => {
    if (!aktifZiyaret) { setElapsed(''); return; }
    const update = () => {
      const diff = Date.now() - new Date(aktifZiyaret.giris_saati).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h > 0 ? h + 's ' : ''}${String(m).padStart(2, '0')}d ${String(s).padStart(2, '0')}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [aktifZiyaret]);

  const fetchAtanmisFirmalar = useCallback(async () => {
    if (!user?.id) return;
    if (org?.activeFirmIds && org.activeFirmIds.length > 0) {
      const { data } = await supabase.from('organizations').select('id, name').in('id', org.activeFirmIds);
      setAtanmisFirmalar(data ?? []);
      return;
    }
    const { data: uoData } = await supabase
      .from('user_organizations').select('active_firm_ids')
      .eq('user_id', user.id).eq('osgb_role', 'gezici_uzman').maybeSingle();
    if (!uoData) return;
    const firmIds: string[] = Array.isArray(uoData.active_firm_ids) ? (uoData.active_firm_ids as string[]).filter(Boolean) : [];
    if (firmIds.length === 0) return;
    const { data } = await supabase.from('organizations').select('id, name').in('id', firmIds);
    setAtanmisFirmalar(data ?? []);
  }, [user?.id, org?.activeFirmIds]);

  const fetchZiyaret = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('osgb_ziyaretler')
        .select('id, firma_org_id, firma_ad, giris_saati, qr_ile_giris')
        .eq('uzman_user_id', user.id).eq('durum', 'aktif').maybeSingle();
      setAktifZiyaret(data ?? null);
      const { data: gecmisData } = await supabase.from('osgb_ziyaretler')
        .select('id, firma_org_id, firma_ad, giris_saati, qr_ile_giris')
        .eq('uzman_user_id', user.id).eq('durum', 'tamamlandi')
        .order('created_at', { ascending: false }).limit(5);
      setGecmis((gecmisData ?? []) as AktifZiyaret[]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchZiyaret();
    void fetchAtanmisFirmalar();
  }, [fetchZiyaret, fetchAtanmisFirmalar]);

  const handleCheckIn = useCallback(async (firmaId: string, qr = false) => {
    if (!user?.id || !org?.id) return;
    setActionLoading(true);
    try {
      const { data: existing } = await supabase.from('osgb_ziyaretler')
        .select('id, firma_ad').eq('uzman_user_id', user.id).eq('durum', 'aktif').maybeSingle();
      if (existing) {
        addToast(`Aktif ziyaret var: ${existing.firma_ad ?? 'Firma'}. Önce bitirin.`, 'error');
        return;
      }
      const { data: firmaData } = await supabase.from('organizations').select('name').eq('id', firmaId).maybeSingle();
      if (!firmaData) { addToast('Firma bulunamadı. QR geçersiz olabilir.', 'error'); return; }
      const now = new Date().toISOString();
      const { data: yeniZiyaret, error } = await supabase.from('osgb_ziyaretler').insert({
        osgb_org_id: org.id, firma_org_id: firmaId, firma_ad: firmaData.name,
        uzman_user_id: user.id,
        uzman_ad: user.user_metadata?.display_name ?? user.email ?? 'Uzman',
        uzman_email: user.email, giris_saati: now, durum: 'aktif',
        qr_ile_giris: qr, created_at: now, updated_at: now,
      }).select('id, firma_org_id, firma_ad, giris_saati, qr_ile_giris').maybeSingle();
      if (error) throw error;
      setAktifZiyaret(yeniZiyaret ?? null);
      addToast(`${firmaData.name} ziyareti başlatıldı!`, 'success');
    } catch (err) {
      addToast(`Check-in yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setActionLoading(false);
    }
  }, [user, org, addToast]);

  const handleCheckOut = useCallback(async () => {
    if (!aktifZiyaret || !user?.id) return;
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      const sureDakika = Math.round((Date.now() - new Date(aktifZiyaret.giris_saati).getTime()) / 60000);
      const { error } = await supabase.from('osgb_ziyaretler').update({
        cikis_saati: now, durum: 'tamamlandi', sure_dakika: sureDakika, updated_at: now,
      }).eq('id', aktifZiyaret.id).eq('uzman_user_id', user.id);
      if (error) throw error;
      addToast(`Ziyaret tamamlandı! Süre: ${sureDakika} dakika`, 'success');
      setAktifZiyaret(null);
      void fetchZiyaret();
    } catch (err) {
      addToast(`Check-out yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setActionLoading(false);
    }
  }, [aktifZiyaret, user?.id, addToast, fetchZiyaret]);

  const handleQrResult = useCallback((text: string) => {
    setShowQr(false);
    let firmaId: string | null = null;
    try {
      const parsed = JSON.parse(text) as { type?: string; id?: string };
      if (parsed.type === 'firm' && parsed.id) firmaId = parsed.id;
    } catch { /* not JSON */ }
    if (!firmaId) {
      const uuidMatch = text.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      if (uuidMatch) firmaId = text.trim();
    }
    if (!firmaId) firmaId = text.match(/firma[_-]?id=([0-9a-f-]{36})/i)?.[1] ?? null;
    if (!firmaId) {
      const segs = text.replace(/[?#].*/, '').split('/').filter(Boolean);
      const last = segs[segs.length - 1] ?? '';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last)) firmaId = last;
    }
    if (!firmaId) { addToast('Geçersiz QR kodu.', 'error'); return; }
    if (aktifZiyaret) {
      if (aktifZiyaret.firma_org_id === firmaId) void handleCheckOut();
      else addToast(`Başka firmada aktif ziyaret var (${aktifZiyaret.firma_ad}). Önce bitirin.`, 'error');
    } else {
      void handleCheckIn(firmaId, true);
    }
  }, [aktifZiyaret, handleCheckIn, handleCheckOut, addToast]);

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Bugün';
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Dün';
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4" style={{ background: bg, minHeight: '100vh' }}>
        <div className="w-12 h-12 flex items-center justify-center rounded-2xl" style={{ background: `rgba(14,165,233,0.1)`, border: `1px solid rgba(14,165,233,0.2)` }}>
          <i className="ri-loader-4-line text-xl animate-spin" style={{ color: ACCENT }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: textMuted }}>Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: bg }}>
      <style>{`
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.8; }
          70% { transform: scale(1.8); opacity: 0; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes timerGlow {
          0%, 100% { text-shadow: 0 0 12px rgba(14,165,233,0.3); }
          50% { text-shadow: 0 0 24px rgba(14,165,233,0.7); }
        }
        .timer-glow { animation: timerGlow 2s ease-in-out infinite; }
      `}</style>

      {/* ── HERO HEADER ── */}
      <div
        className="relative overflow-hidden px-5 pt-8 pb-6"
        style={{
          background: isDark
            ? 'linear-gradient(160deg, #0c1929 0%, #0a1520 60%, #080f1a 100%)'
            : 'linear-gradient(160deg, #e0f2fe 0%, #f0f9ff 60%, #f8fafc 100%)',
          borderBottom: `1px solid ${border}`,
        }}
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)`, transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, rgba(14,165,233,0.05) 0%, transparent 70%)`, transform: 'translate(-30%, 30%)' }} />

        {/* Accent top line */}
        <div className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: `linear-gradient(90deg, ${ACCENT_DARK}, #38BDF8, ${ACCENT})` }} />

        <div className="relative z-10 flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(135deg, rgba(14,165,233,0.2), rgba(14,165,233,0.08))`,
                border: `1.5px solid rgba(14,165,233,0.3)`,
              }}>
              <i className="ri-map-pin-user-line text-2xl" style={{ color: ACCENT }} />
            </div>
            {aktifZiyaret && (
              <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full"
                style={{ background: ACCENT, boxShadow: `0 0 8px rgba(14,165,233,0.6)` }}>
                <i className="ri-check-line text-white text-[9px] font-bold" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-extrabold leading-tight" style={{ color: textPrimary, letterSpacing: '-0.03em' }}>
                Saha Ziyareti
              </h1>
              {aktifZiyaret ? (
                <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
                  style={{ background: `rgba(14,165,233,0.15)`, color: ACCENT, border: `1px solid rgba(14,165,233,0.3)` }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
                  AKTİF
                </span>
              ) : (
                <span className="text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
                  style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', color: textMuted, border: `1px solid ${border}` }}>
                  BEKLİYOR
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: textMuted }}>
              QR okutarak firma check-in / check-out yap
            </p>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="px-4 pt-5 space-y-4">

        {/* ── AKTİF ZİYARET ── */}
        {aktifZiyaret ? (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: cardBg, border: `1.5px solid rgba(14,165,233,0.3)`, boxShadow: isDark ? '0 8px 32px rgba(14,165,233,0.08)' : '0 8px 32px rgba(14,165,233,0.1)' }}
          >
            {/* Card top accent */}
            <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${ACCENT_DARK}, #38BDF8, ${ACCENT})` }} />

            <div className="p-5">
              {/* Status badge */}
              <div className="flex items-center gap-2 mb-5">
                <div className="relative flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: ACCENT }} />
                  <div className="absolute inset-0 rounded-full" style={{ background: ACCENT, animation: 'pulseRing 2s ease-out infinite' }} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: ACCENT }}>
                  Aktif Ziyaret
                </span>
                {aktifZiyaret.qr_ile_giris && (
                  <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ background: `rgba(14,165,233,0.1)`, color: ACCENT, border: `1px solid rgba(14,165,233,0.2)` }}>
                    <i className="ri-qr-code-line mr-0.5" />QR Girişi
                  </span>
                )}
              </div>

              {/* Firma info */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, rgba(14,165,233,0.2), rgba(14,165,233,0.06))`, border: `1px solid rgba(14,165,233,0.25)` }}>
                  <i className="ri-building-2-line text-2xl" style={{ color: ACCENT }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-extrabold leading-tight truncate" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>
                    {aktifZiyaret.firma_ad ?? 'Bilinmeyen Firma'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <i className="ri-time-line text-xs" style={{ color: textMuted }} />
                    <p className="text-xs" style={{ color: textMuted }}>
                      Giriş: {formatTime(aktifZiyaret.giris_saati)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timer */}
              <div className="flex items-center justify-center py-5 rounded-2xl mb-5"
                style={{
                  background: isDark ? 'rgba(14,165,233,0.06)' : 'rgba(14,165,233,0.05)',
                  border: `1px solid rgba(14,165,233,0.15)`,
                }}>
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: `rgba(14,165,233,0.6)` }}>
                    Geçen Süre
                  </p>
                  <p className="text-4xl font-black font-mono timer-glow" style={{ color: ACCENT, letterSpacing: '0.04em' }}>
                    {elapsed || '00d 00s'}
                  </p>
                </div>
              </div>

              {/* Checkout */}
              <button
                onClick={handleCheckOut}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm font-bold text-white cursor-pointer transition-all"
                style={{
                  background: actionLoading
                    ? '#334155'
                    : 'linear-gradient(135deg, #EF4444, #DC2626)',
                  opacity: actionLoading ? 0.7 : 1,
                  letterSpacing: '-0.01em',
                }}
              >
                {actionLoading
                  ? <><i className="ri-loader-4-line animate-spin" />İşleniyor...</>
                  : <><i className="ri-logout-box-r-line text-base" />Ziyareti Bitir (Check-out)</>}
              </button>
            </div>
          </div>
        ) : (
          /* ── CHECK-IN ALANI ── */
          <div className="space-y-3">

            {/* QR Scanner Card */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: cardBg, border: `1px solid ${border}` }}
            >
              <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${ACCENT}, #38BDF8, transparent)` }} />

              {showQr ? (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: `rgba(14,165,233,0.1)` }}>
                        <i className="ri-qr-scan-2-line text-xs" style={{ color: ACCENT }} />
                      </div>
                      <p className="text-sm font-bold" style={{ color: textPrimary }}>Firma QR&apos;ı Okut</p>
                    </div>
                    <button
                      onClick={() => setShowQr(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-xl cursor-pointer transition-all"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <i className="ri-close-line text-sm" />
                    </button>
                  </div>
                  <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
                  <p className="text-center text-xs mt-3 leading-relaxed" style={{ color: textMuted }}>
                    Firma QR kodunu çerçeve içine getirin — otomatik check-in
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => setShowQr(true)}
                  className="w-full flex flex-col items-center justify-center gap-4 py-10 cursor-pointer transition-all"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `rgba(14,165,233,0.03)`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {/* QR Icon with rings */}
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-28 h-28 rounded-full opacity-20"
                      style={{ background: `radial-gradient(circle, rgba(14,165,233,0.3) 0%, transparent 70%)` }} />
                    <div className="w-20 h-20 flex items-center justify-center rounded-2xl relative z-10"
                      style={{
                        background: `linear-gradient(135deg, rgba(14,165,233,0.16), rgba(14,165,233,0.05))`,
                        border: `2px dashed rgba(14,165,233,0.35)`,
                      }}>
                      <i className="ri-qr-scan-2-line text-4xl" style={{ color: ACCENT }} />
                    </div>
                  </div>
                  <div className="text-center px-4">
                    <p className="text-base font-extrabold" style={{ color: ACCENT, letterSpacing: '-0.02em' }}>
                      QR ile Ziyaret Başlat
                    </p>
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: textMuted }}>
                      Firma QR kodunu okutun — anında check-in yapılır
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full"
                    style={{ background: `rgba(14,165,233,0.1)`, border: `1px solid rgba(14,165,233,0.2)` }}
                  >
                    <i className="ri-camera-line text-xs" style={{ color: ACCENT }} />
                    <span className="text-xs font-bold" style={{ color: ACCENT }}>Kamerayı Aç</span>
                  </div>
                </button>
              )}
            </div>

            {/* Manuel seçim */}
            {atanmisFirmalar.length > 0 && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: cardBg, border: `1px solid ${border}` }}
              >
                <div className="px-4 pt-4 pb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{ background: `rgba(14,165,233,0.1)` }}>
                      <i className="ri-building-2-line text-xs" style={{ color: ACCENT }} />
                    </div>
                    <p className="text-xs font-bold" style={{ color: textMuted }}>Manuel Firma Seç</p>
                  </div>
                </div>
                <div className="px-4 pb-2 space-y-1.5 mt-2">
                  {atanmisFirmalar.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setManuelFirmaId(f.id)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all text-left"
                      style={{
                        background: manuelFirmaId === f.id
                          ? `rgba(14,165,233,0.1)`
                          : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.025)',
                        border: manuelFirmaId === f.id
                          ? `1.5px solid rgba(14,165,233,0.35)`
                          : `1.5px solid ${border}`,
                      }}
                    >
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={manuelFirmaId === f.id
                          ? { background: ACCENT }
                          : { background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', border: `1.5px solid ${border}` }}>
                        {manuelFirmaId === f.id && <i className="ri-check-line text-white text-[10px]" />}
                      </div>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: manuelFirmaId === f.id ? `rgba(14,165,233,0.15)` : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }}>
                        <i className="ri-building-2-line text-xs" style={{ color: manuelFirmaId === f.id ? ACCENT : textMuted }} />
                      </div>
                      <p className="text-sm font-semibold flex-1 truncate"
                        style={{ color: manuelFirmaId === f.id ? ACCENT : textPrimary }}>
                        {f.name}
                      </p>
                      {manuelFirmaId === f.id && (
                        <i className="ri-checkbox-circle-fill text-base flex-shrink-0" style={{ color: ACCENT }} />
                      )}
                    </button>
                  ))}
                </div>
                <div className="px-4 pb-4 mt-2">
                  <button
                    onClick={() => { if (manuelFirmaId) void handleCheckIn(manuelFirmaId, false); }}
                    disabled={!manuelFirmaId || actionLoading}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold text-white cursor-pointer transition-all"
                    style={{
                      background: manuelFirmaId && !actionLoading
                        ? `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})`
                        : isDark ? '#1e293b' : '#e2e8f0',
                      color: manuelFirmaId && !actionLoading ? '#fff' : textMuted,
                      opacity: (!manuelFirmaId || actionLoading) ? 0.6 : 1,
                    }}
                  >
                    {actionLoading
                      ? <><i className="ri-loader-4-line animate-spin" />Başlatılıyor...</>
                      : <><i className="ri-login-box-line text-base" />Ziyareti Başlat</>}
                  </button>
                </div>
              </div>
            )}

            {/* Sadece QR gerekiyorsa info */}
            {atanmisFirmalar.length === 0 && !showQr && (
              <div
                className="rounded-2xl p-4"
                style={{ background: isDark ? 'rgba(14,165,233,0.05)' : 'rgba(14,165,233,0.04)', border: `1px dashed rgba(14,165,233,0.25)` }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{ background: `rgba(14,165,233,0.1)` }}>
                    <i className="ri-information-line text-base" style={{ color: ACCENT }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: textPrimary }}>QR ile ziyaret başlatabilirsiniz</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: textMuted }}>
                      Firmanın QR kodunu okutun — sistem otomatik check-in yapar. Manuel seçim için adminizden firma ataması talep edin.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── GEÇMİŞ ZİYARETLER ── */}
        {gecmis.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: cardBg, border: `1px solid ${border}` }}
          >
            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
              <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: `rgba(14,165,233,0.1)` }}>
                <i className="ri-history-line text-xs" style={{ color: ACCENT }} />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: textMuted }}>
                Son Ziyaretler
              </p>
            </div>
            <div className="px-3 pb-3 space-y-1.5">
              {gecmis.map(z => (
                <div key={z.id}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl"
                  style={{ background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.025)', border: `1px solid ${border}` }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }}>
                    <i className="ri-building-2-line text-sm" style={{ color: textMuted }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>
                      {z.firma_ad ?? '—'}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: textMuted }}>
                      {formatDate(z.giris_saati)} · {formatTime(z.giris_saati)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {z.qr_ile_giris && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: `rgba(14,165,233,0.1)`, color: ACCENT, border: `1px solid rgba(14,165,233,0.2)` }}>QR</span>
                    )}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', color: textMuted }}>
                      <i className="ri-check-line mr-0.5" />Bitti
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
