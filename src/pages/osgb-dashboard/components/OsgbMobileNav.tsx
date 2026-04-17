type Tab = 'dashboard' | 'firmalar' | 'uzmanlar' | 'ziyaretler' | 'raporlar' | 'analitik' | 'copkutusu' | 'ayarlar';

interface OsgbMobileNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  firmaCount?: number;
  uzmanCount?: number;
}

const NAV_ITEMS: { id: Tab; icon: string; activeIcon: string; label: string }[] = [
  { id: 'dashboard',   icon: 'ri-home-5-line',            activeIcon: 'ri-home-5-fill',            label: 'Ana Sayfa' },
  { id: 'firmalar',    icon: 'ri-building-3-line',         activeIcon: 'ri-building-3-fill',         label: 'Firmalar' },
  { id: 'uzmanlar',    icon: 'ri-shield-user-line',        activeIcon: 'ri-shield-user-fill',        label: 'Personel' },
  { id: 'ziyaretler',  icon: 'ri-map-pin-2-line',          activeIcon: 'ri-map-pin-2-fill',          label: 'Ziyaret' },
  { id: 'raporlar',    icon: 'ri-bar-chart-2-line',        activeIcon: 'ri-bar-chart-2-fill',        label: 'Raporlar' },
];

export default function OsgbMobileNav({ activeTab, setActiveTab }: OsgbMobileNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{
        background: 'var(--bg-sidebar)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      {/* Nav items */}
      <div
        className="flex items-center"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
      >
        {NAV_ITEMS.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 pt-2.5 pb-1.5 cursor-pointer transition-all duration-200 relative"
              style={{ minHeight: '56px' }}
            >
              {/* Active indicator dot at top */}
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                  style={{
                    width: '20px',
                    height: '3px',
                    background: '#0EA5E9',
                    borderRadius: '0 0 4px 4px',
                  }}
                />
              )}

              {/* Icon container */}
              <span
                className="flex items-center justify-center rounded-xl transition-all duration-200"
                style={{
                  width: '36px',
                  height: '32px',
                  background: isActive ? 'rgba(14,165,233,0.12)' : 'transparent',
                  transform: isActive ? 'translateY(-1px)' : 'none',
                }}
              >
                <i
                  className={`${isActive ? item.activeIcon : item.icon}`}
                  style={{
                    fontSize: '19px',
                    color: isActive ? '#0EA5E9' : 'var(--text-faint)',
                    transition: 'color 0.15s ease',
                  }}
                />
              </span>

              {/* Label */}
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#0EA5E9' : 'var(--text-faint)',
                  transition: 'color 0.15s ease',
                  lineHeight: 1,
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
