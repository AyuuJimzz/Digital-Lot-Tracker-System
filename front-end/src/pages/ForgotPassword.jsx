import React, { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/image/golden-dragon-logo.png";

function ForgotPassword() {
	const [email, setEmail] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setMessage("");
		setLoading(true);

		try {
			const response = await fetch("http://localhost:5000/api/auth/forgot-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});

			const data = await response.json();

			if (response.ok) {
				setMessage(data.message);
				setEmail("");
			} else {
				setError(data.message || "Failed to send reset email");
			}
		} catch (err) {
			setError("Unable to connect to server");
			console.error("Forgot password error:", err);
		} finally {
			setLoading(false);
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
					<h2 className="signin-title">FORGOT PASSWORD</h2>
					<p style={{ color: "#6b7280", marginBottom: "20px", fontSize: "14px" }}>Enter your email address and we'll send you a temporary password.</p>

					{error && <div className="error-message">{error}</div>}
					{message && (
						<div
							style={{
								backgroundColor: "#d1fae5",
								color: "#065f46",
								padding: "12px 16px",
								borderRadius: "8px",
								marginBottom: "20px",
								fontSize: "14px",
							}}>
							{message}
						</div>
					)}

					<form onSubmit={handleSubmit}>
						<div className="input-group">
							<div className="input-wrapper">
								<span className="input-icon">📧</span>
								<input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
							</div>
						</div>

						<button type="submit" className="signin-btn" disabled={loading}>
							{loading ? "Sending..." : "Send Temporary Password →"}
						</button>
					</form>

					<div style={{ marginTop: "20px", textAlign: "center" }}>
						<Link
							to="/login"
							style={{
								color: "#2563eb",
								textDecoration: "none",
								fontSize: "14px",
							}}>
							← Back to Login
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}

export default ForgotPassword;
