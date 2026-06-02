# StockAI 版本歷史

## v2.1.0 (2026-06-02)

### 🐛 Bug 修復
- **gatewayChat retry loop**: 修復重試邏輯中的 `continue` 語句可能導致死循環的 bug
- **auth.js 雙數據庫**: 移除孤立的 `stock_users.db`，統一使用 `stockai.db`
- **JWT_SECRET 安全**: 生產環境未設置 `JWT_SECRET` 時進程主動退出，防止弱密鑰風險
- **模擬數據價格漂移**: 當所有 API 不可用時，使用股票代碼哈希生成固定值，避免 `random` 導致每次結果不同
- **K線緩存目錄**: 從系統 temp 改為項目本地 `.kline_cache/` 目錄，防止重啟後緩存失效

### 🔒 安全加固
- **登入/註冊 Rate Limiting**: 15 分鐘內登入最多 10 次、註冊最多 5 次，防止暴力破解
- **bcrypt 升級**: 從 10 輪升級到 12 輪，提升密碼 hash 安全性
- **異常處理**: 所有資料庫寫入操作增加 try/catch，避免單點失敗影響整體

### ✨ 功能修復
- **新增 `/api/user-context`**: 修補前端依賴但缺失的 API 端點
- **`/api/market/indices` 完善**: 三大指數 + VIX 完整支持

### 📚 數據庫
- **股票名稱映射擴充**: 從 35 支擴充到 70+ 支熱門美股
- **內在價值計算修復**: 安全邊際計算方向修正（現價低於 IV = 有安全邊際）

### 🧹 清理
- 移除 `public/` 目錄下 9 個碎片文件（app.part1-4.js、fix-recommend.js、多個 test*.html）
- 更新 `.env.example` 完整環境變量說明

---

## v2.0.0 (2025-??-??)
- 初始版本
