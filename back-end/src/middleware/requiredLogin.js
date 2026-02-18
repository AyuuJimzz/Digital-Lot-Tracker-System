// requireLogin.js
const requireLogin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    // Send status and message via query params
    const status = 401;
    const message = encodeURIComponent(
      "Access Denied: You must be logged in to view this page.",
    );
    return res.redirect(
      `http://localhost:3000/access-denied?status=${status}&message=${message}`,
    );
  }

  req.user = req.session.user;
  next();
};

module.exports = requireLogin;
