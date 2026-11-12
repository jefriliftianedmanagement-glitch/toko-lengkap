const { signToken, setAuthCookie, clearAuthCookie } = require('../services/tokens');
const { loginAdmin } = require('../services/authService');
const { parseAdminUsername, parseLoginPassword } = require('../services/validators');

async function login(req, res) {
  const username = parseAdminUsername(req.body && req.body.username);
  const password = parseLoginPassword(req.body && req.body.password);

  const admin = await loginAdmin(username, password);

  setAuthCookie(res, 'admin', signToken('admin', admin.id));
  res.json({ ok: true, admin });
}

function logout(req, res) {
  clearAuthCookie(res, 'admin');
  res.json({ ok: true });
}

function me(req, res) {
  res.json({ ok: true, admin: { id: req.admin.id, username: req.admin.username } });
}

module.exports = { login, logout, me };
