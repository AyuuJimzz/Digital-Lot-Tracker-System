import React, { Component } from "react";
import { AlertTriangle, RotateCcw, Home, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";

/**
 * Enterprise-Grade React Error Boundary
 *
 * Prevents the entire application from crashing with a white screen when an
 * unhandled rendering error occurs in child components. Provides graceful UI
 * recovery and expandable developer diagnostics.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("🚨 [Application ErrorBoundary Caught Crash]:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    });
  };

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const diagnosticText = `=== Golden Dragon Estate Platform Error Report ===
Timestamp: ${new Date().toISOString()}
Error: ${error?.toString() || "Unknown error"}
Stack:
${error?.stack || "No stack trace"}
Component Stack:
${errorInfo?.componentStack || "No component stack"}
URL: ${typeof window !== "undefined" ? window.location.href : "N/A"}
User Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "N/A"}`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(diagnosticText).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      });
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, showDetails, copied } = this.state;

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans selection:bg-amber-500/30">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/80 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            {/* Warning Shield Icon */}
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5 text-amber-400 shadow-inner">
              <AlertTriangle className="w-7 h-7" strokeWidth={2.2} />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed max-w-sm">
              An unexpected display issue occurred in this section. Your account session and saved property records remain safe.
            </p>

            {/* Action Buttons */}
            <div className="w-full flex flex-col sm:flex-row gap-2.5 mb-6">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-all shadow-md shadow-amber-500/20 active:scale-[0.98] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-200 font-semibold text-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white transition-all active:scale-[0.98] cursor-pointer"
                title="Go to Home"
                aria-label="Go to Home"
              >
                <Home className="w-4 h-4" />
              </button>
            </div>

            {/* Collapsible Technical Details */}
            <div className="w-full text-left border-t border-slate-800/80 pt-4">
              <button
                type="button"
                onClick={() => this.setState({ showDetails: !showDetails })}
                className="w-full flex items-center justify-between text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors py-1 cursor-pointer"
              >
                <span>Technical Diagnostics</span>
                {showDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showDetails && (
                <div className="mt-2.5 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
                      Error Stack
                    </span>
                    <button
                      type="button"
                      onClick={this.handleCopyError}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2 py-1 rounded-md transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Log</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-44 p-2 rounded bg-black/40 leading-snug whitespace-pre-wrap break-all">
                    {error?.toString() || "Unknown error occurred"}
                    {error?.stack && `\n\n${error.stack}`}
                    {errorInfo?.componentStack && `\n\nComponent Hierarchy:${errorInfo.componentStack}`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
