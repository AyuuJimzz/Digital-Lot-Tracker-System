import axios from "axios";
import { queryClient } from "../config/queryClient";

export const getStoredToken = () =>
  localStorage.getItem("authToken") || localStorage.getItem("token");

export function getCurrentUser() {
  try {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed && (parsed.id || parsed.employee_id)) return parsed;
    }
  } catch (_) {}

  const token = getStoredToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (_) {
    return null;
  }
}

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
