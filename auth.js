const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const Database = require('better-sqlite3');

// 初始化 SQLite 數據庫
const db = new Database(path.join(__dirname, 'stock_users.db'));

// JWT 配置
const JWT_SECRET = process.env.JWT_SECRET || 'stockai-secret-key-of-minimum-32-characters-2026';
const JWT_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 天，毫秒

// 初始化用戶數據庫
function initUserDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        );
        
        -- 默認創建 admin 用戶（密碼 admin）
        INSERT OR IGNORE INTO users (username, password_hash, role)
        VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.vqBytfRtqJ/pOnO', 'admin');
    `);
}
initUserDatabase();

// 生成 hash 密碼（同步版本）
function hashPassword(password) {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(password, salt);
}

// 驗證密碼（同步版本）
function verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

// 獲取用戶
function getUserByUsername(username) {
    return db.prepare('SELECT id, username, password_hash, role FROM users WHERE username = ?').get(username);
}

// 生成 JWT
function signJWT(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

// 驗證 JWT
function verifyJWT(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return null;
    }
}

// 認證中間件
function authMiddleware(req, res, next) {
    // 白名單：不需登入即可訪問的路由
    const whitelist = [
        '/login.html',
        '/register.html',
        '/api/auth/login',
        '/api/auth/register',
        '/favicon.ico',
        '/',
        '/ws/07-stock-ai/',
        '/ws/07-stock-ai/login.html',
        '/ws/07-stock-ai/register.html'
    ];
    
    // 白名單路由直接放行
    const path = req.path;
    if (whitelist.includes(path) || 
        path.startsWith('/css/') || 
        path.startsWith('/js/') || 
        path.startsWith('/images/') ||
        path.startsWith('/api/auth/') ||  // 所有 auth API 豁免
        path.endsWith('.css') ||
        path.endsWith('.js')) {
        return next();
    }
    
    const token = (req.headers.authorization || '').replace('Bearer ', '') || 
                  req.cookies.token ||
                  req.cookies.stockai_token;
    if (!token) {
        // 頁面請求：重定向到登入頁；API 請求：返回 401
        if (path.endsWith('.html') || path === '/' || !path.startsWith('/api/')) {
            // 反代環境下使用相對路徑重定向
            const prefix = req.headers['x-forwarded-prefix'] || '';
            return res.redirect(prefix + '/login.html');
        }
        return res.status(401).json({ error: '請先登入' });
    }
    
    const decoded = verifyJWT(token);
    if (!decoded) {
        if (path.endsWith('.html') || path === '/' || !path.startsWith('/api/')) {
            const prefix = req.headers['x-forwarded-prefix'] || '';
            return res.redirect(prefix + '/login.html');
        }
        return res.status(401).json({ error: '無效或已過期的憑證，請重新登入' });
    }
    
    req.user = decoded;
    next();
}

module.exports = {
    db,
    hashPassword,
    verifyPassword,
    signJWT,
    verifyJWT,
    authMiddleware,
    JWT_EXPIRY,  // cookie maxAge 需要毫秒
    getUserByUsername
};
