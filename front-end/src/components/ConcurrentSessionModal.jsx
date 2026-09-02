import React, { useState, useEffect } from "react";
import { ShieldAlert, LogIn } from "lucide-react";

export default function ConcurrentSessionModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState(
    "Your account was signed into from another device. For security, this session has been ended."
  );

  useEffect(() => {
    const handleKickout = (e) => {
      if (e.detail?.message) {
        setModalMessage(e.detail.message);
      }
      setIsOpen(true);
    };

    window.addEventListener("concurrentSessionKickedOut", handleKickout);
    return () => window.removeEventListener("concurrentSessionKickedOut", handleKickout);
  }, []);

  if (!isOpen) return null;

  const handleReturnToLogin = () => {
    setIsOpen(false);
    localStorage.removeItem("authToken");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    sessionStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0f172a] border border-amber-500/30 rounded-3xl shadow-2xl shadow-amber-500/10 p-6 text-center text-white relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 text-amber-400 shadow-inner">
          <ShieldAlert className="w-8 h-8 stroke-[2.2]" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white tracking-tight mb-2">
          Signed In On Another Device
        </h3>

        {/* Message */}
        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          {modalMessage}
        </p>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleReturnToLogin}
          className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
        >
          <LogIn className="w-5 h-5 stroke-[2.2]" />
          <span>Log In Again</span>
        </button>
      </div>
    </div>
  );
}
