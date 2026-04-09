import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export default function SubscriptionExpiredPage() {
  const handleLogout = useCallback(async () => {
    Object.keys(localStorage).forEach(k => { if (k.startsWith('sb-')) localStorage.removeItem(k); });
    await supabase.auth.signOut({ scope: 'global' });
    window.location.replace('/login');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* İkon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-orange-100 border border-orange-200 mb-6">
          <i className="ri-timer-flash-line text-orange-500 text-4xl"></i>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-3">
          Abonelik Süreniz Doldu
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          Organizasyonunuzun abonelik süresi sona ermiştir. Verileriniz güvende —
          aboneliğinizi yenilemek için sistem yöneticinizle iletişime geçin.
        </p>

        {/* İletişim */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 text-left space-y-3">
          <p className="text-slate-600 text-sm font-medium">Yönetici ile iletişime geç:</p>
          <a
            href="mailto:info@isgdenetim.com.tr"
            className="flex items-center gap-3 text-slate-700 hover:text-slate-900 transition-colors"
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100">
              <i className="ri-mail-line text-sm text-slate-500"></i>
            </div>
            <span className="text-sm">info@isgdenetim.com.tr</span>
          </a>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-logout-box-line"></i>
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}
