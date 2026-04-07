import { useState } from 'react';
import { useApp } from '@/store/AppContext';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  description: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  module: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'firma',
    label: 'Firma',
    icon: 'ri-building-2-line',
    description: 'Yeni firma kaydı',
    accentColor: '#3B82F6',
    gradientFrom: '#3B82F6',
    gradientTo: '#6366F1',
    module: 'firmalar',
  },
  {
    id: 'personel',
    label: 'Personel',
    icon: 'ri-user-add-line',
    description: 'Personel ekle',
    accentColor: '#10B981',
    gradientFrom: '#10B981',
    gradientTo: '#059669',
    module: 'personeller',
  },
  {
    id: 'evrak',
    label: 'Evrak',
    icon: 'ri-file-add-line',
    description: 'Belge yükle',
    accentColor: '#F59E0B',
    gradientFrom: '#F59E0B',
    gradientTo: '#D97706',
    module: 'evraklar',
  },
  {
    id: 'egitim',
    label: 'Eğitim',
    icon: 'ri-graduation-cap-line',
    description: 'Eğitim planla',
    accentColor: '#8B5CF6',
    gradientFrom: '#8B5CF6',
    gradientTo: '#7C3AED',
    module: 'egitimler',
  },
  {
    id: 'muayene',
    label: 'Muayene',
    icon: 'ri-heart-pulse-line',
    description: 'Muayene ekle',
    accentColor: '#EC4899',
    gradientFrom: '#EC4899',
    gradientTo: '#DB2777',
    module: 'muayeneler',
  },
  {
    id: 'uygunsuzluk',
    label: 'Uygunsuzluk',
    icon: 'ri-alert-line',
    description: 'DÖF aç',
    accentColor: '#EF4444',
    gradientFrom: '#EF4444',
    gradientTo: '#DC2626',
    module: 'uygunsuzluklar',
  },
  {
    id: 'ekipman',
    label: 'Ekipman',
    icon: 'ri-tools-line',
    description: 'Ekipman kaydet',
    accentColor: '#FB923C',
    gradientFrom: '#FB923C',
    gradientTo: '#EA580C',
    module: 'ekipmanlar',
  },

];

export default function QuickAdd() {
  const { setActiveModule } = useApp();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleClick = (action: QuickAction) => {
    setActiveModule(action.module as Parameters<typeof setActiveModule>[0]);
  };

  return (
    <div className="rounded-2xl overflow-hidden isg-card">
      {/* Rainbow accent bar */}
      <div
        className="h-[2px] w-full"
        style={{
          background:
            'linear-gradient(90deg, #3B82F6, #10B981, #F59E0B, #8B5CF6, #EC4899, #EF4444, #FB923C, #34D399)',
        }}
      />

      <div className="px-5 pt-4 pb-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
              boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
            }}
          >
            <i className="ri-add-circle-line text-white text-sm" />
          </div>
          <div>
            <h2
              className="text-[13.5px] font-bold"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              Hızlı Ekle
            </h2>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Modüle git ve yeni kayıt oluştur
            </p>
          </div>
          <div
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
            style={{
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
              color: '#A5B4FC',
            }}
          >
            <i className="ri-flashlight-line text-[10px]" />
            {QUICK_ACTIONS.length} modül
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {QUICK_ACTIONS.map((action) => {
            const isHovered = hoveredId === action.id;
            return (
              <button
                key={action.id}
                onClick={() => handleClick(action)}
                onMouseEnter={() => setHoveredId(action.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="flex flex-col items-center gap-2 py-3 px-1 rounded-xl cursor-pointer transition-all duration-200 whitespace-nowrap group"
                style={{
                  background: isHovered
                    ? `linear-gradient(145deg, ${action.gradientFrom}18, ${action.gradientTo}0a)`
                    : 'var(--bg-item)',
                  border: isHovered
                    ? `1px solid ${action.accentColor}40`
                    : '1px solid var(--bg-item-border)',
                  transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
                  boxShadow: isHovered
                    ? `0 8px 20px ${action.accentColor}20`
                    : 'none',
                }}
              >
                {/* Icon circle */}
                <div
                  className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200"
                  style={{
                    background: isHovered
                      ? `linear-gradient(135deg, ${action.gradientFrom}, ${action.gradientTo})`
                      : `${action.accentColor}15`,
                    boxShadow: isHovered
                      ? `0 4px 12px ${action.accentColor}40`
                      : 'none',
                  }}
                >
                  <i
                    className={`${action.icon} text-[15px] transition-all duration-200`}
                    style={{
                      color: isHovered ? '#ffffff' : action.accentColor,
                    }}
                  />
                </div>

                {/* Label */}
                <span
                  className="text-[10.5px] font-semibold transition-colors duration-200"
                  style={{
                    color: isHovered ? action.accentColor : 'var(--text-muted)',
                  }}
                >
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bottom hint */}
        <div
          className="mt-3 pt-3 flex items-center gap-2"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <i className="ri-information-line text-[11px]" style={{ color: 'var(--text-faint)' }} />
          <p className="text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
            İlgili modüle giderek yeni kayıt oluşturabilirsiniz
          </p>
        </div>
      </div>
    </div>
  );
}
