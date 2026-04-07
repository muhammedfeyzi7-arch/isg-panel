import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — prevents blank/white screen on runtime errors.
 * Wrap the root of your app with this component.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error.message, error.stack, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-error-warning-line text-red-500 text-2xl"></i>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Beklenmeyen bir hata oluştu
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Uygulama yüklenirken bir sorun yaşandı. Sayfayı yenileyerek tekrar deneyin.
            </p>
            {this.state.error && (
              <details className="text-left bg-gray-100 rounded-lg p-3 mb-6 text-xs text-gray-600">
                <summary className="cursor-pointer font-medium mb-1">Hata detayı</summary>
                <pre className="whitespace-pre-wrap break-all">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap"
            >
              Ana sayfaya dön
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
