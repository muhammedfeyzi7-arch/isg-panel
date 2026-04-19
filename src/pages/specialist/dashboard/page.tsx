import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import SummaryCard from '@/components/base/SummaryCard';
import StatusBadge from '@/components/base/StatusBadge';
import PageHeader from '@/components/base/PageHeader';
import EmptyState from '@/components/base/EmptyState';

const todayStr = new Date().toISOString().split('T')[0];

const recentActivities = [
  { id: '1', type: 'visit', text: 'Arçelik A.Ş. saha ziyareti tamamlandı', time: '2 saat önce', icon: 'ri-checkbox-circle-line', color: 'var(--success)' },
  { id: '2', type: 'doc', text: 'Bosch Sanayi için risk değerlendirmesi yüklendi', time: '5 saat önce', icon: 'ri-file-add-line', color: 'var(--info)' },
  { id: '3', type: 'training', text: 'Yangın güvenliği eğitimi planlandı', time: 'Dün', icon: 'ri-graduation-cap-line', color: 'var(--warning)' },
  { id: '4', type: 'doc', text: 'Vestel Elektronik belge süresi yaklaşıyor', time: '2 gün önce', icon: 'ri-alarm-warning-line', color: 'var(--danger)' },
];

const pendingItems = [
  { id: '1', label: 'Eksik Belge', count: 3, icon: 'ri-file-warning-line', color: 'var(--danger)', path: '/specialist/document-tracking' },
  { id: '2', label: 'Yaklaşan Eğitim', count: 2, icon: 'ri-graduation-cap-line', color: 'var(--warning)', path: '/specialist/trainings' },
  { id: '3', label: 'Bekleyen İzin', count: 1, icon: 'ri-file-shield-2-line', color: 'var(--info)', path: '/specialist/work-permits' },
  { id: '4', label: 'Sağlık Muayenesi', count: 5, icon: 'ri-heart-pulse-line', color: 'var(--purple)', path: '/specialist/health-status' },
];

export default function SpecialistDashboard() {
  const { session } = useAuth();
  const { firms, visits } = useApp();
  const navigate = useNavigate();

  const myVisits = visits.filter((v) => v.personnelId === session?.userId);
  const todayVisits = myVisits.filter((v) => v.date === todayStr);
  const activeVisits = myVisits.filter((v) => v.status === 'active');
  const completedVisits = myVisits.filter((v) => v.status === 'completed');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title={`${greeting}, ${session?.fullName?.split(' ')[0] ?? 'Uzman'}`}
        description="İş güvenliği operasyonlarınıza genel bakış"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
        <SummaryCard label="Atanmış Firma" value={firms.length} icon="ri-building-2-line" iconColor="var(--info)" />
        <SummaryCard label="Bugünkü Ziyaret" value={todayVisits.length} icon="ri-calendar-check-line" iconColor="var(--success)" />
        <SummaryCard label="Aktif Ziyaret" value={activeVisits.length} icon="ri-map-pin-time-line" iconColor="var(--warning)" />
        <SummaryCard label="Tamamlanan" value={completedVisits.length} icon="ri-checkbox-circle-line" iconColor="var(--purple)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Pending Items */}
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="card-header">
            <span className="card-title">Bekleyen İşler</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {pendingItems.reduce((a, b) => a + b.count, 0)} işlem
            </span>
          </div>
          <div className="p-4 space-y-2">
            {pendingItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer text-left"
                style={{ border: '1px solid var(--border-subtle)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <i className={`${item.icon} text-sm`} style={{ color: item.color }} />
                </div>
                <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface)', color: item.color, border: `1px solid ${item.color}30` }}>
                  {item.count}
                </span>
                <i className="ri-arrow-right-s-line text-sm" style={{ color: 'var(--text-muted)' }} />
              </button>
            ))}
          </div>
        </div>

        {/* Assigned Firms */}
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="card-header">
            <span className="card-title">Atanmış Firmalar</span>
            <button onClick={() => navigate('/specialist/firms')} className="text-xs cursor-pointer transition-colors" style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >Tümünü gör →</button>
          </div>
          {firms.length === 0 ? (
            <EmptyState icon="ri-building-2-line" title="Firma atanmamış" description="Yöneticiniz size firma atadığında burada görünecek." />
          ) : (
            <div>
              {firms.slice(0, 5).map((f) => (
                <div key={f.id} className="px-5 py-3.5 flex items-center gap-3 transition-colors cursor-pointer" style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onClick={() => navigate('/specialist/firms')}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <i className="ri-building-2-line text-sm" style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{f.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{f.address}</p>
                  </div>
                  <StatusBadge status={f.dangerClass} />
                </div>
              ))}
              {firms.length > 5 && (
                <div className="px-5 py-3 text-center">
                  <button onClick={() => navigate('/specialist/firms')} className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                    +{firms.length - 5} firma daha →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="card-header">
            <span className="card-title">Son İşlemler</span>
          </div>
          <div className="p-4 space-y-1">
            {recentActivities.map((act) => (
              <div key={act.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <i className={`${act.icon} text-xs`} style={{ color: act.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{act.text}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{act.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Field Work Banner */}
      {activeVisits.length > 0 && (
        <div className="mt-4 md:mt-6 rounded-xl p-4 md:p-5 flex items-center gap-4" style={{ backgroundColor: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: 'rgba(16,185,129,0.15)' }}>
            <i className="ri-map-pin-time-line text-lg" style={{ color: 'var(--success)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--success-text)' }}>Aktif Saha Ziyareti</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--success-text)', opacity: 0.8 }}>Şu anda {activeVisits.length} aktif ziyaretiniz var.</p>
          </div>
          <button onClick={() => navigate('/specialist/firms')} className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap" style={{ backgroundColor: 'var(--success)', color: '#fff' }}>
            Firmalarım
          </button>
        </div>
      )}
    </div>
  );
}
