import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/store/AppContext';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

interface FirmaOption {
  id: string;
  name: string;
}

export default function ResolvePage() {
  const navigate = useNavigate();
  const { org, orgLoading, switchActiveFirma, fetchActiveFirmNames } = useApp();

  const [firmalar, setFirmalar] = useState<FirmaOption[]>([]);
  const [firmalerYukleniyor, setFirmalarYukleniyor] = useState(false);
  const [secimYapiliyor, setSecimYapiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [showFirmaSec, setShowFirmaSec] = useState(false);

  // ── Org yüklenince yönlendirme veya firma seçimi karar ver ──
  useEffect(() => {
    if (orgLoading || !org) return;

    const { osgbRole, activeFirmIds } = org;

    // OSGB Admin → doğrudan OSGB dashboard
    if (osgbRole === 'osgb_admin') {
      navigate('/osgb-dashboard', { replace: true });
      return;
    }

    // Gezici Uzman
    if (osgbRole === 'gezici_uzman') {
      const firmSayisi = activeFirmIds?.length ?? 0;

      if (firmSayisi === 0) {
        // Firma atanmamış
        navigate('/osgb-uzman', { replace: true });
        return;
      }

      if (firmSayisi === 1) {
        // Tek firma → doğrudan dashboard
        navigate('/dashboard', { replace: true });
        return;
      }

      // Birden fazla firma → seçim ekranı göster
      setShowFirmaSec(true);
      setFirmalarYukleniyor(true);
      fetchActiveFirmNames().then(list => {
        setFirmalar(list);
        setFirmalarYukleniyor(false);
      });
      return;
    }

    // Normal firma kullanıcısı → doğrudan dashboard
    navigate('/dashboard', { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id, org?.osgbRole, orgLoading]);

  const handleFirmaSecim = async (firmaId: string) => {
    setSecimYapiliyor(true);
    setHata(null);
    const { error } = await switchActiveFirma(firmaId);
    if (error) {
      setHata(error);
      setSecimYapiliyor(false);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  // ── Full screen spinner (yükleniyor veya yönlendirme bekliyor) ──
  if (orgLoading || !org || (!showFirmaSec && !hata)) {
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

  // ── Firma seçim ekranı ──
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 40%, #f0fdf4 100%)' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Inter', sans-serif; }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .resolve-card { animation: fadeSlideUp 0.5s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .firma-row {
          transition: all 0.18s ease;
          cursor: pointer;
          border: 1.5px solid #f1f5f9;
        }
        .firma-row:hover {
          border-color: rgba(6,182,212,0.35);
          background: #f0fdff !important;
          transform: translateY(-1px);
        }
        .firma-row:active { transform: translateY(0); }
      `}</style>

      <div
        className="resolve-card w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: '#ffffff',
          border: '1px solid #f1f5f9',
        }}
      >
        {/* Header */}
        <div
          className="px-8 pt-8 pb-6"
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f0fdff 100%)',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(6,182,212,0.1)' }}
            >
              <img src={LOGO_URL} alt="ISG" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#0891B2' }}>Gezici Uzman</p>
              <p className="text-xs" style={{ color: '#94a3b8' }}>
                {org.displayName || 'Kullanıcı'}
              </p>
            </div>
          </div>
          <h1
            className="text-2xl font-extrabold mb-1"
            style={{ color: '#0f172a', letterSpacing: '-0.03em' }}
          >
            Hangi firmaya giriş yapıyorsunuz?
          </h1>
          <p className="text-sm" style={{ color: '#64748b' }}>
            Size atanmış {firmalar.length > 0 ? firmalar.length : (org.activeFirmIds?.length ?? 0)} firma listeleniyor.
            Devam etmek için birini seçin.
          </p>
        </div>

        {/* Firma listesi */}
        <div className="px-6 py-5">
          {firmalerYukleniyor ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <div
                className="w-8 h-8 rounded-full"
                style={{
                  border: '2px solid rgba(6,182,212,0.15)',
                  borderTop: '2px solid #06B6D4',
                  animation: 'spin 0.9s linear infinite',
                }}
              />
              <p className="text-xs" style={{ color: '#94a3b8' }}>Firmalar yükleniyor...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {firmalar.map((firma, idx) => (
                <button
                  key={firma.id}
                  type="button"
                  disabled={secimYapiliyor}
                  onClick={() => handleFirmaSecim(firma.id)}
                  className="firma-row w-full rounded-xl px-5 py-4 flex items-center gap-4 text-left"
                  style={{
                    background: '#f8fafc',
                    opacity: secimYapiliyor ? 0.6 : 1,
                  }}
                >
                  {/* Sıra numarası */}
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{
                      background: 'rgba(6,182,212,0.1)',
                      color: '#0891B2',
                    }}
                  >
                    {idx + 1}
                  </div>

                  {/* İsim */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold text-sm truncate"
                      style={{ color: '#0f172a' }}
                    >
                      {firma.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                      Firmaya giriş yap
                    </p>
                  </div>

                  {/* Ok */}
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {secimYapiliyor ? (
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{
                          border: '2px solid rgba(6,182,212,0.2)',
                          borderTop: '2px solid #06B6D4',
                          animation: 'spin 0.9s linear infinite',
                        }}
                      />
                    ) : (
                      <i className="ri-arrow-right-line text-base" style={{ color: '#cbd5e1' }} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Hata */}
          {hata && (
            <div
              className="mt-4 flex items-start gap-3 rounded-xl p-4"
              style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <i className="ri-error-warning-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <p className="text-sm leading-relaxed" style={{ color: '#dc2626' }}>{hata}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 pb-6"
          style={{ borderTop: '1px solid #f8fafc' }}
        >
          <p className="text-xs text-center pt-4" style={{ color: '#cbd5e1' }}>
            ISG Denetim — Gezici Uzman Paneli
          </p>
        </div>
      </div>
    </div>
  );
}
