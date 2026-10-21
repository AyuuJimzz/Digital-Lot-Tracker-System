import axios from "axios";
import {
  getThemeForSubdivision,
  loadCustomColors,
  normalizeHexColor,
  saveSubdivisionColor,
  resetSubdivisionColors,
  syncColorsFromDatabase,
} from "../utils/subdivisionColors";

describe("subdivision color utilities", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test("normalizes valid HEX values and rejects incomplete input", () => {
    expect(normalizeHexColor("#f43f5e")).toBe("#f43f5e");
    expect(normalizeHexColor("ABC")).toBe("#aabbcc");
    expect(normalizeHexColor("#12F")).toBe("#1122ff");
    expect(normalizeHexColor("#f43")).toBe("#ff4433");
    expect(normalizeHexColor("#f43f")).toBeNull();
    expect(normalizeHexColor("#12xz90")).toBeNull();
  });

  test("saves only valid colors and normalizes them before notifying listeners", () => {
    const handleColorChange = jest.fn();
    window.addEventListener("gde-subdivision-color-changed", handleColorChange);

    expect(saveSubdivisionColor(12, "#F43F5E")).toBe(true);
    expect(loadCustomColors()).toEqual({ "12": "#f43f5e" });
    expect(handleColorChange).toHaveBeenCalledTimes(1);
    expect(handleColorChange.mock.calls[0][0].detail).toEqual({
      identifier: "12",
      color: "#f43f5e",
    });

    expect(saveSubdivisionColor(12, "#f43")).toBe(true);
    expect(loadCustomColors()).toEqual({ "12": "#ff4433" });
    expect(saveSubdivisionColor(12, "#f43f")).toBe(false);
    expect(loadCustomColors()).toEqual({ "12": "#ff4433" });

    window.removeEventListener("gde-subdivision-color-changed", handleColorChange);
  });

  test("falls back to the built-in palette when a stored override is invalid", () => {
    const theme = getThemeForSubdivision(
      { id: 2018, name: "Lot-2018 Oton Cadastre" },
      0,
      { "2018": "not-a-color" }
    );

    expect(theme.hex).toBe("#f43f5e");
    expect(theme.style.dot.backgroundColor).toBe("#f43f5e");
  });

  test("syncColorsFromDatabase fetches server colors and updates local storage", async () => {
    const handleColorChange = jest.fn();
    window.addEventListener("gde-subdivision-color-changed", handleColorChange);

    const getSpy = jest.spyOn(axios, "get").mockResolvedValueOnce({
      data: {
        colors: {
          "2018": "#10b981",
          "3896": "#f43f5e",
        },
      },
    });

    const result = await syncColorsFromDatabase();
    expect(result).toEqual({
      "2018": "#10b981",
      "3896": "#f43f5e",
    });
    expect(loadCustomColors()).toEqual({
      "2018": "#10b981",
      "3896": "#f43f5e",
    });
    expect(handleColorChange).toHaveBeenCalled();

    window.removeEventListener("gde-subdivision-color-changed", handleColorChange);
    getSpy.mockRestore();
  });

  test("resetSubdivisionColors clears storage and calls delete API", () => {
    const deleteSpy = jest.spyOn(axios, "delete").mockResolvedValueOnce({ data: { success: true } });
    localStorage.setItem("gde_subdivision_colors", JSON.stringify({ "2018": "#10b981" }));

    resetSubdivisionColors();
    expect(loadCustomColors()).toEqual({});
    expect(deleteSpy).toHaveBeenCalled();
    deleteSpy.mockRestore();
  });
});
