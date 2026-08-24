// API Configuration for local dev & production deployment
// Set REACT_APP_API_URL in your hosting provider's environment variables (e.g., Vercel)
const getApiUrl = () => {
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  if (typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.warn('[api.js] REACT_APP_API_URL is not set — falling back to localhost:5000. Set it in your hosting environment variables.');
  }
  return 'http://localhost:5000';
};

export const API_BASE_URL = getApiUrl();
