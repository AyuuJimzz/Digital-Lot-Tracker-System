exports.dashboard = (req, res) => {
  res.json({
    message: `Welcome to Admin Dashboard, ${req.user.email}`,
    user: req.user,
  });
};

exports.getProfile = (req, res) => {
  res.json({
    message: "Admin profile",
    user: req.user,
  });
};

// Placeholder for future admin-specific features
exports.reports = (req, res) => {
  res.json({ message: "Admin reports will be implemented here" });
};
