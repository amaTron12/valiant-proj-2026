import React from 'react'

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; info: React.ErrorInfo | null }
> {
  state: { error: Error | null; info: React.ErrorInfo | null } = { error: null, info: null }

  static getDerivedStateFromError(error: Error) {
    return { error, info: null }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info })
    // Keep console log for Electron DevTools if open
    // eslint-disable-next-line no-console
    console.error('Renderer error:', error, info)
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-red-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h1 className="text-lg font-semibold text-slate-800">Something crashed</h1>
            <p className="text-sm text-slate-500 mt-1">
              The app hit a runtime error. Copy the details below so we can fix it.
            </p>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error.name}: {error.message}
            </div>
            <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-4 overflow-auto max-h-[50vh] whitespace-pre-wrap">
{String(error.stack || error.message)}
{info?.componentStack ? `\n\nComponent stack:\n${info.componentStack}` : ''}
            </pre>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

