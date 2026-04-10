import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';

export default function GeziciUzmanBanner() {
  const { org } = useApp();
  const { logout } = useAuth();

  if (org?.osgbRole !== 'gezici_uzman') return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-center gap-3 px-4"
      style={{
        height: '36px',
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
        borderBottom: '1px solid rgba(16,185,129,0.25)',
      }}
    >
      {/* Gezici uzman badge */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="w-5 h-5 flex items-center justify-center rounded-md" style={{ background: 'rgba(16,185,129,0.2)' }}>
          <i className="ri-user-star-line text-[10px]" style={{ color: '#6EE7B7' }} />
        </div>
        <span className="text-[11px] font-bold" style={{ color: '#6EE7B7' }}>Gezici Uzman</span>
      </div>

      <span className="text-[10px]" style={{ color: 'rgba(110,231,183,0.4)' }}>|</span>

      {/* Aktif firma — sadece gösterim, tıklanamaz */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
      >
        <i className="ri-building-2-line text-[10px]" style={{ color: '#34D399' }} />
        <span className="text-[11px] font-semibold" style={{ color: '#34D399' }}>
          {org.name}
        </span>
        <i className="ri-lock-line text-[9px]" style={{ color: 'rgba(52,211,153,0.5)' }} title="Admin tarafından atanmıştır" />
      </div>

      <div className="flex-1" />

      {/* Çıkış */}
      <button
        onClick={logout}
        className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg transition-all"
        style={{ color: 'rgba(110,231,183,0.6)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(110,231,183,0.6)'; }}
      >
        <i className="ri-logout-box-line text-[11px]" />
        <span className="text-[11px] font-medium hidden sm:block">Çıkış</span>
      </button>
    </div>
  );
}
