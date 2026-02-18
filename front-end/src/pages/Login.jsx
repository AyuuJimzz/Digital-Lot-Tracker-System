import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
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
		<div className="login-container">
			<div className="login-left">
				<div className="logo-section">
					<img src={logo} alt="Golden Dragon Logo" className="logo" />
					<h1 className="company-name">Golden Dragon</h1>
					<h2 className="company-subtitle">Estate Corporation</h2>
				</div>
			</div>

			<div className="login-right">
				<div className="signin-box">
					<h2 className="signin-title">SIGN IN</h2>

					{error && <div className="error-message">{error}</div>}

					<form onSubmit={handleSubmit}>
						<div className="input-group">
							<div className="input-wrapper">
								<span className="input-icon">👤</span>
								<input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
							</div>
						</div>

						<div className="input-group">
							<div className="input-wrapper">
								<span className="input-icon">🔒</span>
								<input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
							</div>
						</div>

						<button type="submit" className="signin-btn">
							Sign In →
						</button>
					</form>

					<button type="button" className="forgot-password" onClick={() => alert("Forgot Password feature coming soon")}>
						Forgot Password?
					</button>
				</div>
			</div>
		</div>
	);
}

export default Login;
