// API Configuration for local dev & production deployment
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
const savedToken = localStorage.getItem('authToken') || localStorage.getItem('token');
if (savedToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}

// Global Interceptor: Catch concurrent device session expiration & log API failures
let isHandlingKickout = false;
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || 'unknown url';
    const method = (error.config?.method || 'get').toUpperCase();
    const data = error.response?.data;

    // Structured diagnostic log for easy debugging
    if (status && status >= 400) {
      console.warn(`⚠️ [API Response ${status}] ${method} ${url}:`, data?.message || data?.error || error.message);
    } else if (!error.response) {
      console.error(`🚨 [Network/CORS Error] Failed to connect to backend at ${url}:`, error.message);
    }

    if (
      status === 401 &&
      (data?.code === 'CONCURRENT_SESSION_EXPIRED' ||
        (data?.message && data.message.toLowerCase().includes('another device')))
    ) {
      if (!isHandlingKickout) {
        isHandlingKickout = true;
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('user');
        sessionStorage.clear();

        window.dispatchEvent(
          new CustomEvent('concurrentSessionKickedOut', {
            detail: {
              message:
                data?.message ||
                'Your account was signed into from another device. For your security, this session has been ended.',
            },
          })
        );
      }
    }
    return Promise.reject(error);
  }
);
