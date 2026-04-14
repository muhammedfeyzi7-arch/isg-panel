import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useQueryCache } from '@/hooks/useQueryCache';
import { useCountUp } from '@/hooks/useCountUp';

const SUPABASE_FUNC_URL = 'https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/openai-assistant';

interface Props {
  atanmisFirmaIds: string[];
  isDark: boolean;
}

interface Stats {
  firmaCount: number;
  personelCount: number;
  uygunsuzlukAcik: number;
  uygunsuzlukKapali: number;
  ekipmanCount: number;
  ekipmanUygunDegil: number;
  izinBekleyen: number;
  egitimCount: number;
  tutanakCount: number;
  saglikCount: number;
  gecikmisBelge: number;
  gecikmisEkipman: number;
  yaklasan7: number;
  yaklasan30: number;
}

interface AiAnalysis {
  genel_yorum: string;
  en_acil: string;
  oneriler: string[];
  risk_seviyesi: 'Düşük' | 'Orta' | 'Yüksek' | 'Kritik';
}

/* ── Shared kart style ──────────────────────────────────────── */
function useCardStyle(isDark: boolean) {
  return {
    background: isDark
      ? 'linear-gradient(145deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)'
      : 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}`,
    borderRadius: '20px',
  } as React.CSSProperties;
}

/* ── Premium StatCard (ana panelle birebir aynı) ──────────────── */
interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  sub: string;
  accentColor: string;
  barGrad: string;
  iconGrad: string;
  accentBorder: string;
  accentLight: string;
  trend?: { pct: number; dir: 'up' | 'down' } | null;
  badgeText?: string;
  isDark: boolean;
  delay?: number;
  alertPulse?: boolean;
}

function PremStatCard({
  label, value, icon, sub, accentColor, barGrad, iconGrad, accentBorder, accentLight,
  trend, badgeText, isDark, delay = 0, alertPulse,
}: StatCardProps) {
  const animated = useCountUp(value, 900, delay);
  const card = useCardStyle(isDark);

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-default select-none group transition-all duration-300"
      style={card}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 16px 40px ${accentLight}, 0 4px 16px rgba(0,0,0,0.06)`;
        (e.currentTarget as HTMLElement).style.borderColor = accentBorder;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
      }}
    >
      {/* Accent top bar */}
      <div className="h-[3px] w-full" style={{ background: barGrad }} />

      {/* Shimmer blob */}
      <div
        className="absolute top-0 right-0 w-28 h-28 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle, ${accentLight} 0%, transparent 70%)`,
          transform: 'translate(30%, -30%)',
        }}
      />

      <div className="px-5 py-5 relative">
        {/* Top row */}
        <div className="flex items-start justify-between mb-5">
          <div
            className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
            style={{ background: iconGrad, border: `1px solid ${accentBorder}` }}
          >
            <i className={`${icon} text-base`} style={{ color: accentColor }} />
          </div>

          {alertPulse ? (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full animate-pulse whitespace-nowrap"
              style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}35` }}>
              !
            </span>
          ) : trend ? (
            <div className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{
                background: trend.dir === 'up' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color: trend.dir === 'up' ? '#10B981' : '#EF4444',
                border: `1px solid ${trend.dir === 'up' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}
            >
              <i className={`${trend.dir === 'up' ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-[9px]`} />
              {trend.pct}%
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{ background: accentLight, color: accentColor, border: `1px solid ${accentBorder}` }}>
              {badgeText ?? <><i className="ri-check-line text-[9px]" />Güncel</>}
            </div>
          )}
        </div>

        {/* Big number */}
        <div className="mb-1">
          <p
            className="font-black leading-none tabular-nums"
            style={{
              fontSize: 'clamp(2rem, 4vw, 2.6rem)',
              color: isDark ? '#f1f5f9' : '#0f172a',
              letterSpacing: '-0.06em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {animated}
          </p>
        </div>

        {/* Label */}
        <p className="text-sm font-bold mb-3 leading-tight" style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
          {label}
        </p>

        {/* Divider */}
        <div className="h-px mb-3" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }} />

        {/* Sub */}
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: accentColor }} />
          <p className="text-[11px] leading-snug flex-1" style={{ color: isDark ? '#64748b' : '#64748b' }}>
            {sub}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Groq AI Panel ──────────────────────────────────────────────── */
function GroqAiPanel({
  isDark, stats,
}: {
  isDark: boolean;
  stats: Stats;
}) {
  const card = useCardStyle(isDark);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiVisible, setAiVisible] = useState(false);

  const sorunlar = useMemo(() => {
    const list: string[] = [];
    if (stats.uygunsuzlukAcik > 0) list.push(`${stats.uygunsuzlukAcik} açık uygunsuzluk`);
    if (stats.ekipmanUygunDegil > 0) list.push(`${stats.ekipmanUygunDegil} uygun değil ekipman`);
    if (stats.gecikmisBelge > 0) list.push(`${stats.gecikmisBelge} süresi dolmuş belge`);
    if (stats.gecikmisEkipman > 0) list.push(`${stats.gecikmisEkipman} gecikmiş ekipman kontrolü`);
    if (stats.izinBekleyen > 0) list.push(`${stats.izinBekleyen} bekleyen iş izni`);
    return list;
  }, [stats]);

  const kritikSayisi = [stats.uygunsuzlukAcik, stats.ekipmanUygunDegil, stats.gecikmisBelge, stats.gecikmisEkipman]
    .filter(v => v > 0).length;

  const healthScore = useMemo(() => {
    const total = stats.ekipmanCount + stats.personelCount + stats.egitimCount;
    if (total === 0) return 100;
    const penalty = (stats.uygunsuzlukAcik * 3 + stats.ekipmanUygunDegil * 4 + stats.gecikmisBelge * 2 + stats.gecikmisEkipman * 2);
    return Math.max(0, Math.min(100, Math.round(100 - (penalty / Math.max(total, 1)) * 80)));
  }, [stats]);

  const scoreColor = healthScore >= 80 ? '#34D399' : healthScore >= 50 ? '#F59E0B' : '#EF4444';
  const scoreLabel = healthScore >= 80 ? 'İyi' : healthScore >= 50 ? 'Dikkat' : 'Kritik';

  const riskColor: Record<string, string> = {
    'Düşük': '#34D399', 'Orta': '#F59E0B', 'Yüksek': '#F87171', 'Kritik': '#EF4444',
  };

  const fetchAi = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    setAiVisible(true);
    try {
      const res = await fetch(SUPABASE_FUNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'dashboard-ozet',
          data: {
            saglikSkoru: healthScore,
            kritikSayisi,
            uyariSayisi: sorunlar.length,
            bilgiSayisi: 0,
            sorunlar,
          },
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAiAnalysis(json.data as AiAnalysis);
      } else {
        setAiError(json.error || 'Analiz alınamadı');
      }
    } catch {
      setAiError('Bağlantı hatası');
    } finally {
      setAiLoading(false);
    }
  }, [healthScore, kritikSayisi, sorunlar]);

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={card}>
      <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}80)` }} />

      {/* Header */}
      <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}` }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
            <i className="ri-brain-line text-white text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-bold" style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>Akıllı Özet</h3>
            <p className="text-[10px]" style={{ color: isDark ? '#64748b' : '#64748b' }}>Saha & ISG durum analizi</p>
          </div>
          {/* Score ring */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl flex-shrink-0"
            style={{ background: `${scoreColor}15`, border: `1px solid ${scoreColor}30` }}>
            <div className="relative w-8 h-8">
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="12" fill="none" stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'} strokeWidth="3" />
                <circle cx="16" cy="16" r="12" fill="none" stroke={scoreColor} strokeWidth="3"
                  strokeDasharray={`${(healthScore / 100) * 75.4} 75.4`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black" style={{ color: scoreColor }}>
                {healthScore}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-black leading-tight" style={{ color: scoreColor }}>{scoreLabel}</p>
              <p className="text-[9px]" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Sağlık</p>
            </div>
          </div>
        </div>

        {/* Mini count row */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Kritik', count: [stats.uygunsuzlukAcik, stats.ekipmanUygunDegil, stats.gecikmisBelge].filter(v => v > 0).length, color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
            { label: 'Uyarı', count: [stats.izinBekleyen, stats.gecikmisEkipman].filter(v => v > 0).length, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
            { label: 'Takip', count: stats.yaklasan7, color: '#60A5FA', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.18)' },
          ].map(item => (
            <div key={item.label} className="rounded-xl p-2 text-center"
              style={{ background: item.bg, border: `1px solid ${item.border}` }}>
              <p className="text-[15px] font-black" style={{ color: item.count > 0 ? item.color : isDark ? '#475569' : '#94a3b8' }}>
                {item.count}
              </p>
              <p className="text-[9px] font-semibold" style={{ color: item.count > 0 ? item.color : isDark ? '#475569' : '#94a3b8' }}>
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Button */}
      <div className="px-5 pt-3">
        <button
          onClick={fetchAi}
          disabled={aiLoading}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all whitespace-nowrap"
          style={{
            background: aiLoading ? 'rgba(99,102,241,0.08)' : 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.1))',
            border: '1px solid rgba(99,102,241,0.25)',
            color: '#6366F1',
          }}
        >
          {aiLoading ? (
            <>
              <i className="ri-loader-4-line animate-spin text-xs" />
              Groq AI analiz ediyor...
            </>
          ) : (
            <>
              <i className="ri-sparkling-2-line text-xs" />
              Groq AI ile Analiz Et
            </>
          )}
        </button>
      </div>

      {/* AI Result */}
      {aiVisible && (
        <div className="mx-5 mt-3 mb-1 rounded-xl overflow-hidden"
          style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: '1px solid rgba(99,102,241,0.14)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 flex items-center justify-center rounded-md"
                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                <i className="ri-sparkling-2-fill text-white" style={{ fontSize: '8px' }} />
              </div>
              <span className="text-[10px] font-bold" style={{ color: '#6366F1' }}>Groq AI Analizi</span>
              {aiAnalysis && (
                <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{
                    background: `${riskColor[aiAnalysis.risk_seviyesi] ?? '#F59E0B'}18`,
                    color: riskColor[aiAnalysis.risk_seviyesi] ?? '#F59E0B',
                    border: `1px solid ${riskColor[aiAnalysis.risk_seviyesi] ?? '#F59E0B'}30`,
                  }}>
                  Risk: {aiAnalysis.risk_seviyesi}
                </span>
              )}
            </div>
            <button onClick={() => setAiVisible(false)} className="cursor-pointer"
              style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
              <i className="ri-close-line text-xs" />
            </button>
          </div>

          <div className="p-3 space-y-2">
            {aiLoading && (
              <div className="flex flex-col items-center gap-2 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: '#6366F1', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <p className="text-[9.5px]" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                  Llama 3.3 70B analiz ediyor...
                </p>
              </div>
            )}
            {aiError && !aiLoading && (
              <div className="flex items-center gap-1.5 py-2">
                <i className="ri-error-warning-line text-xs" style={{ color: '#EF4444' }} />
                <p className="text-[10px]" style={{ color: '#EF4444' }}>{aiError}</p>
              </div>
            )}
            {aiAnalysis && !aiLoading && (
              <>
                <p className="text-[10.5px] leading-relaxed" style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                  {aiAnalysis.genel_yorum}
                </p>
                <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <i className="ri-alarm-warning-line text-[10px] mt-0.5 flex-shrink-0" style={{ color: '#EF4444' }} />
                  <div>
                    <p className="text-[8.5px] font-bold mb-0.5" style={{ color: '#EF4444' }}>EN ACİL</p>
                    <p className="text-[10px] leading-snug" style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
                      {aiAnalysis.en_acil}
                    </p>
                  </div>
                </div>
                {aiAnalysis.oneriler && aiAnalysis.oneriler.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[8.5px] font-bold" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>ÖNERİLER</p>
                    {aiAnalysis.oneriler.map((oneri, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <div className="w-3.5 h-3.5 flex items-center justify-center rounded-full flex-shrink-0 mt-0.5"
                          style={{ background: 'rgba(99,102,241,0.15)', minWidth: '14px' }}>
                          <span className="text-[7px] font-black" style={{ color: '#6366F1' }}>{idx + 1}</span>
                        </div>
                        <p className="text-[10px] leading-snug" style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                          {oneri}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Insight list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 pt-3 space-y-2" style={{ maxHeight: '340px' }}>
        {sorunlar.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <div className="w-10 h-10 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <i className="ri-shield-check-fill text-base" style={{ color: '#34D399' }} />
            </div>
            <p className="text-[12px] font-bold" style={{ color: '#34D399' }}>Her şey yolunda!</p>
            <p className="text-[10px]" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
              Kritik uyarı bulunmuyor
            </p>
          </div>
        ) : (
          <>
            {stats.uygunsuzlukAcik > 0 && (
              <InsightRow icon="ri-error-warning-fill" title={`${stats.uygunsuzlukAcik} Açık Uygunsuzluk`}
                detail="Kapatılmayı bekliyor" color="#EF4444" level="Kritik" isDark={isDark} />
            )}
            {stats.ekipmanUygunDegil > 0 && (
              <InsightRow icon="ri-tools-fill" title={`${stats.ekipmanUygunDegil} Ekipman Uygun Değil`}
                detail="Müdahale gerekiyor" color="#EF4444" level="Kritik" isDark={isDark} />
            )}
            {stats.gecikmisBelge > 0 && (
              <InsightRow icon="ri-file-damage-line" title={`${stats.gecikmisBelge} Belge Süresi Dolmuş`}
                detail="Güncelleme yapılmalı" color="#F87171" level="Kritik" isDark={isDark} />
            )}
            {stats.gecikmisEkipman > 0 && (
              <InsightRow icon="ri-alarm-warning-fill" title={`${stats.gecikmisEkipman} Ekipman Kontrolü Gecikti`}
                detail="Kontrol planlanmalı" color="#F59E0B" level="Uyarı" isDark={isDark} />
            )}
            {stats.izinBekleyen > 0 && (
              <InsightRow icon="ri-shield-keyhole-fill" title={`${stats.izinBekleyen} İş İzni Onay Bekliyor`}
                detail="İncelemeniz gerekiyor" color="#A78BFA" level="Uyarı" isDark={isDark} />
            )}
            {stats.yaklasan7 > 0 && (
              <InsightRow icon="ri-alarm-warning-line" title={`${stats.yaklasan7} Belge 7 Gün İçinde`}
                detail="Yaklaşan son tarihler" color="#FBBF24" level="Bilgi" isDark={isDark} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InsightRow({ icon, title, detail, color, level, isDark }: {
  icon: string; title: string; detail: string; color: string; level: string; isDark: boolean;
}) {
  const levelColor: Record<string, string> = {
    'Kritik': '#EF4444', 'Uyarı': '#F59E0B', 'Bilgi': '#60A5FA',
  };
  return (
    <div className="flex items-start gap-2.5 rounded-xl p-3"
      style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
      <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
        style={{ background: `${color}18` }}>
        <i className={`${icon} text-[10px]`} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: `${levelColor[level] ?? color}15`, color: levelColor[level] ?? color, border: `1px solid ${levelColor[level] ?? color}28` }}>
            {level}
          </span>
        </div>
        <p className="text-[11px] font-semibold leading-tight" style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>{title}</p>
        <p className="text-[10px] mt-0.5" style={{ color: isDark ? '#64748b' : '#64748b' }}>{detail}</p>
      </div>
    </div>
  );
}

/* ── Ana component ──────────────────────────────────────────────── */
export default function UzmanGenelBakis({ atanmisFirmaIds, isDark }: Props) {
  const cache = useQueryCache<Stats>(3 * 60 * 1000); // 3 dakika cache
  const [stats, setStats] = useState<Stats>({
    firmaCount: 0, personelCount: 0,
    uygunsuzlukAcik: 0, uygunsuzlukKapali: 0,
    ekipmanCount: 0, ekipmanUygunDegil: 0,
    izinBekleyen: 0, egitimCount: 0,
    tutanakCount: 0, saglikCount: 0,
    gecikmisBelge: 0, gecikmisEkipman: 0,
    yaklasan7: 0, yaklasan30: 0,
  });
  const [loading, setLoading] = useState(true);

  const card = useCardStyle(isDark);
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  useEffect(() => {
    if (atanmisFirmaIds.length === 0) { setLoading(false); return; }
    const fetchStats = async () => {
      // Cache kontrolü — aynı firma listesi için daha önce çekilmiş veri varsa kullan
      const cacheKey = `uzman_genel_${atanmisFirmaIds.slice().sort().join(',')}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        setStats(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        const in7   = new Date(Date.now() + 7  * 86400000).toISOString().split('T')[0];
        const in30  = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

        // Tüm tablolarda durum, silinmis vs. kolonlar yok — data JSONB içinde.
        // Sadece deleted_at ile silinmemiş filtresi yapılabilir.
        // Uygunsuzluk açık/kapalı, ekipman durumu için data->'durum' filtrelemesi gerekiyor.
        const [
          { count: personelC },
          { count: uygunsuzlukAcikC },
          { count: uygunsuzlukKapaliC },
          { count: ekipmanC },
          { count: ekipmanUygunDegilC },
          { count: izinC },
          { count: egitimC },
          { count: tutanakC },
          { count: saglikC },
        ] = await Promise.all([
          supabase.from('personeller').select('*',{ count:'exact',head:true }).in('organization_id',atanmisFirmaIds).is('deleted_at', null),
          supabase.from('uygunsuzluklar').select('*',{ count:'exact',head:true }).in('organization_id',atanmisFirmaIds).is('deleted_at', null).not('data->>durum', 'in', '("Kapandı","Kapatıldı","Kapandı")'),
          supabase.from('uygunsuzluklar').select('*',{ count:'exact',head:true }).in('organization_id',atanmisFirmaIds).is('deleted_at', null).or('data->>durum.eq.Kapandı,data->>durum.eq.Kapatıldı'),
          supabase.from('ekipmanlar').select('*',{ count:'exact',head:true }).in('organization_id',atanmisFirmaIds).is('deleted_at', null),
          supabase.from('ekipmanlar').select('*',{ count:'exact',head:true }).in('organization_id',atanmisFirmaIds).is('deleted_at', null).eq('data->>durum', 'Uygun Değil'),
          supabase.from('is_izinleri').select('*',{ count:'exact',head:true }).in('organization_id',atanmisFirmaIds).is('deleted_at', null).eq('data->>durum', 'Onay Bekliyor'),
          supabase.from('egitimler').select('*',{ count:'exact',head:true }).in('organization_id',atanmisFirmaIds).is('deleted_at', null),
          supabase.from('tutanaklar').select('*',{ count:'exact',head:true }).in('organization_id',atanmisFirmaIds).is('deleted_at', null),
          supabase.from('muayeneler').select('*',{ count:'exact',head:true }).in('organization_id',atanmisFirmaIds).is('deleted_at', null),
        ]);

        // Gecikmiş belge: data->>'gecerlilikTarihi' < today filtrelemesi
        // Supabase client ile JSONB text cast + lt/lte kullanılabilir
        const [
          { count: gecikmisBelgeC },
          { count: gecikmisEkipmanC },
          { count: yaklasan7C },
          { count: yaklasan30C },
        ] = await Promise.all([
          supabase.from('evraklar').select('id', { count: 'exact', head: true })
            .in('organization_id', atanmisFirmaIds).is('deleted_at', null)
            .lt('data->>gecerlilikTarihi', today)
            .not('data->>gecerlilikTarihi', 'is', null),
          supabase.from('ekipmanlar').select('id', { count: 'exact', head: true })
            .in('organization_id', atanmisFirmaIds).is('deleted_at', null)
            .lt('data->>sonrakiKontrolTarihi', today)
            .not('data->>sonrakiKontrolTarihi', 'is', null)
            .not('data->>durum', 'eq', 'Uygun Değil'),
          supabase.from('evraklar').select('id', { count: 'exact', head: true })
            .in('organization_id', atanmisFirmaIds).is('deleted_at', null)
            .gte('data->>gecerlilikTarihi', today)
            .lte('data->>gecerlilikTarihi', in7)
            .not('data->>gecerlilikTarihi', 'is', null),
          supabase.from('evraklar').select('id', { count: 'exact', head: true })
            .in('organization_id', atanmisFirmaIds).is('deleted_at', null)
            .gte('data->>gecerlilikTarihi', today)
            .lte('data->>gecerlilikTarihi', in30)
            .not('data->>gecerlilikTarihi', 'is', null),
        ]);

        const newStats: Stats = {
          firmaCount: atanmisFirmaIds.length,
          personelCount: personelC ?? 0,
          uygunsuzlukAcik: uygunsuzlukAcikC ?? 0,
          uygunsuzlukKapali: uygunsuzlukKapaliC ?? 0,
          ekipmanCount: ekipmanC ?? 0,
          ekipmanUygunDegil: ekipmanUygunDegilC ?? 0,
          izinBekleyen: izinC ?? 0,
          egitimCount: egitimC ?? 0,
          tutanakCount: tutanakC ?? 0,
          saglikCount: saglikC ?? 0,
          gecikmisBelge: gecikmisBelgeC,
          gecikmisEkipman: gecikmisEkipmanC,
          yaklasan7: yaklasan7C,
          yaklasan30: yaklasan30C,
        };
        cache.set(cacheKey, newStats);
        setStats(newStats);
      } catch (err) {
        console.error('[UzmanGenelBakis]', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atanmisFirmaIds.join(',')]);

  const toplamKritik = stats.uygunsuzlukAcik + stats.ekipmanUygunDegil + stats.gecikmisBelge;

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-5 animate-pulse" style={{ ...card, height: '168px' }} />
          ))}
        </div>
      </div>
    );
  }

  /* Stat cards config */
  const statCards = [
    {
      label: 'Atanmış Firma',
      value: stats.firmaCount,
      icon: 'ri-building-3-fill',
      sub: stats.firmaCount === 0 ? 'Henüz firma yok' : `${stats.personelCount} toplam personel`,
      accentColor: '#0EA5E9',
      barGrad: 'linear-gradient(90deg, #0EA5E9, #38BDF8)',
      iconGrad: 'linear-gradient(135deg, rgba(14,165,233,0.22), rgba(14,165,233,0.07))',
      accentBorder: 'rgba(14,165,233,0.25)',
      accentLight: 'rgba(14,165,233,0.12)',
    },
    {
      label: 'Toplam Personel',
      value: stats.personelCount,
      icon: 'ri-group-fill',
      sub: `${stats.firmaCount} firmaya dağılmış`,
      accentColor: '#0EA5E9',
      barGrad: 'linear-gradient(90deg, #0EA5E9, #38BDF8)',
      iconGrad: 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(14,165,233,0.06))',
      accentBorder: 'rgba(14,165,233,0.22)',
      accentLight: 'rgba(14,165,233,0.1)',
    },
    {
      label: 'Açık Uygunsuzluk',
      value: stats.uygunsuzlukAcik,
      icon: 'ri-error-warning-fill',
      sub: `${stats.uygunsuzlukKapali} adet kapatılmış`,
      accentColor: stats.uygunsuzlukAcik > 0 ? '#EF4444' : '#22C55E',
      barGrad: stats.uygunsuzlukAcik > 0 ? 'linear-gradient(90deg, #EF4444, #F87171)' : 'linear-gradient(90deg, #22C55E, #34D399)',
      iconGrad: stats.uygunsuzlukAcik > 0 ? 'linear-gradient(135deg, rgba(239,68,68,0.22), rgba(239,68,68,0.07))' : 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.07))',
      accentBorder: stats.uygunsuzlukAcik > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.22)',
      accentLight: stats.uygunsuzlukAcik > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.1)',
      alertPulse: stats.uygunsuzlukAcik > 0,
    },
    {
      label: 'Bekleyen İzin',
      value: stats.izinBekleyen,
      icon: 'ri-shield-keyhole-fill',
      sub: 'Onay bekleyen iş izinleri',
      accentColor: stats.izinBekleyen > 0 ? '#F59E0B' : '#0EA5E9',
      barGrad: stats.izinBekleyen > 0 ? 'linear-gradient(90deg, #F59E0B, #FCD34D)' : 'linear-gradient(90deg, #0EA5E9, #38BDF8)',
      iconGrad: stats.izinBekleyen > 0 ? 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(245,158,11,0.07))' : 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(14,165,233,0.06))',
      accentBorder: stats.izinBekleyen > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(14,165,233,0.22)',
      accentLight: stats.izinBekleyen > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(14,165,233,0.1)',
      alertPulse: stats.izinBekleyen > 0,
    },
    {
      label: 'Toplam Ekipman',
      value: stats.ekipmanCount,
      icon: 'ri-tools-fill',
      sub: stats.ekipmanUygunDegil > 0 ? `${stats.ekipmanUygunDegil} uygun değil` : 'Tümü uygun',
      accentColor: stats.ekipmanUygunDegil > 0 ? '#F97316' : '#0EA5E9',
      barGrad: stats.ekipmanUygunDegil > 0 ? 'linear-gradient(90deg, #F97316, #FB923C)' : 'linear-gradient(90deg, #0EA5E9, #38BDF8)',
      iconGrad: stats.ekipmanUygunDegil > 0 ? 'linear-gradient(135deg, rgba(249,115,22,0.22), rgba(249,115,22,0.07))' : 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(14,165,233,0.06))',
      accentBorder: stats.ekipmanUygunDegil > 0 ? 'rgba(249,115,22,0.25)' : 'rgba(14,165,233,0.22)',
      accentLight: stats.ekipmanUygunDegil > 0 ? 'rgba(249,115,22,0.12)' : 'rgba(14,165,233,0.1)',
      alertPulse: stats.ekipmanUygunDegil > 0,
    },
    {
      label: 'Eğitim Kaydı',
      value: stats.egitimCount,
      icon: 'ri-graduation-cap-fill',
      sub: 'Toplam kayıtlı eğitim',
      accentColor: '#A78BFA',
      barGrad: 'linear-gradient(90deg, #A78BFA, #C4B5FD)',
      iconGrad: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(167,139,250,0.07))',
      accentBorder: 'rgba(167,139,250,0.25)',
      accentLight: 'rgba(167,139,250,0.1)',
    },
    {
      label: 'Tutanak',
      value: stats.tutanakCount,
      icon: 'ri-file-text-fill',
      sub: 'Oluşturulan tutanaklar',
      accentColor: '#22D3EE',
      barGrad: 'linear-gradient(90deg, #22D3EE, #67E8F9)',
      iconGrad: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(34,211,238,0.07))',
      accentBorder: 'rgba(34,211,238,0.25)',
      accentLight: 'rgba(34,211,238,0.1)',
    },
    {
      label: 'Muayene Kaydı',
      value: stats.saglikCount,
      icon: 'ri-heart-pulse-fill',
      sub: 'Sağlık muayene kayıtları',
      accentColor: '#FB7185',
      barGrad: 'linear-gradient(90deg, #FB7185, #FCA5A5)',
      iconGrad: 'linear-gradient(135deg, rgba(251,113,133,0.2), rgba(251,113,133,0.07))',
      accentBorder: 'rgba(251,113,133,0.25)',
      accentLight: 'rgba(251,113,133,0.1)',
    },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header banner ── */}
      <div className="rounded-2xl px-5 py-4 flex items-center justify-between gap-3 flex-wrap" style={card}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.22), rgba(14,165,233,0.08))' }}>
            <i className="ri-dashboard-3-line text-sm" style={{ color: '#0EA5E9' }} />
          </div>
          <div>
            <h1 className="text-[15px] font-black leading-tight" style={{ color: textPrimary, letterSpacing: '-0.03em' }}>
              Genel Bakış
            </h1>
            <p className="text-[11px] mt-0.5 font-medium" style={{ color: textSecondary }}>
              {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} · {stats.firmaCount} atanmış firma
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {toplamKritik > 0 && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full animate-pulse"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
              <i className="ri-error-warning-fill text-[10px]" />
              {toplamKritik} kritik
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', color: '#0EA5E9' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#0EA5E9' }} />
            Sistem Aktif
          </span>
        </div>
      </div>

      {/* ── 8 StatCard ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c, idx) => (
          <PremStatCard
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            sub={c.sub}
            accentColor={c.accentColor}
            barGrad={c.barGrad}
            iconGrad={c.iconGrad}
            accentBorder={c.accentBorder}
            accentLight={c.accentLight}
            alertPulse={(c as { alertPulse?: boolean }).alertPulse}
            isDark={isDark}
            delay={idx * 80}
          />
        ))}
      </div>

      {/* ── Akıllı Özet + ISG Risk ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GroqAiPanel isDark={isDark} stats={stats} />

        {/* ISG Risk Paneli */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={card}>
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #EF4444, #F87171)' }} />
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.22), rgba(239,68,68,0.08))' }}>
                <i className="ri-shield-cross-fill text-sm" style={{ color: '#EF4444' }} />
              </div>
              <div>
                <h3 className="text-[13px] font-bold" style={{ color: textPrimary }}>ISG Risk Paneli</h3>
                <p className="text-[10px]" style={{ color: textSecondary }}>
                  {toplamKritik > 0 ? `${toplamKritik} kritik durum tespit edildi` : 'Tüm sistemler normal'}
                </p>
              </div>
              {toplamKritik > 0 && (
                <span className="ml-auto text-[9.5px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {toplamKritik} kritik
                </span>
              )}
            </div>

            {/* Geciken block */}
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: textSecondary }}>
                <i className="ri-error-warning-line mr-1.5" style={{ color: '#EF4444' }} />Geciken İşlemler
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Belge',    value: stats.gecikmisBelge,   icon: 'ri-file-damage-fill', color: '#F87171' },
                  { label: 'Ekipman',  value: stats.gecikmisEkipman, icon: 'ri-tools-fill',       color: '#F97316' },
                  { label: 'Açık DOF', value: stats.uygunsuzlukAcik, icon: 'ri-alert-fill',       color: '#F87171' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl p-3 text-center"
                    style={{
                      background: item.value > 0 ? `${item.color}15` : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)'),
                      border: `1px solid ${item.value > 0 ? `${item.color}28` : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)')}`,
                    }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-1.5"
                      style={{ background: item.value > 0 ? `${item.color}20` : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)') }}>
                      <i className={`${item.icon} text-xs`} style={{ color: item.value > 0 ? item.color : textSecondary }} />
                    </div>
                    <p className="text-xl font-extrabold" style={{ color: item.value > 0 ? item.color : textSecondary }}>{item.value}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: textSecondary }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Yaklaşan */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: textSecondary }}>
                <i className="ri-timer-line mr-1.5" style={{ color: '#F59E0B' }} />Yaklaşan Kritikler
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl p-3"
                  style={{
                    background: stats.yaklasan7 > 0 ? 'rgba(245,158,11,0.07)' : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)'),
                    border: `1px solid ${stats.yaklasan7 > 0 ? 'rgba(245,158,11,0.2)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)')}`,
                  }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <i className="ri-alarm-warning-fill text-xs" style={{ color: '#F59E0B' }} />
                      <span className="text-[11px] font-bold" style={{ color: textPrimary }}>7 Gün İçinde</span>
                    </div>
                    <span className="text-sm font-black" style={{ color: stats.yaklasan7 > 0 ? '#F59E0B' : textSecondary }}>
                      {stats.yaklasan7}
                    </span>
                  </div>
                  <p className="text-[10px]" style={{ color: textSecondary }}>
                    {stats.yaklasan7 === 0 ? 'Yaklaşan belge yok' : `${stats.yaklasan7} belge süresi dolmak üzere`}
                  </p>
                </div>
                <div className="rounded-xl p-3"
                  style={{
                    background: stats.yaklasan30 > 0 ? 'rgba(251,191,36,0.06)' : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)'),
                    border: `1px solid ${stats.yaklasan30 > 0 ? 'rgba(251,191,36,0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)')}`,
                  }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <i className="ri-timer-fill text-xs" style={{ color: '#FBBF24' }} />
                      <span className="text-[11px] font-bold" style={{ color: textPrimary }}>30 Gün İçinde</span>
                    </div>
                    <span className="text-sm font-black" style={{ color: stats.yaklasan30 > 0 ? '#FBBF24' : textSecondary }}>
                      {stats.yaklasan30}
                    </span>
                  </div>
                  <p className="text-[10px]" style={{ color: textSecondary }}>
                    {stats.yaklasan30 === 0 ? 'Yaklaşan belge yok' : `${stats.yaklasan30} belge takipte`}
                  </p>
                </div>
              </div>
            </div>

            {/* All OK banner */}
            {toplamKritik === 0 && (
              <div className="mt-4 rounded-xl p-3 flex items-center gap-3"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }}>
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(34,197,94,0.15)' }}>
                  <i className="ri-shield-check-fill text-sm" style={{ color: '#22C55E' }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: '#22C55E' }}>Her şey yolunda!</p>
                  <p className="text-xs" style={{ color: textSecondary }}>Kritik uyarı bulunmuyor</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                  <span className="text-[10px] font-semibold" style={{ color: '#22C55E' }}>Sağlıklı</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Progress kartları ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Atanmış Firmalar',
            value: stats.firmaCount,
            total: stats.firmaCount,
            color: '#0EA5E9',
            icon: 'ri-building-3-fill',
            grad: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
          },
          {
            label: 'Toplam Personel',
            value: stats.personelCount,
            total: Math.max(stats.personelCount, 1),
            color: '#38BDF8',
            icon: 'ri-group-fill',
            grad: 'linear-gradient(135deg, #38BDF8, #0EA5E9)',
          },
          {
            label: 'Kapanan DOF Oranı',
            value: stats.uygunsuzlukKapali,
            total: Math.max(stats.uygunsuzlukAcik + stats.uygunsuzlukKapali, 1),
            color: '#22C55E',
            icon: 'ri-checkbox-circle-fill',
            grad: 'linear-gradient(135deg, #22C55E, #16A34A)',
          },
        ].map(item => {
          const pct = Math.round((item.value / item.total) * 100);
          return (
            <div key={item.label} className="rounded-2xl overflow-hidden" style={card}>
              <div className="h-[3px]" style={{ background: item.grad }} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${item.color}18` }}>
                    <i className={`${item.icon} text-xs`} style={{ color: item.color }} />
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: item.color }}>{pct}%</span>
                </div>
                <p className="text-2xl font-black" style={{ color: textPrimary }}>
                  {item.value}
                  <span className="text-xs font-normal ml-1" style={{ color: textSecondary }}>/ {item.total}</span>
                </p>
                <p className="text-[10.5px] mt-0.5 mb-2.5" style={{ color: textSecondary }}>{item.label}</p>
                <div className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: item.grad }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
