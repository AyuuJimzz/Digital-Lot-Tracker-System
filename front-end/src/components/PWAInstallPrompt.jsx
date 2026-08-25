import React, { useState, useEffect } from "react";
import { Download, X, Share } from "lucide-react";
import logo from "../assets/image/golden-dragon-logo.png";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);


  useEffect(() => {
    // Check if already running in standalone/installed mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone ||
      document.referrer.includes("android-app://");

    if (isStandalone) return;

    // Check if user dismissed prompt in current browser tab/session
    if (sessionStorage.getItem("pwa_install_dismissed_session")) return;

    // ── Case 1: Chrome fired beforeinstallprompt BEFORE React mounted ──
    // We already captured it in index.html via window.__pwaInstallEvent
    if (window.__pwaInstallEvent) {
      setDeferredPrompt(window.__pwaInstallEvent);
      setShowPrompt(true);
      return;
    }

    // ── Case 2: Chrome fires it AFTER React mounts — listen normally ──
    const handleNativeEvent = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    // Also listen for our custom bridge event from index.html
    const handleBridgeEvent = () => {
      if (window.__pwaInstallEvent) {
        setDeferredPrompt(window.__pwaInstallEvent);
        setShowPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleNativeEvent);
    window.addEventListener("pwa-install-available", handleBridgeEvent);

    // iOS / iPad Safari — no beforeinstallprompt, show manual Share guide
    const isAppleDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isAppleDevice) {
      setIsIOS(true);
      setShowPrompt(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleNativeEvent);
      window.removeEventListener("pwa-install-available", handleBridgeEvent);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("pwa_install_dismissed_session", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[99999] max-w-sm w-[calc(100vw-2.5rem)] sm:w-96">
      <div className="bg-slate-900/95 backdrop-blur-xl text-white p-4 sm:p-5 rounded-2xl shadow-2xl border border-emerald-500/40 ring-1 ring-emerald-500/20">
        <div className="flex items-start gap-3.5">
          {/* App Logo */}
          <img
            src={logo}
            alt="Golden Dragon"
            className="w-11 h-11 rounded-xl object-cover ring-2 ring-emerald-500/50 flex-shrink-0 shadow-md"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight truncate">
                Install Golden Dragon App
              </h3>
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Install as an app for full-screen presentation without the browser address bar.
            </p>

            {/* iOS Safari Instruction */}
            {isIOS ? (
              <div className="mt-3 p-2.5 bg-slate-800/90 rounded-xl border border-slate-700/80 text-xs text-slate-300 flex items-center gap-2">
                <Share className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  Tap <strong className="text-white">Share (📤)</strong> then{" "}
                  <strong className="text-emerald-400">"Add to Home Screen"</strong>
                </span>
              </div>
            ) : (
              /* Chrome/Edge 1-Click Install Button */
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleInstallClick}
                  className="flex-1 py-2 px-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Install App</span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Later
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

