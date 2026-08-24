// API Configuration for local dev & production deployment
// Set REACT_APP_API_URL in your hosting provider's environment variables (e.g., Vercel)
import axios from 'axios';

const getApiUrl = () => {
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // Automatically use live Render backend URL when accessed from Vercel or any non-localhost domain
  if (typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://golden-dragon-estate-backend.onrender.com';
  }
  return 'http://localhost:5000';
};

export const API_BASE_URL = getApiUrl();

// Auto-restore JWT token for cross-origin deployments (Vercel frontend + Render backend).
// Session cookies are blocked cross-domain, so we use the JWT token stored after login.
const savedToken = localStorage.getItem('authToken');
if (savedToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}
