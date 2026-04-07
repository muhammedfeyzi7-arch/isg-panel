import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * QR kod tarandığında /equipment/qr/:id adresine gelir.
 * Bu sayfa ekipman ID'sini sessionStorage'a kaydedip
 * ana sayfaya (saha modülü) yönlendirir.
 */
export default function QrRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      // Ekipman ID'sini sessionStorage'a kaydet — saha sayfası okuyacak
      sessionStorage.setItem('qr_ekipman_id', id);
    }
    // Saha modülüne yönlendir
    navigate('/?module=saha', { replace: true });
  }, [id, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0F1E' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}>
          <i className="ri-qr-code-line text-3xl" style={{ color: '#34D399' }} />
        </div>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(52,211,153,0.3)', borderTopColor: '#34D399' }} />
        <p className="text-sm font-medium" style={{ color: '#64748B' }}>Ekipman yükleniyor...</p>
      </div>
    </div>
  );
}
