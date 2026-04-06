function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in to continue' });
  }
  next();
}

function checkUsage(req, res, next) {
  // Will implement usage limiting here in next phase
  next();
}

module.exports = { requireAuth, checkUsage };
