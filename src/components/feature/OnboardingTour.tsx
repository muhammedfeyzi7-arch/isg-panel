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
  targetId?: string;
}

const ADMIN_STEPS: TourStep[] = [
  {
    title: 'ISG Denetim\'e Hoş Geldiniz!',
    description: 'Bu kısa tur ile sistemi hızlıca tanıyacaksınız. İstediğiniz zaman atlayabilirsiniz.',
    icon: 'ri-shield-star-line',
    iconColor: '#818CF8',
    iconBg: 'rgba(99,102,241,0.15)',
  },
  {
    title: 'Kontrol Paneli',
    description: 'Tüm önemli verileri tek ekranda görün. Bildirimler, istatistikler ve yaklaşan görevler burada.',
    icon: 'ri-dashboard-3-line',
    iconColor: '#10B981',
    iconBg: 'rgba(16,185,129,0.15)',
    targetId: 'sidebar-dashboard',
  },
  {
    title: 'Firmalar',
    description: 'Denetlediğiniz firmaları buradan yönetin. Firma ekleyin, düzenleyin ve takip edin.',
    icon: 'ri-building-2-line',
    iconColor: '#60A5FA',
    iconBg: 'rgba(96,165,250,0.15)',
    targetId: 'sidebar-firmalar',
  },
  {
    title: 'Personeller',
    description: 'Personel bilgilerini, evraklarını ve sağlık kayıtlarını buradan takip edin.',
    icon: 'ri-team-line',
    iconColor: '#4ADE80',
    iconBg: 'rgba(74,222,128,0.15)',
    targetId: 'sidebar-personeller',
  },
  {
    title: 'Saha Denetim',
    description: 'Uygunsuzlukları kaydedin, DÖF açın ve kapatma süreçlerini yönetin.',
    icon: 'ri-map-pin-user-line',
    iconColor: '#FB923C',
    iconBg: 'rgba(251,146,60,0.15)',
    targetId: 'sidebar-uygunsuzluklar',
  },
  {
    title: 'Ekip Yönetimi',
    description: 'Ayarlar menüsünden yeni kullanıcı ekleyebilir, rol atayabilirsiniz.',
    icon: 'ri-group-line',
    iconColor: '#F59E0B',
    iconBg: 'rgba(245,158,11,0.15)',
    targetId: 'sidebar-ayarlar',
  },
  {
    title: 'Hazırsınız!',
    description: 'Sistemi kullanmaya başlayabilirsiniz. Sol menüden istediğiniz modüle geçin. İyi çalışmalar!',
    icon: 'ri-rocket-line',
    iconColor: '#10B981',
    iconBg: 'rgba(16,185,129,0.15)',
  },
];

const MEMBER_STEPS: TourStep[] = [
  {
    title: 'ISG Denetim\'e Hoş Geldiniz!',
    description: 'Evrak/Dökümantasyon Denetçi olarak sisteme erişiminiz hazır. Hızlı bir tur yapalım.',
    icon: 'ri-file-list-3-line',
    iconColor: '#A78BFA',
    iconBg: 'rgba(167,139,250,0.15)',
  },
  {
    title: 'Evrak Takibi',
    description: 'Personel evraklarını buradan yönetin. Süresi dolmak üzere olan evraklar için bildirim alırsınız.',
    icon: 'ri-file-list-3-line',
    iconColor: '#C084FC',
    iconBg: 'rgba(192,132,252,0.15)',
    targetId: 'sidebar-evraklar',
  },
  {
    title: 'Eğitim Evrakları',
    description: 'Personel eğitim belgelerini ve geçerlilik sürelerini buradan takip edin.',
    icon: 'ri-graduation-cap-line',
    iconColor: '#2DD4BF',
    iconBg: 'rgba(45,212,191,0.15)',
    targetId: 'sidebar-egitimler',
  },
  {
    title: 'Tutanaklar',
    description: 'Denetim tutanaklarını oluşturun, imzalayın ve arşivleyin.',
    icon: 'ri-article-line',
    iconColor: '#FB923C',
    iconBg: 'rgba(251,146,60,0.15)',
    targetId: 'sidebar-tutanaklar',
  },
  {
    title: 'Hazırsınız!',
    description: 'Sistemi kullanmaya başlayabilirsiniz. Sol menüden istediğiniz modüle geçin. İyi çalışmalar!',
    icon: 'ri-rocket-line',
    iconColor: '#10B981',
    iconBg: 'rgba(16,185,129,0.15)',
  },
];

const DENETCI_STEPS: TourStep[] = [
  {
    title: 'ISG Denetim\'e Hoş Geldiniz!',
    description: 'Saha Personeli olarak sisteme erişiminiz hazır. Hızlı bir tur yapalım.',
    icon: 'ri-map-pin-user-line',
    iconColor: '#22D3EE',
    iconBg: 'rgba(34,211,238,0.15)',
  },
  {
    title: 'Saha Denetim',
    description: 'Sahada tespit ettiğiniz uygunsuzlukları buradan kaydedin ve takip edin.',
    icon: 'ri-map-pin-user-line',
    iconColor: '#FB923C',
    iconBg: 'rgba(251,146,60,0.15)',
    targetId: 'sidebar-uygunsuzluklar',
  },
  {
    title: 'Ekipman Kontrolleri',
    description: 'Ekipmanların periyodik kontrollerini kaydedin ve durumlarını güncelleyin.',
    icon: 'ri-tools-line',
    iconColor: '#34D399',
    iconBg: 'rgba(52,211,153,0.15)',
    targetId: 'sidebar-ekipmanlar',
  },
  {
    title: 'Hazırsınız!',
    description: 'Sistemi kullanmaya başlayabilirsiniz. Sol menüden istediğiniz modüle geçin. İyi çalışmalar!',
    icon: 'ri-rocket-line',
    iconColor: '#10B981',
    iconBg: 'rgba(16,185,129,0.15)',
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

  // stepIndex'i ref + state ile tut — modül değişiminden etkilenmesin
  const stepIndexRef = useRef(0);
  const [stepIndex, setStepIndexState] = useState(0);
  const [visible, setVisible] = useState(false);
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  const [, forceRender] = useState(0);

  // BUG FIX #1: checkedRef user bazlı tutulmalı — farklı kullanıcı girişinde sıfırlansın
  const checkedUserIdRef = useRef<string | null>(null);

  const setStepIndex = useCallback((i: number) => {
    stepIndexRef.current = i;
    setStepIndexState(i);
  }, []);

  const role = org?.role ?? 'member';
  const steps = getTourSteps(role);
  const currentStep = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  // Turu göster: Supabase'den kontrol et, localStorage fallback
  useEffect(() => {
    // org.id VE user.id ikisi de hazır olmalı — erken çalışmayı engelle
    // NOT: org.id bekliyoruz çünkü rol bilgisi org'dan geliyor
    if (!user?.id) return;

    // Aynı kullanıcı için tekrar çalışmasın, ama farklı kullanıcı için çalışsın
    // NOT: org.id'yi beklememek için sadece user.id ile track ediyoruz
    if (checkedUserIdRef.current === user.id) return;
    checkedUserIdRef.current = user.id;

    const localKey = `${TOUR_STORAGE_KEY}_${user.id}`;
    let cancelled = false;
    let showTimer: ReturnType<typeof setTimeout> | null = null;

    // Önce localStorage'a bak (hızlı kontrol — aynı cihazda cache)
    try {
      const localDone = localStorage.getItem(localKey);
      if (localDone === '1') return; // Bu cihazda zaten tamamlanmış
    } catch { /* ignore */ }

    // Supabase'den kontrol et (cihazlar arası kalıcı durum)
    supabase
      .from('profiles')
      .select('tour_completed')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          // Supabase hatası — localStorage'da da yoksa göster
          showTimer = setTimeout(() => { if (!cancelled) setVisible(true); }, 800);
          return;
        }

        if (data?.tour_completed === true) {
          // Supabase'de tamamlanmış — localStorage cache'e yaz
          try { localStorage.setItem(localKey, '1'); } catch { /* ignore */ }
          return;
        }

        // Tamamlanmamış (data null veya tour_completed false) — turu göster
        showTimer = setTimeout(() => { if (!cancelled) setVisible(true); }, 800);
      })
      .catch(() => {
        // Network hatası — localStorage'da da yoksa göster
        if (!cancelled) {
          showTimer = setTimeout(() => { if (!cancelled) setVisible(true); }, 800);
        }
      });

    // BUG FIX #3: Cleanup düzgün çalışsın — Promise içinde değil dışında
    return () => {
      cancelled = true;
      if (showTimer) clearTimeout(showTimer);
    };
  }, [org?.id, user?.id]);

  // Hedef elementi bul — modül değişiminden bağımsız
  useEffect(() => {
    if (!visible) return;
    if (!currentStep?.targetId) {
      setTargetEl(null);
      return;
    }
    // Kısa gecikme ile DOM'u bekle
    const t = setTimeout(() => {
      const el = document.getElementById(currentStep.targetId!);
      setTargetEl(el);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      forceRender(n => n + 1); // highlight pozisyonunu güncelle
    }, 100);
    return () => clearTimeout(t);
  }, [visible, stepIndex, currentStep?.targetId]);

  const completeTour = useCallback(async () => {
    if (!user?.id) return;

    // Önce UI'ı kapat — kullanıcı beklemeden devam etsin
    setVisible(false);

    // localStorage'a hemen yaz (anlık etki, aynı cihaz)
    try {
      localStorage.setItem(`${TOUR_STORAGE_KEY}_${user.id}`, '1');
    } catch { /* ignore */ }

    // BUG FIX #4: update yerine upsert — profiles satırı yoksa da çalışsın
    try {
      await supabase
        .from('profiles')
        .upsert(
          { user_id: user.id, tour_completed: true },
          { onConflict: 'user_id', ignoreDuplicates: false }
        );
    } catch { /* ignore — localStorage zaten yazıldı */ }
  }, [user?.id]);

  const handleNext = useCallback(() => {
    const nextIndex = stepIndexRef.current + 1;
    if (nextIndex < steps.length) {
      setStepIndex(nextIndex);
    } else {
      completeTour();
    }
  }, [steps.length, setStepIndex, completeTour]);

  const handleSkip = useCallback(() => {
    completeTour();
  }, [completeTour]);

  if (!visible || !currentStep) return null;

  const hasTarget = !!currentStep.targetId;
  const isCenter = !hasTarget || !targetEl;

  // Tooltip pozisyonu
  let tooltipStyle: React.CSSProperties = {};
  let arrowVisible = false;
  let highlightStyle: React.CSSProperties = {};

  if (!isCenter && targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const tooltipWidth = 300;
    const tooltipTop = rect.top + rect.height / 2 - 90;

    tooltipStyle = {
      position: 'fixed',
      top: Math.max(16, Math.min(tooltipTop, window.innerHeight - 240)),
      left: Math.min(rect.right + 20, window.innerWidth - tooltipWidth - 16),
      width: tooltipWidth,
      zIndex: 99999,
    };
    arrowVisible = true;

    highlightStyle = {
      position: 'fixed',
      zIndex: 99999,
      top: rect.top - 5,
      left: rect.left - 5,
      width: rect.width + 10,
      height: rect.height + 10,
      borderRadius: '12px',
      border: `2px solid ${currentStep.iconColor}`,
      boxShadow: `0 0 0 4px ${currentStep.iconColor}20, 0 0 24px ${currentStep.iconColor}35`,
      pointerEvents: 'none',
      transition: 'all 0.3s ease',
    };
  }

  const bg = isDark ? '#0D1526' : '#ffffff';
  const border = isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(15,23,42,0.15)';
  const nameColor = isDark ? '#E2E8F0' : '#0F172A';
  const subColor = isDark ? '#64748B' : '#94A3B8';

  const ProgressDots = ({ size = 'md' }: { size?: 'sm' | 'md' }) => (
    <div className={`flex ${size === 'md' ? 'justify-center gap-1.5' : 'items-center gap-1'}`}>
      {steps.map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === stepIndex ? (size === 'md' ? 20 : 14) : (size === 'md' ? 6 : 5),
            height: size === 'md' ? 6 : 5,
            background: i === stepIndex
              ? currentStep.iconColor
              : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.15)',
          }}
        />
      ))}
      {size === 'sm' && (
        <span className="ml-auto text-[10px] font-semibold" style={{ color: subColor }}>
          {stepIndex + 1}/{steps.length}
        </span>
      )}
    </div>
  );

  const ActionButtons = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex gap-${compact ? '2' : '3'}`}>
      <button
        onClick={handleSkip}
        className={`flex-1 ${compact ? 'py-2 text-xs' : 'py-2.5 text-sm'} rounded-xl font-semibold cursor-pointer whitespace-nowrap transition-all`}
        style={{
          background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.1)',
          color: subColor,
        }}
      >
        <i className="ri-skip-forward-line mr-1" />
        Atla
      </button>
      <button
        onClick={handleNext}
        className={`flex-1 ${compact ? 'py-2 text-xs' : 'py-2.5 text-sm'} rounded-xl font-bold text-white cursor-pointer whitespace-nowrap transition-all`}
        style={{
          background: `linear-gradient(135deg, ${currentStep.iconColor}, ${currentStep.iconColor}bb)`,
          boxShadow: compact ? 'none' : `0 4px 14px ${currentStep.iconColor}35`,
        }}
      >
        {isLast ? (
          <><i className="ri-check-line mr-1" />Başlayalım!</>
        ) : (
          <>İleri <i className="ri-arrow-right-line ml-1" /></>
        )}
      </button>
    </div>
  );

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0"
        style={{
          zIndex: 99998,
          background: isCenter ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.4)',
          backdropFilter: isCenter ? 'blur(6px)' : 'blur(2px)',
          transition: 'all 0.3s ease',
        }}
      />

      {/* Highlight ring */}
      {!isCenter && targetEl && <div style={highlightStyle} />}

      {/* CENTER modal */}
      {isCenter && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div
            className="w-full max-w-sm rounded-2xl p-7 space-y-5"
            style={{ background: bg, border, boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
          >
            <div className="flex justify-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: currentStep.iconBg, border: `1px solid ${currentStep.iconColor}30` }}
              >
                <i className={`${currentStep.icon} text-3xl`} style={{ color: currentStep.iconColor }} />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold" style={{ color: nameColor }}>{currentStep.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: subColor }}>{currentStep.description}</p>
            </div>
            <ProgressDots size="md" />
            <ActionButtons compact={false} />
          </div>
        </div>
      )}

      {/* TOOLTIP (sidebar yanında) */}
      {!isCenter && (
        <div style={tooltipStyle}>
          {/* Ok işareti */}
          {arrowVisible && (
            <div style={{
              position: 'absolute',
              left: -8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderRight: isDark ? '8px solid #0D1526' : '8px solid #ffffff',
              zIndex: 1,
            }} />
          )}
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ background: bg, border, boxShadow: '0 20px 50px rgba(0,0,0,0.45)' }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: currentStep.iconBg }}
              >
                <i className={`${currentStep.icon} text-lg`} style={{ color: currentStep.iconColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold" style={{ color: nameColor }}>{currentStep.title}</h4>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: subColor }}>{currentStep.description}</p>
              </div>
            </div>
            <ProgressDots size="sm" />
            <ActionButtons compact={true} />
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
