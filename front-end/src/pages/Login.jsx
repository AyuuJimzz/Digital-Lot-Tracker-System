import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/image/golden-dragon-logo.png";

function Login({ setRole }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Already logged in
  useEffect(() => {
    fetch("http://localhost:5000/api/auth/check-session", {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Not logged in");
        return res.json();
      })
      .then((data) => {
        if (data.role === "admin") navigate("/admin-panel");
        else if (data.role === "employee") navigate("/employee-panel");
      })
      .catch(() => {});
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("role", data.role);
        setRole(data.role);

        if (data.role === "admin") navigate("/admin-panel");
        else if (data.role === "employee") navigate("/employee-panel");
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError("Unable to connect to server");
      console.error("Login error:", err);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen font-sans">
      {/* Left side */}
      <div className="flex-1 bg-white flex items-center justify-center p-10">
        <div className="flex flex-col items-center text-center">
          <img
            src={logo}
            alt="Golden Dragon Logo"
            className="block mx-auto w-64 h-64 object-contain mb-5 md:mb-8"
          />
          <h1 className="text-4xl md:text-5xl font-bold tracking-wider text-black mb-2">
            Golden Dragon
          </h1>
          <h2 className="text-2xl md:text-3xl font-medium tracking-wide text-gray-700">
            Estate Corporation
          </h2>
        </div>
      </div>

      {/* Right side */}
      <div className="flex-1 bg-gray-400 flex items-center justify-center p-10">
        <div className="bg-gray-300 p-10 md:p-12 rounded-xl w-full max-w-md shadow-lg">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
            SIGN IN
          </h2>

          {error && (
            <div className="bg-red-100 text-red-700 p-2 rounded mb-6 text-center text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="flex items-center bg-white rounded px-3 py-1">
              <span className="text-xl mr-3">👤</span>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 outline-none p-3 text-base placeholder-gray-500 bg-transparent"
              />
            </div>

            {/* Password */}
            <div className="flex items-center bg-white rounded px-3 py-1">
              <span className="text-xl mr-3">🔒</span>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="flex-1 outline-none p-3 text-base placeholder-gray-500 bg-transparent"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-white text-black font-semibold rounded hover:bg-gray-100 transition-colors"
            >
              Sign In →
            </button>
          </form>

          <button
            type="button"
            onClick={() => alert("Forgot Password feature coming soon")}
            className="block mt-5 text-center text-blue-700 text-sm hover:underline"
          >
            Forgot Password?
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
