import { useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import PageHeader from '@/components/base/PageHeader';
import Button from '@/components/base/Button';

export default function SpecialistSettingsPage() {
  const { session } = useAuth();
  const { showToast } = useApp();
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifDoc, setNotifDoc] = useState(true);
  const [notifVisit, setNotifVisit] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Bildirim tercihleri şu an local state'te tutuluyor
    // İleride Supabase profiles tablosuna eklenebilir
    await new Promise((res) => setTimeout(res, 600));
    setSaving(false);
    showToast('Bildirim tercihleri kaydedildi');
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className="relative w-10 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0"
      style={{ backgroundColor: value ? 'var(--text-primary)' : 'var(--border)' }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
        style={{ backgroundColor: 'white', transform: value ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  );

  return (
    <div className="p-6 max-w-[800px] mx-auto">
      <PageHeader title="Ayarlar" description="Profil ve bildirim tercihleriniz" />

      {/* Profile */}
      <div className="rounded-xl p-6 mb-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Profil Bilgileri</h3>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--text-primary)' }}>
            <span className="text-lg font-bold" style={{ color: 'var(--card)' }}>
              {session?.fullName?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() ?? 'U'}
            </span>
          </div>
          <div>
            <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{session?.fullName ?? '—'}</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{session?.email ?? '—'}</p>
            <span className="inline-block text-xs px-2 py-0.5 rounded-full mt-1" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid rgba(14,165,233,0.2)' }}>
              İş Güvenliği Uzmanı
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Ad Soyad</label>
            <input className="input" defaultValue={session?.fullName ?? ''} readOnly style={{ opacity: 0.7 }} />
          </div>
          <div>
            <label className="form-label">E-posta</label>
            <input className="input" defaultValue={session?.email ?? ''} readOnly style={{ opacity: 0.7 }} />
          </div>
          <div>
            <label className="form-label">Organizasyon</label>
            <input className="input" defaultValue={session?.organizationName ?? ''} readOnly style={{ opacity: 0.7 }} />
          </div>
          <div>
            <label className="form-label">Rol</label>
            <input className="input" defaultValue="İş Güvenliği Uzmanı" readOnly style={{ opacity: 0.7 }} />
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Profil bilgilerini değiştirmek için yöneticinizle iletişime geçin.</p>
      </div>

      {/* Notifications */}
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Bildirim Tercihleri</h3>
        <div className="space-y-4">
          {[
            { label: 'E-posta Bildirimleri', desc: 'Önemli güncellemeler için e-posta al', value: notifEmail, onChange: setNotifEmail },
            { label: 'Belge Uyarıları', desc: 'Süresi yaklaşan belgeler için bildirim', value: notifDoc, onChange: setNotifDoc },
            { label: 'Ziyaret Bildirimleri', desc: 'Ziyaret başlangıç ve bitiş bildirimleri', value: notifVisit, onChange: setNotifVisit },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
              </div>
              <Toggle value={item.value} onChange={item.onChange} />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  );
}
