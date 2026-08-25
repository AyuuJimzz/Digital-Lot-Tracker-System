import React, { useState, useEffect } from "react";
import { Monitor } from "lucide-react";

const DesktopOnlyGuard = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreen = () => {
      // Block only phones (<768px), allow tablets and desktops (768px+)
      setIsMobile(window.innerWidth < 768);
    };

    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  if (isMobile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-10 max-w-md w-full text-center border border-white/20">
          <div className="flex justify-center mb-6">
            <div className="bg-amber-500/20 p-5 rounded-full">
              <Monitor className="w-16 h-16 text-amber-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-3">
            Tablet or Desktop Required
          </h1>

          <p className="text-slate-300 text-base leading-relaxed mb-6">
            This system is designed for{" "}
            <span className="text-amber-400 font-semibold">
              tablets and desktop computers
            </span>
            . Please access this website using a tablet or PC with a screen width of at least 768px.
          </p>

          <div className="bg-slate-700/50 rounded-xl p-4 mb-6">
            <p className="text-sm text-slate-400">
              📱 Minimum Screen: <span className="text-white font-medium">768 x 600</span>
            </p>
            <p className="text-sm text-slate-400 mt-1">
              📏 Your Screen:{" "}
              <span className="text-red-400 font-medium">
                {window.innerWidth} x {window.innerHeight}
              </span>
            </p>
          </div>

          <div className="text-xs text-slate-500">
            Golden Dragon Estate Corporation
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default DesktopOnlyGuard;
