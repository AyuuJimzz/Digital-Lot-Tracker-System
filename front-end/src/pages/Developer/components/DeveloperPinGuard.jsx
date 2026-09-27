import React from "react";

const DeveloperPinGuard = ({
  isCheckingAuth,
  isAuthorized,
  showPin,
  setShowPin,
  pin,
  setPin,
  handleVerifyPin,
  error,
  loading,
}) => {
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 font-sans text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
          <p className="text-xs text-gray-400 font-mono">Authenticating Developer Session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 font-sans text-white">
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl shadow-black/20">
          <div className="text-center mb-6">
            <div className="mb-4 inline-flex rounded-xl border border-slate-700 bg-slate-800 p-3 text-slate-200">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Developer Console</h1>
            <p className="text-gray-400 text-xs mt-1">Enter your security PIN to access system controls</p>
          </div>

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full tracking-[1.5em] text-center text-xl font-bold py-3.5 bg-slate-950 border border-slate-700 rounded-xl focus:border-slate-400 focus:ring-1 focus:ring-slate-400 outline-none transition pr-12"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                aria-label={showPin ? "Hide PIN" : "Show PIN"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition flex items-center justify-center"
              >
                {showPin ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {error && <div className="text-red-400 text-xs text-center font-medium">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate-200 hover:bg-white text-slate-950 text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Access Console"}
            </button>

            <button
              type="button"
              onClick={() => (window.location.href = "/login")}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-200 transition pt-1"
            >
              ← Back to Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
};

export default DeveloperPinGuard;
