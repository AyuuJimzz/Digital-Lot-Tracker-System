import React from "react";
import { Link, useLocation } from "react-router-dom";

const Forbidden = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const status = searchParams.get("status") || "403";
  const message =
    searchParams.get("message") ||
    "You do not have permission to access this page.";

  return (
    <div className="forbidden-container">
      <div className="forbidden-box">
        <div className="forbidden-icon">🚫</div>
        <div className="forbidden-status">Status: {status}</div>
        <div className="forbidden-message">{message}</div>
        <Link to="/" className="forbidden-btn">
          Go to Login
        </Link>
      </div>
    </div>
  );
};

export default Forbidden;
