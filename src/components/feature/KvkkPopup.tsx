import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';

interface KvkkPopupProps {
  onAccepted: () => void;
  organizationId?: string;
}

// KVKK'yı localStorage'da da saklayalım — her yenilemede gösterme
function markKvkkAcceptedLocally(userId: string) {
  try {
    const key = `kvkk_accepted_${userId}`;
    localStorage.setItem(key, '1');
  } catch { /* ignore */ }
}
export function isKvkkAcceptedLocally(userId: string): boolean {
  try {
    return localStorage.getItem(`kvkk_accepted_${userId}`) === '1';
  } catch { return false; }
}

export default function KvkkPopup({ onAccepted, organizationId }: KvkkPopupProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const handleAccept = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // organization_id ile update yap — RLS policy organization_id'ye göre kontrol eder
      let updateQuery = supabase
        .from('user_organizations')
        .update({
          kvkk_accepted: true,
          kvkk_accepted_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (organizationId) {
        updateQuery = updateQuery.eq('organization_id', organizationId);
      }

      const { error: updateError } = await updateQuery;

      if (updateError) {
        console.error('[KVKK] DB update error:', updateError);
        if (organizationId) {
          await supabase.rpc('accept_kvkk', { p_user_id: user.id, p_org_id: organizationId }).catch(() => null);
        }
      }
      // Her durumda localStorage'a kaydet — sayfa yenilemede tekrar sorma
      markKvkkAcceptedLocally(user.id);
      onAccepted();
    } catch (err) {
      console.error('[KVKK] Unexpected error:', err);
      if (user) markKvkkAcceptedLocally(user.id);
      onAccepted();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={`relative w-full max-w-xl rounded-2xl overflow-hidden transition-all duration-400 ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        style={{ background: '#ffffff' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Üst renkli bant */}
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #0f766e, #0d9488, #14b8a6)' }} />

        {/* Header */}
        <div className="px-8 pt-7 pb-5 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: '#f0fdf9', border: '1.5px solid #99f6e4' }}
            >
              <i className="ri-shield-check-line text-xl" style={{ color: '#0d9488' }} />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-800 tracking-tight">
                KVKK Aydınlatma ve Onay Metni
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Devam etmeden önce lütfen aşağıdaki metni dikkatlice okuyun
              </p>
            </div>
          </div>
        </div>

        {/* İçerik */}
        <div className="px-8 py-6 max-h-[48vh] overflow-y-auto">
          <div className="space-y-4 text-sm leading-[1.75] text-slate-600">

            <p>
              <span className="font-semibold text-slate-800">ISG Denetim</span> platformu kapsamında,
              sistem üzerinde işlenecek kişisel veriler; iş sağlığı ve güvenliği süreçlerinin yürütülmesi,
              personel, ekipman ve evrak takibinin sağlanması, yasal yükümlülüklerin yerine getirilmesi
              ve raporlama faaliyetlerinin gerçekleştirilmesi amacıyla işlenmektedir.
            </p>

            <div
              className="rounded-xl p-4 text-sm leading-relaxed"
              style={{ background: '#f0fdf9', border: '1px solid #99f6e4', color: '#134e4a' }}
            >
              Bu platforma girilen tüm kişisel verilerin,{' '}
              <span className="font-semibold" style={{ color: '#0f766e' }}>
                6698 sayılı Kişisel Verilerin Korunması Kanunu
              </span>{' '}
              kapsamında ilgili kişilerden gerekli açık rızalar alınarak sisteme yüklendiğini,
              veri sorumlusu sıfatıyla tüm hukuki yükümlülüklerin tarafınıza ait olduğunu ve
              ISG Denetim platformunun yalnızca veri işleyen konumunda olduğunu kabul etmiş olursunuz.
            </div>

            <p>
              Kişisel veriler, yalnızca yetkili kullanıcılar tarafından erişilebilir olup, üçüncü
              kişilerle izinsiz paylaşılmaz ve gerekli teknik ve idari güvenlik önlemleri alınarak
              korunur.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex flex-col gap-3">
          {error && (
            <div className="text-xs px-4 py-2.5 rounded-lg text-center bg-amber-50 text-amber-700 border border-amber-100">
              <i className="ri-information-line mr-1.5" />
              Onay alındı, devam ediliyor...
            </div>
          )}

          <button
            onClick={handleAccept}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm cursor-pointer transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-2 text-white"
            style={{
              background: loading
                ? '#5eead4'
                : 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
              opacity: loading ? 0.8 : 1,
            }}
          >
            {loading ? (
              <>
                <i className="ri-loader-4-line animate-spin" />
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <>
                <i className="ri-check-double-line" />
                <span>Okudum, onaylıyorum</span>
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-400">
            Bu onay yalnızca bir kez alınır ve bir daha gösterilmez.
          </p>
        </div>
      </div>
    </div>
  );
}
