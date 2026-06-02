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

## v2.2.2 — 2026-06-02
- 新增「搜尋成功後自動收藏」機制（預設開啟）
- 登入使用者成功完成一次分析後，自動將內容加入收藏夾
- 去重：同一 ticker+type 同一天只收藏一次
- 開關：localStorage `stock_auto_favorite` (預設 1，改 0 可關閉)
- 不彈 modal、不自動切收藏頁、無額外 toast，不干擾使用體驗

## v2.2.3 — 2026-06-02
- 修復 Wilson 持倉/自選股看似消失：DB 資料仍在，前端 `loadSrvData()` 補 snake_case ↔ camelCase 相容映射，載入完成後主動刷新持倉/自選/市場統計畫面
- `/api/portfolio` 回傳新增 `cash`，前端現金餘額不再固定為 0
- 修復首頁搜尋/分析資料獲取：將 read-only 市場資料端點加入 auth 白名單（`/api/quote`, `/api/quotes`, `/api/config`, `/api/market/indices`, `/api/chart/:ticker`, `/api/financial/:ticker`, `/api/moat/:ticker`）
- 恢復 v2.0.0 類似資料鏈路：`/api/analyze` 內部 server-side fetch 可重新取得 quote/chart/financial/moat 數據，再進行分析
- 更新 `public/app.js` 與 `index.html` 的模組版本標識到 v2.2.3

## v2.2.4 — 2026-06-02
- 運維清理：將 `.kline_cache/` 加入 `.gitignore`，避免 K 線運行時快取污染 Git 工作區
- 版本標識同步到 v2.2.4
