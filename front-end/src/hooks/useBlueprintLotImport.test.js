import { act, renderHook } from "@testing-library/react";
import axios from "axios";
import { saveBlueprintOverlay } from "../utils/overlayStorage";
import { useBlueprintLotImport } from "./useBlueprintLotImport";

jest.mock("axios", () => ({ post: jest.fn() }));
jest.mock("../config/api", () => ({ API_BASE_URL: "http://local.test" }));
jest.mock("../utils/overlayStorage", () => ({ saveBlueprintOverlay: jest.fn() }));

const map = {
  project: ([lat, lng]) => ({ x: lng, y: -lat }),
  unproject: ([lng, negLat]) => ({ lng, lat: -negLat }),
};
const options = { propertyId: 8, map, bounds: [[10, 122], [10.001, 122.001]], rotation: 0, isAligning: false };
const candidate = { id: "a", points: [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2]], lotNumber: "1", block: "2", areaSqm: 120, selected: true, warnings: [] };
const draft = { sourceName: "site.pdf", pageNumber: 1, imageWidth: 1000, imageHeight: 1000, candidates: [candidate], warnings: [] };

beforeEach(() => { jest.clearAllMocks(); saveBlueprintOverlay.mockResolvedValue(true); });

test("old cached scans explain how to rescan while preserving edited candidates", () => {
  const { result } = renderHook(() => useBlueprintLotImport(options));
  act(() => result.current.restore(draft));
  expect(result.current.warnings.join(" ")).toContain("Replace file");
  expect(result.current.candidates).toEqual([candidate]);
  act(() => result.current.restore({ ...draft, detectorVersion: 2 }));
  expect(result.current.warnings.join(" ")).not.toContain("Replace file");
});

test("manual saleability and detection history survive draft saving and restoration", async () => {
  const { result } = renderHook(() => useBlueprintLotImport(options));
  act(() => result.current.restore(draft));
  const changed = { ...candidate, nonSaleable: false, category: "residential", categoryLabel: "Saleable Lot",
    detectedClassification: { nonSaleable: true, category: "facility", categoryLabel: "Community Facility" } };
  await act(async () => result.current.changeCandidates([changed]));
  const saved = saveBlueprintOverlay.mock.calls[0][1].lotImport;
  act(() => result.current.restore(saved));
  expect(result.current.candidates[0]).toEqual(changed);
});

test("a switched property cannot inherit an import draft or review modal", () => {
  const { result, rerender } = renderHook((props) => useBlueprintLotImport(props), { initialProps: options });
  act(() => result.current.restore(draft));
  act(() => result.current.openReview());
  expect(result.current.isReviewOpen).toBe(true);
  rerender({ ...options, propertyId: 9 });
  expect(result.current.draft).toBeNull();
  expect(result.current.candidates).toEqual([]);
  expect(result.current.isReviewOpen).toBe(false);
});

test("successful batch sends projected coordinates once and removes saved candidates", async () => {
  axios.post.mockResolvedValue({ data: { success: true, createdCount: 1 } });
  const onImported = jest.fn().mockResolvedValue({});
  const { result } = renderHook(() => useBlueprintLotImport(options));
  act(() => result.current.restore(draft));
  await act(async () => { await result.current.importLots(onImported); });
  const [url, body, config] = axios.post.mock.calls[0];
  expect(url).toBe("http://local.test/api/lots/import");
  expect(body.property_id).toBe(8);
  expect(body.lots[0].lot_number).toBe("Block 2 Lot 1");
  expect(body.lots[0].coordinates[0][0]).toBeCloseTo(10.0009);
  expect(config._retry).toBe(true);
  expect(result.current.candidates).toHaveLength(0);
  expect(result.current.message).toContain("1 lots created");
  expect(onImported).toHaveBeenCalledTimes(1);
});

test("failed validation leaves draft editable and displays the server error", async () => {
  axios.post.mockRejectedValue({ response: { data: { error: "Duplicate boundary" } } });
  const { result } = renderHook(() => useBlueprintLotImport(options));
  act(() => result.current.restore(draft));
  await act(async () => { await result.current.importLots(jest.fn()); });
  expect(result.current.error).toBe("Duplicate boundary");
  expect(result.current.candidates).toHaveLength(1);
  expect(result.current.isImporting).toBe(false);
});

test("in-flight double submit is locked and alignment must be finished", async () => {
  const { result, rerender } = renderHook((props) => useBlueprintLotImport(props), { initialProps: { ...options, isAligning: true } });
  act(() => result.current.restore(draft));
  await act(async () => { await result.current.importLots(jest.fn()); });
  expect(axios.post).not.toHaveBeenCalled();
  rerender(options);
  let finish;
  axios.post.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  let pending;
  act(() => { pending = result.current.importLots(jest.fn()); });
  await act(async () => { await result.current.importLots(jest.fn()); });
  expect(axios.post).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ data: { createdCount: 1 } }); await pending; });
});
