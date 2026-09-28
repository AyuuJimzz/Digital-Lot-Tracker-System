import React, { useEffect, useState } from "react";
import { Maximize2, Monitor, RotateCw } from "lucide-react";
import estateLogo from "../assets/image/golden-dragon-logo.png";

export const getGuardState = () => {
  if (typeof window === "undefined") {
    return { isPhone: false, isPortraitTablet: false, isNarrowDesktop: false };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isTouchOnly = window.matchMedia
    ? window.matchMedia("(hover: none) and (pointer: coarse)").matches
    : "ontouchstart" in window && window.navigator.maxTouchPoints > 0;
  const isPortrait = height > width;
  const minDimension = Math.min(width, height);
  const isPhone = isTouchOnly && minDimension < 500;
  const isPortraitTablet = !isPhone && isTouchOnly && isPortrait;
  const isNarrowDesktop = !isTouchOnly && (width < 768 || (isPortrait && width < 900));

  return { isPhone, isPortraitTablet, isNarrowDesktop };
};

const DesktopOnlyGuard = ({ children }) => {
  const [guardState, setGuardState] = useState(getGuardState);

  useEffect(() => {
    const checkOrientationAndDevice = () => {
      setGuardState(getGuardState());
    };

    checkOrientationAndDevice();
    window.addEventListener("resize", checkOrientationAndDevice);
    window.addEventListener("orientationchange", checkOrientationAndDevice);

    const orientationQuery = window.matchMedia?.("(orientation: portrait)");
    orientationQuery?.addEventListener?.("change", checkOrientationAndDevice);
    const pointerQuery = window.matchMedia?.("(hover: none) and (pointer: coarse)");
    pointerQuery?.addEventListener?.("change", checkOrientationAndDevice);

    return () => {
      window.removeEventListener("resize", checkOrientationAndDevice);
      window.removeEventListener("orientationchange", checkOrientationAndDevice);
      orientationQuery?.removeEventListener?.("change", checkOrientationAndDevice);
      pointerQuery?.removeEventListener?.("change", checkOrientationAndDevice);
    };
  }, []);

  const notice = guardState.isPhone
    ? {
        icon: Monitor,
        category: "Display requirements",
        title: "A larger screen is needed",
        description: "The estate map and management tools need more space than a phone-sized screen provides.",
        instruction: "Open this page on a tablet in landscape or on a computer.",
      }
    : guardState.isNarrowDesktop
      ? {
          icon: Maximize2,
          category: "Window size",
          title: "Make your window wider",
          description: "The current browser window is too narrow to display the full workspace.",
          instruction: "Maximize the window or drag its edge to widen it.",
        }
      : guardState.isPortraitTablet
        ? {
            icon: RotateCw,
            category: "Tablet orientation",
            title: "Rotate to landscape",
            description: "The estate map and management tools are designed for a horizontal tablet display.",
            instruction: "Turn your tablet sideways. If the screen does not rotate, turn off orientation lock.",
          }
        : null;

  if (!notice) return children;

  const NoticeIcon = notice.icon;

  return (
    <main className="relative isolate flex min-h-screen min-h-[100dvh] items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-amber-500/[0.06] to-transparent" />

      <section aria-labelledby="display-notice-title" className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
        <div className="flex items-center gap-3 border-b border-white/10 pb-5">
          <img src={estateLogo} alt="" className="h-9 w-9 shrink-0 object-contain" />
          <span className="text-sm font-semibold tracking-wide text-slate-200">
            Golden Dragon Estate
          </span>
        </div>

        <div className="pt-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
            <NoticeIcon aria-hidden="true" className="h-7 w-7" strokeWidth={1.7} />
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
            {notice.category}
          </p>
          <h1 id="display-notice-title" className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-white sm:text-[28px]">
            {notice.title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {notice.description}
          </p>

          <div className="mt-8 border-t border-white/10 pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              What to do
            </p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-200">
              {notice.instruction}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default DesktopOnlyGuard;
