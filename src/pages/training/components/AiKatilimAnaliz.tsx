import { useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Personel } from '@/types';

const EDGE_FN_URL = `${
  (import.meta.env.VITE_PUBLIC_SUPABASE_URL as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  ''
}/functions/v1/openai-assistant`;

// ── Türkçe karakter normalize ──
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z\s]/g, '')
    .trim();
}

// ── Levenshtein mesafesi ──
function levenshtein(a: string, b: string): number {
  const m = a.length; const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ── Benzerlik skoru (0-1) ──
function similarity(a: string, b: string): number {
  const na = normalize(a); const nb = normalize(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

// ── En iyi eşleşmeyi bul ──
function findBestMatch(
  aiIsim: string,
  personeller: Personel[],
  esik = 0.72,
): { personel: Personel; skor: number } | null {
  let best: { personel: Personel; skor: number } | null = null;
  for (const p of personeller) {
    const skor = similarity(aiIsim, p.adSoyad);
    if (skor >= esik && (!best || skor > best.skor)) {
      best = { personel: p, skor };
    }
  }
  return best;
}

// ── Tipler ──
type AnalyzState = 'idle' | 'reading' | 'analyzing' | 'done' | 'error';

export interface EslestirmeItem {
  aiIsim: string;
  eslesen: Personel | null;
  skor: number;
  secili: boolean;
  manuelPersonelId: string | null;
}

export interface EgitimMetaBilgi {
  egitimTarihi?: string;
  egitimYeri?: string;
  egitimSuresi?: string;
  egitmen?: string;
  egitmenGorev?: string;
  projeAdi?: string;
  firmaAdi?: string;
}

interface AiKatilimAnalizProps {
  firmaPersoneller: Personel[];
  tumPersoneller: Personel[];
  onEkle: (personelIds: string[]) => void;
  onGorselSecildi?: (base64: string, mimeType: string) => void;
  /** AI kağıttan okunan meta bilgileri formu doldurmak için iletir */
  onMetaOkundu?: (meta: EgitimMetaBilgi) => void;
}

// ── Meta bilgi etiketi için yardımcı ──
const META_LABELS: Record<keyof EgitimMetaBilgi, { label: string; icon: string }> = {
  egitimTarihi: { label: 'Eğitim Tarihi', icon: 'ri-calendar-line' },
  egitimYeri: { label: 'Eğitim Yeri', icon: 'ri-map-pin-line' },
  egitimSuresi: { label: 'Süre', icon: 'ri-time-line' },
  egitmen: { label: 'Eğitmen', icon: 'ri-user-star-line' },
  egitmenGorev: { label: 'Görev/Ünvan', icon: 'ri-briefcase-line' },
  projeAdi: { label: 'Proje/Eğitim Adı', icon: 'ri-bookmark-line' },
  firmaAdi: { label: 'Firma', icon: 'ri-building-line' },
};

export default function AiKatilimAnaliz({
  firmaPersoneller,
  tumPersoneller,
  onEkle,
  onGorselSecildi,
  onMetaOkundu,
}: AiKatilimAnalizProps) {
  const [state, setState] = useState<AnalyzState>('idle');
  const [hata, setHata] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [dosyaAdi, setDosyaAdi] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [eslestirmeler, setEslestirmeler] = useState<EslestirmeItem[]>([]);
  const [metaBilgi, setMetaBilgi] = useState<EgitimMetaBilgi | null>(null);
  const [metaUygulandiMi, setMetaUygulandiMi] = useState(false);
  const [eklendi, setEklendi] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setState('idle');
    setHata('');
    setPreview(null);
    setDosyaAdi('');
    setEslestirmeler([]);
    setMetaBilgi(null);
    setMetaUygulandiMi(false);
    setEklendi(false);
  };

  const seciliSayisi = useMemo(
    () => eslestirmeler.filter(e => e.secili && (e.eslesen || e.manuelPersonelId)).length,
    [eslestirmeler],
  );

  const eslesmeSayisi = useMemo(
    () => eslestirmeler.filter(e => e.eslesen !== null).length,
    [eslestirmeler],
  );

  // Meta bilgide kaç alan dolu?
  const metaDoluSayisi = useMemo(() => {
    if (!metaBilgi) return 0;
    return Object.values(metaBilgi).filter(v => v && v.trim()).length;
  }, [metaBilgi]);

  const analizeEt = useCallback(async (file: File) => {
    const desteklenen = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!desteklenen.includes(file.type)) {
      setHata('Sadece JPG, PNG veya WEBP formatı desteklenmektedir.');
      setState('error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setHata('Dosya boyutu 10MB\'ı geçemez.');
      setState('error');
      return;
    }

    setDosyaAdi(file.name);
    setState('reading');
    setHata('');
    setEslestirmeler([]);
    setMetaBilgi(null);
    setMetaUygulandiMi(false);
    setEklendi(false);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setPreview(`data:${file.type};base64,${base64}`);
      onGorselSecildi?.(base64, file.type);
      setState('analyzing');

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? '';

      const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mode: 'egitim-katilim-analiz',
          data: { imageBase64: base64, mimeType: file.type },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Sunucu hatası' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Analiz başarısız');

      const bulunanIsimler: string[] = result.isimler ?? [];
      const okunanMeta: EgitimMetaBilgi = result.meta ?? {};

      // Meta bilgileri kaydet
      const metaDolu = Object.values(okunanMeta).some(v => v && v.trim());
      if (metaDolu) {
        setMetaBilgi(okunanMeta);
      }

      // Eşleştirme
      const hedefPersoneller = firmaPersoneller.length > 0 ? firmaPersoneller : tumPersoneller;
      const items: EslestirmeItem[] = bulunanIsimler.map(aiIsim => {
        const match = findBestMatch(aiIsim, hedefPersoneller);
        return {
          aiIsim,
          eslesen: match?.personel ?? null,
          skor: match?.skor ?? 0,
          secili: match !== null,
          manuelPersonelId: null,
        };
      });

      setEslestirmeler(items);
      setState('done');

    } catch (err) {
      console.error('[AI Katılım]', err);
      setHata(err instanceof Error ? err.message : 'Bilinmeyen hata');
      setState('error');
    }
  }, [firmaPersoneller, tumPersoneller, onGorselSecildi]);

  const handleFile = (file: File | undefined) => { if (file) analizeEt(file); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const toggleSecim = (idx: number) => {
    setEslestirmeler(prev => prev.map((e, i) => i === idx ? { ...e, secili: !e.secili } : e));
  };

  const setManuelPersonel = (idx: number, personelId: string) => {
    setEslestirmeler(prev => prev.map((e, i) =>
      i === idx ? { ...e, manuelPersonelId: personelId || null, secili: !!personelId } : e,
    ));
  };

  const handleEkle = () => {
    const ids = eslestirmeler
      .filter(e => e.secili)
      .map(e => e.manuelPersonelId ?? e.eslesen?.id)
      .filter((id): id is string => !!id);
    if (ids.length === 0) return;
    onEkle(ids);
    setEklendi(true);
  };

  // Meta bilgileri forma uygula
  const handleMetaUygula = () => {
    if (!metaBilgi) return;
    onMetaOkundu?.(metaBilgi);
    setMetaUygulandiMi(true);
  };

  const isLoading = state === 'reading' || state === 'analyzing';

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(129,140,248,0.25)', background: 'rgba(129,140,248,0.03)' }}>
      {/* Başlık */}
      <div className="flex items-center gap-2.5 px-4 py-3"
        style={{ borderBottom: '1px solid rgba(129,140,248,0.15)', background: 'rgba(129,140,248,0.07)' }}>
        <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: 'rgba(129,140,248,0.18)', border: '1px solid rgba(129,140,248,0.3)' }}>
          <i className="ri-sparkling-2-line text-sm" style={{ color: '#818CF8' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>AI Katılım Asistanı</p>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(129,140,248,0.15)', color: '#818CF8', border: '1px solid rgba(129,140,248,0.25)' }}>
              BETA
            </span>
          </div>
          <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
            Katılım listesi görselini yükle → AI tarih, eğitmen, isimleri okusun → Forma otomatik doldur
          </p>
        </div>
        {state !== 'idle' && (
          <button onClick={reset}
            className="w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            title="Sıfırla">
            <i className="ri-refresh-line text-sm" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">

        {/* ── IDLE / ERROR: Yükleme alanı ── */}
        {(state === 'idle' || state === 'error') && (
          <>
            <div
              className="rounded-xl p-5 text-center cursor-pointer transition-all duration-200 select-none"
              style={{
                border: `2px dashed ${isDragging ? '#818CF8' : 'rgba(129,140,248,0.25)'}`,
                background: isDragging ? 'rgba(129,140,248,0.08)' : 'var(--bg-input)',
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#818CF8'; e.currentTarget.style.background = 'rgba(129,140,248,0.05)'; }}
              onMouseLeave={e => { if (!isDragging) { e.currentTarget.style.borderColor = 'rgba(129,140,248,0.25)'; e.currentTarget.style.background = 'var(--bg-input)'; } }}
            >
              <div className="w-10 h-10 flex items-center justify-center rounded-xl mx-auto mb-3"
                style={{ background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.2)' }}>
                <i className="ri-image-add-line text-xl" style={{ color: '#818CF8' }} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Katılım listesi görselini yükle
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                JPG, PNG, WEBP • Maks. 10MB • Sürükle bırak veya tıkla
              </p>
            </div>
            {state === 'error' && hata && (
              <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <i className="ri-error-warning-line text-sm mt-0.5 flex-shrink-0" style={{ color: '#EF4444' }} />
                <p className="text-xs" style={{ color: '#EF4444' }}>{hata}</p>
              </div>
            )}
          </>
        )}

        {/* ── LOADING ── */}
        {isLoading && (
          <div className="space-y-3">
            {preview && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                <img src={preview} alt="Yüklenen görsel" className="w-full max-h-36 object-contain"
                  style={{ background: 'var(--bg-input)' }} />
              </div>
            )}
            <div className="flex items-center gap-3 rounded-xl px-4 py-3.5"
              style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)' }}>
              <div className="relative w-8 h-8 flex-shrink-0">
                <div className="absolute inset-0 rounded-full animate-ping opacity-60"
                  style={{ background: 'rgba(129,140,248,0.4)', animationDuration: '1.2s' }} />
                <div className="relative w-8 h-8 flex items-center justify-center rounded-full"
                  style={{ background: 'rgba(129,140,248,0.2)' }}>
                  <i className="ri-sparkling-2-line text-sm" style={{ color: '#818CF8' }} />
                </div>
              </div>
              <div>
                <p className="text-[12.5px] font-semibold" style={{ color: '#818CF8' }}>
                  {state === 'reading' ? 'Görsel okunuyor...' : 'AI formu analiz ediyor...'}
                </p>
                <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                  {state === 'reading' ? 'Dosya hazırlanıyor' : 'Tarih, eğitmen, katılımcılar tespit ediliyor...'}
                </p>
              </div>
            </div>
            {/* Adım göstergesi */}
            <div className="flex items-center gap-1.5">
              {[
                { label: 'Dosya Okunuyor', done: state !== 'reading', active: state === 'reading' },
                { label: 'AI Analiz', done: false, active: state === 'analyzing' },
                { label: 'Eşleştirme', done: false, active: false },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-1.5 flex-1">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold"
                    style={{
                      background: step.done ? 'rgba(16,185,129,0.2)' : step.active ? 'rgba(129,140,248,0.2)' : 'var(--bg-input)',
                      border: `1px solid ${step.done ? 'rgba(16,185,129,0.4)' : step.active ? 'rgba(129,140,248,0.4)' : 'var(--border-main)'}`,
                      color: step.done ? '#10B981' : step.active ? '#818CF8' : 'var(--text-faint)',
                    }}>
                    {step.done ? <i className="ri-check-line" /> : i + 1}
                  </div>
                  <span className="text-[10px] truncate" style={{ color: step.active ? '#818CF8' : 'var(--text-faint)' }}>{step.label}</span>
                  {i < 2 && <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {state === 'done' && (
          <div className="space-y-3">
            {/* Küçük önizleme + özet */}
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
              {preview && (
                <img src={preview} alt="Analiz edilen görsel"
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  style={{ border: '1px solid var(--border-subtle)' }} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{dosyaAdi}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {metaDoluSayisi > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(129,140,248,0.12)', color: '#818CF8' }}>
                      {metaDoluSayisi} bilgi okundu
                    </span>
                  )}
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
                    {eslesmeSayisi} isim eşleşti
                  </span>
                  {eslestirmeler.length - eslesmeSayisi > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                      {eslestirmeler.length - eslesmeSayisi} eşleşmedi
                    </span>
                  )}
                </div>
              </div>
              <button onClick={reset}
                className="text-[10px] font-semibold px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap flex-shrink-0"
                style={{ background: 'rgba(129,140,248,0.1)', color: '#818CF8', border: '1px solid rgba(129,140,248,0.2)' }}>
                <i className="ri-refresh-line mr-1" />Yeni
              </button>
            </div>

            {/* ── META BİLGİLER KARTI ── */}
            {metaBilgi && metaDoluSayisi > 0 && (
              <div className="rounded-xl overflow-hidden"
                style={{ border: metaUygulandiMi ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(129,140,248,0.25)', background: metaUygulandiMi ? 'rgba(16,185,129,0.04)' : 'rgba(129,140,248,0.04)' }}>
                {/* Başlık */}
                <div className="flex items-center justify-between px-3 py-2.5"
                  style={{ borderBottom: `1px solid ${metaUygulandiMi ? 'rgba(16,185,129,0.15)' : 'rgba(129,140,248,0.15)'}`, background: metaUygulandiMi ? 'rgba(16,185,129,0.06)' : 'rgba(129,140,248,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <i className={`text-sm ${metaUygulandiMi ? 'ri-checkbox-circle-line' : 'ri-file-info-line'}`}
                      style={{ color: metaUygulandiMi ? '#10B981' : '#818CF8' }} />
                    <span className="text-[11.5px] font-bold" style={{ color: metaUygulandiMi ? '#10B981' : 'var(--text-primary)' }}>
                      {metaUygulandiMi ? 'Form bilgileri güncellendi!' : 'Formdan okunan bilgiler'}
                    </span>
                  </div>
                  {!metaUygulandiMi && (
                    <button
                      onClick={handleMetaUygula}
                      className="flex items-center gap-1.5 text-[10.5px] font-bold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-all"
                      style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)', color: '#fff' }}
                    >
                      <i className="ri-magic-line text-[11px]" />
                      Forma Otomatik Doldur
                    </button>
                  )}
                </div>
                {/* Meta alanlar grid */}
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(META_LABELS) as (keyof EgitimMetaBilgi)[]).map(key => {
                    const val = metaBilgi[key];
                    if (!val) return null;
                    const { label, icon } = META_LABELS[key];
                    return (
                      <div key={key} className="flex items-start gap-2 rounded-lg px-2.5 py-2"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
                        <div className="w-5 h-5 flex items-center justify-center rounded flex-shrink-0 mt-0.5"
                          style={{ background: 'rgba(129,140,248,0.1)' }}>
                          <i className={`${icon} text-[10px]`} style={{ color: '#818CF8' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9.5px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-faint)' }}>{label}</p>
                          <p className="text-[11.5px] font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>{val}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── KATILIMCı LİSTESİ ── */}
            {eslestirmeler.length === 0 ? (
              <div className="rounded-xl px-4 py-5 text-center"
                style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <i className="ri-file-search-line text-2xl mb-2 block" style={{ color: '#F59E0B' }} />
                <p className="text-[12px] font-semibold mb-1" style={{ color: '#F59E0B' }}>İsim tespit edilemedi</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Görselin daha net veya farklı açıdan çekilmiş versiyonunu deneyin.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                    AI tarafından bulunan {eslestirmeler.length} isim:
                  </p>
                  <button
                    onClick={() => setEslestirmeler(prev => {
                      const tumSecili = prev.every(e => e.secili && (e.eslesen || e.manuelPersonelId));
                      return prev.map(e => ({ ...e, secili: !tumSecili && !!(e.eslesen || e.manuelPersonelId) }));
                    })}
                    className="text-[10px] font-semibold cursor-pointer"
                    style={{ color: '#818CF8' }}>
                    {eslestirmeler.every(e => e.secili) ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                  </button>
                </div>

                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                  <div className="max-h-64 overflow-y-auto divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                    {eslestirmeler.map((item, idx) => {
                      const eslestiMi = item.eslesen !== null;
                      const manuelSecildi = !!item.manuelPersonelId;
                      const aktifPersonel = item.eslesen ?? (manuelSecildi ? tumPersoneller.find(p => p.id === item.manuelPersonelId) : null);

                      return (
                        <div key={idx}
                          className="px-3 py-2.5 transition-colors"
                          style={{
                            background: item.secili
                              ? eslestiMi ? 'rgba(16,185,129,0.04)' : 'rgba(245,158,11,0.04)'
                              : undefined,
                          }}>
                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={() => toggleSecim(idx)}
                              disabled={!eslestiMi && !manuelSecildi}
                              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              style={item.secili && (eslestiMi || manuelSecildi)
                                ? { background: 'linear-gradient(135deg, #10B981, #059669)' }
                                : { background: 'var(--bg-input)', border: '1.5px solid var(--border-main)' }}>
                              {item.secili && (eslestiMi || manuelSecildi) && (
                                <i className="ri-check-line text-white text-[10px]" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                                  {item.aiIsim}
                                </span>
                                {(eslestiMi || manuelSecildi) && (
                                  <i className="ri-arrow-right-line text-[10px]" style={{ color: 'var(--text-faint)' }} />
                                )}
                                {aktifPersonel && (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                                    style={{
                                      background: eslestiMi ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                                      color: eslestiMi ? '#10B981' : '#F59E0B',
                                      border: `1px solid ${eslestiMi ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                                    }}>
                                    {aktifPersonel.adSoyad}
                                  </span>
                                )}
                                {eslestiMi && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981' }}>
                                    %{Math.round(item.skor * 100)}
                                  </span>
                                )}
                              </div>
                              {!eslestiMi && (
                                <div className="mt-1.5 flex items-center gap-2">
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                                    <i className="ri-close-circle-line mr-0.5" />Eşleşme yok
                                  </span>
                                  <select
                                    value={item.manuelPersonelId ?? ''}
                                    onChange={e => setManuelPersonel(idx, e.target.value)}
                                    className="flex-1 text-[10px] rounded-lg px-2 py-1 cursor-pointer"
                                    style={{
                                      background: 'var(--bg-input)',
                                      border: '1px solid var(--border-main)',
                                      color: 'var(--text-secondary)',
                                      outline: 'none',
                                      maxWidth: 180,
                                    }}>
                                    <option value="">Manuel seç...</option>
                                    {(firmaPersoneller.length > 0 ? firmaPersoneller : tumPersoneller).map(p => (
                                      <option key={p.id} value={p.id}>{p.adSoyad}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              {eslestiMi ? (
                                <div className="w-6 h-6 flex items-center justify-center rounded-full"
                                  style={{ background: 'rgba(16,185,129,0.12)' }}>
                                  <i className="ri-user-follow-line text-[11px]" style={{ color: '#10B981' }} />
                                </div>
                              ) : manuelSecildi ? (
                                <div className="w-6 h-6 flex items-center justify-center rounded-full"
                                  style={{ background: 'rgba(245,158,11,0.12)' }}>
                                  <i className="ri-user-add-line text-[11px]" style={{ color: '#F59E0B' }} />
                                </div>
                              ) : (
                                <div className="w-6 h-6 flex items-center justify-center rounded-full"
                                  style={{ background: 'rgba(239,68,68,0.1)' }}>
                                  <i className="ri-user-unfollow-line text-[11px]" style={{ color: '#EF4444' }} />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ekle butonu */}
                {!eklendi ? (
                  <button
                    onClick={handleEkle}
                    disabled={seciliSayisi === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    style={{
                      background: seciliSayisi > 0
                        ? 'linear-gradient(135deg, #6366F1, #818CF8)'
                        : 'var(--bg-item)',
                      color: seciliSayisi > 0 ? '#fff' : 'var(--text-faint)',
                      border: seciliSayisi > 0 ? 'none' : '1px solid var(--border-main)',
                    }}>
                    <i className="ri-user-add-line text-base" />
                    {seciliSayisi > 0 ? `${seciliSayisi} kişiyi eğitime ekle` : 'Eklenecek kişi seçin'}
                  </button>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <div className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0"
                      style={{ background: 'rgba(16,185,129,0.15)' }}>
                      <i className="ri-checkbox-circle-line text-sm" style={{ color: '#10B981' }} />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: '#10B981' }}>
                        {seciliSayisi} kişi katılımcı listesine eklendi!
                      </p>
                      <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                        Kaydetmek için formu onaylayın.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-xl px-3 py-2"
                  style={{ background: 'rgba(100,116,139,0.05)', border: '1px solid rgba(100,116,139,0.1)' }}>
                  <i className="ri-shield-check-line text-xs mt-0.5 flex-shrink-0" style={{ color: '#64748B' }} />
                  <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                    Kayıt yalnızca &quot;Eğitim Ekle / Güncelle&quot; butonuna basıldığında oluşturulur.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
