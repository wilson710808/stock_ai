/**
 * StockAI 認證模組 — JWT + scrypt 密碼 hash
 */
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 天

// ===== 密碼 Hash（使用 scrypt，無需 bcrypt 原生編譯）=====
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384 }).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, derived] = stored.split(':');
  if (!salt || !derived) return false;
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384 }).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(derived));
}

// ===== JWT（簡潔 HMAC 方案，與 #09 一致）=====
function signJWT(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + Math.floor(JWT_EXPIRY / 1000),
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyJWT(token) {
  try {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// ===== 認證中間件 =====
function authMiddleware(req, res, next) {
  // 允許無需登錄的路徑
  const publicPaths = [
    '/api/auth/login', '/api/auth/register',
    '/api/health', '/api/config', '/api/market/indices',
    '/api/sector',
  ];
  if (publicPaths.some(p => req.path === p || req.path.startsWith(p + '/'))) {
    return next();
  }
  // 靜態文件和非 API 路徑放行
  if (!req.path.startsWith('/api/')) return next();

  // 分析/報價/聊天/K線 — 允許未登錄使用但記錄用戶（如有）
  const optionalAuthPaths = ['/api/analyze', '/api/quote', '/api/quotes', '/api/chat', '/api/chart/', '/api/save-analysis', '/api/analysis-history'];
  const isOptional = optionalAuthPaths.some(p => req.path.startsWith(p));

  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const payload = verifyJWT(token);
    if (payload) {
      req.user = { userId: payload.userId, username: payload.username, role: payload.role };
    } else {
      res.clearCookie('token');
    }
  }

  if (!req.user && !isOptional) {
    return res.status(401).json({ error: '請先登錄', needLogin: true });
  }

  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  signJWT,
  verifyJWT,
  authMiddleware,
  JWT_EXPIRY,
};
