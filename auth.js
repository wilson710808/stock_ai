const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const Database = require('better-sqlite3');

// 初始化 SQLite 數據庫
const db = new Database(path.join(__dirname, 'stock_users.db'));

// JWT 配置
const JWT_SECRET = process.env.JWT_SECRET || 'stockai-secret-key-of-minimum-32-characters-2026';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d'; // 7天

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

// 生成 hash 密碼
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

// 驗證密碼
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
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
    const token = (req.headers.authorization || '').replace('Bearer ', '') || 
                  req.cookies.stockai_token;
    if (!token) {
        return res.status(401).json({ error: '請先登入' });
    }
    const decoded = verifyJWT(token);
    if (!decoded) {
        return res.status(401).json({ error: '無效或已過期的憑證，請重新登入' });
    }
    // 注意：單機模式，無需從DB查詢
    req.user = decoded;
    next();
}

// 登入驗證
async function checkLogin(username, password) {
    const user = getUserByUsername(username);
    if (!user) return null;
    const match = await verifyPassword(password, user.password_hash);
    return match ? { userId: user.id, username: user.username, role: user.role } : null;
}

// 更改用戶名
function updateUsername(userId, newUsername) {
    try {
        const result = db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername, userId);
        return result.changes > 0;
    } catch (e) {
        return false; // UNIQUE 約束錯誤
    }
}

// 更改密碼
async function updatePassword(userId, newPassword) {
    const newHash = await hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);
    return true;
}

module.exports = {
    db,
    hashPassword,
    verifyPassword,
    signJWT,
    verifyJWT,
    authMiddleware,
    JWT_EXPIRY,
    checkLogin,
    updateUsername,
    updatePassword
};