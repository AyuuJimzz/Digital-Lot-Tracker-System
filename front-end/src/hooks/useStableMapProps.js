import { useLayoutEffect, useRef } from "react";

// Parent property/overlay updates should not rewrite every SVG style or detach
// and reattach thousands of listeners. Keep callbacks fresh behind stable ones.
export function useStableMapProps(pathOptions, eventHandlers) {
  const style = useRef(pathOptions);
  if (Object.keys(pathOptions || {}).length !== Object.keys(style.current || {}).length ||
      Object.keys(pathOptions || {}).some((key) => pathOptions[key] !== style.current?.[key])) {
    style.current = pathOptions;
  }
  const callbacks = useRef(eventHandlers);
  useLayoutEffect(() => { callbacks.current = eventHandlers; });
  const handlers = useRef({});
  const keys = Object.keys(eventHandlers || {});
  if (keys.length !== Object.keys(handlers.current).length || keys.some((key) => !handlers.current[key])) {
    handlers.current = Object.fromEntries(keys.map((key) => [key, function (...args) {
      return callbacks.current?.[key]?.apply(this, args);
    }]));
  }
  return { pathOptions: style.current, eventHandlers: handlers.current };
}
