import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { supabase } from '../../lib/supabase';

interface TourStep {
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  gradient: string;
  features?: { icon: string; text: string }[];
  targetId?: string;
  tip?: string;
}

const ADMIN_STEPS: TourStep[] = [
  {
    title: 'ISG Denetim\'e Hoş Geldiniz!',
    description: 'Türkiye\'nin en kapsamlı İş Sağlığı & Güvenliği yönetim platformuna hoş geldiniz. Birkaç adımda sistemi tanıyalım.',
    icon: 'ri-shield-star-fill',
    iconColor: '#818CF8',
    iconBg: 'rgba(99,102,241,0.15)',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    features: [
      { icon: 'ri-building-2-line', text: 'Firma & personel yönetimi' },
      { icon: 'ri-file-list-3-line', text: 'Evrak takibi & bildirimler' },
      { icon: 'ri-map-pin-user-line', text: 'Saha denetim & DÖF' },
    ],
  },
  {
    title: 'Kontrol Paneli',
    description: 'Tüm kritik verileri tek ekranda görün. Süresi dolmak üzere evraklar, bekleyen görevler ve anlık istatistikler burada.',
    icon: 'ri-dashboard-3-fill',
    iconColor: '#10B981',
    iconBg: 'rgba(16,185,129,0.15)',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    targetId: 'sidebar-dashboard',
    tip: 'Otomatik risk analizi ile günlük durumunuzu hızlıca görün',
    features: [
      { icon: 'ri-bar-chart-2-line', text: 'Anlık istatistikler' },
      { icon: 'ri-notification-3-line', text: 'Akıllı bildirimler' },
      { icon: 'ri-bar-chart-box-line', text: 'Otomatik risk analizi' },
    ],
  },
  {
    title: 'Firma & Personel Yönetimi',
    description: 'Denetlediğiniz firmaları ve personelleri kolayca yönetin. Evrak sürelerini takip edin, otomatik uyarılar alın.',
    icon: 'ri-building-2-fill',
    iconColor: '#F59E0B',
    iconBg: 'rgba(245,158,11,0.15)',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)',
    targetId: 'sidebar-firmalar',
    tip: 'Evrak süresi dolmadan 30 gün önce otomatik bildirim alırsınız',
    features: [
      { icon: 'ri-building-line', text: 'Sınırsız firma kaydı' },
      { icon: 'ri-team-line', text: 'Personel evrak takibi' },
      { icon: 'ri-alarm-warning-line', text: 'Otomatik uyarı sistemi' },
    ],
  },
  {
    title: 'Saha Denetim & DÖF',
    description: 'Sahada tespit ettiğiniz uygunsuzlukları kaydedin, DÖF açın ve kapatma süreçlerini takip edin.',
    icon: 'ri-map-pin-user-fill',
    iconColor: '#EF4444',
    iconBg: 'rgba(239,68,68,0.15)',
    gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    targetId: 'sidebar-uygunsuzluklar',
    tip: 'PDF rapor oluşturma ve fotoğraf ekleme özelliği mevcuttur',
    features: [
      { icon: 'ri-camera-line', text: 'Fotoğraflı kayıt' },
      { icon: 'ri-file-pdf-line', text: 'Otomatik PDF rapor' },
      { icon: 'ri-time-line', text: 'Süreç takibi' },
    ],
  },
  {
    title: 'Ekip Yönetimi',
    description: 'Ayarlar menüsünden ekibinizi yönetin. Farklı roller atayın, yetkileri özelleştirin.',
    icon: 'ri-group-fill',
    iconColor: '#06B6D4',
    iconBg: 'rgba(6,182,212,0.15)',
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
    targetId: 'sidebar-ayarlar',
    tip: 'Admin, Saha Personeli ve Evrak Denetçi rolleri mevcuttur',
    features: [
      { icon: 'ri-user-add-line', text: 'Kullanıcı davet et' },
      { icon: 'ri-shield-user-line', text: 'Rol bazlı yetki' },
      { icon: 'ri-history-line', text: 'Aktivite geçmişi' },
    ],
  },
  {
    title: 'Her Şey Hazır!',
    description: 'Sistemi kullanmaya başlayabilirsiniz. Herhangi bir sorunuzda destek ekibimize ulaşabilirsiniz.',
    icon: 'ri-rocket-2-fill',
    iconColor: '#10B981',
    iconBg: 'rgba(16,185,129,0.15)',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    features: [
      { icon: 'ri-customer-service-2-line', text: '7/24 destek hattı' },
      { icon: 'ri-book-open-line', text: 'Kullanım kılavuzu' },
      { icon: 'ri-refresh-line', text: 'Düzenli güncellemeler' },
    ],
  },
];

const MEMBER_STEPS: TourStep[] = [
  {
    title: 'Hoş Geldiniz!',
    description: 'Evrak/Dökümantasyon Denetçi olarak sisteme erişiminiz hazır. Görevlerinizi hızlıca tanıyalım.',
    icon: 'ri-file-list-3-fill',
    iconColor: '#A78BFA',
    iconBg: 'rgba(167,139,250,0.15)',
    gradient: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
    features: [
      { icon: 'ri-file-list-3-line', text: 'Evrak yönetimi' },
      { icon: 'ri-graduation-cap-line', text: 'Eğitim takibi' },
      { icon: 'ri-article-line', text: 'Tutanak oluşturma' },
    ],
  },
  {
    title: 'Evrak Takibi',
    description: 'Personel evraklarını yönetin. Süresi dolmak üzere olan evraklar için otomatik bildirim alırsınız.',
    icon: 'ri-file-list-3-fill',
    iconColor: '#C084FC',
    iconBg: 'rgba(192,132,252,0.15)',
    gradient: 'linear-gradient(135deg, #C084FC 0%, #A855F7 100%)',
    targetId: 'sidebar-evraklar',
    tip: 'Toplu evrak yükleme özelliği ile zamandan tasarruf edin',
    features: [
      { icon: 'ri-upload-cloud-line', text: 'Toplu yükleme' },
      { icon: 'ri-alarm-warning-line', text: 'Süre uyarıları' },
      { icon: 'ri-search-line', text: 'Gelişmiş arama' },
    ],
  },
  {
    title: 'Eğitim Takibi',
    description: 'Personel eğitim belgelerini ve geçerlilik sürelerini takip edin.',
    icon: 'ri-graduation-cap-fill',
    iconColor: '#2DD4BF',
    iconBg: 'rgba(45,212,191,0.15)',
    gradient: 'linear-gradient(135deg, #2DD4BF 0%, #0D9488 100%)',
    targetId: 'sidebar-egitimler',
    tip: 'Eğitim sertifikalarını sisteme yükleyerek dijital arşiv oluşturun',
    features: [
      { icon: 'ri-calendar-check-line', text: 'Eğitim takvimi' },
      { icon: 'ri-award-line', text: 'Sertifika arşivi' },
      { icon: 'ri-notification-line', text: 'Yenileme hatırlatıcı' },
    ],
  },
  {
    title: 'Her Şey Hazır!',
    description: 'Görevlerinize başlayabilirsiniz. Sol menüden istediğiniz modüle geçin.',
    icon: 'ri-rocket-2-fill',
    iconColor: '#10B981',
    iconBg: 'rgba(16,185,129,0.15)',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    features: [
      { icon: 'ri-customer-service-2-line', text: 'Destek hattı' },
      { icon: 'ri-refresh-line', text: 'Düzenli güncellemeler' },
      { icon: 'ri-shield-check-line', text: 'Güvenli platform' },
    ],
  },
];

const DENETCI_STEPS: TourStep[] = [
  {
    title: 'Hoş Geldiniz!',
    description: 'Saha Personeli olarak sisteme erişiminiz hazır. Saha denetim araçlarınızı tanıyalım.',
    icon: 'ri-map-pin-user-fill',
    iconColor: '#22D3EE',
    iconBg: 'rgba(34,211,238,0.15)',
    gradient: 'linear-gradient(135deg, #22D3EE 0%, #0891B2 100%)',
    features: [
      { icon: 'ri-map-pin-user-line', text: 'Saha denetim' },
      { icon: 'ri-tools-line', text: 'Ekipman kontrol' },
      { icon: 'ri-file-pdf-line', text: 'Rapor oluşturma' },
    ],
  },
  {
    title: 'Saha Denetim',
    description: 'Sahada tespit ettiğiniz uygunsuzlukları fotoğrafla kaydedin, DÖF açın ve takip edin.',
    icon: 'ri-map-pin-user-fill',
    iconColor: '#FB923C',
    iconBg: 'rgba(251,146,60,0.15)',
    gradient: 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)',
    targetId: 'sidebar-uygunsuzluklar',
    tip: 'QR kod ile ekipman kaydı yapabilirsiniz',
    features: [
      { icon: 'ri-camera-line', text: 'Fotoğraflı kayıt' },
      { icon: 'ri-qr-code-line', text: 'QR kod desteği' },
      { icon: 'ri-file-pdf-line', text: 'PDF rapor' },
    ],
  },
  {
    title: 'Ekipman Kontrolleri',
    description: 'Ekipmanların periyodik kontrollerini kaydedin, QR kod ile hızlı erişim sağlayın.',
    icon: 'ri-tools-fill',
    iconColor: '#34D399',
    iconBg: 'rgba(52,211,153,0.15)',
    gradient: 'linear-gradient(135deg, #34D399 0%, #059669 100%)',
    targetId: 'sidebar-ekipmanlar',
    tip: 'Ekipman QR kodlarını yazdırarak sahaya asabilirsiniz',
    features: [
      { icon: 'ri-qr-code-line', text: 'QR kod oluştur' },
      { icon: 'ri-calendar-check-line', text: 'Periyodik kontrol' },
      { icon: 'ri-alarm-warning-line', text: 'Bakım uyarıları' },
    ],
  },
  {
    title: 'Her Şey Hazır!',
    description: 'Saha çalışmalarınıza başlayabilirsiniz. İyi çalışmalar!',
    icon: 'ri-rocket-2-fill',
    iconColor: '#10B981',
    iconBg: 'rgba(16,185,129,0.15)',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    features: [
      { icon: 'ri-customer-service-2-line', text: 'Destek hattı' },
      { icon: 'ri-shield-check-line', text: 'Güvenli platform' },
      { icon: 'ri-refresh-line', text: 'Düzenli güncellemeler' },
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
    }, 200);
  }, []);

  const role = org?.role ?? 'member';
  const steps = getTourSteps(role);
  const currentStep = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  useEffect(() => {
    if (!org?.id || !user?.id) return;
    if (checkedUserIdRef.current === user.id) return;
    checkedUserIdRef.current = user.id;

    const localKey = `${TOUR_STORAGE_KEY}_${user.id}`;
    let cancelled = false;
    let showTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      const localDone = localStorage.getItem(localKey);
      if (localDone === '1') return;
    } catch { /* ignore */ }

    supabase
      .from('profiles')
      .select('tour_completed')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Hata varsa turu gösterme — kullanıcıyı rahatsız etme
          return;
        }
        if (data?.tour_completed === true) {
          // Supabase'de tamamlanmış — localStorage'a da kaydet
          try { localStorage.setItem(localKey, '1'); } catch { /* ignore */ }
          return;
        }
        // Supabase'de kayıt yok veya tour_completed false — turu göster
        showTimer = setTimeout(() => { if (!cancelled) setVisible(true); }, 600);
      })
      .catch(() => {
        // Network hatası — turu gösterme, kullanıcıyı rahatsız etme
      });

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
    try { localStorage.setItem(`${TOUR_STORAGE_KEY}_${user.id}`, '1'); } catch { /* ignore */ }
    try {
      // Önce mevcut kaydı kontrol et
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing?.id) {
        // Kayıt varsa güncelle
        await supabase
          .from('profiles')
          .update({ tour_completed: true })
          .eq('user_id', user.id);
      } else {
        // Kayıt yoksa oluştur
        await supabase
          .from('profiles')
          .insert({ user_id: user.id, tour_completed: true });
      }
    } catch { /* ignore */ }
  }, [user?.id]);

  const handleNext = useCallback(() => {
    const nextIndex = stepIndexRef.current + 1;
    if (nextIndex < steps.length) {
      setStepIndex(nextIndex, 'next');
    } else {
      completeTour();
    }
  }, [steps.length, setStepIndex, completeTour]);

  const handlePrev = useCallback(() => {
    const prevIndex = stepIndexRef.current - 1;
    if (prevIndex >= 0) setStepIndex(prevIndex, 'prev');
  }, [setStepIndex]);

  const handleSkip = useCallback(() => completeTour(), [completeTour]);

  if (!visible || !currentStep) return null;

  const hasTarget = !!currentStep.targetId;
  const isCenter = !hasTarget || !targetEl;

  let tooltipStyle: React.CSSProperties = {};
  let arrowSide: 'left' | 'right' | null = null;
  let highlightStyle: React.CSSProperties = {};

  if (!isCenter && targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const tooltipWidth = 320;
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;
    const placeRight = spaceRight >= tooltipWidth + 24;
    const placeLeft = !placeRight && spaceLeft >= tooltipWidth + 24;

    const tooltipTop = Math.max(16, Math.min(
      rect.top + rect.height / 2 - 120,
      window.innerHeight - 280
    ));

    if (placeRight) {
      tooltipStyle = { position: 'fixed', top: tooltipTop, left: rect.right + 16, width: tooltipWidth, zIndex: 99999 };
      arrowSide = 'left';
    } else if (placeLeft) {
      tooltipStyle = { position: 'fixed', top: tooltipTop, left: rect.left - tooltipWidth - 16, width: tooltipWidth, zIndex: 99999 };
      arrowSide = 'right';
    } else {
      tooltipStyle = { position: 'fixed', top: tooltipTop, left: Math.min(rect.right + 16, window.innerWidth - tooltipWidth - 16), width: tooltipWidth, zIndex: 99999 };
      arrowSide = 'left';
    }

    highlightStyle = {
      position: 'fixed',
      zIndex: 99999,
      top: rect.top - 6,
      left: rect.left - 6,
      width: rect.width + 12,
      height: rect.height + 12,
      borderRadius: '14px',
      border: `2px solid ${currentStep.iconColor}`,
      boxShadow: `0 0 0 4px ${currentStep.iconColor}25, 0 0 30px ${currentStep.iconColor}40`,
      pointerEvents: 'none',
      transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
    };
  }

  const bg = isDark ? '#0D1526' : '#ffffff';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)';
  const border = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15,23,42,0.12)';
  const nameColor = isDark ? '#E2E8F0' : '#0F172A';
  const subColor = isDark ? '#64748B' : '#94A3B8';

  const progress = ((stepIndex + 1) / steps.length) * 100;

  const slideStyle: React.CSSProperties = {
    opacity: animating ? 0 : 1,
    transform: animating
      ? `translateX(${direction === 'next' ? '20px' : '-20px'})`
      : 'translateX(0)',
    transition: 'opacity 0.2s ease, transform 0.2s ease',
  };

  // ── CENTER MODAL ──
  if (isCenter) {
    return createPortal(
      <>
        <div
          className="fixed inset-0"
          style={{ zIndex: 99998, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
        />
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div
            className="w-full max-w-md rounded-3xl overflow-hidden"
            style={{ background: bg, border, boxShadow: '0 32px 80px rgba(0,0,0,0.55)' }}
          >
            {/* Progress bar */}
            <div className="h-1 w-full" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }}>
              <div
                className="h-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%`, background: currentStep.gradient }}
              />
            </div>

            {/* Hero area */}
            <div
              className="relative flex flex-col items-center justify-center pt-10 pb-8 px-8"
              style={{ background: `${currentStep.iconColor}08` }}
            >
              {/* Step counter */}
              <div
                className="absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: `${currentStep.iconColor}18`, color: currentStep.iconColor }}
              >
                {stepIndex + 1} / {steps.length}
              </div>

              {/* Icon */}
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                style={{
                  background: currentStep.gradient,
                  boxShadow: `0 12px 40px ${currentStep.iconColor}45`,
                }}
              >
                <i className={`${currentStep.icon} text-4xl text-white`} />
              </div>

              <div style={slideStyle} className="text-center">
                <h2 className="text-xl font-extrabold mb-2" style={{ color: nameColor, letterSpacing: '-0.02em' }}>
                  {currentStep.title}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: subColor }}>
                  {currentStep.description}
                </p>
              </div>
            </div>

            {/* Features */}
            {currentStep.features && (
              <div className="px-6 py-4" style={slideStyle}>
                <div className="grid grid-cols-3 gap-2">
                  {currentStep.features.map((f, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl text-center"
                      style={{ background: cardBg, border }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `${currentStep.iconColor}15` }}
                      >
                        <i className={`${f.icon} text-sm`} style={{ color: currentStep.iconColor }} />
                      </div>
                      <span className="text-[10px] font-semibold leading-tight" style={{ color: subColor }}>{f.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tip */}
            {currentStep.tip && (
              <div className="px-6 pb-2" style={slideStyle}>
                <div
                  className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl"
                  style={{ background: `${currentStep.iconColor}10`, border: `1px solid ${currentStep.iconColor}25` }}
                >
                  <i className="ri-lightbulb-flash-line text-sm flex-shrink-0 mt-0.5" style={{ color: currentStep.iconColor }} />
                  <p className="text-xs leading-relaxed" style={{ color: currentStep.iconColor }}>
                    <strong>İpucu:</strong> {currentStep.tip}
                  </p>
                </div>
              </div>
            )}

            {/* Dot indicators */}
            <div className="flex items-center justify-center gap-1.5 py-4">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStepIndex(i, i > stepIndex ? 'next' : 'prev')}
                  className="rounded-full transition-all duration-300 cursor-pointer"
                  style={{
                    width: i === stepIndex ? 22 : 7,
                    height: 7,
                    background: i === stepIndex
                      ? currentStep.iconColor
                      : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.12)',
                  }}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              {!isFirst ? (
                <button
                  onClick={handlePrev}
                  className="w-10 h-10 flex items-center justify-center rounded-xl cursor-pointer flex-shrink-0 transition-all"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                    border,
                    color: subColor,
                  }}
                >
                  <i className="ri-arrow-left-line text-sm" />
                </button>
              ) : (
                <button
                  onClick={handleSkip}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap transition-all"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
                    border,
                    color: subColor,
                  }}
                >
                  Atla
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap transition-all flex items-center justify-center gap-2"
                style={{
                  background: currentStep.gradient,
                  boxShadow: `0 6px 20px ${currentStep.iconColor}40`,
                }}
              >
                {isLast ? (
                  <><i className="ri-rocket-line" />Hadi Başlayalım!</>
                ) : (
                  <>Devam Et <i className="ri-arrow-right-line" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  }

  // ── TOOLTIP (sidebar yanında) ──
  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 99998, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
      />

      {/* Highlight ring */}
      <div style={highlightStyle} />

      {/* Pulse ring */}
      <div style={{
        ...highlightStyle,
        border: `2px solid ${currentStep.iconColor}`,
        boxShadow: 'none',
        animation: 'tourPulse 1.8s ease-in-out infinite',
      }} />

      <style>{`
        @keyframes tourPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.08); }
        }
      `}</style>

      {/* Tooltip card */}
      <div style={tooltipStyle}>
        {/* Arrow */}
        {arrowSide === 'left' && (
          <div style={{
            position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '8px solid transparent', borderBottom: '8px solid transparent',
            borderRight: isDark ? '8px solid #0D1526' : '8px solid #ffffff',
            zIndex: 1,
          }} />
        )}
        {arrowSide === 'right' && (
          <div style={{
            position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '8px solid transparent', borderBottom: '8px solid transparent',
            borderLeft: isDark ? '8px solid #0D1526' : '8px solid #ffffff',
            zIndex: 1,
          }} />
        )}

        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: bg, border, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
        >
          {/* Progress bar */}
          <div className="h-1" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }}>
            <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: currentStep.gradient }} />
          </div>

          {/* Header */}
          <div className="p-4" style={{ background: `${currentStep.iconColor}08` }}>
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: currentStep.gradient, boxShadow: `0 6px 16px ${currentStep.iconColor}40` }}
              >
                <i className={`${currentStep.icon} text-xl text-white`} />
              </div>
              <div className="flex-1 min-w-0" style={slideStyle}>
                <h4 className="text-sm font-bold" style={{ color: nameColor }}>{currentStep.title}</h4>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: subColor }}>{currentStep.description}</p>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: `${currentStep.iconColor}18`, color: currentStep.iconColor }}
              >
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
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${currentStep.iconColor}15` }}
                    >
                      <i className={`${f.icon} text-xs`} style={{ color: currentStep.iconColor }} />
                    </div>
                    <span className="text-xs" style={{ color: subColor }}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tip */}
          {currentStep.tip && (
            <div className="px-4 pb-3" style={slideStyle}>
              <div
                className="flex items-start gap-2 px-3 py-2 rounded-lg"
                style={{ background: `${currentStep.iconColor}10`, border: `1px solid ${currentStep.iconColor}20` }}
              >
                <i className="ri-lightbulb-flash-line text-xs flex-shrink-0 mt-0.5" style={{ color: currentStep.iconColor }} />
                <p className="text-[10px] leading-relaxed" style={{ color: currentStep.iconColor }}>
                  <strong>İpucu:</strong> {currentStep.tip}
                </p>
              </div>
            </div>
          )}

          {/* Dots */}
          <div className="flex items-center justify-center gap-1 pb-3">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStepIndex(i, i > stepIndex ? 'next' : 'prev')}
                className="rounded-full transition-all duration-300 cursor-pointer"
                style={{
                  width: i === stepIndex ? 16 : 5,
                  height: 5,
                  background: i === stepIndex
                    ? currentStep.iconColor
                    : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.12)',
                }}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="px-4 pb-4 flex gap-2">
            {!isFirst ? (
              <button
                onClick={handlePrev}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', border, color: subColor }}
              >
                <i className="ri-arrow-left-line text-xs" />
              </button>
            ) : (
              <button
                onClick={handleSkip}
                className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border, color: subColor }}
              >
                Atla
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 py-2 rounded-lg text-xs font-bold text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
              style={{ background: currentStep.gradient, boxShadow: `0 4px 12px ${currentStep.iconColor}35` }}
            >
              {isLast ? (
                <><i className="ri-rocket-line" />Başlayalım!</>
              ) : (
                <>Devam Et <i className="ri-arrow-right-line" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
