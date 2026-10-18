import axios from "axios";
import { queryClient } from "../config/queryClient";

export const getStoredToken = () =>
  localStorage.getItem("authToken") || localStorage.getItem("token");

export function getCurrentUser() {
  let user = null;
  try {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed && (parsed.id || parsed.employee_id)) {
        user = parsed;
      }
    }
  } catch (_) {}

  if (!user) {
    const token = getStoredToken();
    if (token) {
      try {
        const parts = token.split(".");
        if (parts.length >= 2) {
          const base64Url = parts[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join("")
          );
          user = JSON.parse(jsonPayload);
        }
      } catch (_) {}
    }
  }

  // If user object lacks full name, enrich from userProfileCache
  if (user && !user.first_name && !user.name) {
    try {
      const cached = sessionStorage.getItem("userProfileCache");
      if (cached) {
        const profile = JSON.parse(cached);
        if (profile?.first_name || profile?.name) {
          user = {
            ...user,
            first_name: profile.first_name || "",
            last_name: profile.last_name || "",
            name: profile.name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
          };
        }
      }
    } catch (_) {}
  }

  return user;
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
