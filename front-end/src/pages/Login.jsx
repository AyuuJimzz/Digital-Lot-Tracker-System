import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Login.css";
import logo from "../assets/image/golden-dragon-logo.png";

function Login({ setRole }) {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");

	// Check if already logged in
	useEffect(() => {
		axios
			.get("http://localhost:5000/api/auth/check-session", {
				withCredentials: true,
			})
			.then((response) => {
				localStorage.setItem("role", response.data.role || "");
				localStorage.setItem("password_reset_required", response.data.password_reset_required ? "true" : "false");
				setRole(response.data.role || null);
				if (response.data.role === "admin") navigate("/admin-panel");
				else if (response.data.role === "employee") navigate("/employee-panel");
			})
			.catch(() => {});
	}, [navigate, setRole]);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");

		try {
			const response = await axios.post("http://localhost:5000/api/auth/login", { email, password }, { withCredentials: true });

			const userRole = response.data.user.role;
			const passwordResetRequired = response.data.password_reset_required;

			localStorage.setItem("role", userRole);
			localStorage.setItem("password_reset_required", passwordResetRequired ? "true" : "false");
			setRole(userRole);

			if (userRole === "admin") navigate("/admin-panel");
			else if (userRole === "employee") navigate("/employee-panel");
		} catch (err) {
			const errorMessage = err.response?.data?.message || err.message || "Login failed";
			setError(errorMessage);
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

					<button type="button" className="forgot-password" onClick={() => navigate("/forgot-password")}>
						Forgot Password?
					</button>
				</div>
			</div>
		</div>
	);
}

export default Login;
