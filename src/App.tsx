import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './router';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { AuthProvider } from './store/AuthContext';
import { AppProvider } from './store/AppContext';
import { OfflineQueueProvider } from './store/OfflineQueueContext';
import { ErrorBoundary } from './components/base/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <BrowserRouter basename={__BASE_PATH__}>
            <AppProvider>
              <OfflineQueueProvider>
                <AppRoutes />
              </OfflineQueueProvider>
            </AppProvider>
          </BrowserRouter>
        </AuthProvider>
      </I18nextProvider>
    </ErrorBoundary>
  );
}

export default App;
