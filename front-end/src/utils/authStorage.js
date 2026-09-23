import axios from "axios";

export const getStoredToken = () =>
  localStorage.getItem("authToken") || localStorage.getItem("token");

// Only remove auth state if the response belongs to the current token. An old
// request must not erase a newer login shared with another tab.
export function clearStoredAuth(expectedToken) {
  if (expectedToken !== undefined && getStoredToken() !== expectedToken) return false;

  ["authToken", "token", "role", "user", "password_reset_required"].forEach((key) =>
    localStorage.removeItem(key)
  );
  delete axios.defaults.headers.common.Authorization;
  return true;
}
