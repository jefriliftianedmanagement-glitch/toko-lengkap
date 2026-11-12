const { signToken, setAuthCookie, clearAuthCookie } = require('../services/tokens');
const { registerUser, loginUser, getUserProfile } = require('../services/authService');
const { parseUsername, parseNewPassword, parseLoginPassword } = require('../services/validators');

async function register(req, res) {
  const username = parseUsername(req.body && req.body.username);
  const password = parseNewPassword(req.body && req.body.password);

  const user = await registerUser(username, password);

  setAuthCookie(res, 'user', signToken('user', user.id));
  res.status(201).json({ ok: true, user });
}

async function login(req, res) {
  const username = parseUsername(req.body && req.body.username);
  const password = parseLoginPassword(req.body && req.body.password);

  const user = await loginUser(username, password);

  setAuthCookie(res, 'user', signToken('user', user.id));
  res.json({ ok: true, user });
}

function logout(req, res) {
  clearAuthCookie(res, 'user');
  res.json({ ok: true });
}

// Dipakai header aplikasi: username, ID akun, saldo, jumlah pesan belum dibaca
async function me(req, res) {
  const profile = await getUserProfile(req.user.id);
  res.json({
    ok: true,
    user: {
      id: req.user.id,
      account_id: req.user.account_id,
      username: req.user.username,
      avatar_url: req.user.avatar_url,
      balance: profile.balance,
      unread_count: profile.unread_count,
    },
  });
}

module.exports = { register, login, logout, me };
