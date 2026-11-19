import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendlyMsg = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && parsed.error) {
          friendlyMsg = `${parsed.error} (${parsed.operationType || 'operation'} at ${parsed.path || 'database'})`;
        }
      } catch {
        // plain text error
      }

      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 text-red-700 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-bold text-zinc-950">Something went wrong</h2>
            </div>
            <p className="text-sm text-zinc-700 mb-5 break-words">{friendlyMsg}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-5 py-2.5 bg-zinc-950 text-yellow-400 font-semibold rounded-xl flex items-center gap-2 hover:bg-zinc-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload AusaRides</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
