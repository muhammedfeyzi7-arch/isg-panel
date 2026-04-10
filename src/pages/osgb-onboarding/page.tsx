import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../lib/supabase';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

export default function OsgbOnboardingPage() {
  const { user } = useAuth();
  const { refetchOrg, addToast } = useApp();
  const navigate = useNavigate();

  const [osgbAd, setOsgbAd] = useState('');
  const [yetkiliAd, setYetkiliAd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!osgbAd.trim()) { setError('OSGB adı zorunludur.'); return; }
    if (!yetkiliAd.trim()) { setError('Yetkili adı zorunludur.'); return; }
    if (!user) { setError('Oturum bulunamadı.'); return; }

    setLoading(true);
    setError(null);

    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const inviteCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

      // org_type='osgb' olan organizasyon oluştur
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: osgbAd.trim(),
          invite_code: inviteCode,
          created_by: user.id,
          org_type: 'osgb',
        })
        .select()
        .maybeSingle();

      if (orgError || !newOrg) {
        setError(orgError?.message ?? 'Organizasyon oluşturulamadı.');
        return;
      }

      // Kullanıcıyı osgb_admin olarak ekle
      const { error: memberError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          organization_id: newOrg.id,
          role: 'admin',
          display_name: yetkiliAd.trim(),
          email: user.email ?? '',
          is_active: true,
          must_change_password: false,
          osgb_role: 'osgb_admin',
        });

      if (memberError && memberError.code !== '23505') {
        setError(memberError.message);
        return;
      }

      // app_data oluştur
      await supabase.from('app_data').upsert(
        { organization_id: newOrg.id, data: {}, updated_at: new Date().toISOString() },
        { onConflict: 'organization_id' }
      );

      addToast('OSGB hesabınız başarıyla oluşturuldu!', 'success');
      await refetchOrg();
      navigate('/osgb-dashboard', { replace: true });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0f9ff 100%)' }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'); * { font-family: 'Inter', sans-serif; }`}</style>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
          >
            <img src={LOGO_URL} alt="ISG" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <p className="font-bold text-base" style={{ color: '#0f172a' }}>ISG Denetim</p>
            <p className="text-xs" style={{ color: '#64748b' }}>OSGB Yönetim Platformu</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
          {/* Header */}
          <div className="mb-6">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#059669' }}
            >
              <i className="ri-stethoscope-line text-xs" />
              OSGB Kurulumu
            </div>
            <h1 className="text-2xl font-extrabold mb-2" style={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
              OSGB Hesabınızı Kurun
            </h1>
            <p className="text-sm" style={{ color: '#64748b' }}>
              Müşteri firmalarınızı ve gezici uzmanlarınızı yönetmek için OSGB bilgilerinizi girin.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#374151' }}>
                OSGB / Kurum Adı *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none">
                  <i className="ri-hospital-line text-sm" style={{ color: '#94a3b8' }} />
                </div>
                <input
                  value={osgbAd}
                  onChange={e => { setOsgbAd(e.target.value); setError(null); }}
                  placeholder="Örn: Sağlıklı İş OSGB Ltd. Şti."
                  className="w-full text-sm"
                  style={{
                    background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px',
                    padding: '13px 16px 13px 44px', outline: 'none', color: '#1e293b',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#374151' }}>
                Yetkili Adı Soyadı *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none">
                  <i className="ri-user-line text-sm" style={{ color: '#94a3b8' }} />
                </div>
                <input
                  value={yetkiliAd}
                  onChange={e => { setYetkiliAd(e.target.value); setError(null); }}
                  placeholder="Örn: Ahmet Yılmaz"
                  className="w-full text-sm"
                  style={{
                    background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px',
                    padding: '13px 16px 13px 44px', outline: 'none', color: '#1e293b',
                  }}
                />
              </div>
            </div>

            {error && (
              <div
                className="flex items-start gap-3 rounded-xl p-3"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <i className="ri-error-warning-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-sm text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-2.5"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? (
                  <><i className="ri-loader-4-line text-base animate-spin" /><span>Oluşturuluyor...</span></>
                ) : (
                  <><i className="ri-arrow-right-line text-base" /><span>OSGB Panelime Git</span></>
                )}
              </button>
            </div>
          </form>

          {/* Info */}
          <div
            className="mt-4 flex items-start gap-3 p-3 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)' }}
          >
            <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} />
            <p className="text-xs leading-relaxed" style={{ color: '#64748b' }}>
              Kurulum sonrası müşteri firmalarınızı ekleyebilir, gezici uzmanlarınızı atayabilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
