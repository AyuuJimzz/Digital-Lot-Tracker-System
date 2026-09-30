import { getGuardState } from "../components/DesktopOnlyGuard";

describe("display requirements", () => {
  const originalMatchMedia = window.matchMedia;
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;

  const setScreen = (width, height, touchOnly) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
    window.matchMedia = jest.fn(() => ({ matches: touchOnly }));
  };

  afterAll(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
    window.matchMedia = originalMatchMedia;
  });

  test("distinguishes phone, portrait tablet, narrow desktop, and supported desktop", () => {
    setScreen(390, 844, true);
    expect(getGuardState()).toEqual({ isPhone: true, isPortraitTablet: false, isNarrowDesktop: false });

    setScreen(820, 1180, true);
    expect(getGuardState()).toEqual({ isPhone: false, isPortraitTablet: true, isNarrowDesktop: false });

    setScreen(640, 900, false);
    expect(getGuardState()).toEqual({ isPhone: false, isPortraitTablet: false, isNarrowDesktop: true });

    setScreen(1366, 768, false);
    expect(getGuardState()).toEqual({ isPhone: false, isPortraitTablet: false, isNarrowDesktop: false });
  });
});
