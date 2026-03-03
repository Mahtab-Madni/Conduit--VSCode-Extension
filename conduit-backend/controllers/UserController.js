/**
 * Get current authenticated user
 * GET /api/user/me
 */
export const getMe = (req, res) => {
  res.json({
    id: req.user._id,
    username: req.user.username,
    displayName: req.user.displayName,
    email: req.user.email,
    avatarUrl: req.user.avatarUrl,
  });
};
