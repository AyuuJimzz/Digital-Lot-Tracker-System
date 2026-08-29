import React from "react";
import axios from "axios";

import { API_BASE_URL } from "../config/api";

const MaintenancePage = () => {
  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/developer/maintenance-status`);
        if (res.data.maintenanceMode === false) {
          window.location.href = "/";
        }
      } catch (err) {
        // Ignored
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090d16] text-white relative overflow-hidden font-sans">
      {/* Sleek background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#10b981]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-[#3b82f6]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="z-10 max-w-md w-full mx-4 text-center">
        {/* Animated cog/construction emblem */}
        <div className="mb-8 flex justify-center">
          <div className="relative w-24 h-24 flex items-center justify-center bg-[#1e293b]/60 rounded-2xl border border-white/10 shadow-xl backdrop-blur-md">
            <svg
              className="w-12 h-12 text-[#10b981] animate-spin"
              style={{ animationDuration: "8s" }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#10b981] animate-ping opacity-75" />
          </div>
        </div>

        {/* Brand Name */}
        <div className="text-sm font-semibold tracking-widest text-[#10b981] uppercase mb-2">
          Golden Dragon Estate
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-4">
          Under Maintenance
        </h1>

        {/* Description card */}
        <div className="bg-[#111827]/60 border border-white/5 p-6 rounded-2xl shadow-2xl backdrop-blur-lg text-left mb-6">
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            We are currently executing scheduled upgrades on the database and servers to bring you a faster and more optimized experience.
          </p>
          <div className="flex items-center gap-3 text-xs text-[#10b981] bg-[#10b981]/5 px-4 py-3 rounded-lg border border-[#10b981]/15">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Your lot mappings and property records are safe.</span>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-xs text-gray-500">
          Expected downtime is minimal. For urgent assistance, contact your administrator.
        </p>
      </div>
    </div>
  );
};

export default MaintenancePage;
