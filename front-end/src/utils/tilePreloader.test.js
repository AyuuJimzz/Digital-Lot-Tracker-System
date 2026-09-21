let images, preloadLocationTiles, preloadRegionalOverviewTiles;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  images = [];
  jest.spyOn(window, "Image").mockImplementation(() => {
    const image = {};
    images.push(image);
    return image;
  });
  ({ preloadLocationTiles, preloadRegionalOverviewTiles } = require("./tilePreloader"));
});

afterEach(() => {
  jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
});

test("background tiles are limited to concurrent requests and cancelled destinations drop queued work", () => {
  const cancel = preloadLocationTiles(10, 122, [18, 19], "satellite", 1);
  expect(images).toHaveLength(4);
  expect(images[0].fetchPriority).toBe("low");
  images[0].onload();
  expect(images).toHaveLength(5);
  cancel();
  images[1].onload(); images[2].onload();
  expect(images).toHaveLength(5);
});

test("failed tiles can retry, successful tiles are deduplicated, and shared requests survive cancellation", () => {
  const cancel = preloadLocationTiles(0, 0, [19], "hybrid", 0);
  preloadLocationTiles(0, 0, [19], "hybrid", 0);
  expect(images).toHaveLength(1);
  cancel();
  images[0].onerror();
  preloadLocationTiles(0, 0, [19], "hybrid", 0);
  expect(images).toHaveLength(2);
  images[1].onload();
  preloadLocationTiles(0, 0, [19], "hybrid", 0);
  expect(images).toHaveLength(2);
});

test("preloadRegionalOverviewTiles computes center and preloads low-zoom tiles", () => {
  const props = [
    { coordinates: [10.6, 122.3] },
    { coordinates: [10.8, 122.5] },
  ];
  const cancel = preloadRegionalOverviewTiles(props, "satellite");
  expect(images.length).toBeGreaterThan(0);
  expect(typeof cancel).toBe("function");
  cancel();
});
