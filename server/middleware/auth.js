const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ success: false, message: 'לא מחובר' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'appointment-super-secret-key-change-in-production');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'טוקן לא תקין' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'אין הרשאה' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
