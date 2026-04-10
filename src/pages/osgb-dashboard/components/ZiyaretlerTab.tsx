import { useState, useMemo } from 'react';
import { mockZiyaretler, mockUzmanlar, mockFirmalar, MockZiyaret } from '@/mocks/ziyaretler';
import ZiyaretDetayPanel from './ZiyaretDetayPanel';

interface ZiyaretlerTabProps {
  isDark: boolean;
}

type DateFilter = 'bugun' | 'bu_hafta' | 'ozel';

function calcDuration(giris: string, cikis: string | null): string {
  const end = cikis ? new Date(cikis) : new Date();
  const diff = Math.max(0, end.getTime() - new Date(giris).getTime());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function isThisWeek(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1);
  startOfWeek.setHours(0, 0, 0, 0);
  return d >= startOfWeek;
}

export default function ZiyaretlerTab({ isDark }: ZiyaretlerTabProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('bugun');
  const [ozelDate, setOzelDate] = useState('');
  const [uzmanFilter, setUzmanFilter] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [secilenZiyaret, setSecilenZiyaret] = useState<MockZiyaret | null>(null);
  const [ziyaretler, setZiyaretler] = useState<MockZiyaret[]>(mockZiyaretler);

  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#64748b' : '#64748b';
  const textSecondary = isDark ? '#94a3b8' : '#475569';
  const cardBg = isDark ? '#1e2a3a' : '#ffffff';
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const rowBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)';
  const rowHover = isDark ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.04)';
  const rowActive = isDark ? 'rgba(16,185,129,0.09)' : 'rgba(16,185,129,0.06)';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';
  const headBg = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(15,23,42,0.04)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)';

  const filtered = useMemo(() => {
    return ziyaretler.filter(z => {
      if (dateFilter === 'bugun' && !isToday(z.giris_saati)) return false;
      if (dateFilter === 'bu_hafta' && !isThisWeek(z.giris_saati)) return false;
      if (dateFilter === 'ozel' && ozelDate) {
        const d = new Date(z.giris_saati).toISOString().split('T')[0];
        if (d !== ozelDate) return false;
      }
      if (uzmanFilter && z.uzman_id !== uzmanFilter) return false;
      if (firmaFilter && z.firma_id !== firmaFilter) return false;
      return true;
    });
  }, [ziyaretler, dateFilter, ozelDate, uzmanFilter, firmaFilter]);

  const aktifler = filtered.filter(z => z.durum === 'aktif');
  const tamamlananlar = filtered.filter(z => z.durum === 'tamamlandi');
  const sorted = [...aktifler, ...tamamlananlar];

  // Stats
  const bugunToplam = ziyaretler.filter(z => isToday(z.giris_saati)).length;
  const aktifSahadaki = ziyaretler.filter(z => z.durum === 'aktif').length;
  const toplamTum = ziyaretler.length;
  const tamamlananSureleri = ziyaretler
    .filter(z => z.durum === 'tamamlandi' && z.cikis_saati)
    .map(z => new Date(z.cikis_saati!).getTime() - new Date(z.giris_saati).getTime());
  const ortSure = tamamlananSureleri.length > 0
    ? Math.round(tamamlananSureleri.reduce((a, b) => a + b, 0) / tamamlananSureleri.length / 60000)
    : 0;

  const handleBitir = (id: string) => {
    setZiyaretler(prev => prev.map(z =>
      z.id === id ? { ...z, durum: 'tamamlandi' as const, cikis_saati: new Date().toISOString() } : z
    ));
    if (secilenZiyaret?.id === id) setSecilenZiyaret(null);
  };

  const dateFilterBtns: { id: DateFilter; label: string }[] = [
    { id: 'bugun', label: 'Bugün' },
    { id: 'bu_hafta', label: 'Bu Hafta' },
    { id: 'ozel', label: 'Özel Tarih' },
  ];

  return (
    <div className="space-y-4 page-enter">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Bugünkü Ziyaret',
            value: bugunToplam,
            icon: 'ri-calendar-check-line',
            color: '#10B981',
            bg: 'rgba(16,185,129,0.1)',
            border: 'rgba(16,185,129,0.18)',
            trend: '+2 dün',
          },
          {
            label: 'Aktif Sahadaki',
            value: aktifSahadaki,
            icon: 'ri-map-pin-user-line',
            color: '#F59E0B',
            bg: 'rgba(245,158,11,0.1)',
            border: 'rgba(245,158,11,0.18)',
            trend: 'Sahada',
          },
          {
            label: 'Toplam Ziyaret',
            value: toplamTum,
            icon: 'ri-route-line',
            color: '#06B6D4',
            bg: 'rgba(6,182,212,0.1)',
            border: 'rgba(6,182,212,0.18)',
            trend: 'Tüm zamanlar',
          },
          {
            label: 'Ort. Ziyaret Süresi',
            value: `${ortSure} dk`,
            icon: 'ri-time-line',
            color: '#8B5CF6',
            bg: 'rgba(139,92,246,0.1)',
            border: 'rgba(139,92,246,0.18)',
            trend: 'Tamamlanan',
          },
        ].map((s, i) => (
          <div
            key={s.label}
            className="rounded-2xl p-4 stat-card stagger-item"
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              animationDelay: `${i * 0.06}s`,
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}
              >
                <i className={`${s.icon} text-base`} style={{ color: s.color }} />
              </div>
              {aktifSahadaki > 0 && s.label === 'Aktif Sahadaki' && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: '#10B981', boxShadow: '0 0 6px rgba(16,185,129,0.6)', animation: 'status-pulse 2s ease-in-out infinite' }}
                />
              )}
            </div>
            <p
              className="text-2xl font-extrabold mb-0.5"
              style={{ color: textPrimary, letterSpacing: '-0.03em' }}
            >
              {s.value}
            </p>
            <p className="text-[11px] font-medium" style={{ color: textMuted }}>{s.label}</p>
            <p className="text-[9.5px] font-semibold mt-1" style={{ color: s.color }}>{s.trend}</p>
          </div>
        ))}
      </div>

      {/* ── Filtreler ── */}
      <div
        className="rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3"
        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
      >
        {/* Date filter tabs */}
        <div
          className="flex items-center gap-0.5 p-1 rounded-xl"
          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border: `1px solid ${dividerColor}` }}
        >
          {dateFilterBtns.map(btn => (
            <button
              key={btn.id}
              onClick={() => setDateFilter(btn.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-all duration-150"
              style={{
                background: dateFilter === btn.id
                  ? isDark ? '#1e3a2e' : '#ffffff'
                  : 'transparent',
                color: dateFilter === btn.id ? '#10B981' : textMuted,
                border: dateFilter === btn.id ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Özel tarih input */}
        {dateFilter === 'ozel' && (
          <input
            type="date"
            value={ozelDate}
            onChange={e => setOzelDate(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl outline-none cursor-pointer"
            style={{
              background: inputBg,
              border: `1px solid ${inputBorder}`,
              color: textPrimary,
            }}
          />
        )}

        {/* Uzman filtre */}
        <select
          value={uzmanFilter}
          onChange={e => setUzmanFilter(e.target.value)}
          className="text-xs px-3 py-2 rounded-xl outline-none cursor-pointer"
          style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textPrimary }}
        >
          <option value="">Tüm Uzmanlar</option>
          {mockUzmanlar.map(u => (
            <option key={u.id} value={u.id}>{u.ad}</option>
          ))}
        </select>

        {/* Firma filtre */}
        <select
          value={firmaFilter}
          onChange={e => setFirmaFilter(e.target.value)}
          className="text-xs px-3 py-2 rounded-xl outline-none cursor-pointer"
          style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textPrimary }}
        >
          <option value="">Tüm Firmalar</option>
          {mockFirmalar.map(f => (
            <option key={f.id} value={f.id}>{f.ad}</option>
          ))}
        </select>

        {/* Reset */}
        {(uzmanFilter || firmaFilter) && (
          <button
            onClick={() => { setUzmanFilter(''); setFirmaFilter(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
          >
            <i className="ri-close-line text-xs" />
            Temizle
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: textMuted }}>
            {sorted.length} ziyaret
          </span>
          {aktifler.length > 0 && (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981', animation: 'status-pulse 2s ease-in-out infinite' }} />
              {aktifler.length} Aktif
            </span>
          )}
        </div>
      </div>

      {/* ── Tablo ── */}
      {sorted.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-16 gap-4"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}
          >
            <i className="ri-map-pin-2-line text-2xl" style={{ color: '#10B981' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold mb-1" style={{ color: textPrimary }}>Bu dönemde ziyaret bulunamadı</p>
            <p className="text-xs" style={{ color: textMuted }}>Farklı bir tarih filtresi veya uzman/firma seçin</p>
          </div>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          {/* Table header */}
          <div
            className="overflow-x-auto"
          >
            <table className="w-full min-w-[720px]">
              <thead>
                <tr style={{ background: headBg, borderBottom: `1px solid ${dividerColor}` }}>
                  {['Uzman', 'Firma', 'Giriş', 'Çıkış', 'Süre', 'Durum', 'Konum', ''].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                      style={{ color: textMuted }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((z, i) => {
                  const isAktif = z.durum === 'aktif';
                  const duration = calcDuration(z.giris_saati, z.cikis_saati);

                  return (
                    <tr
                      key={z.id}
                      className="cursor-pointer transition-all duration-150"
                      style={{
                        borderBottom: i < sorted.length - 1 ? `1px solid ${dividerColor}` : 'none',
                        background: isAktif ? rowActive : rowBg,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = rowHover; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isAktif ? rowActive : rowBg; }}
                      onClick={() => setSecilenZiyaret(z)}
                    >
                      {/* Uzman */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
                            style={{
                              background: isAktif
                                ? 'linear-gradient(135deg, #10B981, #059669)'
                                : isDark ? 'linear-gradient(135deg, #334155, #475569)' : 'linear-gradient(135deg, #64748b, #475569)',
                            }}
                          >
                            {z.uzman_ad.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold truncate" style={{ color: textPrimary }}>{z.uzman_ad}</p>
                            <p className="text-[9.5px] truncate" style={{ color: textMuted }}>{z.uzman_email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Firma */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
                            style={{ background: 'rgba(16,185,129,0.1)' }}
                          >
                            <i className="ri-building-3-line text-[10px]" style={{ color: '#059669' }} />
                          </div>
                          <span className="text-[12px] font-medium whitespace-nowrap" style={{ color: textSecondary }}>{z.firma_ad}</span>
                        </div>
                      </td>

                      {/* Giriş */}
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-[12px] font-semibold tabular-nums" style={{ color: '#10B981' }}>{fmtTime(z.giris_saati)}</p>
                          <p className="text-[9.5px]" style={{ color: textMuted }}>
                            {new Date(z.giris_saati).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      </td>

                      {/* Çıkış */}
                      <td className="px-4 py-3">
                        {z.cikis_saati ? (
                          <div>
                            <p className="text-[12px] font-semibold tabular-nums" style={{ color: textPrimary }}>{fmtTime(z.cikis_saati)}</p>
                            <p className="text-[9.5px]" style={{ color: textMuted }}>
                              {new Date(z.cikis_saati).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: '#10B981', animation: 'status-pulse 2s ease-in-out infinite' }}
                            />
                            <span className="text-[11px] font-semibold" style={{ color: '#10B981' }}>Devam</span>
                          </div>
                        )}
                      </td>

                      {/* Süre */}
                      <td className="px-4 py-3">
                        <span
                          className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                          style={{
                            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
                            color: isAktif ? '#10B981' : textSecondary,
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'}`,
                          }}
                        >
                          {duration}
                        </span>
                      </td>

                      {/* Durum */}
                      <td className="px-4 py-3">
                        <span
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap w-fit"
                          style={{
                            background: isAktif ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                            border: `1px solid ${isAktif ? 'rgba(16,185,129,0.25)' : 'rgba(100,116,139,0.2)'}`,
                            color: isAktif ? '#10B981' : '#64748b',
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{
                              background: isAktif ? '#10B981' : '#64748b',
                              animation: isAktif ? 'status-pulse 2s ease-in-out infinite' : 'none',
                            }}
                          />
                          {isAktif ? 'Aktif' : 'Tamamlandı'}
                        </span>
                      </td>

                      {/* Konum */}
                      <td className="px-4 py-3">
                        {z.konum_lat ? (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-6 h-6 flex items-center justify-center rounded-lg"
                              style={{ background: 'rgba(16,185,129,0.1)' }}
                            >
                              <i className="ri-map-pin-2-fill text-[10px]" style={{ color: '#10B981' }} />
                            </div>
                            <span className="text-[10px] font-medium" style={{ color: '#10B981' }}>GPS</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-6 h-6 flex items-center justify-center rounded-lg"
                              style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }}
                            >
                              <i className="ri-map-pin-line text-[10px]" style={{ color: textMuted }} />
                            </div>
                            <span className="text-[10px] font-medium" style={{ color: textMuted }}>—</span>
                          </div>
                        )}
                      </td>

                      {/* Detay */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {z.qr_ile_giris && (
                            <div
                              title="QR ile Giriş"
                              className="w-6 h-6 flex items-center justify-center rounded-lg"
                              style={{ background: 'rgba(16,185,129,0.1)' }}
                            >
                              <i className="ri-qr-code-line text-[10px]" style={{ color: '#10B981' }} />
                            </div>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); setSecilenZiyaret(z); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10.5px] font-semibold cursor-pointer whitespace-nowrap transition-all duration-150"
                            style={{
                              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
                              border: `1px solid ${dividerColor}`,
                              color: textSecondary,
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.1)';
                              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.25)';
                              (e.currentTarget as HTMLElement).style.color = '#10B981';
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)';
                              (e.currentTarget as HTMLElement).style.borderColor = dividerColor;
                              (e.currentTarget as HTMLElement).style.color = textSecondary;
                            }}
                          >
                            <i className="ri-eye-line text-[10px]" />
                            Detay
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer summary */}
          {sorted.length > 0 && (
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: `1px solid ${dividerColor}` }}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
                  <span className="text-[10.5px] font-semibold" style={{ color: textMuted }}>
                    {aktifler.length} aktif
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: '#64748b' }} />
                  <span className="text-[10.5px] font-semibold" style={{ color: textMuted }}>
                    {tamamlananlar.length} tamamlandı
                  </span>
                </div>
              </div>
              <span className="text-[10.5px] font-semibold" style={{ color: textMuted }}>
                Toplam {sorted.length} kayıt
              </span>
            </div>
          )}
        </div>
      )}

      {/* Detay paneli */}
      {secilenZiyaret && (
        <ZiyaretDetayPanel
          ziyaret={secilenZiyaret}
          isDark={isDark}
          onClose={() => setSecilenZiyaret(null)}
          onBitir={handleBitir}
        />
      )}
    </div>
  );
}
