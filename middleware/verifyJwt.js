const jwt = require('jsonwebtoken');

const verifyJWT = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, 'Tirtho', (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Failed to authenticate token' });
    }

    req.userId = decoded._id;
    next();
  });
};

module.exports = verifyJWT;
