import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { supabase } from '../../lib/supabase';

interface TourStep {
  title: string;
  description: string;
  icon: string;
  accent: string;       // tek accent renk, tema uyumlu
  features?: { icon: string; text: string }[];
  targetId?: string;
  tip?: string;
}

// ─── ACCENT PALETİ — yeşil/teal/slate ────────────────────────────────────────
const A = {
  green:   '#10B981',
  teal:    '#14B8A6',
  emerald: '#059669',
  slate:   '#64748B',
  sky:     '#0EA5E9',
  rose:    '#F43F5E',
  amber:   '#F59E0B',
  indigo:  '#6366F1',
};

const ADMIN_STEPS: TourStep[] = [
  {
    title: 'ISG Denetim\'e Hoş Geldiniz!',
    description: 'Firma, personel, evrak, ekipman ve saha denetim süreçlerinizi tek yerden yönetin.',
    icon: 'ri-shield-star-fill',
    accent: A.green,
    features: [
      { icon: 'ri-building-2-line',       text: 'Firma & personel yönetimi' },
      { icon: 'ri-graduation-cap-line',   text: 'Eğitim & sağlık takibi' },
      { icon: 'ri-map-pin-user-line',     text: 'Saha denetim & DÖF' },
    ],
  },
  {
    title: 'Kontrol Paneli',
    description: 'Süresi dolmak üzere evraklar, bekleyen görevler, anlık istatistikler ve AI özetler burada.',
    icon: 'ri-dashboard-3-fill',
    accent: A.teal,
    targetId: 'sidebar-dashboard',
    tip: 'Yapay zeka destekli risk analizi ile günlük durumunuzu saniyeler içinde görün',
    features: [
      { icon: 'ri-bar-chart-2-line',    text: 'Anlık istatistikler' },
      { icon: 'ri-robot-line',          text: 'AI destekli özet' },
      { icon: 'ri-notification-3-line', text: 'Akıllı bildirimler' },
    ],
  },
  {
    title: 'Firma & Personel Yönetimi',
    description: 'Firmaları ve personelleri kolayca yönetin. Evrak sürelerini takip edin, otomatik uyarı alın.',
    icon: 'ri-building-2-fill',
    accent: A.emerald,
    targetId: 'sidebar-firmalar',
    tip: 'Evrak süresi dolmadan 30 gün önce otomatik bildirim alırsınız',
    features: [
      { icon: 'ri-building-line',        text: 'Sınırsız firma kaydı' },
      { icon: 'ri-id-card-line',         text: 'Dijital kartvizit' },
      { icon: 'ri-alarm-warning-line',   text: 'Otomatik uyarı sistemi' },
    ],
  },
  {
    title: 'Eğitim & Sağlık Takibi',
    description: 'Personel eğitimlerini planlayın, katılım oranlarını ve muayene tarihlerini yönetin.',
    icon: 'ri-graduation-cap-fill',
    accent: A.sky,
    targetId: 'sidebar-egitimler',
    tip: 'Eğitim katılım oranı firma toplam personel sayısına göre hesaplanır',
    features: [
      { icon: 'ri-team-line',            text: 'Katılım takibi' },
      { icon: 'ri-heart-pulse-line',     text: 'Muayene yönetimi' },
      { icon: 'ri-file-excel-2-line',    text: 'Excel raporu' },
    ],
  },
  {
    title: 'Ekipman & İş İzni',
    description: 'Ekipman periyodik kontrollerini kaydedin, QR kod ile hızlı erişim sağlayın.',
    icon: 'ri-tools-fill',
    accent: A.amber,
    targetId: 'sidebar-ekipmanlar',
    tip: 'QR kod ile ekipmana telefon kamerasıyla anında erişebilirsiniz',
    features: [
      { icon: 'ri-qr-code-line',         text: 'QR kod desteği' },
      { icon: 'ri-file-text-line',       text: 'İş izni PDF' },
      { icon: 'ri-calendar-check-line',  text: 'Periyodik kontrol' },
    ],
  },
  {
    title: 'Saha Denetim & DÖF',
    description: 'Uygunsuzlukları fotoğrafla kaydedin, DÖF açın ve kapatma süreçlerini takip edin.',
    icon: 'ri-map-pin-user-fill',
    accent: A.rose,
    targetId: 'sidebar-uygunsuzluklar',
    tip: 'Fotoğraflı DÖF kaydı ve otomatik PDF rapor oluşturma özelliği mevcuttur',
    features: [
      { icon: 'ri-camera-line',          text: 'Fotoğraflı kayıt' },
      { icon: 'ri-file-pdf-line',        text: 'Otomatik PDF rapor' },
      { icon: 'ri-article-line',         text: 'Tutanak yönetimi' },
    ],
  },
  {
    title: 'Raporlar & Analiz',
    description: 'Tüm verileri grafikler ve tablolarla analiz edin. Tek tıkla Excel raporu indirin.',
    icon: 'ri-bar-chart-box-fill',
    accent: A.indigo,
    targetId: 'sidebar-raporlar',
    tip: 'Excel raporu; firmalar, personeller, eğitimler, muayeneler ve uygunsuzlukları tek dosyada sunar',
    features: [
      { icon: 'ri-pie-chart-line',       text: 'Görsel analizler' },
      { icon: 'ri-file-excel-2-line',    text: 'Toplu Excel export' },
      { icon: 'ri-filter-3-line',        text: 'Firma & tarih filtresi' },
    ],
  },
  {
    title: 'Ekip Yönetimi',
    description: 'Ayarlar menüsünden ekibinizi yönetin, rol atayın ve aktivite geçmişini takip edin.',
    icon: 'ri-group-fill',
    accent: A.teal,
    targetId: 'sidebar-ayarlar',
    tip: 'Admin, Saha Personeli ve Evrak Denetçi rolleri mevcuttur',
    features: [
      { icon: 'ri-user-add-line',        text: 'Kullanıcı davet et' },
      { icon: 'ri-shield-user-line',     text: 'Rol bazlı yetki' },
      { icon: 'ri-history-line',         text: 'Aktivite geçmişi' },
    ],
  },
  {
    title: 'Her Şey Hazır!',
    description: 'Sistemi kullanmaya başlayabilirsiniz. Herhangi bir sorunuzda destek ekibimize ulaşabilirsiniz.',
    icon: 'ri-rocket-2-fill',
    accent: A.green,
    features: [
      { icon: 'ri-customer-service-2-line', text: '7/24 destek hattı' },
      { icon: 'ri-book-open-line',          text: 'Kullanım kılavuzu' },
      { icon: 'ri-refresh-line',            text: 'Düzenli güncellemeler' },
    ],
  },
];

const MEMBER_STEPS: TourStep[] = [
  {
    title: 'Hoş Geldiniz!',
    description: 'Evrak/Dökümantasyon Denetçi olarak sisteme erişiminiz hazır. Görevlerinizi hızlıca tanıyalım.',
    icon: 'ri-file-list-3-fill',
    accent: A.teal,
    features: [
      { icon: 'ri-file-list-3-line',     text: 'Evrak yönetimi' },
      { icon: 'ri-graduation-cap-line',  text: 'Eğitim takibi' },
      { icon: 'ri-heart-pulse-line',     text: 'Sağlık takibi' },
    ],
  },
  {
    title: 'Evrak Takibi',
    description: 'Personel evraklarını yönetin. Süresi dolmak üzere olanlar için otomatik bildirim alırsınız.',
    icon: 'ri-file-list-3-fill',
    accent: A.emerald,
    targetId: 'sidebar-evraklar',
    tip: 'Toplu evrak yükleme özelliği ile tüm personel evraklarını tek seferde yükleyin',
    features: [
      { icon: 'ri-upload-cloud-line',    text: 'Toplu yükleme' },
      { icon: 'ri-alarm-warning-line',   text: 'Süre uyarıları' },
      { icon: 'ri-search-line',          text: 'Gelişmiş arama' },
    ],
  },
  {
    title: 'Eğitim Takibi',
    description: 'Personel eğitimlerini planlayın, katılım listelerini yönetin.',
    icon: 'ri-graduation-cap-fill',
    accent: A.sky,
    targetId: 'sidebar-egitimler',
    tip: 'Eğitim sertifikalarını sisteme yükleyerek dijital arşiv oluşturun',
    features: [
      { icon: 'ri-calendar-check-line', text: 'Eğitim takvimi' },
      { icon: 'ri-team-line',           text: 'Katılım takibi' },
      { icon: 'ri-file-excel-2-line',   text: 'Excel raporu' },
    ],
  },
  {
    title: 'Sağlık Takibi',
    description: 'Personellerin periyodik muayene tarihlerini takip edin. Süresi yaklaşanlar için uyarı alın.',
    icon: 'ri-heart-pulse-fill',
    accent: A.rose,
    targetId: 'sidebar-saglik',
    tip: 'Muayene sonuçlarını (Çalışabilir / Kısıtlı / Çalışamaz) kaydedin',
    features: [
      { icon: 'ri-alarm-warning-line', text: 'Süre uyarıları' },
      { icon: 'ri-file-text-line',     text: 'Muayene belgesi' },
      { icon: 'ri-bar-chart-2-line',   text: 'Durum analizi' },
    ],
  },
  {
    title: 'Her Şey Hazır!',
    description: 'Görevlerinize başlayabilirsiniz. Sol menüden istediğiniz modüle geçin.',
    icon: 'ri-rocket-2-fill',
    accent: A.green,
    features: [
      { icon: 'ri-customer-service-2-line', text: 'Destek hattı' },
      { icon: 'ri-refresh-line',            text: 'Düzenli güncellemeler' },
      { icon: 'ri-shield-check-line',       text: 'Güvenli platform' },
    ],
  },
];

const DENETCI_STEPS: TourStep[] = [
  {
    title: 'Hoş Geldiniz!',
    description: 'Saha Personeli olarak sisteme erişiminiz hazır. Saha denetim araçlarınızı tanıyalım.',
    icon: 'ri-map-pin-user-fill',
    accent: A.teal,
    features: [
      { icon: 'ri-map-pin-user-line', text: 'Saha denetim' },
      { icon: 'ri-tools-line',        text: 'Ekipman kontrol' },
      { icon: 'ri-file-text-line',    text: 'İş izni yönetimi' },
    ],
  },
  {
    title: 'Saha Denetim & DÖF',
    description: 'Sahada tespit ettiğiniz uygunsuzlukları fotoğrafla kaydedin, DÖF açın ve takip edin.',
    icon: 'ri-map-pin-user-fill',
    accent: A.rose,
    targetId: 'sidebar-uygunsuzluklar',
    tip: 'Fotoğraflı DÖF kaydı ve otomatik PDF rapor oluşturma özelliği mevcuttur',
    features: [
      { icon: 'ri-camera-line',   text: 'Fotoğraflı kayıt' },
      { icon: 'ri-file-pdf-line', text: 'PDF rapor' },
      { icon: 'ri-article-line',  text: 'Tutanak oluştur' },
    ],
  },
  {
    title: 'Ekipman Kontrolleri',
    description: 'Ekipmanların periyodik kontrollerini kaydedin, QR kod ile hızlı erişim sağlayın.',
    icon: 'ri-tools-fill',
    accent: A.emerald,
    targetId: 'sidebar-ekipmanlar',
    tip: 'Ekipman QR kodlarını yazdırarak sahaya asabilirsiniz',
    features: [
      { icon: 'ri-qr-code-line',         text: 'QR kod oluştur' },
      { icon: 'ri-calendar-check-line',  text: 'Periyodik kontrol' },
      { icon: 'ri-alarm-warning-line',   text: 'Bakım uyarıları' },
    ],
  },
  {
    title: 'İş İzni Yönetimi',
    description: 'Tehlikeli işler için dijital iş izni oluşturun ve onay süreçlerini takip edin.',
    icon: 'ri-file-text-fill',
    accent: A.sky,
    targetId: 'sidebar-is-izni',
    tip: 'İş izni PDF olarak indirilebilir ve sahada imzalatılabilir',
    features: [
      { icon: 'ri-fire-line',       text: 'Sıcak çalışma izni' },
      { icon: 'ri-arrow-up-line',   text: 'Yüksekte çalışma' },
      { icon: 'ri-file-pdf-line',   text: 'PDF çıktı' },
    ],
  },
  {
    title: 'Her Şey Hazır!',
    description: 'Saha çalışmalarınıza başlayabilirsiniz. İyi çalışmalar!',
    icon: 'ri-rocket-2-fill',
    accent: A.green,
    features: [
      { icon: 'ri-customer-service-2-line', text: 'Destek hattı' },
      { icon: 'ri-shield-check-line',       text: 'Güvenli platform' },
      { icon: 'ri-refresh-line',            text: 'Düzenli güncellemeler' },
    ],
  },
];

const TOUR_STORAGE_KEY = 'isg_tour_completed';

function getTourSteps(role: string): TourStep[] {
  if (role === 'admin') return ADMIN_STEPS;
  if (role === 'denetci') return DENETCI_STEPS;
  return MEMBER_STEPS;
}

export default function OnboardingTour() {
  const { org, theme } = useApp();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const stepIndexRef = useRef(0);
  const [stepIndex, setStepIndexState] = useState(0);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  const [, forceRender] = useState(0);
  const checkedUserIdRef = useRef<string | null>(null);

  const setStepIndex = useCallback((i: number, dir: 'next' | 'prev' = 'next') => {
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      stepIndexRef.current = i;
      setStepIndexState(i);
      setAnimating(false);
    }, 180);
  }, []);

  const role = org?.role ?? 'member';
  const steps = getTourSteps(role);
  const currentStep = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;
  const progress = ((stepIndex + 1) / steps.length) * 100;
  const accent = currentStep?.accent ?? A.green;

  useEffect(() => {
    if (!org?.id || !user?.id) return;
    if (checkedUserIdRef.current === user.id) return;
    checkedUserIdRef.current = user.id;

    const sessionKey = `${TOUR_STORAGE_KEY}_${user.id}`;
    let cancelled = false;
    let showTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      if (sessionStorage.getItem(sessionKey) === '1') return;
    } catch { /* ignore */ }

    supabase
      .from('profiles')
      .select('tour_completed')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        if (data?.tour_completed === true) {
          try { sessionStorage.setItem(sessionKey, '1'); } catch { /* ignore */ }
          return;
        }
        showTimer = setTimeout(() => { if (!cancelled) setVisible(true); }, 600);
      })
      .catch(() => { /* ignore */ });

    return () => {
      cancelled = true;
      if (showTimer) clearTimeout(showTimer);
    };
  }, [org?.id, user?.id]);

  useEffect(() => {
    if (!visible) return;
    if (!currentStep?.targetId) { setTargetEl(null); return; }
    const t = setTimeout(() => {
      const el = document.getElementById(currentStep.targetId!);
      setTargetEl(el);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      forceRender(n => n + 1);
    }, 100);
    return () => clearTimeout(t);
  }, [visible, stepIndex, currentStep?.targetId]);

  const completeTour = useCallback(async () => {
    if (!user?.id) return;
    setVisible(false);
    try { sessionStorage.setItem(`${TOUR_STORAGE_KEY}_${user.id}`, '1'); } catch { /* ignore */ }
    try { localStorage.removeItem(`${TOUR_STORAGE_KEY}_${user.id}`); } catch { /* ignore */ }
    try {
      await supabase
        .from('profiles')
        .upsert({ user_id: user.id, tour_completed: true }, { onConflict: 'user_id' });
    } catch { /* ignore */ }
  }, [user?.id]);

  const handleNext = useCallback(() => {
    const next = stepIndexRef.current + 1;
    if (next < steps.length) setStepIndex(next, 'next');
    else completeTour();
  }, [steps.length, setStepIndex, completeTour]);

  const handlePrev = useCallback(() => {
    const prev = stepIndexRef.current - 1;
    if (prev >= 0) setStepIndex(prev, 'prev');
  }, [setStepIndex]);

  const handleSkip = useCallback(() => completeTour(), [completeTour]);

  if (!visible || !currentStep) return null;

  // ── layout tokens ──
  const bg       = isDark ? '#0D1526' : '#ffffff';
  const bgSub    = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.025)';
  const border   = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.09)';
  const primary  = isDark ? '#E2E8F0' : '#0F172A';
  const muted    = isDark ? '#64748B' : '#94A3B8';
  const sub      = isDark ? '#94A3B8' : '#475569';

  const slideStyle: React.CSSProperties = {
    opacity: animating ? 0 : 1,
    transform: animating ? `translateX(${direction === 'next' ? '16px' : '-16px'})` : 'translateX(0)',
    transition: 'opacity 0.18s ease, transform 0.18s ease',
  };

  // ── tooltip positioning ──
  const hasTarget = !!currentStep.targetId;
  const isCenter = !hasTarget || !targetEl;

  let tooltipStyle: React.CSSProperties = {};
  let arrowSide: 'left' | 'right' | null = null;
  let highlightStyle: React.CSSProperties = {};

  if (!isCenter && targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const tooltipWidth = 300;
    const spaceRight = window.innerWidth - rect.right;
    const placeRight = spaceRight >= tooltipWidth + 20;
    const placeLeft = !placeRight && rect.left >= tooltipWidth + 20;

    const tooltipTop = Math.max(12, Math.min(rect.top + rect.height / 2 - 110, window.innerHeight - 260));

    if (placeRight) {
      tooltipStyle = { position: 'fixed', top: tooltipTop, left: rect.right + 12, width: tooltipWidth, zIndex: 99999 };
      arrowSide = 'left';
    } else if (placeLeft) {
      tooltipStyle = { position: 'fixed', top: tooltipTop, left: rect.left - tooltipWidth - 12, width: tooltipWidth, zIndex: 99999 };
      arrowSide = 'right';
    } else {
      tooltipStyle = { position: 'fixed', top: tooltipTop, left: Math.min(rect.right + 12, window.innerWidth - tooltipWidth - 12), width: tooltipWidth, zIndex: 99999 };
      arrowSide = 'left';
    }

    highlightStyle = {
      position: 'fixed', zIndex: 99999,
      top: rect.top - 5, left: rect.left - 5,
      width: rect.width + 10, height: rect.height + 10,
      borderRadius: '12px',
      border: `1.5px solid ${accent}`,
      boxShadow: `0 0 0 4px ${accent}20, 0 0 24px ${accent}35`,
      pointerEvents: 'none',
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CENTER MODAL
  // ─────────────────────────────────────────────────────────────────────────
  if (isCenter) {
    return createPortal(
      <>
        <div className="fixed inset-0" style={{ zIndex: 99998, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }} />
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="w-full max-w-[420px] rounded-2xl overflow-hidden"
            style={{ background: bg, border, boxShadow: isDark ? '0 32px 80px rgba(0,0,0,0.65)' : '0 24px 60px rgba(15,23,42,0.18)' }}>

            {/* Progress bar */}
            <div className="h-0.5 w-full" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)' }}>
              <div className="h-full transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progress}%`, background: accent }} />
            </div>

            {/* Hero */}
            <div className="relative flex flex-col items-center pt-9 pb-7 px-8"
              style={{ background: `${accent}08` }}>
              <div className="absolute top-3.5 right-4 text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: `${accent}15`, color: accent }}>
                {stepIndex + 1} / {steps.length}
              </div>

              {/* Icon ring */}
              <div className="relative mb-5">
                <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center"
                  style={{ background: `${accent}18`, border: `1.5px solid ${accent}35` }}>
                  <i className={`${currentStep.icon} text-4xl`} style={{ color: accent }} />
                </div>
                {/* Pulse ring */}
                <div className="absolute inset-0 rounded-2xl animate-ping"
                  style={{ background: `${accent}10`, animationDuration: '2.5s' }} />
              </div>

              <div style={slideStyle} className="text-center">
                <h2 className="text-[17px] font-extrabold mb-2 leading-snug"
                  style={{ color: primary, letterSpacing: '-0.025em' }}>
                  {currentStep.title}
                </h2>
                <p className="text-[13px] leading-relaxed" style={{ color: sub }}>
                  {currentStep.description}
                </p>
              </div>
            </div>

            {/* Features */}
            {currentStep.features && (
              <div className="px-6 pt-4 pb-2" style={slideStyle}>
                <div className="grid grid-cols-3 gap-2">
                  {currentStep.features.map((f, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-center"
                      style={{ background: bgSub, border }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: `${accent}12` }}>
                        <i className={`${f.icon} text-xs`} style={{ color: accent }} />
                      </div>
                      <span className="text-[10px] font-semibold leading-tight" style={{ color: sub }}>{f.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tip */}
            {currentStep.tip && (
              <div className="px-6 pt-2 pb-1" style={slideStyle}>
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{ background: `${accent}08`, border: `1px solid ${accent}20` }}>
                  <i className="ri-lightbulb-line text-xs flex-shrink-0 mt-0.5" style={{ color: accent }} />
                  <p className="text-[11px] leading-relaxed" style={{ color: accent }}>
                    <strong>İpucu:</strong> {currentStep.tip}
                  </p>
                </div>
              </div>
            )}

            {/* Dots */}
            <div className="flex items-center justify-center gap-1.5 py-4">
              {steps.map((s, i) => (
                <button key={i}
                  onClick={() => setStepIndex(i, i > stepIndex ? 'next' : 'prev')}
                  className="rounded-full transition-all duration-300 cursor-pointer"
                  style={{
                    width: i === stepIndex ? 20 : 6,
                    height: 6,
                    background: i === stepIndex ? s.accent : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)',
                  }} />
              ))}
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-2.5">
              {!isFirst ? (
                <button onClick={handlePrev}
                  className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer flex-shrink-0 transition-all"
                  style={{ background: bgSub, border, color: muted }}>
                  <i className="ri-arrow-left-s-line text-sm" />
                </button>
              ) : (
                <button onClick={handleSkip}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap transition-all"
                  style={{ background: bgSub, border, color: muted }}>
                  Atla
                </button>
              )}
              <button onClick={handleNext}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap transition-all flex items-center justify-center gap-2"
                style={{ background: accent, boxShadow: `0 4px 16px ${accent}40` }}>
                {isLast
                  ? <><i className="ri-rocket-line text-sm" />Hadi Başlayalım!</>
                  : <>Devam Et <i className="ri-arrow-right-s-line text-sm" /></>}
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOOLTIP (sidebar yanında)
  // ─────────────────────────────────────────────────────────────────────────
  return createPortal(
    <>
      <style>{`
        @keyframes tourPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.1); }
        }
      `}</style>

      <div className="fixed inset-0"
        style={{ zIndex: 99998, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)' }} />

      {/* Highlight */}
      <div style={highlightStyle} />
      <div style={{ ...highlightStyle, border: `1.5px solid ${accent}`, boxShadow: 'none',
        animation: 'tourPulse 1.8s ease-in-out infinite' }} />

      {/* Tooltip card */}
      <div style={tooltipStyle}>
        {/* Arrow */}
        {arrowSide === 'left' && (
          <div style={{
            position: 'absolute', left: -7, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '7px solid transparent', borderBottom: '7px solid transparent',
            borderRight: `7px solid ${bg}`, zIndex: 1,
          }} />
        )}
        {arrowSide === 'right' && (
          <div style={{
            position: 'absolute', right: -7, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '7px solid transparent', borderBottom: '7px solid transparent',
            borderLeft: `7px solid ${bg}`, zIndex: 1,
          }} />
        )}

        <div className="rounded-2xl overflow-hidden"
          style={{ background: bg, border, boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.55)' : '0 16px 40px rgba(15,23,42,0.14)' }}>

          {/* Progress bar */}
          <div className="h-0.5" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)' }}>
            <div className="h-full transition-all duration-500"
              style={{ width: `${progress}%`, background: accent }} />
          </div>

          {/* Header */}
          <div className="p-4" style={{ background: `${accent}08` }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
                <i className={`${currentStep.icon} text-lg`} style={{ color: accent }} />
              </div>
              <div className="flex-1 min-w-0" style={slideStyle}>
                <h4 className="text-sm font-bold mb-0.5" style={{ color: primary }}>{currentStep.title}</h4>
                <p className="text-[11px] leading-relaxed" style={{ color: sub }}>{currentStep.description}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: `${accent}15`, color: accent }}>
                {stepIndex + 1}/{steps.length}
              </span>
            </div>
          </div>

          {/* Features */}
          {currentStep.features && (
            <div className="px-4 py-3" style={slideStyle}>
              <div className="space-y-1.5">
                {currentStep.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${accent}12` }}>
                      <i className={`${f.icon} text-[10px]`} style={{ color: accent }} />
                    </div>
                    <span className="text-xs" style={{ color: sub }}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tip */}
          {currentStep.tip && (
            <div className="px-4 pb-3" style={slideStyle}>
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg"
                style={{ background: `${accent}08`, border: `1px solid ${accent}18` }}>
                <i className="ri-lightbulb-line text-[10px] flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <p className="text-[10px] leading-relaxed" style={{ color: accent }}>
                  <strong>İpucu:</strong> {currentStep.tip}
                </p>
              </div>
            </div>
          )}

          {/* Dots */}
          <div className="flex items-center justify-center gap-1 pb-3">
            {steps.map((s, i) => (
              <button key={i}
                onClick={() => setStepIndex(i, i > stepIndex ? 'next' : 'prev')}
                className="rounded-full transition-all duration-300 cursor-pointer"
                style={{
                  width: i === stepIndex ? 14 : 5, height: 5,
                  background: i === stepIndex ? s.accent : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)',
                }} />
            ))}
          </div>

          {/* Actions */}
          <div className="px-4 pb-4 flex gap-2">
            {!isFirst ? (
              <button onClick={handlePrev}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
                style={{ background: bgSub, border, color: muted }}>
                <i className="ri-arrow-left-s-line text-xs" />
              </button>
            ) : (
              <button onClick={handleSkip}
                className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                style={{ background: bgSub, border, color: muted }}>
                Atla
              </button>
            )}
            <button onClick={handleNext}
              className="flex-1 py-2 rounded-lg text-xs font-bold text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
              style={{ background: accent, boxShadow: `0 3px 10px ${accent}35` }}>
              {isLast
                ? <><i className="ri-rocket-line" />Başlayalım!</>
                : <>Devam Et <i className="ri-arrow-right-s-line" /></>}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
