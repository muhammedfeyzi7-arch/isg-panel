import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './router';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { AuthProvider } from './store/AuthContext';
import { ErrorBoundary } from './components/base/ErrorBoundary';
import { isSupabaseConfigured } from './lib/supabase';

/** Friendly screen when Supabase env vars are missing */
function SupabaseConfigError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg w-full">
        <div className="bg-white border border-gray-200 rounded-xl p-8">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-6">
            <i className="ri-settings-3-line text-amber-600 text-2xl"></i>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Yapılandırma Eksik
          </h1>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Uygulama için Supabase ortam değişkenleri ayarlanmamış.
            Uygulamayı çalıştırmak için aşağıdaki değişkenleri tanımlamanız gerekiyor.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 font-mono text-xs text-gray-700 space-y-1">
            <p className="text-gray-400 mb-2"># .env dosyasına ekleyin</p>
            <p>VITE_SUPABASE_URL=https://&lt;proje-id&gt;.supabase.co</p>
            <p>VITE_SUPABASE_ANON_KEY=&lt;anon-key&gt;</p>
          </div>

          <div className="space-y-2 text-sm text-gray-500">
            <div className="flex items-start gap-2">
              <i className="ri-information-line text-gray-400 mt-0.5 shrink-0"></i>
              <span>
                Supabase proje ayarlarından{' '}
                <strong className="text-gray-700">Project Settings → API</strong>{' '}
                bölümünden bu değerleri alabilirsiniz.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <i className="ri-information-line text-gray-400 mt-0.5 shrink-0"></i>
              <span>
                Vercel'de deploy ediyorsanız{' '}
                <strong className="text-gray-700">Settings → Environment Variables</strong>{' '}
                bölümüne ekleyin.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  // Show a helpful screen instead of crashing when Supabase isn't configured
  if (!isSupabaseConfigured) {
    return <SupabaseConfigError />;
  }

  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <BrowserRouter basename={__BASE_PATH__}>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </I18nextProvider>
    </ErrorBoundary>
  );
}

export default App;
