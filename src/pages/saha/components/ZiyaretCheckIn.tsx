import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import QrScanner from './QrScanner';

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

export default function ZiyaretCheckIn() {
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

  // Aktif ziyaret süresini say
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

  // Kullanıcıya atanmış firmaları çek — active_firm_ids (array) üzerinden
  const fetchAtanmisFirmalar = useCallback(async () => {
    if (!user?.id) return;

    // org context'ten activeFirmIds varsa direkt kullan (daha hızlı)
    if (org?.activeFirmIds && org.activeFirmIds.length > 0) {
      const { data: firmData } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', org.activeFirmIds);
      setAtanmisFirmalar(firmData ?? []);
      return;
    }

    // Fallback: DB'den çek (osgb_role = gezici_uzman kaydından)
    const { data: uoData } = await supabase
      .from('user_organizations')
      .select('active_firm_ids')
      .eq('user_id', user.id)
      .eq('osgb_role', 'gezici_uzman')
      .maybeSingle();

    if (!uoData) return;

    const firmIds: string[] = (uoData.active_firm_ids && Array.isArray(uoData.active_firm_ids) && uoData.active_firm_ids.length > 0)
      ? (uoData.active_firm_ids as string[]).filter(Boolean)
      : [];

    if (firmIds.length === 0) return;

    const { data: firmData } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', firmIds);

    setAtanmisFirmalar(firmData ?? []);
  }, [user?.id, org?.activeFirmIds]);

  // Aktif ziyareti ve geçmişi çek
  const fetchZiyaret = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('osgb_ziyaretler')
        .select('id, firma_org_id, firma_ad, giris_saati, qr_ile_giris')
        .eq('uzman_user_id', user.id)
        .eq('durum', 'aktif')
        .maybeSingle();
      setAktifZiyaret(data ?? null);

      // Son 10 tamamlanmış ziyaret
      const { data: gecmisData } = await supabase
        .from('osgb_ziyaretler')
        .select('id, firma_org_id, firma_ad, giris_saati, qr_ile_giris')
        .eq('uzman_user_id', user.id)
        .eq('durum', 'tamamlandi')
        .order('created_at', { ascending: false })
        .limit(5);
      setGecmis((gecmisData ?? []) as AktifZiyaret[]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchZiyaret();
    void fetchAtanmisFirmalar();
  }, [fetchZiyaret, fetchAtanmisFirmalar]);

  // Check-in yap (firma ID ile)
  const handleCheckIn = useCallback(async (firmaId: string, qr = false) => {
    if (!user?.id || !org?.id) return;
    setActionLoading(true);
    try {
      // Önce aktif ziyaret var mı kontrol et
      const { data: existing } = await supabase
        .from('osgb_ziyaretler')
        .select('id, firma_ad')
        .eq('uzman_user_id', user.id)
        .eq('durum', 'aktif')
        .maybeSingle();

      if (existing) {
        addToast(`Zaten aktif bir ziyaretiniz var: ${existing.firma_ad ?? 'Firma'}. Önce mevcut ziyareti bitirin.`, 'error');
        setActionLoading(false);
        return;
      }

      // Firma adını al
      const { data: firmaData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', firmaId)
        .maybeSingle();

      if (!firmaData) {
        addToast('Firma bulunamadı. QR geçersiz olabilir.', 'error');
        setActionLoading(false);
        return;
      }

      const now = new Date().toISOString();
      const { data: yeniZiyaret, error } = await supabase
        .from('osgb_ziyaretler')
        .insert({
          osgb_org_id: org.id,
          firma_org_id: firmaId,
          firma_ad: firmaData.name,
          uzman_user_id: user.id,
          uzman_ad: user.user_metadata?.display_name ?? user.email ?? 'Uzman',
          uzman_email: user.email,
          giris_saati: now,
          durum: 'aktif',
          qr_ile_giris: qr,
          created_at: now,
          updated_at: now,
        })
        .select('id, firma_org_id, firma_ad, giris_saati, qr_ile_giris')
        .maybeSingle();

      if (error) throw error;
      setAktifZiyaret(yeniZiyaret ?? null);
      addToast(`${firmaData.name} ziyareti başlatıldı!`, 'success');
    } catch (err) {
      addToast(`Check-in yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setActionLoading(false);
    }
  }, [user, org, addToast]);

  // Check-out yap
  const handleCheckOut = useCallback(async () => {
    if (!aktifZiyaret || !user?.id) return;
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      const giris = new Date(aktifZiyaret.giris_saati);
      const sureDakika = Math.round((Date.now() - giris.getTime()) / 60000);

      const { error } = await supabase
        .from('osgb_ziyaretler')
        .update({
          cikis_saati: now,
          durum: 'tamamlandi',
          sure_dakika: sureDakika,
          updated_at: now,
        })
        .eq('id', aktifZiyaret.id)
        .eq('uzman_user_id', user.id);

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

  // QR scan sonucu — yeni format: {"type":"firm","id":"..."} veya legacy UUID
  const handleQrResult = useCallback((text: string) => {
    setShowQr(false);

    let firmaId: string | null = null;

    // 1) Yeni format: JSON {"type":"firm","id":"uuid"}
    try {
      const parsed = JSON.parse(text) as { type?: string; id?: string };
      if (parsed.type === 'firm' && parsed.id) {
        firmaId = parsed.id;
      }
    } catch { /* JSON değil, devam */ }

    // 2) Direkt UUID
    if (!firmaId) {
      const uuidMatch = text.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      if (uuidMatch) firmaId = text.trim();
    }

    // 3) URL içinde firma_id parametresi
    if (!firmaId) {
      firmaId = text.match(/firma[_-]?id=([0-9a-f-]{36})/i)?.[1] ?? null;
    }

    // 4) URL path'inden son UUID segment
    if (!firmaId) {
      const segments = text.replace(/[?#].*/, '').split('/').filter(Boolean);
      const last = segments[segments.length - 1] ?? '';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last)) {
        firmaId = last;
      }
    }

    if (!firmaId) {
      addToast('Geçersiz QR kodu. Firma QR\'ı değil veya okunamadı.', 'error');
      return;
    }

    if (aktifZiyaret) {
      if (aktifZiyaret.firma_org_id === firmaId) {
        void handleCheckOut();
      } else {
        addToast(`Farklı firmada aktif ziyaretiniz var (${aktifZiyaret.firma_ad}). Önce bitirin.`, 'error');
      }
    } else {
      // QR ile check-in — firma atanmış olmasına gerek yok
      void handleCheckIn(firmaId, true);
    }
  }, [aktifZiyaret, handleCheckIn, handleCheckOut, addToast]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Bugün';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Dün';
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <i className="ri-loader-4-line text-xl animate-spin" style={{ color: '#0EA5E9' }} />
        <span className="text-sm" style={{ color: '#475569' }}>Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── AKTİF ZİYARET KARTI ── */}
      {aktifZiyaret ? (
        <div className="rounded-2xl p-5" style={{ background: 'rgba(14,165,233,0.07)', border: '2px solid rgba(14,165,233,0.3)' }}>
          {/* Pulse indicator */}
          <div className="flex items-center gap-2.5 mb-4">
            <div className="relative flex-shrink-0">
              <div className="w-3 h-3 rounded-full" style={{ background: '#0EA5E9' }} />
              <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(14,165,233,0.4)' }} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0EA5E9' }}>Aktif Ziyaret</span>
            {aktifZiyaret.qr_ile_giris && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(14,165,233,0.15)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.3)' }}>
                <i className="ri-qr-code-line mr-0.5" />QR ile giriş
              </span>
            )}
          </div>

          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)' }}>
              <i className="ri-building-2-line text-xl" style={{ color: '#0EA5E9' }} />
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {aktifZiyaret.firma_ad ?? 'Bilinmeyen Firma'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                Giriş: {formatTime(aktifZiyaret.giris_saati)}
              </p>
            </div>
          </div>

          {/* Süre sayacı */}
          <div className="flex items-center justify-center py-3 rounded-xl mb-4"
            style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.15)' }}>
            <div className="text-center">
              <p className="text-xs font-semibold mb-1" style={{ color: '#64748B' }}>Geçen Süre</p>
              <p className="text-2xl font-extrabold font-mono" style={{ color: '#0EA5E9', letterSpacing: '0.05em' }}>
                {elapsed || '00d 00s'}
              </p>
            </div>
          </div>

          <button
            onClick={handleCheckOut}
            disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold text-white cursor-pointer transition-all"
            style={{ background: actionLoading ? '#64748B' : 'linear-gradient(135deg, #EF4444, #DC2626)', opacity: actionLoading ? 0.7 : 1 }}>
            {actionLoading
              ? <><i className="ri-loader-4-line animate-spin" />İşleniyor...</>
              : <><i className="ri-logout-box-r-line text-base" />Ziyareti Bitir (Check-out)</>}
          </button>
        </div>
      ) : (
        /* ── CHECK-IN ALANI ── */
        <div className="space-y-3">
          {/* QR ile başlat */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(14,165,233,0.2)', background: 'rgba(255,255,255,0.02)' }}>
            {showQr ? (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Firma QR Kodunu Okut</p>
                  <button onClick={() => setShowQr(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
                <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
                <p className="text-center text-xs mt-2" style={{ color: '#64748B' }}>
                  Firmanın QR kodunu tarat → otomatik check-in yapılır
                </p>
              </div>
            ) : (
              <button
                onClick={() => setShowQr(true)}
                className="w-full flex flex-col items-center justify-center gap-3 py-8 cursor-pointer transition-all"
                style={{ background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                <div className="relative">
                  <div className="w-20 h-20 flex items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(14,165,233,0.08)', border: '2px dashed rgba(14,165,233,0.3)' }}>
                    <i className="ri-qr-scan-2-line text-4xl" style={{ color: '#0EA5E9' }} />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold" style={{ color: '#0EA5E9' }}>QR ile Ziyaret Başlat</p>
                  <p className="text-xs mt-1" style={{ color: '#475569' }}>Firma QR kodunu okutun — anında check-in</p>
                </div>
              </button>
            )}
          </div>

          {/* Manuel firma seçimi */}
          {atanmisFirmalar.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: '#64748B' }}>
                <i className="ri-building-2-line mr-1" />Manuel Firma Seç
              </p>
              <div className="space-y-1.5 mb-3">
                {atanmisFirmalar.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setManuelFirmaId(f.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-left"
                    style={{
                      background: manuelFirmaId === f.id ? 'rgba(14,165,233,0.1)' : 'rgba(255,255,255,0.03)',
                      border: manuelFirmaId === f.id ? '1.5px solid rgba(14,165,233,0.35)' : '1.5px solid rgba(255,255,255,0.07)',
                    }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={manuelFirmaId === f.id
                        ? { background: '#0EA5E9' }
                        : { background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)' }}>
                      {manuelFirmaId === f.id && <i className="ri-check-line text-white text-[10px]" />}
                    </div>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(14,165,233,0.1)' }}>
                      <i className="ri-building-2-line text-xs" style={{ color: '#0EA5E9' }} />
                    </div>
                    <p className="text-xs font-semibold flex-1 truncate"
                      style={{ color: manuelFirmaId === f.id ? '#0EA5E9' : 'var(--text-primary)' }}>
                      {f.name}
                    </p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => { if (manuelFirmaId) void handleCheckIn(manuelFirmaId, false); }}
                disabled={!manuelFirmaId || actionLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white cursor-pointer transition-all"
                style={{
                  background: manuelFirmaId && !actionLoading ? 'linear-gradient(135deg, #0284C7, #0EA5E9)' : '#334155',
                  opacity: (!manuelFirmaId || actionLoading) ? 0.6 : 1,
                }}>
                {actionLoading
                  ? <><i className="ri-loader-4-line animate-spin" />Başlatılıyor...</>
                  : <><i className="ri-login-box-line" />Ziyareti Başlat</>}
              </button>
            </div>
          )}

          {atanmisFirmalar.length === 0 && !showQr && (
            <div className="rounded-2xl p-5" style={{ background: 'rgba(14,165,233,0.05)', border: '1px dashed rgba(14,165,233,0.3)' }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ background: 'rgba(14,165,233,0.1)' }}>
                  <i className="ri-qr-scan-2-line text-base" style={{ color: '#0EA5E9' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    QR kod okutarak ziyaret başlatabilirsiniz
                  </p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#64748B' }}>
                    Firmanın QR kodunu tarat — sistem otomatik check-in yapar.
                    Manuel seçim için OSGB admininizden firma ataması talep edin.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ZİYARET GEÇMİŞİ ── */}
      {gecmis.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>
            Son Ziyaretler
          </p>
          <div className="space-y-2">
            {gecmis.map(z => (
              <div key={z.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(148,163,184,0.1)' }}>
                  <i className="ri-building-2-line text-xs" style={{ color: '#94A3B8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {z.firma_ad ?? '—'}
                  </p>
                  <p className="text-[10px]" style={{ color: '#475569' }}>
                    {formatDate(z.giris_saati)} · {formatTime(z.giris_saati)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {z.qr_ile_giris && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>QR</span>
                  )}
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(148,163,184,0.1)', color: '#94A3B8' }}>Tamamlandı</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
