import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/base/PageHeader';
import SummaryCard from '@/components/base/SummaryCard';
import Button from '@/components/base/Button';
import EmptyState from '@/components/base/EmptyState';
import StatusBadge from '@/components/base/StatusBadge';
import { useApp } from '@/store/AppContext';

const todayStr = new Date().toISOString().split('T')[0];

export default function HomePage() {
  const navigate = useNavigate();
  const { firms, personnel, visits } = useApp();

  const hasData = firms.length > 0 || visits.length > 0 || personnel.length > 0;
  const activePersonnel = personnel.filter((p) => p.status === 'Aktif').length;
  const todayVisits = visits.filter((v) => v.date === todayStr).length;
  const completedThisWeek = visits.filter((v) => v.status === 'Tamamlandı').length;
  const recentVisits = visits.slice(0, 6);

  if (!hasData) {
    return (
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <PageHeader
          title="Genel Bakış"
          description="OSGB operasyonlarınıza genel bir bakış"
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
          <SummaryCard label="Toplam Firma" value="0" icon="ri-building-2-line" iconColor="var(--info)" />
          <SummaryCard label="Aktif Personel" value="0" icon="ri-team-line" iconColor="var(--purple)" />
          <SummaryCard label="Bugünkü Ziyaretler" value="0" icon="ri-map-pin-time-line" iconColor="var(--success)" />
          <SummaryCard label="Bu Hafta Tamamlanan" value="0" icon="ri-checkbox-circle-line" iconColor="var(--warning)" />
        </div>

        <div
          className="rounded-xl"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <EmptyState
            icon="ri-dashboard-line"
            title="Henüz veri yok"
            description="Paneli kullanmaya başlamak için önce bir firma ekleyin. Firmalar, personel ve ziyaretler burada özetlenecek."
            actionLabel="Firma Ekle"
            onAction={() => navigate('/firmalar')}
          />
        </div>

        <div className="mt-4 md:mt-6 grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
          {[
            { step: '01', icon: 'ri-building-2-line', title: 'Firma Ekle', desc: 'Hizmet verdiğiniz firmaları sisteme kaydedin.', path: '/firmalar', cta: 'Firmalar' },
            { step: '02', icon: 'ri-team-line', title: 'Personel Tanımla', desc: 'Uzman ve hekimlerinizi ekleyip firmalara atayın.', path: '/personel', cta: 'Personel' },
            { step: '03', icon: 'ri-map-pin-time-line', title: 'Ziyaret Başlat', desc: 'Saha ziyaretlerini kayıt altına alın.', path: '/ziyaretler', cta: 'Ziyaretler' },
          ].map((item) => (
            <button
              key={item.step}
              onClick={() => navigate(item.path)}
              className="text-left p-5 rounded-xl transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--card)')}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <i className={`${item.icon} text-base`} style={{ color: 'var(--text-secondary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{item.step}</span>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
                  <p className="text-xs font-medium mt-2" style={{ color: 'var(--text-secondary)' }}>{item.cta} →</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Genel Bakış"
        description="OSGB operasyonlarınıza genel bir bakış"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <SummaryCard label="Toplam Firma" value={firms.length} icon="ri-building-2-line" iconColor="var(--info)" />
        <SummaryCard label="Aktif Personel" value={activePersonnel} icon="ri-team-line" iconColor="var(--purple)" />
        <SummaryCard label="Bugünkü Ziyaretler" value={todayVisits} icon="ri-map-pin-time-line" iconColor="var(--success)" />
        <SummaryCard label="Bu Hafta Tamamlanan" value={completedThisWeek} icon="ri-checkbox-circle-line" iconColor="var(--warning)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Recent Visits */}
        <div
          className="lg:col-span-2 rounded-xl"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="card-header">
            <span className="card-title">Son Ziyaretler</span>
            <button
              onClick={() => navigate('/ziyaretler')}
              className="text-xs transition-colors cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              Tümünü gör →
            </button>
          </div>
          {recentVisits.length === 0 ? (
            <EmptyState
              icon="ri-map-pin-time-line"
              title="Henüz ziyaret yok"
              description="İlk ziyareti başlatmak için Ziyaretler sayfasına gidin."
              actionLabel="Ziyaret Başlat"
              onAction={() => navigate('/ziyaretler')}
            />
          ) : (
            <div>
              {recentVisits.map((v) => (
                <div
                  key={v.id}
                  className="px-4 md:px-5 py-3 md:py-3.5 flex items-center gap-3 md:gap-4 transition-colors cursor-pointer"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onClick={() => navigate('/ziyaretler')}
                >
                  <div
                    className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
                    style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <i
                      className={`text-sm ${v.role === 'Hekim' ? 'ri-stethoscope-line' : 'ri-shield-check-line'}`}
                      style={{ color: v.role === 'Hekim' ? 'var(--purple)' : 'var(--info)' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{v.personnel}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{v.firm} · {v.date}</p>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div
          className="rounded-xl"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="card-header">
            <span className="card-title">Hızlı Aksiyonlar</span>
          </div>
          <div className="p-4 space-y-2">
            {[
              { icon: 'ri-building-2-line', label: 'Yeni Firma Ekle', path: '/firmalar', color: 'var(--info)' },
              { icon: 'ri-team-line', label: 'Personel Ekle', path: '/personel', color: 'var(--purple)' },
              { icon: 'ri-map-pin-time-line', label: 'Ziyaret Başlat', path: '/ziyaretler', color: 'var(--success)' },
              { icon: 'ri-file-chart-line', label: 'Rapor Oluştur', path: '/raporlar', color: 'var(--warning)' },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer text-left"
                style={{ border: '1px solid var(--border-subtle)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <i className={`${action.icon} text-sm`} style={{ color: action.color }} />
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
                <i className="ri-arrow-right-s-line text-sm ml-auto" style={{ color: 'var(--text-muted)' }} />
              </button>
            ))}
          </div>

          {/* Firm summary */}
          {firms.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div className="px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Son Eklenen Firmalar</p>
                <div className="space-y-2">
                  {firms.slice(0, 3).map((f) => (
                    <div key={f.id} className="flex items-center gap-2.5">
                      <div
                        className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0"
                        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                      >
                        <i className="ri-building-2-line text-xs" style={{ color: 'var(--text-muted)' }} />
                      </div>
                      <p className="text-xs truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{f.name}</p>
                      <StatusBadge status={f.status} />
                    </div>
                  ))}
                </div>
                {firms.length > 3 && (
                  <button
                    onClick={() => navigate('/firmalar')}
                    className="text-xs mt-3 cursor-pointer transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    +{firms.length - 3} firma daha →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
