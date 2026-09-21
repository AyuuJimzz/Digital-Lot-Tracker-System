import { renderHook } from "@testing-library/react";
import { useStableMapProps } from "./useStableMapProps";

test("unchanged lot styles and listeners retain identity but use current click behavior", () => {
  const first = jest.fn(), second = jest.fn();
  const { result, rerender } = renderHook(({ color, click }) => useStableMapProps({ color, weight: 2 }, { click }), {
    initialProps: { color: "green", click: first },
  });
  const initial = result.current;
  rerender({ color: "green", click: second });
  expect(result.current.pathOptions).toBe(initial.pathOptions);
  expect(result.current.eventHandlers).toBe(initial.eventHandlers);
  result.current.eventHandlers.click("event");
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledWith("event");
  rerender({ color: "red", click: second });
  expect(result.current.pathOptions).not.toBe(initial.pathOptions);
  expect(result.current.pathOptions.color).toBe("red");
});
