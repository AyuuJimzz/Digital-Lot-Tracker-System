// API Configuration for local dev & production deployment
const getApiUrl = () => {
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  if (typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://golden-dragon-backend-1204.onrender.com';
  }
  return 'http://localhost:5000';
};

export const API_BASE_URL = getApiUrl();
