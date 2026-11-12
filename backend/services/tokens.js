const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ISSUER = 'fake-shop';

// Cookie user dan admin dipisah supaya sesi admin tidak tercampur dengan user.
const COOKIES = {
  user: { name: 'user_token', path: '/api', ttl: env.USER_TOKEN_TTL_SEC },
  admin: { name: 'admin_token', path: '/api/admin', ttl: env.ADMIN_TOKEN_TTL_SEC },
};

function signToken(role, id) {
  return jwt.sign({ role }, env.JWT_SECRET, {
    subject: String(id),
    expiresIn: COOKIES[role].ttl,
    issuer: ISSUER,
    algorithm: 'HS256',
  });
}

// Mengembalikan payload jika valid DAN role cocok, selain itu null
function verifyToken(token, role) {
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: ISSUER,
      algorithms: ['HS256'],
    });
    return payload.role === role ? payload : null;
  } catch {
    return null;
  }
}

function cookieOptions(role) {
  return {
    httpOnly: true, // tidak bisa dibaca JavaScript (anti XSS token theft)
    sameSite: 'strict', // anti CSRF
    secure: env.IS_PROD, // wajib HTTPS di production
    path: COOKIES[role].path,
  };
}

function setAuthCookie(res, role, token) {
  res.cookie(COOKIES[role].name, token, {
    ...cookieOptions(role),
    maxAge: COOKIES[role].ttl * 1000,
  });
}

function clearAuthCookie(res, role) {
  res.clearCookie(COOKIES[role].name, cookieOptions(role));
}

function readCookie(req, role) {
  return req.cookies ? req.cookies[COOKIES[role].name] : undefined;
}

module.exports = { signToken, verifyToken, setAuthCookie, clearAuthCookie, readCookie };
