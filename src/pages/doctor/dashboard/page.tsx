import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import SummaryCard from '@/components/base/SummaryCard';
import StatusBadge from '@/components/base/StatusBadge';
import PageHeader from '@/components/base/PageHeader';
import EmptyState from '@/components/base/EmptyState';

const todayStr = new Date().toISOString().split('T')[0];

const recentActivities = [
  { id: '1', text: 'Arçelik A.Ş. — periyodik muayene tamamlandı', time: '3 saat önce', icon: 'ri-checkbox-circle-line', color: 'var(--success)' },
  { id: '2', text: 'Bosch Sanayi — 2 personel sağlık raporu güncellendi', time: '1 gün önce', icon: 'ri-heart-pulse-line', color: 'var(--info)' },
  { id: '3', text: 'Vestel Elektronik — iş kazası raporu oluşturuldu', time: '2 gün önce', icon: 'ri-file-warning-line', color: 'var(--danger)' },
  { id: '4', text: 'Arçelik A.Ş. — 5 personel muayene planlandı', time: '3 gün önce', icon: 'ri-calendar-line', color: 'var(--warning)' },
];

const healthSummary = [
  { label: 'Uygun', count: 42, color: 'var(--success)', bg: 'var(--success-bg)', icon: 'ri-checkbox-circle-line' },
  { label: 'Muayene Gerekli', count: 8, color: 'var(--warning)', bg: 'var(--warning-bg)', icon: 'ri-alarm-warning-line' },
  { label: 'Uygun Değil', count: 2, color: 'var(--danger)', bg: 'var(--danger-bg)', icon: 'ri-close-circle-line' },
];

export default function DoctorDashboard() {
  const { session } = useAuth();
  const { firms, visits } = useApp();
  const navigate = useNavigate();

  const myVisits = visits.filter((v) => v.personnelId === session?.userId);
  const todayVisits = myVisits.filter((v) => v.date === todayStr);
  const activeVisits = myVisits.filter((v) => v.status === 'active');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title={`${greeting}, Dr. ${session?.fullName?.split(' ')[0] ?? 'Hekim'}`}
        description="İş hekimliği operasyonlarınıza genel bakış"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
        <SummaryCard label="Atanmış Firma" value={firms.length} icon="ri-building-2-line" iconColor="var(--purple)" />
        <SummaryCard label="Bugünkü Ziyaret" value={todayVisits.length} icon="ri-calendar-check-line" iconColor="var(--success)" />
        <SummaryCard label="Aktif Ziyaret" value={activeVisits.length} icon="ri-stethoscope-line" iconColor="var(--warning)" />
        <SummaryCard label="Toplam Ziyaret" value={myVisits.length} icon="ri-checkbox-circle-line" iconColor="var(--info)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Health Summary */}
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="card-header">
            <span className="card-title">Sağlık Durumu Özeti</span>
            <button onClick={() => navigate('/doctor/health-status')} className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >Tümünü gör →</button>
          </div>
          <div className="p-4 space-y-3">
            {healthSummary.map((s) => (
              <div key={s.label} className="flex items-center gap-3 px-3 py-3 rounded-lg" style={{ backgroundColor: s.bg, border: `1px solid ${s.color}20` }}>
                <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: `${s.color}20` }}>
                  <i className={`${s.icon} text-sm`} style={{ color: s.color }} />
                </div>
                <span className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                <span className="text-lg font-bold" style={{ color: s.color }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Assigned Firms */}
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="card-header">
            <span className="card-title">Atanmış Firmalar</span>
            <button onClick={() => navigate('/doctor/firms')} className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}
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
                  onClick={() => navigate('/doctor/firms')}
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
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="card-header">
            <span className="card-title">Son İşlemler</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {recentActivities.map((act) => (
              <div key={act.id} className="flex items-start gap-3 px-5 py-3.5">
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

      {/* Active visit banner */}
      {activeVisits.length > 0 && (
        <div className="mt-6 rounded-xl p-5 flex items-center gap-4" style={{ backgroundColor: 'var(--purple-bg)', border: '1px solid rgba(139,92,246,0.25)' }}>
          <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: 'rgba(139,92,246,0.15)' }}>
            <i className="ri-stethoscope-line text-lg" style={{ color: 'var(--purple)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--purple-text)' }}>Aktif Saha Ziyareti</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--purple-text)', opacity: 0.8 }}>Şu anda {activeVisits.length} aktif ziyaretiniz var.</p>
          </div>
        </div>
      )}
    </div>
  );
}
