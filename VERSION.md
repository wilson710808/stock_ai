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

## v2.2.5 — 2026-06-02
- 修復瀏覽器仍載入舊模組導致持倉/自選看似空白：前端所有模組 cache-buster 由 `20260602001` 升至 `20260602005`
- `showPage()` 改為 async；進入「持倉」或「自選」頁時，已登入用戶會先強制執行 `loadSrvData()` 再渲染
- 避免初始化順序或瀏覽器快取造成 Wilson 的 server DB 資料未顯示


## v2.2.8 — 2026-06-02
- 同步 GitHub 遠端提交 `d87a972` / `8134b8a` 後的 #07 生產適配修復
- 將 `server.js` 預設端口由 3001 改回 #07 生產端口 3007
- 將 `buildUserInvestContext()` 內部 `/api/quotes` 呼叫從硬編碼 `127.0.0.1:3001` 改為 `127.0.0.1:${PORT}`，避免抓錯 webspace
- 前端版本標識與 cache-buster 升至 `20260602008`


## v2.2.9 — 2026-06-02
- 修復前端初始化中斷：不再覆寫瀏覽器原生 `window.history`，改用 `window.stockHistory`
- 修復因初始化中斷導致 `checkAuth()` 未執行，Wilson 登入後持倉/自選看似丟失
- 修復全面分析 `type` 可能為空，導致 `analysis_history.type` NOT NULL 錯誤與分析流程不穩
- 後端 `/api/analyze` 增加 `analysisType` fallback：空 type 預設 `overview`
- 前端版本與 cache-buster 升至 `20260602009`


## v2.2.10 — 2026-06-03
- 修復 K 線圖：前端 `loadChart()` 套回 v2.0.0 的 `/api/chart/:ticker` `candles` 格式，並兼容舊 `data` 格式
- 等待 async lightweight-charts 載入後再初始化，避免圖表庫尚未載入造成空白
- K 線圖 badge 顯示資料源與天數，錯誤訊息改為可理解提示
- 修復決策建議卡片：兼容 `[RECOMMENDATION:BUY|HOLD|SELL|AVOID]` 與中文「最終建議/當前建議/綜合評級」
- 前端版本與 cache-buster 升至 `20260603001`


## v2.2.11 — 2026-06-03
- 當前價格獲取套回 v2.0.0 的 canonical Python 流程：`realtime_price.py` 作為單股/批量報價唯一來源
- `realtime_price.py` 報價優先使用 Yahoo `regularMarketPrice` 作為**當前現價**，再 fallback Stooq/TwelveData/EODHD
- 後端統一以 `(現價 - 前一日收盤價) / 前一日收盤價` 重算 `changePercent`，避免來源欄位不一致
- 持倉列表當日漲幅也以前一交易日收盤價重算，不再直接信任來源回傳百分比
- `/api/quote` 同時支援 GET/POST，避免 GET 被 SPA fallback 回 HTML
- `/api/quotes` 優先使用 `realtime_price.py --batch`，避免並行啟動多個 Python 查詢造成價格源不穩
- `/api/analysis-history` 回傳新增記錄 ID，前端可關聯收藏
- 分析成功後更新 `lastAnalysis*` 狀態，等待分析歷史保存，再執行自動收藏並保留 `lastFavoriteId`
- 恢復結果頁「📚 收藏分析」按鈕，手動收藏與自動收藏都可用
- 移除 index.html 內舊版 inline 收藏腳本，避免覆蓋模組化實作
- 前端版本與 cache-buster 升至 `20260603002`
