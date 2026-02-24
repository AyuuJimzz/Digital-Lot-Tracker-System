import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const [auth, setAuth] = useState({ loading: true, isAuthorized: false });

  useEffect(() => {
    fetch("http://localhost:5000/api/auth/check-session", {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        const hasAccess = allowedRoles.includes(data.role);
        setAuth({ loading: false, isAuthorized: hasAccess });
      })
      .catch(() => {
        setAuth({ loading: false, isAuthorized: false });
      });
  }, [allowedRoles]);

  if (auth.loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600 font-medium">
          Verifying Session...
        </span>
      </div>
    );
  }

  if (!auth.isAuthorized) {
    return <Navigate to="/access-denied" replace />;
  }

  return children;
};

export default ProtectedRoute;
