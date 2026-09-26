import { QueryClient } from "@tanstack/react-query";

// Axios already performs one bounded retry for transient GET/HEAD failures.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

// Mark related read caches stale after a successful write. Existing screens
// keep their data; the next visit refreshes it in the background.
export function invalidateEstateMutation(path) {
  const affected = [];
  if (/\/api\/(lots|transactions|customers)(\/|$|\?)/.test(path)) {
    affected.push(["map-data"], ["recent-transactions"], ["my-sales"], ["employee-lots"], ["customers"]);
  }
  if (/\/api\/properties(\/|$|\?)/.test(path)) {
    affected.push(["properties"], ["map-data"], ["my-sales"], ["employee-lots"]);
  }
  if (/\/api\/employees(\/|$|\?)/.test(path)) {
    affected.push(["employees"], ["recent-transactions"]);
    if (/\/reassign-pending(?:\/|$|\?)/.test(path)) {
      affected.push(["map-data"], ["customers"], ["employee-lots"], ["my-sales"]);
    }
  }
  affected.forEach((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: "none" }));
}
