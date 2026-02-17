import React, { useState } from "react";
import "./Login.css";
import logo from "../assets/golden-dragon-logo.png";

function Login() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");

		try {
			const response = await fetch("http://localhost:5000/api/auth/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ username, password }),
			});

			const data = await response.json();

			if (response.ok) {
				localStorage.setItem("token", data.token);
				console.log("Login successful!");
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
								<input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
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
				</div>
			</div>
		</div>
	);
}
export default Login;
