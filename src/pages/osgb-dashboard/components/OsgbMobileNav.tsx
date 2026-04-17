type Tab = 'dashboard' | 'firmalar' | 'uzmanlar' | 'ziyaretler' | 'raporlar' | 'analitik' | 'copkutusu' | 'ayarlar';

interface OsgbMobileNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  firmaCount?: number;
  uzmanCount?: number;
}

const NAV_ITEMS: { id: Tab; icon: string; activeIcon: string; label: string }[] = [
  { id: 'dashboard',   icon: 'ri-layout-grid-line',      activeIcon: 'ri-layout-grid-fill',      label: 'Genel' },
  { id: 'firmalar',    icon: 'ri-building-3-line',        activeIcon: 'ri-building-3-fill',        label: 'Firmalar' },
  { id: 'uzmanlar',    icon: 'ri-shield-user-line',       activeIcon: 'ri-shield-user-fill',       label: 'Personel' },
  { id: 'ziyaretler',  icon: 'ri-map-pin-2-line',         activeIcon: 'ri-map-pin-2-fill',         label: 'Ziyaret' },
  { id: 'raporlar',    icon: 'ri-bar-chart-grouped-line', activeIcon: 'ri-bar-chart-grouped-fill', label: 'Raporlar' },
];

export default function OsgbMobileNav({ activeTab, setActiveTab }: OsgbMobileNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{
        background: 'var(--bg-sidebar)',
        borderTop: '1px solid var(--border-subtle)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-stretch px-2 py-1">
        {NAV_ITEMS.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 cursor-pointer transition-all duration-200 relative rounded-2xl mx-0.5"
              style={{
                minHeight: '52px',
                background: isActive ? 'rgba(14,165,233,0.1)' : 'transparent',
              }}
            >
              {/* Active top indicator */}
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(90deg, #0EA5E9, #0284C7)' }}
                />
              )}

              <span
                className="flex items-center justify-center w-6 h-6"
                style={{
                  transform: isActive ? 'translateY(-1px) scale(1.1)' : 'none',
                  transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                }}
              >
                <i
                  className={`${isActive ? item.activeIcon : item.icon} text-[18px]`}
                  style={{
                    color: isActive ? '#0EA5E9' : 'var(--text-faint)',
                    transition: 'color 0.15s ease',
                  }}
                />
              </span>

              <span
                className="text-[10px] font-semibold leading-none"
                style={{
                  color: isActive ? '#0EA5E9' : 'var(--text-faint)',
                  transition: 'color 0.15s ease',
                  fontWeight: isActive ? 700 : 500,
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
