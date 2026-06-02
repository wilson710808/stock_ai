/**
 * StockAI - 數據模組
 * 服務器數據加載、本地用戶數據、行情數據等
 */
(function() {
    'use strict';
    
    var $ = window.$;
    
    // ===== 離線模式數據（localStorage） =====
    window.offPortfolio = JSON.parse(localStorage.getItem('stock_portfolio') || '[]');
    window.offWatchlist = JSON.parse(localStorage.getItem('stock_watchlist') || '[]');
    window.offWLGroups = JSON.parse(localStorage.getItem('stock_watchlist_groups') || '["科技股","消費股","金融股","觀察池"]');
    window.offTx = JSON.parse(localStorage.getItem('stock_transactions') || '[]');
    window.offAlerts = JSON.parse(localStorage.getItem('stock_alerts') || '[]');
    window.offCash = 0;
    
    // ===== 服務器緩存數據 =====
    window.srvPortfolio = [];
    window.srvWatchlist = [];
    window.srvWLGroups = [];
    window.srvTx = [];
    window.srvAlerts = [];
    window.srvCash = 0;
    window.srvDivs = [];
    
    // ===== 歷史記錄 =====
    window.history = JSON.parse(localStorage.getItem('stock_history') || '[]');
    window.chatHistoryArr = [];
    
    // ===== 用戶投資上下文 =====
    window.userInvestCtx = { hasPortfolio: false, hasWatchlist: false, context: '' };
    
    // ===== 當前分析類型 =====
    window.currentType = 'overview';
    window.currentTicker = '';
    
    // ===== 圖表實例 =====
    window.chart = null;
    
    // ===== 數據訪問器 =====
    
    /**
     * 獲取持倉數據
     * @returns {Array} 持倉數組
     */
    window.gPF = function() {
        return window.currentUser ? window.srvPortfolio : window.offPortfolio;
    };
    
    /**
     * 獲取現金餘額
     * @returns {number} 現金餘額
     */
    window.gCash = function() {
        return window.currentUser ? window.srvCash : window.offCash;
    };
    
    /**
     * 獲取自選股代碼列表
     * @returns {Array} 自選股代碼數組
     */
    window.gWL = function() {
        return window.currentUser ? window.srvWatchlist.map(function(w) { return w.ticker; }) : window.offWatchlist;
    };
    
    /**
     * 獲取自選股完整信息
     * @returns {Array} 自選股信息數組
     */
    window.gWLI = function() {
        return window.currentUser ? window.srvWatchlist : [];
    };
    
    /**
     * 獲取自選分組列表
     * @returns {Array} 分組名稱數組
     */
    window.gWLGroups = function() {
        return window.currentUser ? window.srvWLGroups : window.offWLGroups;
    };
    
    /**
     * 獲取交易記錄
     * @returns {Array} 交易記錄數組
     */
    window.gTx = function() {
        return window.currentUser ? window.srvTx : window.offTx;
    };
    
    // ===== 載入服務器數據 =====
    
    /**
     * 載入用戶服務器數據（持倉、自選、交易、提醒）
     */
    window.loadSrvData = async function() {
        if (!window.currentUser) return;
        
        try {
            var promises = [
                fetch('api/portfolio'),
                fetch('api/watchlist'),
                fetch('api/transactions?limit=100'),
                fetch('api/alerts')
            ];
            
            var results = await Promise.all(promises);
            var pD = await results[0].json();
            var wD = await results[1].json();
            var tD = await results[2].json();
            var aD = await results[3].json();
            
            if (pD.success) {
                // 後端 DB 使用 snake_case；前端模組部分地方讀 camelCase，這裡做兼容映射
                window.srvPortfolio = (pD.portfolio || []).map(function(p) {
                    p.buyPrice = p.buy_price;
                    p.stopLoss = p.stop_loss;
                    p.takeProfit = p.take_profit;
                    p.currentPrice = p.current_price || p.currentPrice || 0;
                    return p;
                });
                window.srvCash = typeof pD.cash === 'number' ? pD.cash : (window.currentUser && typeof window.currentUser.cash === 'number' ? window.currentUser.cash : 0);
                window.srvDivs = pD.dividends || [];
            }
            
            if (wD.success) {
                window.srvWatchlist = (wD.watchlist || []).map(function(w) {
                    w.groupName = w.group_name;
                    w.targetBuyPrice = w.target_buy_price;
                    w.targetSellPrice = w.target_sell_price;
                    return w;
                });
                window.srvWLGroups = wD.groups || [];
            }
            
            if (tD.success) {
                window.srvTx = tD.transactions || [];
            }
            
            if (aD.success) {
                window.srvAlerts = aD.alerts || [];
            }

            // 重新渲染當前頁，避免登入後資料已載入但畫面仍停在空狀態
            if (window.renderPortfolio) window.renderPortfolio();
            if (window.renderWatchlist) window.renderWatchlist();
            if (window.renderMarketStats) window.renderMarketStats();
            
            // 渲染 UI（持倉 + 自選）
            if (window.renderPortfolio) window.renderPortfolio();
            if (window.renderWatchlist) window.renderWatchlist();

        } catch (e) {
            console.error('載入服務器數據失敗:', e);
            if (window.showToast) window.showToast('載入持倉/自選資料失敗，請重新登入後再試');
        }
    };
    
    // ===== 分析類型配置 =====
    
    /**
     * 載入分析類型配置
     */
    window.loadAnalysisTypes = async function() {
        try {
            var r = await fetch('api/config');
            var d = await r.json();
            
            if (!d.success) {
                window.bindTypes(document.querySelector('.analysis-types'));
                return;
            }
            
            var ts = d.config.analysisTypes.filter(function(t) { return t.enabled; })
                .sort(function(a, b) { return a.order - b.order; });
            
            var c = document.querySelector('.analysis-types');
            if (!c) return;
            
            c.innerHTML = ts.map(function(t, i) {
                return '<button class="type-btn ' + (i === 0 ? 'active' : '') + '" data-type="' + t.id + '">' +
                    '<span class="type-icon">' + t.icon + '</span>' + t.label + '</button>';
            }).join('');
            
            window.bindTypes(c);
            if (ts.length) window.currentType = ts[0].id;
            
        } catch (e) {
            window.bindTypes(document.querySelector('.analysis-types'));
        }
    };
    
    /**
     * 綁定分析類型按鈕事件
     * @param {HTMLElement} c - 容器元素
     */
    window.bindTypes = function(c) {
        if (!c) return;
        
        c.querySelectorAll('.type-btn').forEach(function(b) {
            b.onclick = function() {
                c.querySelectorAll('.type-btn').forEach(function(x) { x.classList.remove('active'); });
                b.classList.add('active');
                window.currentType = b.dataset.type;
            };
        });
    };
    
    // ===== 用戶投資上下文 =====
    
    /**
     * 載入用戶投資上下文（讓 AI 知道持倉和自選股）
     */
    window.loadUserInvestCtx = async function() {
        if (!window.currentUser) {
            window.userInvestCtx = { hasPortfolio: false, hasWatchlist: false, context: '' };
            return;
        }
        
        try {
            var r = await fetch('api/user-context');
            var d = await r.json();
            
            if (d.success) {
                window.userInvestCtx = d;
            }
            
            // 更新 UI 指示器
            var el = document.getElementById('aiCtxIndicator');
            if (el) {
                var parts = [];
                if (d.hasPortfolio) parts.push('💼持倉');
                if (d.hasWatchlist) parts.push('⭐自選');
                el.textContent = parts.length ? '🤖 AI 已知: ' + parts.join('+') : '🤖 AI: 未登錄';
                el.style.display = 'inline-block';
            }
            
        } catch (e) {
            console.warn('loadUserInvestCtx error:', e);
        }
    };
    
    // ===== 市場指數 =====
    
    /**
     * 載入市場指數
     */
    window.loadMarketIndices = async function() {
        var bar = $('marketBar');
        if (!bar) return;
        
        try {
            var r = await fetch('api/market/indices');
            var d = await r.json();
            
            if (d.success && d.indices) {
                bar.innerHTML = d.indices.map(function(i) {
                    var up = i.change >= 0;
                    return '<div class="market-idx">' +
                        '<div class="market-idx-name">' + i.ticker + '</div>' +
                        '<div class="market-idx-val" style="color:' + window.udC(i.change) + '">' + window.fmtP(i.price) + '</div>' +
                        '<div class="market-idx-chg" style="color:' + window.udC(i.change) + '">' + 
                        (up ? '▲' : '▼') + ' ' + window.fmtPct(i.changePercent) + '</div>' +
                        '</div>';
                }).join('');
            }
        } catch (e) {}
    };
    
    // ===== 價格提醒檢查 =====
    
    /**
     * 檢查價格提醒
     */
    window.checkPriceAlerts = function() {
        if (!window.currentUser) return;
        
        var alerts = window.srvAlerts;
        if (!alerts.length) return;
        
        var tickers = [];
        if (window.srvPortfolio && window.srvPortfolio.length) {
            tickers = tickers.concat(window.srvPortfolio.map(function(p) { return p.ticker; }));
        }
        if (window.srvWatchlist && window.srvWatchlist.length) {
            tickers = tickers.concat(window.srvWatchlist.map(function(w) { return w.ticker; }));
        }
        
        tickers = [...new Set(tickers)];
        if (!tickers.length) return;
        
        fetch('api/quotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickers: tickers })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (!d.success) return;
            
            var triggered = [];
            (d.quotes || []).forEach(function(q) {
                if (!q.success) return;
                alerts.forEach(function(a) {
                    if (a.ticker !== q.ticker || a.triggered) return;
                    if (a.type === 'above' && q.price >= a.price) triggered.push(a);
                    if (a.type === 'below' && q.price <= a.price) triggered.push(a);
                });
            });
            
            if (triggered.length) {
                triggered.forEach(function(a) {
                    window.showToast('🔔 ' + a.ticker + ' 已' + (a.type === 'above' ? '漲破' : '跌至') + ' ' + window.fmtP(a.price) + '！');
                    fetch('api/alerts/' + a.id, { method: 'DELETE' }).catch(function() {});
                });
                if (window.loadSrvData) window.loadSrvData();
            }
        })
        .catch(function() {});
    };
    
    // 啟動時自動載入分析類型
    window.loadAnalysisTypes();
    
})();
