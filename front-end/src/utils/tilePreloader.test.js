let images, preloadLocationTiles;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  images = [];
  jest.spyOn(window, "Image").mockImplementation(() => {
    const image = {};
    images.push(image);
    return image;
  });
  ({ preloadLocationTiles } = require("./tilePreloader"));
});

afterEach(() => {
  jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
});

test("background tiles are limited to two requests and cancelled destinations drop queued work", () => {
  const cancel = preloadLocationTiles(10, 122, [18, 19], "satellite", 1);
  expect(images).toHaveLength(2);
  expect(images[0].fetchPriority).toBe("low");
  images[0].onload();
  expect(images).toHaveLength(3);
  cancel();
  images[1].onload(); images[2].onload();
  expect(images).toHaveLength(3);
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
