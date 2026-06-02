/**
 * StockAI 數據庫模組 — better-sqlite3
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'stockai.db');
const db = new Database(DB_PATH);

// 啟用 WAL 模式提升並發性能
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ===== 建表 =====
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  role TEXT DEFAULT 'user',
  cash REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT,
  settings TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS login_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  success INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS portfolio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  shares INTEGER NOT NULL,
  buy_price REAL NOT NULL,
  stop_loss REAL DEFAULT 0,
  take_profit REAL DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, ticker)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  ticker TEXT NOT NULL,
  shares INTEGER NOT NULL,
  price REAL NOT NULL,
  amount REAL NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  group_name TEXT DEFAULT '',
  note TEXT DEFAULT '',
  target_buy_price REAL DEFAULT 0,
  target_sell_price REAL DEFAULT 0,
  priority INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, ticker)
);

CREATE TABLE IF NOT EXISTS price_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  price REAL NOT NULL,
  type TEXT NOT NULL,
  triggered INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dividends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analysis_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT DEFAULT '',
  recommendation TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watchlist_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS analysis_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  analysis_id INTEGER REFERENCES analysis_history(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  type TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ticker ON transactions(user_id, ticker);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_dividends_user ON dividends(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_user ON analysis_history(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON analysis_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_ticker ON analysis_favorites(user_id, ticker);
CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id);
`);

// ===== 用戶 CRUD =====
const stmts = {
  createUser: db.prepare(`INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)`),
  getUserById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  getUserByUsername: db.prepare(`SELECT * FROM users WHERE username = ?`),
  getUserByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  updateUserLogin: db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`),
  updateProfile: db.prepare(`UPDATE users SET display_name = ?, email = ?, settings = ? WHERE id = ?`),
  updatePassword: db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`),
  updateCash: db.prepare(`UPDATE users SET cash = ? WHERE id = ?`),
  addCash: db.prepare(`UPDATE users SET cash = cash + ? WHERE id = ?`),
  // Portfolio
  getPortfolio: db.prepare(`SELECT * FROM portfolio WHERE user_id = ? ORDER BY ticker`),
  getPortfolioItem: db.prepare(`SELECT * FROM portfolio WHERE user_id = ? AND ticker = ?`),
  insertPortfolio: db.prepare(`INSERT INTO portfolio (user_id, ticker, shares, buy_price, stop_loss, take_profit, note) VALUES (?, ?, ?, ?, ?, ?, ?)`),
  updatePortfolio: db.prepare(`UPDATE portfolio SET shares = ?, buy_price = ?, stop_loss = ?, take_profit = ?, note = ?, updated_at = datetime('now') WHERE user_id = ? AND ticker = ?`),
  deletePortfolio: db.prepare(`DELETE FROM portfolio WHERE user_id = ? AND ticker = ?`),
  // Transactions
  insertTransaction: db.prepare(`INSERT INTO transactions (user_id, type, ticker, shares, price, amount, note) VALUES (?, ?, ?, ?, ?, ?, ?)`),
  getTransactions: db.prepare(`SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`),
  // Watchlist
  getWatchlist: db.prepare(`SELECT * FROM watchlist WHERE user_id = ? ORDER BY priority DESC, ticker`),
  getWatchlistItem: db.prepare(`SELECT * FROM watchlist WHERE user_id = ? AND ticker = ?`),
  insertWatchlist: db.prepare(`INSERT OR IGNORE INTO watchlist (user_id, ticker, group_name, note, target_buy_price, target_sell_price, priority) VALUES (?, ?, ?, ?, ?, ?, ?)`),
  updateWatchlist: db.prepare(`UPDATE watchlist SET group_name = ?, note = ?, target_buy_price = ?, target_sell_price = ?, priority = ? WHERE user_id = ? AND ticker = ?`),
  deleteWatchlist: db.prepare(`DELETE FROM watchlist WHERE user_id = ? AND ticker = ?`),
  // Watchlist Groups
  getWatchlistGroups: db.prepare(`SELECT * FROM watchlist_groups WHERE user_id = ? ORDER BY name`),
  insertWatchlistGroup: db.prepare(`INSERT OR IGNORE INTO watchlist_groups (user_id, name) VALUES (?, ?)`),
  deleteWatchlistGroup: db.prepare(`DELETE FROM watchlist_groups WHERE user_id = ? AND name = ?`),
  // Price Alerts
  getAlerts: db.prepare(`SELECT * FROM price_alerts WHERE user_id = ? AND triggered = 0 ORDER BY created_at DESC`),
  insertAlert: db.prepare(`INSERT INTO price_alerts (user_id, ticker, price, type) VALUES (?, ?, ?, ?)`),
  deleteAlert: db.prepare(`DELETE FROM price_alerts WHERE id = ? AND user_id = ?`),
  triggerAlert: db.prepare(`UPDATE price_alerts SET triggered = 1 WHERE id = ?`),
  // Dividends
  getDividends: db.prepare(`SELECT * FROM dividends WHERE user_id = ? AND ticker = ? ORDER BY date DESC`),
  getDividendsAll: db.prepare(`SELECT ticker, SUM(amount) as total FROM dividends WHERE user_id = ? GROUP BY ticker`),
  insertDividend: db.prepare(`INSERT INTO dividends (user_id, ticker, amount, date, note) VALUES (?, ?, ?, ?, ?)`),
  // Analysis History
  getAnalysisHistory: db.prepare(`SELECT * FROM analysis_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`),
  insertAnalysis: db.prepare(`INSERT INTO analysis_history (user_id, ticker, type, content, recommendation) VALUES (?, ?, ?, ?, ?)`),
  getAnalysisById: db.prepare(`SELECT * FROM analysis_history WHERE id = ? AND user_id = ?`),
  // Favorites
  addFavorite: db.prepare(`INSERT INTO analysis_favorites (user_id, analysis_id, ticker, type, note) VALUES (?, ?, ?, ?, ?)`),
  removeFavorite: db.prepare(`DELETE FROM analysis_favorites WHERE id = ? AND user_id = ?`),
  updateFavorite: db.prepare(`UPDATE analysis_favorites SET note = ? WHERE id = ? AND user_id = ?`),
  getFavorites: db.prepare(`SELECT f.*, a.content, a.recommendation FROM analysis_favorites f LEFT JOIN analysis_history a ON f.analysis_id = a.id WHERE f.user_id = ? ORDER BY f.created_at DESC`),
  getFavoritesByTicker: db.prepare(`SELECT f.*, a.content, a.recommendation FROM analysis_favorites f LEFT JOIN analysis_history a ON f.analysis_id = a.id WHERE f.user_id = ? AND f.ticker = ? ORDER BY f.created_at DESC`),
  // Login Logs
  insertLoginLog: db.prepare(`INSERT INTO login_logs (user_id, ip, user_agent, success) VALUES (?, ?, ?, ?)`),
};

module.exports = { db, stmts };
