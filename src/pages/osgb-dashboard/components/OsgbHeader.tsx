import { useAuth } from '@/store/AuthContext';

type Tab = 'dashboard' | 'firmalar' | 'uzmanlar' | 'raporlar';

interface OsgbHeaderProps {
  activeTab: Tab;
  collapsed: boolean;
  orgName: string;
  onMobileMenuToggle?: () => void;
  onFirmaEkle?: () => void;
  onUzmanEkle?: () => void;
}

const tabMeta: Record<Tab, { label: string; icon: string }> = {
  dashboard: { label: 'Genel Bakış', icon: 'ri-dashboard-3-line' },
  firmalar:  { label: 'Müşteri Firmalar', icon: 'ri-building-2-line' },
  uzmanlar:  { label: 'Gezici Uzmanlar', icon: 'ri-user-star-line' },
  raporlar:  { label: 'Raporlar', icon: 'ri-bar-chart-2-line' },
};

export default function OsgbHeader({
  activeTab, collapsed, orgName, onMobileMenuToggle, onFirmaEkle, onUzmanEkle,
}: OsgbHeaderProps) {
  const { user } = useAuth();
  const meta = tabMeta[activeTab];

  const hour = new Date().getHours();
  const greeting = hour >= 6 && hour < 12 ? 'Günaydın' : hour >= 12 && hour < 17 ? 'İyi Günler' : 'İyi Akşamlar';
  const firstName = user?.email?.split('@')[0] ?? 'Admin';

  return (
    <header
      className={`fixed top-0 right-0 z-30 flex items-center ${collapsed ? 'lg:left-[48px]' : 'lg:left-[168px]'} left-0`}
      style={{
        height: '46px',
        background: 'var(--bg-header, rgba(255,255,255,0.97))',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderBottom: '1px solid var(--border-subtle, rgba(15,23,42,0.075))',
        boxShadow: '0 1px 6px rgba(15,23,42,0.06)',
        transition: 'left 0.26s cubic-bezier(0.4,0,0.2,1)',
        paddingLeft: '10px',
        paddingRight: '10px',
        gap: '6px',
      }}
    >
      {/* Mobile hamburger */}
      <button
        onClick={onMobileMenuToggle}
        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer lg:hidden flex-shrink-0"
        style={{ color: '#64748b', background: 'rgba(15,23,42,0.038)', border: '1px solid rgba(15,23,42,0.09)' }}
      >
        <i className="ri-menu-line text-sm" />
      </button>

      {/* Sayfa başlığı */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div
          className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: 'rgba(16,185,129,0.1)' }}
        >
          <i className={`${meta.icon} text-[11px]`} style={{ color: '#10B981' }} />
        </div>
        <span className="text-[12px] sm:text-[13px] font-bold truncate" style={{ color: '#0f172a', maxWidth: '140px' }}>
          {meta.label}
        </span>
      </div>

      <div className="flex-1" />

      {/* Selamlama */}
      <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
        <p className="text-[11.5px] font-medium" style={{ color: '#64748b' }}>
          {greeting}, <span className="font-bold" style={{ color: '#0f172a' }}>{firstName}</span>
        </p>
      </div>

      {/* OSGB badge */}
      <div
        className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0"
        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#059669' }}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
        OSGB Admin · {orgName}
      </div>

      {/* Hızlı eylemler */}
      {activeTab === 'firmalar' && onFirmaEkle && (
        <button
          onClick={onFirmaEkle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer whitespace-nowrap flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #10B981, #059669)',
            fontSize: '11px',
            borderRadius: '8px',
          }}
        >
          <i className="ri-add-line text-sm" />
          <span className="hidden sm:inline">Firma Ekle</span>
        </button>
      )}

      {activeTab === 'uzmanlar' && onUzmanEkle && (
        <button
          onClick={onUzmanEkle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer whitespace-nowrap flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #10B981, #059669)',
            fontSize: '11px',
            borderRadius: '8px',
          }}
        >
          <i className="ri-user-add-line text-sm" />
          <span className="hidden sm:inline">Uzman Ekle</span>
        </button>
      )}

      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
      >
        {(user?.email ?? 'O').charAt(0).toUpperCase()}
      </div>
    </header>
  );
}
