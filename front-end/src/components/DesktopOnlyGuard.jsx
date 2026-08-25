import React, { useState, useEffect } from "react";
import { Monitor } from "lucide-react";

const DesktopOnlyGuard = ({ children }) => {
  const [guardState, setGuardState] = useState({
    isTooSmallPhone: false,
    isPortraitTablet: false,
  });

  useEffect(() => {
    const checkOrientationAndDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const isPortrait = height > width;

      // 1. Phone check: very narrow screen in either orientation (< 500px smallest dimension)
      const minDimension = Math.min(width, height);
      const isPhone = minDimension < 500;

      // 2. Portrait Tablet check: touch device or tablet screen resolution currently in portrait
      // (e.g., iPad 768x1024, iPad Air 820x1180, iPad Pro 834x1194 or 1024x1366)
      // When rotated to landscape, width > height (1024x768), which allows access!
      const isPortraitTablet = !isPhone && isPortrait && (isTouch || width < 1200);

      setGuardState({
        isTooSmallPhone: isPhone,
        isPortraitTablet: isPortraitTablet,
      });
    };

    checkOrientationAndDevice();
    window.addEventListener("resize", checkOrientationAndDevice);
    window.addEventListener("orientationchange", checkOrientationAndDevice);

    const mql = window.matchMedia("(orientation: portrait)");
    if (mql?.addEventListener) {
      mql.addEventListener("change", checkOrientationAndDevice);
    }

    return () => {
      window.removeEventListener("resize", checkOrientationAndDevice);
      window.removeEventListener("orientationchange", checkOrientationAndDevice);
      if (mql?.removeEventListener) {
        mql.removeEventListener("change", checkOrientationAndDevice);
      }
    };
  }, []);

  // ── Screen Notice 1: Phone Device (Too small even in landscape) ──────────
  if (guardState.isTooSmallPhone) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-white select-none">
        <div className="bg-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border border-slate-700/60">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-amber-400/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Monitor className="w-10 h-10 text-amber-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
            Tablet or Desktop Required
          </h1>

          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            This platform is optimized for{" "}
            <span className="text-amber-400 font-semibold">Tablets (Landscape)</span> and{" "}
            <span className="text-emerald-400 font-semibold">Desktop PCs</span>.
          </p>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 mb-6">
            <p className="text-xs text-slate-400 mb-1">
              📱 Minimum Resolution: <span className="text-white font-medium">768 × 600</span>
            </p>
            <p className="text-xs text-slate-400">
              📏 Detected:{" "}
              <span className="text-rose-400 font-semibold">
                {window.innerWidth} × {window.innerHeight} px
              </span>
            </p>
          </div>

          <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Golden Dragon Estate Corporation
          </div>
        </div>
      </div>
    );
  }

  // ── Screen Notice 2: Tablet in Portrait Mode (Prompt user to Rotate to Landscape) ──
  if (guardState.isPortraitTablet) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-white select-none">
        <div className="bg-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 sm:p-10 max-w-md w-full text-center border border-emerald-500/30 ring-1 ring-emerald-500/20">
          
          {/* Animated Rotate Tablet Visual Cue */}
          <div className="flex justify-center mb-6">
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/40 flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <div className="animate-pulse absolute inset-0 rounded-3xl bg-emerald-500/10"></div>
              
              {/* Rotating tablet icon animation */}
              <svg
                className="w-12 h-12 text-emerald-400 transition-transform duration-700"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Tablet body */}
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>

              {/* Rotation Arrow Badge */}
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-slate-950 p-1.5 rounded-full shadow-lg border-2 border-slate-900 font-bold">
                <svg className="w-4 h-4 animate-spin" style={{ animationDuration: "3s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
              </div>
            </div>
          </div>

          <span className="inline-block px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-full mb-3 tracking-wide">
            Orientation Notice
          </span>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3 tracking-tight">
            Please Rotate Your Tablet
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
            To use the system and view the interactive estate map properly, please rotate your iPad or tablet to{" "}
            <span className="text-emerald-400 font-bold underline decoration-emerald-500/50 underline-offset-4">
              Landscape Mode (Pahiga)
            </span>
            .
          </p>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 mb-6 text-xs text-slate-400 flex items-center justify-center gap-3">
            <div className="w-7 h-4 border-2 border-emerald-400 rounded-sm bg-emerald-400/20"></div>
            <span>Rotate to horizontal for the full control panel</span>
          </div>

          <div className="text-xs font-medium tracking-wider text-slate-500 uppercase">
            Golden Dragon Estate Corporation
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default DesktopOnlyGuard;

