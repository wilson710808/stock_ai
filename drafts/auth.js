/**
 * StockAI — 認證模組
 * bcrypt 為主，crypto.scryptSync 為後備方案
 * JWT 使用 crypto.createHmac（無需 jsonwebtoken 依賴）
 */
const crypto = require('crypto');
const db = require('./db');

// ===== JWT 配置 =====
let JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  // 首次啟動自動生成，存入 .env
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  try {
    const fs = require('fs');
    const envPath = require('path').join(__dirname, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      // 移除舊的 JWT_SECRET 行
      envContent = envContent.replace(/^JWT_SECRET=.*$/m, '').trim();
    }
    envContent += '\nJWT_SECRET=' + JWT_SECRET + '\n';
    fs.writeFileSync(envPath, envContent);
  } catch (e) {
    console.warn('[Auth] 無法寫入 .env，JWT_SECRET 僅存於記憶體');
  }
}
const JWT_EXPIRY = 7 * 24 * 60 * 60; // 7 天（秒）

// ===== 密碼 Hash =====
let bcrypt = null;
let useBcrypt = false;
try {
  bcrypt = require('bcrypt');
  useBcrypt = true;
  console.log('[Auth] 使用 bcrypt 加密');
} catch (e) {
  console.log('[Auth] bcrypt 不可用，使用 crypto.scryptSync 後備方案');
}

function hashPassword(password) {
  if (useBcrypt) {
    return bcrypt.hashSync(password, 10);
  }
  // 後備方案：scryptSync
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, hash) {
  if (useBcrypt && hash.startsWith('$2')) {
    return bcrypt.compareSync(password, hash);
  }
  // scrypt 後備驗證
  if (hash.startsWith('scrypt$')) {
    const parts = hash.split('$');
    const salt = parts[1];
    const derived = parts[2];
    const check = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(check));
  }
  return false;
}

// ===== JWT =====
function signJWT(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = { ...payload, iat: now, exp: now + JWT_EXPIRY };
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('格式錯誤');
    const [header, body, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expectedSig) throw new Error('簽名無效');
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (data.exp && Math.floor(Date.now() / 1000) > data.exp) throw new Error('已過期');
    return data; // { userId, username, role, iat, exp }
  } catch (e) {
    throw new Error('Token 無效: ' + e.message);
  }
}

// ===== 認證中間件 =====
function authMiddleware(req, res, next) {
  // 排除不需要登錄的路徑
  if (
    req.path === '/api/auth/login' ||
    req.path === '/api/auth/register' ||
    req.path === '/api/health' ||
    req.path === '/api/config' ||
    req.path === '/api/market/indices' ||
    req.path.startsWith('/api/analyze') ||
    req.path.startsWith('/api/quote') ||
    req.path.startsWith('/api/quotes') ||
    req.path.startsWith('/api/chat') ||
    req.path.startsWith('/api/chart/') ||
    req.path.startsWith('/api/save-analysis') ||
    req.path.startsWith('/api/sector/') ||
    !req.path.startsWith('/api/')
  ) {
    return next();
  }

  const token = req.cookies?.token || (req.headers.authorization?.replace('Bearer ', '') || '');
  if (!token) {
    return res.status(401).json({ error: '請先登錄', needLogin: true });
  }

  try {
    const payload = verifyJWT(token);
    req.user = { userId: payload.userId, username: payload.username, role: payload.role };
    next();
  } catch (e) {
    res.clearCookie('token');
    return res.status(401).json({ error: '登錄已過期', needLogin: true });
  }
}

// ===== 用戶操作 =====
function registerUser({ username, email, password, display_name }) {
  if (!username || !password) throw new Error('用戶名和密碼必填');
  if (username.length < 3) throw new Error('用戶名至少 3 個字元');
  if (password.length < 6) throw new Error('密碼至少 6 個字元');

  const password_hash = hashPassword(password);
  try {
    const stmt = db.prepare(
      'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(username, email || null, password_hash, display_name || username);
    return { id: result.lastInsertRowid, username };
  } catch (e) {
    if (e.message.includes('UNIQUE constraint')) {
      if (e.message.includes('username')) throw new Error('用戶名已被使用');
      if (e.message.includes('email')) throw new Error('郵箱已被使用');
    }
    throw e;
  }
}

function loginUser(identifier, password) {
  // 支持用戶名或郵箱登錄
  const stmt = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?');
  const user = stmt.get(identifier, identifier);
  if (!user) throw new Error('用戶不存在');

  if (!verifyPassword(password, user.password_hash)) {
    throw new Error('密碼錯誤');
  }

  // 更新最後登錄時間
  db.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?').run(user.id);

  // 生成 JWT
  const token = signJWT({ userId: user.id, username: user.username, role: user.role });
  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      avatar: user.avatar,
      role: user.role,
      cash: user.cash,
      settings: JSON.parse(user.settings || '{}')
    }
  };
}

function getUserById(userId) {
  const stmt = db.prepare('SELECT id, username, email, display_name, avatar, role, cash, settings, created_at, last_login FROM users WHERE id = ?');
  const user = stmt.get(userId);
  if (user) user.settings = JSON.parse(user.settings || '{}');
  return user;
}

function updateUserProfile(userId, { display_name, email }) {
  const updates = [];
  const values = [];
  if (display_name !== undefined) { updates.push('display_name = ?'); values.push(display_name); }
  if (email !== undefined) { updates.push('email = ?'); values.push(email); }
  if (!updates.length) throw new Error('無更新內容');
  values.push(userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getUserById(userId);
}

function changePassword(userId, oldPassword, newPassword) {
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('用戶不存在');
  if (!verifyPassword(oldPassword, user.password_hash)) throw new Error('原密碼錯誤');
  if (newPassword.length < 6) throw new Error('新密碼至少 6 個字元');
  const hash = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
  return true;
}

function logLogin(userId, ip, userAgent, success = 1) {
  db.prepare('INSERT INTO login_logs (user_id, ip, user_agent, success) VALUES (?, ?, ?, ?)')
    .run(userId, ip, userAgent, success);
}

module.exports = {
  authMiddleware,
  registerUser,
  loginUser,
  getUserById,
  updateUserProfile,
  changePassword,
  logLogin,
  signJWT,
  verifyJWT,
  hashPassword,
  verifyPassword
};
