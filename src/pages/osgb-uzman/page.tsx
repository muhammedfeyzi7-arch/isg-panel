import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

/**
 * Bu sayfa sadece gezici uzmanın henüz firma atanmamış durumu için gösterilir.
 * Firma atandığında useOrganization otomatik olarak firma org ID'sini set eder
 * ve ProtectedRoute /dashboard'a yönlendirir — bu sayfa artık görünmez.
 */
export default function OsgbUzmanPage() {
  const { logout } = useAuth();
  const { org } = useApp();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>

      <div className="text-center max-w-sm w-full">
        {/* Logo */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'linear-gradient(135deg, #071f14 0%, #0a2e1c 100%)', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          <img src={LOGO_URL} alt="ISG" className="w-10 h-10 object-contain" />
        </div>

        {/* Başlık */}
        <h1 className="text-xl font-extrabold mb-2" style={{ color: '#0f172a', letterSpacing: '-0.03em' }}>
          Hoş Geldiniz
        </h1>
        <p className="text-sm font-semibold mb-1" style={{ color: '#059669' }}>
          {org?.displayName ?? 'Gezici Uzman'}
        </p>

        {/* Durum kartı */}
        <div
          className="rounded-2xl p-6 mt-6 mb-6"
          style={{ background: '#fff', border: '1px solid #f1f5f9' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <i className="ri-time-line text-2xl" style={{ color: '#F59E0B' }} />
          </div>

          <h2 className="text-sm font-bold mb-2" style={{ color: '#0f172a' }}>
            Firma Ataması Bekleniyor
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: '#64748b' }}>
            OSGB admininiz henüz size bir müşteri firma ataması yapmadı. Atama yapıldığında
            sisteme otomatik olarak giriş yapabileceksiniz.
          </p>

          <div
            className="flex items-center gap-2 mt-4 p-3 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}
          >
            <i className="ri-information-line text-sm flex-shrink-0" style={{ color: '#10B981' }} />
            <p className="text-[11px] leading-relaxed" style={{ color: '#059669' }}>
              Atama yapıldıktan sonra bu sayfayı yenileyerek veya tekrar giriş yaparak panele erişebilirsiniz.
            </p>
          </div>
        </div>

        {/* Butonlar */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => window.location.reload()}
            className="whitespace-nowrap flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff' }}
          >
            <i className="ri-refresh-line" />
            Sayfayı Yenile
          </button>
          <button
            onClick={logout}
            className="whitespace-nowrap flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <i className="ri-logout-box-line" />
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}