import React from 'react';

type State = { error: Error | null };
type Props = { children?: React.ReactNode };

export default class AppErrorBoundary extends React.Component<Props, State> {
  declare readonly props: Props;
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unique Mail renderer error', error, info.componentStack);
  }

  private resetMailSnapshot = () => {
    window.localStorage.removeItem('outlook_emails');
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center p-6">
        <section className="w-full max-w-xl border border-slate-300 bg-white shadow-sm p-6">
          <h1 className="text-xl font-bold">Unique Mail konnte die Oberfläche nicht laden</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ihre Konten und Einstellungen bleiben erhalten. Sie können die App neu laden oder nur den lokalen Mail-Schnellcache zurücksetzen.
          </p>
          <pre className="mt-4 max-h-36 overflow-auto border border-red-200 bg-red-50 p-3 text-xs text-red-800 whitespace-pre-wrap">
            {this.state.error.message || String(this.state.error)}
          </pre>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => window.location.reload()} className="border border-[#0078d4] bg-[#0078d4] px-4 py-2 text-sm font-semibold text-white">
              App neu laden
            </button>
            <button type="button" onClick={this.resetMailSnapshot} className="border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-800">
              Mail-Schnellcache zurücksetzen
            </button>
          </div>
        </section>
      </main>
    );
  }
}
