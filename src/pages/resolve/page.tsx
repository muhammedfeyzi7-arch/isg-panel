import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/store/AppContext';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

export default function ResolvePage() {
  const navigate = useNavigate();
  const { org, orgLoading } = useApp();

  // ── Org yüklenince rol bazlı yönlendirme ──
  useEffect(() => {
    if (orgLoading || !org) return;

    const { osgbRole, activeFirmIds } = org;

    // OSGB Admin → doğrudan OSGB dashboard
    if (osgbRole === 'osgb_admin') {
      navigate('/osgb-dashboard', { replace: true });
      return;
    }

    // İşyeri Hekimi → hekim paneli (tüm atanmış firmalar orada görünür)
    if (osgbRole === 'isyeri_hekimi') {
      const firmSayisi = activeFirmIds?.length ?? 0;
      if (firmSayisi === 0) {
        navigate('/osgb-uzman', { replace: true });
      } else {
        navigate('/hekim', { replace: true });
      }
      return;
    }

    // Gezici Uzman → bağımsız uzman paneline yönlendir
    if (osgbRole === 'gezici_uzman') {
      navigate('/uzman', { replace: true });
      return;
    }

    // Normal firma kullanıcısı → doğrudan dashboard
    navigate('/dashboard', { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id, org?.osgbRole, orgLoading]);

  // ── Full screen spinner ──
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 40%, #f0fdf4 100%)' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { font-family: 'Inter', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .resolve-fadein { animation: fadeIn 0.4s ease forwards; }
      `}</style>
      <div className="resolve-fadein flex flex-col items-center gap-6">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: '3px solid rgba(6,182,212,0.15)',
              borderTop: '3px solid #06B6D4',
              animation: 'spin 0.9s linear infinite',
            }}
          />
          <img src={LOGO_URL} alt="ISG" className="w-8 h-8 object-contain relative z-10" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: '#0f172a' }}>Hesabınız doğrulanıyor</p>
          <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Lütfen bekleyin...</p>
        </div>
      </div>
    </div>
  );
}