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


## v2.3.0 — 2026-06-03 (Baseline)
**Baseline 版本**：自 v2.2.x 一系列修復後，基本功能（登入/註冊、報價、K 線圖、決策建議、收藏、持倉/自選、AI 分析）已可穩定運作，正式升 minor 至 v2.3.0 作為後續迭代基準。

繼承自 v2.2.11 的關鍵能力：
- 現價來源：`realtime_price.py` Yahoo `regularMarketPrice` 優先 → Stooq → TwelveData → EODHD
- 當日漲幅一律以 `(現價 - 前一日收盤價) / 前一日收盤價` 計算
- 持倉列表 / AI 持倉分析 / 自選股皆從同一報價鏈路取得實時報價
- K 線圖：EODHD → Yahoo → TwelveData，最後一根蠟燭與當前現價對齊
- 決策建議卡片：兼容 `[RECOMMENDATION:BUY|HOLD|SELL|AVOID]` 與中文「最終建議/當前建議/綜合評級」
- 收藏：搜尋成功後依「板塊 → 個股 → 日期」自動分類，支援 PUT 更新筆記
- 認證：JWT + cookie，子路徑反代下 `/api/auth/me` 正常解析 token
- 前端模組化：app-config/utils/auth/data/analysis/portfolio/watchlist/recommend/init/app 共 10 模組
- 前端版本與 cache-buster 升至 `20260603030`


## v2.3.2 — 2026-06-09
**修復「收藏/持倉」現價來源過期，導致當日漲跌幅錯誤的問題**

### 根因
- Yahoo Finance 在目前伺服器 IP 上持續返回 429。
- EODHD demo endpoint 近期返回 403。
- Stooq endpoint 返回 404。
- 報價鏈路因此落到 `stock_prices.json` 中央靜態價格庫或哈希模擬資料，造成 ARM 等股票顯示舊價格（例如 ARM 顯示 335.20，而非即時約 347 美元），並進一步導致當日漲跌幅錯誤。

### 修復
- `realtime_price.py` 新增 `get_quote_nasdaq(ticker)`，使用 Nasdaq 官方 quote API 作為第一即時來源。
- Nasdaq 回傳 `lastSalePrice + netChange + percentageChange`，後端以 `prevClose = price - netChange` 推回前收，確保當日漲跌幅與現價同源。
- 報價主流程調整為：Nasdaq → Yahoo（含 EODHD prevClose 校正）→ EODHD K 線 → Stooq → TwelveData → `stock_prices.json` / 哈希模擬最後防線。
- `_validate_quote_pair` 支援 `allow_zero_change`，避免可信即時源在平盤時被誤判，但仍阻止靜態 fallback 製造 0% 假漲幅。

### 驗證
- `python3 realtime_price.py ARM` 返回 Nasdaq 即時源，ARM 約 `$346.97`，prevClose `$342.93`，changePercent 約 `+1.18%`。
- 批量驗證 ARM/NVDA/CI/EPAM/GPRO/NKE/ADTN/UNH/AAPL/TSLA 均返回 Nasdaq 即時價格，不再落到 `central_db` / `simulated_fallback`。

---

## v2.3.1 — 2026-06-03
**修復「持倉/自選/搜尋」當日漲跌幅在不同資料源下不一致的問題**

### 根因
v2.3.0 報價鏈路雖然在後端用 `(price - prevClose) / prevClose` 重算 changePercent，但前提是 `prevClose` 與 `price` 在語意上必須同源、同日對位：
- Yahoo `chartPreviousClose` 在跨夜/盤前/盤後可能與 `regularMarketPrice` 不在同一個交易日對位
- Stooq EOD CSV 的 `close` 是「上一個完整交易日收盤」，跟「現在的 Yahoo 盤中價」混用會造成漲幅錯位
- 模擬資料 fallback 把 `prevClose = price`，會推出 0% 的假漲幅

### 修復
- `realtime_price.py`：
  - 新增 `_validate_quote_pair(q)` 合理性檢查：`prevClose<=0`、`prev==price`、`|pct|>50%` 均視為不可信，直接換下一個資料源
  - 新增 `_attach_prev_close_from_kline(q,t)`：Yahoo 拿到的盤中現價若 prevClose 不可信，用 EODHD 日線倒數第二根 close 校正
  - 新增 `_quote_from_eodhd_kline(t)`：直接從 EODHD K 線取最後兩根 close，保證 `price` / `prevClose` 同源同語意
  - `get_quote(t)` 主流程改為：Yahoo（含校正）→ EODHD K 線 → Stooq → TwelveData → 模擬
- `server.js` `normalizeQuoteResult`：當推算出來的 `|pct|>50%` 或 prevClose 缺失時，把 `change` / `changePercent` 設為 `null`，前端 fmtPct 自動顯示 `--`，避免錯誤訊號誤導
- `public/app-utils.js`：新增共享工具 `window.dailyChange(q)`，封裝 `(price - prevClose)/prevClose`，三處顯示一律改用此工具：
  - `app-portfolio.js`：持倉列表當日漲跌
  - `app-watchlist.js`：自選股列表 + 漲跌幅排序
  - `app-analysis.js`：搜尋分析 `renderQuoteOnly` + `renderResult` 頭卡
- 前端 cache-buster 升至 `20260603031`
