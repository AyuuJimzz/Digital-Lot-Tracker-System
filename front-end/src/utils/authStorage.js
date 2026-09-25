import axios from "axios";
import { queryClient } from "../config/queryClient";

export const getStoredToken = () =>
  localStorage.getItem("authToken") || localStorage.getItem("token");

export function clearUserDataCache() {
  queryClient.clear();
  ["propertiesCache", "employeesCache", "adminStatsCache", "employeeStatsCache",
    "employeeLotsCache", "customersCache", "mapDataCache", "userProfileCache"].forEach((key) =>
    sessionStorage.removeItem(key)
  );
}

// Only remove auth state if the response belongs to the current token. An old
// request must not erase a newer login shared with another tab.
export function clearStoredAuth(expectedToken) {
  if (expectedToken !== undefined && getStoredToken() !== expectedToken) return false;

  ["authToken", "token", "role", "user", "password_reset_required"].forEach((key) =>
    localStorage.removeItem(key)
  );
  delete axios.defaults.headers.common.Authorization;
  clearUserDataCache();
  return true;
}
