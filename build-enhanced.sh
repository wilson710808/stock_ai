#!/bin/bash
# Build enhanced index.html for StockAI #07
# This script constructs the complete enhanced HTML file

cat > /root/webspaces/07-stock-ai/public/index.html << 'HTMLEOF'
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>StockAI - 美股投顧助手</title>
  <script async src="https://cdn.jsdelivr.net/npm/marked/marked.min.js" onerror="this.onerror=null;this.src='marked.min.js'"></script>
  <script async src="https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js" onerror="this.onerror=null;this.src='lightweight-charts.min.js'"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --primary: #1a1a2e;
  --accent: #00C853;
  --accent-rgb: 0, 200, 83;
  --accent-light: #69F0AE;
  --up: #22c55e;
  --down: #ef4444;
  --blue: #448AFF;
  --bg: #f5f7fa;
  --card: #ffffff;
  --text: #1a1a2e;
  --text-secondary: #6b7280;
  --border: #e5e7eb;
  --shadow: 0 4px 20px rgba(0,0,0,0.06);
  --shadow-lg: 0 8px 40px rgba(0,0,0,0.1);
}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{font-family:'Noto Sans TC',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased;padding-bottom:100px}
.header{position:fixed;top:0;left:0;right:0;background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);padding:16px 20px;z-index:100;border-bottom:1px solid var(--border)}
.header-inner{max-width:600px;margin:0 auto;display:flex;justify-content:space-between;align-items:center}
.logo{font-size:20px;font-weight:700}
.logo span{color:var(--accent)}
.logo-sub{font-size:12px;color:var(--text-secondary)}
.main{max-width:600px;margin:0 auto;padding:80px 20px 20px}
.hero{text-align:center;padding:32px 0 24px}
.hero-emoji{font-size:56px;margin-bottom:12px}
.hero-title{font-size:24px;font-weight:600;margin-bottom:6px}
.hero-subtitle{font-size:14px;color:var(--text-secondary)}
.search-container{margin-bottom:20px}
.search-box{display:flex;gap:10px}
.ticker-input{flex:1;padding:14px 16px;font-size:16px;border:2px solid var(--border);border-radius:12px;background:var(--card);outline:none;font-family:inherit;text-transform:uppercase}
.ticker-input:focus{border-color:var(--accent)}
.search-btn{width:52px;height:52px;border:none;background:var(--accent);border-radius:12px;font-size:20px;cursor:pointer;color:#fff}
.search-btn:active{transform:scale(0.95)}
.quick-chips{display:flex;gap:8px;overflow-x:auto;padding:4px 0 12px;scrollbar-width:none}
.quick-chips::-webkit-scrollbar{display:none}
.chip{flex-shrink:0;padding:8px 14px;background:var(--card);border:1px solid var(--border);border-radius:20px;font-size:13px;color:var(--text-secondary);cursor:pointer}
.chip:active{transform:scale(0.96)}
.analysis-types{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:20px}
.type-btn{padding:14px 12px;background:var(--card);border:2px solid var(--border);border-radius:12px;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px;font-family:inherit}
.type-btn:active{transform:scale(0.98)}
.type-btn.active{border-color:var(--accent);background:rgba(var(--accent-rgb),0.08);color:var(--accent)}
.type-icon{font-size:18px}
.loading{display:none;text-align:center;padding:48px 20px}
.loading.show{display:block}
.spinner{width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}
.result-view{display:none}
.result-view.show{display:block}
.result-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.back-btn{display:inline-flex;align-items:center;gap:6px;font-size:14px;color:var(--accent);background:none;border:none;cursor:pointer;font-family:inherit}
.ticker-badge{padding:6px 12px;background:var(--primary);color:#fff;border-radius:20px;font-size:13px;font-weight:600}
.result-card{background:var(--card);border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:var(--shadow)}
.result-title{font-size:16px;font-weight:600;margin-bottom:12px;color:var(--accent)}
.result-content{font-size:14px;line-height:1.8;color:var(--text);white-space:pre-wrap}
.recommendation{display:flex;align-items:center;justify-content:center;gap:16px;padding:20px;background:linear-gradient(135deg,var(--primary),#2d2d4a);border-radius:16px;margin-bottom:20px;color:#fff}
.rec-icon{font-size:36px}
.rec-label{font-size:13px;opacity:0.8}
.rec-value{font-size:24px;font-weight:700}
.rec-buy{color:#4ADE80}
.rec-hold{color:#FBBF24}
.rec-sell{color:#F87171}
.rec-watch{color:#60A5FA}
.action-row{display:flex;gap:12px}
.action-btn{flex:1;padding:12px;border:none;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit}
.action-btn.secondary{background:var(--bg);color:var(--text)}
.action-btn.primary{background:var(--accent);color:#fff}
.section{margin-top:32px}
.section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.section-title{font-size:16px;font-weight:600}
.history-list{display:flex;flex-direction:column;gap:10px}
.history-item{display:flex;align-items:center;gap:12px;padding:14px;background:var(--card);border-radius:12px;box-shadow:var(--shadow);cursor:pointer}
.history-ticker{width:48px;height:48px;background:linear-gradient(135deg,var(--accent),var(--accent-light));border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0}
.history-info{flex:1;min-width:0}
.history-title{font-size:14px;font-weight:600}
.history-type{font-size:12px;color:var(--text-secondary)}
.history-arrow{font-size:18px;color:var(--border)}
.empty{text-align:center;padding:32px 20px;color:var(--text-secondary)}
.empty-icon{font-size:40px;margin-bottom:8px}
.empty-text{font-size:13px}
.chat-messages{display:flex;flex-direction:column;gap:12px;margin-bottom:20px}
.chat-msg{max-width:85%;padding:14px 16px;border-radius:16px;font-size:14px;line-height:1.6}
.chat-msg.user{align-self:flex-end;background:var(--accent);color:#fff}
.chat-msg.ai{align-self:flex-start;background:var(--card);box-shadow:var(--shadow)}
.chat-input-box{display:flex;gap:10px;position:sticky;bottom:0;background:var(--bg);padding:12px 0}
.chat-input{flex:1;padding:14px 16px;font-size:15px;border:2px solid var(--border);border-radius:24px;background:var(--card);outline:none;font-family:inherit}
.chat-send{width:48px;height:48px;border:none;background:var(--accent);border-radius:50%;font-size:18px;cursor:pointer;color:#fff}
.toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--primary);color:#fff;padding:12px 24px;border-radius:24px;font-size:14px;opacity:0;transition:all 0.3s;z-index:300;white-space:nowrap}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.disclaimer{margin-top:24px;padding:16px;background:#FFF3E0;border-radius:12px;font-size:12px;color:#E65100;line-height:1.6}
.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);display:flex;justify-content:space-around;padding:10px 0;padding-bottom:max(10px,env(safe-area-inset-bottom));border-top:1px solid var(--border);z-index:100}
.nav-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 20px;background:none;border:none;color:var(--text-secondary);font-size:10px;cursor:pointer;font-family:inherit}
.nav-item.active{color:var(--accent)}
.nav-item .icon{font-size:22px}
.page{display:none}
.page.active{display:block}
.chart-container{background:var(--card);border-radius:16px;padding:16px;margin-bottom:16px;box-shadow:var(--shadow)}
.chart-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.chart-title{font-size:15px;font-weight:600}
.chart-badge{font-size:11px;padding:4px 8px;background:var(--bg);border-radius:8px;color:var(--text-secondary)}
#chart{width:100%;height:280px;border-radius:8px;overflow:hidden}
.chart-error{text-align:center;padding:40px;color:var(--text-secondary);font-size:13px}
.markdown-body{line-height:1.7;font-size:14px}
.markdown-body h2{font-size:17px;font-weight:700;margin:20px 0 12px 0;color:var(--text);border-bottom:2px solid var(--accent);padding-bottom:6px}
.markdown-body h3{font-size:15px;font-weight:600;margin:16px 0 10px 0;color:var(--text)}
.markdown-body table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
.markdown-body th,.markdown-body td{border:1px solid var(--border);padding:8px 10px;text-align:left}
.markdown-body th{background:var(--bg);font-weight:600}
.markdown-body tr:nth-child(even){background:var(--bg)}
.markdown-body ul,.markdown-body ol{margin:8px 0;padding-left:20px}
.markdown-body li{margin:6px 0}
.markdown-body p{margin:10px 0}
.markdown-body strong{font-weight:600;color:var(--text)}
.markdown-body code{background:var(--bg);padding:2px 6px;border-radius:4px;font-size:12px}
.markdown-body blockquote{border-left:3px solid var(--accent);padding-left:12px;margin:12px 0;color:var(--text-secondary)}
/* ===== 持倉頁增強 ===== */
.pf-summary{background:linear-gradient(135deg,#1a1a2e,#2d2d4a);border-radius:16px;padding:20px;margin-bottom:16px;color:#fff}
.pf-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pf-stat{text-align:center}
.pf-stat-label{font-size:11px;opacity:0.7;margin-bottom:4px}
.pf-stat-value{font-size:18px;font-weight:700}
.pf-stat-value.up{color:var(--up)}
.pf-stat-value.down{color:var(--down)}
.pf-alloc{margin-top:16px}
.pf-alloc-item{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px}
.pf-alloc-bar{flex:1;height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden}
.pf-alloc-fill{height:100%;border-radius:4px;transition:width 0.3s}
.pf-alloc-pct{width:40px;text-align:right;opacity:0.8}
.holding-card{background:var(--card);border-radius:12px;padding:14px 16px;margin-bottom:10px;box-shadow:var(--shadow)}
.holding-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
.holding-ticker{font-size:18px;font-weight:700}
.holding-name{font-size:12px;color:var(--text-secondary)}
.holding-current{font-size:18px;font-weight:700}
.holding-change{font-size:12px;font-weight:600}
.holding-details{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:11px;padding-top:8px;border-top:1px solid var(--border)}
.holding-detail-label{color:var(--text-secondary)}
.holding-detail-value{font-weight:600}
.holding-pnl{font-weight:700;font-size:13px}
.holding-actions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.h-btn{padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--card);font-size:12px;cursor:pointer;font-family:inherit;transition:all 0.15s}
.h-btn:active{transform:scale(0.97)}
.h-btn.buy{color:var(--up);border-color:var(--up)}
.h-btn.sell{color:var(--down);border-color:var(--down)}
.h-btn.alert{color:var(--blue);border-color:var(--blue)}
.h-btn.analyze{color:var(--accent);border-color:var(--accent)}
.sl-tp-tag{display:inline-flex;align-items:center;gap:2px;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:4px}
.sl-tag{background:#fef2f2;color:var(--down)}
.tp-tag{background:#f0fdf4;color:var(--up)}
/* 交易記錄面板 */
.tx-panel{position:fixed;top:0;right:0;bottom:0;width:85%;max-width:400px;background:#fff;z-index:600;box-shadow:-4px 0 30px rgba(0,0,0,0.15);transform:translateX(100%);transition:transform 0.3s;overflow-y:auto}
.tx-panel.open{transform:translateX(0)}
.tx-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:599;display:none}
.tx-overlay.open{display:block}
.tx-panel-header{padding:20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:#fff;z-index:1}
.tx-panel-title{font-size:16px;font-weight:700}
.tx-panel-close{background:none;border:none;font-size:24px;cursor:pointer;color:var(--text-secondary)}
.tx-item{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--border)}
.tx-type{padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700}
.tx-type.buy{background:#f0fdf4;color:var(--up)}
.tx-type.sell{background:#fef2f2;color:var(--down)}
.tx-info{flex:1}
.tx-ticker{font-size:14px;font-weight:600}
.tx-detail{font-size:12px;color:var(--text-secondary)}
.tx-amount{text-align:right;font-size:14px;font-weight:600}
/* ===== 自選頁增強 ===== */
.wl-search{display:flex;gap:8px;padding:0 0 12px}
.wl-search-input{flex:1;padding:12px 14px;font-size:15px;border:2px solid var(--border);border-radius:12px;background:var(--card);outline:none;font-family:inherit;text-transform:uppercase}
.wl-search-input:focus{border-color:var(--accent)}
.wl-add-btn{padding:12px 16px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit}
.wl-toolbar{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
.wl-toolbar select,.wl-toolbar button{padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--card);font-size:12px;cursor:pointer;font-family:inherit}
.wl-card{background:var(--card);border-radius:12px;padding:14px 16px;margin-bottom:10px;box-shadow:var(--shadow)}
.wl-header{display:flex;justify-content:space-between;align-items:flex-start}
.wl-ticker{font-size:18px;font-weight:700}
.wl-name{font-size:12px;color:var(--text-secondary)}
.wl-current{font-size:18px;font-weight:700}
.wl-change{font-size:12px;font-weight:600}
.wl-note{margin-top:8px;padding:6px 10px;background:var(--bg);border-radius:6px;font-size:12px;color:var(--text-secondary);display:flex;justify-content:space-between;align-items:center}
.wl-note-text{flex:1;font-style:italic}
.wl-alerts{margin-top:8px;display:flex;gap:4px;flex-wrap:wrap}
.wl-alert-tag{font-size:10px;padding:3px 8px;border-radius:4px;display:inline-flex;align-items:center;gap:4px;cursor:pointer}
.wl-alert-tag.above{background:#f0fdf4;color:var(--up)}
.wl-alert-tag.below{background:#fef2f2;color:var(--down)}
.wl-actions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.wl-btn{padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--card);font-size:12px;cursor:pointer;font-family:inherit;transition:all 0.15s}
.wl-btn:active{transform:scale(0.97)}
.wl-btn.buy{color:var(--up);border-color:var(--up)}
.wl-btn.analyze{color:var(--accent);border-color:var(--accent)}
.wl-btn.remove{color:var(--down);border-color:var(--down)}
.wl-btn.note{color:#8b5cf6;border-color:#8b5cf6}
.wl-btn.alert{color:var(--blue);border-color:var(--blue)}
.wl-group-tag{font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(var(--accent-rgb),0.1);color:var(--accent);font-weight:500}
/* Modal */
.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:500;display:flex;align-items:center;justify-content:center}
.modal-box{background:#fff;border-radius:16px;padding:24px;width:85%;max-width:360px}
.modal-title{font-size:18px;font-weight:600;margin-bottom:16px}
.modal-input{width:100%;padding:12px;border:2px solid var(--border);border-radius:10px;font-size:15px;margin-bottom:12px;font-family:inherit;outline:none}
.modal-input:focus{border-color:var(--accent)}
.modal-btn-row{display:flex;gap:10px;margin-top:16px}
.modal-btn{flex:1;padding:12px;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
.modal-btn.primary{background:var(--accent);color:#fff}
.modal-btn.danger{background:var(--down);color:#fff}
.modal-btn.cancel{background:var(--bg);color:var(--text)}
.modal-info{font-size:13px;color:var(--text-secondary);margin-bottom:12px;line-height:1.5}
.modal-cost{font-size:13px;padding:8px;background:var(--bg);border-radius:8px;margin-bottom:12px}
.modal-label{font-size:12px;font-weight:600;color:var(--text-secondary);margin:10px 0 4px}
.modal-row{display:flex;gap:8px}
.modal-row input{flex:1}
</style>
</head>
<body>
<header class="header"><div class="header-inner"><div><div class="logo">Stock<span>AI</span></div><div class="logo-sub">美股 AI 投顧助手</div></div></div></header>

<!-- 首頁 -->
<main class="main page active" id="homePage">
  <div class="hero"><div class="hero-emoji">📈</div><h1 class="hero-title">分析你的投資</h1><p class="hero-subtitle">輸入股票代碼，獲得專業分析</p></div>
  <div class="search-container"><div class="search-box"><input type="text" class="ticker-input" id="tickerInput" placeholder="輸入代碼，如：AAPL"><button class="search-btn" id="searchBtn">🔍</button></div></div>
  <div class="quick-chips">
    <span class="chip" data-ticker="AAPL">AAPL 蘋果</span><span class="chip" data-ticker="NVDA">NVDA 輝達</span><span class="chip" data-ticker="MSFT">MSFT 微軟</span><span class="chip" data-ticker="TSLA">TSLA 特斯拉</span><span class="chip" data-ticker="META">META</span><span class="chip" data-ticker="GOOGL">GOOGL</span>
  </div>
  <div class="analysis-types">
    <button class="type-btn active" data-type="overview"><span class="type-icon">🏰</span>價值評估</button>
    <button class="type-btn" data-type="fundamental"><span class="type-icon">💰</span>財務分析</button>
    <button class="type-btn" data-type="technical"><span class="type-icon">📈</span>技術面</button>
    <button class="type-btn" data-type="risk"><span class="type-icon">⚠️</span>風險評估</button>
    <button class="type-btn" data-type="signal"><span class="type-icon">🎯</span>操作建議</button>
  </div>
  <div class="loading" id="loading"><div class="spinner"></div><div class="loading-text">資深分析師正在分析...</div></div>
  <div class="result-view" id="resultView"></div>
  <div class="section"><div class="section-header"><h2 class="section-title">最近分析</h2></div><div class="history-list" id="historyList"></div></div>
  <div class="disclaimer">⚠️ 風險提示：本系統提供的分析和建議僅供參考，不構成任何投資建議。投資有風險，請自行承擔後果。</div>
</main>

<!-- 聊天頁 -->
<main class="main page" id="chatPage">
  <div class="section-header" style="margin-bottom:16px;"><h2 class="section-title">💬 提問分析師</h2></div>
  <div class="chat-messages" id="chatMessages"><div class="chat-msg ai">你好！我是 StockAI 投顧助手。有任何關於美股的問題，歡迎隨時問我！</div></div>
  <div class="chat-input-box"><input type="text" class="chat-input" id="chatInput" placeholder="問關於股票、投資的問題..."><button class="chat-send" id="chatSend">➤</button></div>
</main>

<!-- 持倉頁 -->
<main class="main page" id="portfolioPage">
  <div class="pf-summary" id="pfSummary"></div>
  <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
    <button class="type-btn" onclick="showBuyDialog()" style="flex:1;"><span class="type-icon">📈</span>買入股票</button>
    <button class="type-btn" onclick="toggleTxPanel()" style="flex:1;"><span class="type-icon">📋</span>交易記錄</button>
    <button class="type-btn" onclick="analyzePortfolioAll()" style="flex:1;"><span class="type-icon">🤖</span>AI組合分析</button>
  </div>
  <div id="portfolioList"></div>
</main>

<!-- 自選頁 -->
<main class="main page" id="watchlistPage">
  <div class="wl-search">
    <input type="text" class="wl-search-input" id="wlTickerInput" placeholder="輸入代碼添加自選，如：AAPL">
    <button class="wl-add-btn" onclick="addToWatchlistDirect()">+ 加入</button>
  </div>
  <div class="wl-toolbar">
    <select id="wlSortSelect" onchange="renderWatchlist()"><option value="default