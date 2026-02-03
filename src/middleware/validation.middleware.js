/**
 * Input validation middleware
 * Basic validation for common request patterns
 */

const validateAuth = (req, res, next) => {
  const { username, password } = req.body;

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({
      message: 'Invalid username. Must be at least 3 characters.',
    });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({
      message: 'Invalid password. Must be at least 6 characters.',
    });
  }

  // Sanitize inputs
  req.body.username = username.trim().toLowerCase();
  req.body.password = password.trim();

  next();
};

const validateContactAdd = (req, res, next) => {
  // For favorites - validate userId
  const userId = req.body.userId;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ message: 'Invalid userId' });
  }

  next();
};

const validateSearch = (req, res, next) => {
  const { q } = req.query;

  if (q && typeof q !== 'string') {
    return res.status(400).json({ message: 'Invalid search query' });
  }

  next();
};

module.exports = {
  validateAuth,
  validateContactAdd,
  validateSearch,
};
