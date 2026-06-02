/**
 * StockAI - 分析模組
 * 股票分析、圖表渲染、歷史記錄、聊天功能
 */
(function() {
    'use strict';
    
    var $ = window.$;
    
    // ===== Markdown 渲染 =====
    
    /**
     * 渲染 Markdown 為 HTML
     * @param {string} t - Markdown 文本
     * @returns {string} HTML 字符串
     */
    window.renderMarkdown = function(t) {
        if (typeof marked !== 'undefined') {
            try {
                return marked.parse(t);
            } catch (e) {}
        }
        
        var h = t;
        h = h.replace(/## (.*)/g, '<h2 style="font-size:17px;font-weight:700;margin:16px 0 8px;border-bottom:2px solid #00C853;padding-bottom:4px">$1</h2>');
        h = h.replace(/### (.*)/g, '<h3 style="font-size:15px;font-weight:600;margin:12px 0 6px">$1</h3>');
        h = h.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        h = h.replace(/^- (.*)$/gm, '<li style="margin:4px 0">$1</li>');
        h = h.replace(/---/g, '<hr style="border:none;border-top:1px solid #eee;margin:16px 0">');
        return h;
    };
    
    // ===== 添加到歷史記錄 =====
    
    /**
     * 添加到歷史記錄
     * @param {string} t - 股票代碼
     * @param {string} type - 分析類型
     */
    window.addToHistory = function(t, type) {
        var now = Date.now();
        var safeType = type || 'overview';
        if (!Array.isArray(window.stockHistory)) window.stockHistory = [];
        // 避免重複；不要使用 window.history（瀏覽器原生 History 物件）
        var existing = window.stockHistory.findIndex(function(h) {
            return h.ticker === t && h.type === safeType;
        });
        if (existing >= 0) {
            window.stockHistory.splice(existing, 1);
        }
        window.stockHistory.unshift({ ticker: t, type: safeType, time: now });
        if (window.stockHistory.length > 50) window.stockHistory = window.stockHistory.slice(0, 50);
        window.saveLS('stock_history', window.stockHistory);
        window.renderHistory();
    };
    
    /**
     * 渲染歷史記錄列表
     */
    window.renderHistory = function() {
        var list = window.getHistoryList() || $('historyList');
        if (!list) return;
        
        if (!Array.isArray(window.stockHistory) || !window.stockHistory.length) {
            list.innerHTML = '<div class="empty"><div class="empty-icon">📜</div><div class="empty-text">尚無分析記錄</div></div>';
            return;
        }
        
        var typeLabels = {
            'overview': '全面分析',
            'technical': '技術面',
            'fundamental': '基本面',
            'risk': '風險評估',
            'signal': '買賣信號',
            'portfolio': '組合分析'
        };
        
        list.innerHTML = window.stockHistory.map(function(h) {
            return '<div class="history-item" onclick="quickAnalyze(\'' + h.ticker + '\')">' +
                '<div class="history-ticker">' + h.ticker + '</div>' +
                '<div class="history-info">' +
                '<div class="history-title">' + h.ticker + '</div>' +
                '<div class="history-type">' + (typeLabels[h.type] || h.type) + ' · ' + window.fmtDays(h.time) + '前</div>' +
                '</div>' +
                '<div class="history-arrow">→</div>' +
                '</div>';
        }).join('');
    };
    
    // ===== 主要分析函數 =====
    
    /**
     * 執行股票分析
     */
    window.analyze = async function() {
        var input = window.getTickerInput() || $('tickerInput');
        var t = input.value.trim().toUpperCase();
        var analysisType = window.currentType || 'overview';
        
        if (!t) {
            window.showToast('請輸入股票代碼');
            return;
        }
        
        window.currentTicker = t;
        
        var loading = window.getLoading() || $('loading');
        var resultView = window.getResultView() || $('resultView');
        
        if (loading) loading.classList.add('show');
        if (resultView) {
            resultView.classList.remove('show');
            var loadingText = loading ? loading.querySelector('.loading-text') : null;
            if (loadingText) loadingText.textContent = '正在獲取股價數據...';
        }
        
        var q = null;
        
        try {
            // 獲取報價
            var qr = await fetch('api/quote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: t })
            });
            q = await qr.json();
            
            if (q && q.success) {
                window.renderQuoteOnly(t, q);
            }
            
            if (loading) {
                var lt = loading.querySelector('.loading-text');
                if (lt) lt.textContent = '🤖 AI 分析師正在分析中...';
            }
            
            // 執行分析
            var r = await fetch('api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: t, type: analysisType })
            });
            var d = await r.json();
            
            if (!d.success) {
                throw new Error(d.error || '分析失敗');
            }
            
            window.renderResult(t, analysisType, d.content, q);
            window.addToHistory(t, analysisType);
            
            if (window.currentUser) {
                fetch('api/analysis-history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticker: t, type: analysisType, content: d.content })
                }).catch(function() {});

                // v2.2.2: 搜尋成功後自動收藏（可關）
                if (window.autoFavoriteEnabled && window.autoFavoriteEnabled()) {
                    window.autoFavoriteCurrent(t, analysisType, d.content);
                }
            }
            
            window.showToast('分析完成！');
            
        } catch (e) {
            window.showToast(e.message || '發生錯誤');
        } finally {
            if (loading) loading.classList.remove('show');
        }
    };
    
    // ===== 渲染報價（僅顯示報價，尚未分析） =====
    
    /**
     * 僅渲染股票報價
     * @param {string} t - 股票代碼
     * @param {Object} q - 報價數據
     */
    window.renderQuoteOnly = function(t, q) {
        if (!q || !q.success) return;
        
        var up = q.change >= 0;
        var resultView = window.getResultView() || $('resultView');
        if (!resultView) return;
        
        resultView.innerHTML =
            '<div class="result-header">' +
            '<button class="back-btn" onclick="backToHome()">← 返回</button>' +
            '<span class="ticker-badge">' + t + '</span>' +
            '</div>' +
            '<div class="result-card" style="background:linear-gradient(135deg,var(--primary),#2d2d4a);color:#fff">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">' +
            '<div>' +
            '<div style="font-size:14px;opacity:.8">' + (q.name || t) + '</div>' +
            '<div style="font-size:28px;font-weight:700">' + window.fmtP(q.price) + '</div>' +
            '</div>' +
            '<div style="text-align:right">' +
            '<div style="font-size:16px;font-weight:600;color:' + (up ? '#4ADE80' : '#F87171') + '">' +
            (up ? '▲' : '▼') + ' ' + window.fmtP(Math.abs(q.change)) + '</div>' +
            '<div style="font-size:14px;color:' + (up ? '#4ADE80' : '#F87171') + '">(' + window.fmtPct(q.changePercent) + ')</div>' +
            '</div>' +
            '</div>' +
            '<div style="font-size:12px;opacity:.7">' + (q.note || '') + '</div>' +
            '</div>' +
            '<div class="loading show" style="background:transparent">' +
            '<div class="spinner"></div>' +
            '<div class="loading-text">🤖 AI 分析師正在分析中...</div>' +
            '</div>';
        
        resultView.classList.add('show');
    };
    
    // ===== 渲染分析結果 =====
    
    /**
     * 渲染股票分析結果
     * @param {string} t - 股票代碼
     * @param {string} type - 分析類型
     * @param {string} content - 分析內容
     * @param {Object} q - 報價數據（可選）
     */
    window.renderResult = function(t, type, content, q) {
        var typeLabels = {
            'overview': '全面分析',
            'technical': '技術面分析',
            'fundamental': '基本面分析',
            'risk': '風險評估',
            'signal': '買賣信號'
        };
        
        var resultView = window.getResultView() || $('resultView');
        if (!resultView) return;
        
        var qh = '';
        
        if (q && q.success) {
            var up = q.change >= 0;
            qh = '<div class="result-card" style="background:linear-gradient(135deg,var(--primary),#2d2d4a);color:#fff;margin-bottom:12px">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">' +
                '<div>' +
                '<div style="font-size:14px;opacity:.8">' + (q.name || t) + '</div>' +
                '<div style="font-size:28px;font-weight:700">' + window.fmtP(q.price) + '</div>' +
                '</div>' +
                '<div style="text-align:right">' +
                '<div style="font-size:16px;font-weight:600;color:' + (up ? '#4ADE80' : '#F87171') + '">' +
                (up ? '▲' : '▼') + ' ' + window.fmtP(Math.abs(q.change)) + '</div>' +
                '<div style="font-size:14px;color:' + (up ? '#4ADE80' : '#F87171') + '">(' + window.fmtPct(q.changePercent) + ')</div>' +
                '</div>' +
                '</div>' +
                '<div style="font-size:12px;opacity:.7">' + (q.note || '') + '</div>' +
                '</div>';
        }
        
        // 提取決策建議（兼容 v2.0.0 的 [RECOMMENDATION:*] 標記與中文結論）
        var recInfo = window.extractRecommendation ? window.extractRecommendation(content) : null;
        var recHtml = '';
        if (recInfo) {
            recHtml = '<div class="recommendation">' +
                '<div class="rec-icon">' + recInfo.icon + '</div>' +
                '<div>' +
                '<div class="rec-label">投資決策建議</div>' +
                '<div class="rec-value ' + recInfo.cls + '" style="color:' + recInfo.color + '">' + recInfo.label + '</div>' +
                (recInfo.reason ? '<div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:4px">' + recInfo.reason + '</div>' : '') +
                '</div>' +
                '</div>';
        }
        
        // 操作按鈕
        var actionHtml = '<div class="action-row">' +
            '<button class="action-btn secondary" onclick="quickAnalyze(\'' + t + '\')">🔄 重新分析</button>' +
            '<button class="action-btn secondary" onclick="toggleWatchlist(\'' + t + '\')">' + 
            (window.gWL().includes(t) ? '⭐ 已加自選' : '☆ 加自選') + '</button>' +
            '</div>';
        
        // 自選股買入按鈕
        var buyBtnHtml = '';
        if (q && q.success) {
            buyBtnHtml = '<div class="action-row" style="margin-top:8px">' +
                '<button class="action-btn primary" onclick="showBuyDialogFor(\'' + t + '\',' + q.price + ')">📈 買入</button>' +
                '</div>';
        }
        
        resultView.innerHTML =
            '<div class="result-header">' +
            '<button class="back-btn" onclick="backToHome()">← 返回</button>' +
            '<span class="ticker-badge">' + t + '</span>' +
            '</div>' +
            qh +
            recHtml +
            '<div class="result-card">' +
            '<div class="result-title">' + (typeLabels[type] || type) + '</div>' +
            '<div class="result-content markdown-body">' + window.renderMarkdown(content) + '</div>' +
            '</div>' +
            actionHtml +
            buyBtnHtml +
            '<div id="chartContainer" class="chart-container" style="display:none">' +
            '<div class="chart-header">' +
            '<span class="chart-title">📈 K線走勢圖</span>' +
            '<span class="chart-badge" id="chartBadge">加載中...</span>' +
            '</div>' +
            '<div id="chart"></div>' +
            '</div>';
        
        resultView.classList.add('show');
        
        // 載入圖表
        window.loadChart(t);
    };
    
    // ===== 決策建議解析 =====

    /**
     * 從 AI 內容提取決策建議。
     * 兼容 v2.0.0 的 [RECOMMENDATION:*] 標記，以及中文「最終建議 / 當前建議」。
     * @param {string} content
     * @returns {Object|null}
     */
    window.extractRecommendation = function(content) {
        var text = String(content || '');
        var marker = text.match(/\[RECOMMENDATION:(BUY|HOLD|SELL|AVOID)\]/i);
        var code = marker ? marker[1].toUpperCase() : '';
        var reason = '';

        if (!code) {
            var conclusion = text.match(/(?:\*\*)?(?:最終建議|當前建議|綜合評級|建議)[:：]?(?:\*\*)?\s*([^\n]+)/i);
            var line = conclusion ? conclusion[1] : text;
            if (/避開|不符合|避免|不建議買入|AVOID/i.test(line)) code = 'AVOID';
            else if (/賣出|減倉|清倉|SELL/i.test(line)) code = 'SELL';
            else if (/買入|加倉|強烈買入|BUY/i.test(line)) code = 'BUY';
            else if (/持有|觀望|等待|HOLD/i.test(line)) code = 'HOLD';
            if (conclusion) reason = line.replace(/\[RECOMMENDATION:(BUY|HOLD|SELL|AVOID)\]/ig, '').trim();
        }

        var map = {
            BUY:   { icon: '🚀', label: '建議買入', cls: 'rec-buy', color: '#4ADE80' },
            HOLD:  { icon: '⏸️', label: '觀望持有', cls: 'rec-hold', color: '#FBBF24' },
            SELL:  { icon: '⚠️', label: '建議賣出', cls: 'rec-sell', color: '#F87171' },
            AVOID: { icon: '🛑', label: '建議避開', cls: 'rec-watch', color: '#F87171' }
        };
        if (!map[code]) return null;
        return Object.assign({ code: code, reason: reason }, map[code]);
    };

    // ===== 載入股票圖表 =====

    /**
     * 載入股票 K 線圖。套用 v2.0.0 的 candles 資料格式，並兼容舊 data 格式。
     * @param {string} ticker - 股票代碼
     */
    window.loadChart = async function(ticker) {
        var container = document.getElementById('chartContainer');
        var chartDiv = document.getElementById('chart');
        var badge = document.getElementById('chartBadge');
        if (!container || !chartDiv) return;

        container.style.display = 'block';
        chartDiv.innerHTML = '';
        if (badge) {
            badge.textContent = '加載中...';
            badge.style.color = 'var(--text-secondary)';
        }

        // v2.0.0 是直接等待 lightweight-charts 載入；當前版本 script 是 async，也需要等待。
        for (var i = 0; i < 20 && typeof LightweightCharts === 'undefined'; i++) {
            await new Promise(function(resolve) { setTimeout(resolve, 150); });
        }
        if (typeof LightweightCharts === 'undefined') {
            chartDiv.innerHTML = '<div class="chart-error">⚠️ K線圖庫載入失敗</div>';
            if (badge) badge.textContent = '❌ 圖表庫錯誤';
            return;
        }

        try {
            var r = await fetch('api/chart/' + encodeURIComponent(ticker));
            var d = await r.json();
            var raw = [];
            if (d && Array.isArray(d.candles)) raw = d.candles;
            else if (d && Array.isArray(d.data)) raw = d.data;

            var candles = raw.map(function(item) {
                var time = item.time || item.date;
                if (typeof time === 'number') {
                    // lightweight-charts 可接受 UTC 秒；若 API 不小心給毫秒則轉秒。
                    time = time > 20000000000 ? Math.floor(time / 1000) : time;
                }
                return {
                    time: time,
                    open: Number(item.open),
                    high: Number(item.high),
                    low: Number(item.low),
                    close: Number(item.close)
                };
            }).filter(function(item) {
                return item.time && isFinite(item.open) && isFinite(item.high) && isFinite(item.low) && isFinite(item.close);
            });

            if (!d.success || !candles.length) {
                chartDiv.innerHTML = '<div class="chart-error">📊 K線數據暫時無法獲取，請稍後再試</div>';
                if (badge) badge.textContent = '⚠️ 暫無數據';
                return;
            }

            if (window.chart) {
                try { window.chart.remove(); } catch (e) {}
                window.chart = null;
            }

            var width = chartDiv.clientWidth || container.clientWidth || 340;
            window.chart = LightweightCharts.createChart(chartDiv, {
                width: width,
                height: 280,
                layout: {
                    background: { color: '#ffffff' },
                    backgroundColor: '#ffffff',
                    textColor: '#333'
                },
                grid: {
                    vertLines: { color: '#e5e7eb' },
                    horzLines: { color: '#e5e7eb' }
                },
                crosshair: { mode: LightweightCharts.CrosshairMode ? LightweightCharts.CrosshairMode.Normal : 0 },
                rightPriceScale: { borderColor: '#e5e7eb' },
                timeScale: { borderColor: '#e5e7eb', timeVisible: false }
            });

            var candleSeries = window.chart.addCandlestickSeries({
                upColor: '#22c55e',
                downColor: '#ef4444',
                borderUpColor: '#22c55e',
                borderDownColor: '#ef4444',
                wickUpColor: '#22c55e',
                wickDownColor: '#ef4444'
            });

            candleSeries.setData(candles);
            window.chart.timeScale().fitContent();

            if (badge) {
                badge.textContent = '✅ ' + (d.source || 'K線數據') + ' · ' + candles.length + ' 天';
                badge.style.color = 'var(--accent)';
            }

            if (!window.__stockChartResizeBound) {
                window.__stockChartResizeBound = true;
                window.addEventListener('resize', function() {
                    if (window.chart) {
                        var el = document.getElementById('chart');
                        if (el) window.chart.resize(el.clientWidth || 340, 280);
                    }
                });
            }
        } catch (e) {
            console.error('[Chart] 載入失敗:', e);
            chartDiv.innerHTML = '<div class="chart-error">圖表加載失敗：' + (e.message || '未知錯誤') + '</div>';
            if (badge) badge.textContent = '❌ 錯誤';
        }
    };

    // ===== 聊天功能 =====
    
    /**
     * 發送聊天消息
     */
    window.sendChat = async function() {
        var input = $('chatInput');
        var messages = $('chatMessages');
        if (!input || !messages) return;
        
        var msg = input.value.trim();
        if (!msg) return;
        
        input.value = '';
        
        // 添加用戶消息
        messages.innerHTML += '<div class="chat-msg user">' + msg.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
        messages.scrollTop = messages.scrollHeight;
        
        // 保存到歷史
        window.chatHistoryArr.push({ role: 'user', content: msg });
        if (window.chatHistoryArr.length > 50) window.chatHistoryArr = window.chatHistoryArr.slice(-50);
        
        // 添加載入指示器
        var loadingId = 'chat-loading-' + Date.now();
        messages.innerHTML += '<div class="chat-msg ai" id="' + loadingId + '">思考中...</div>';
        messages.scrollTop = messages.scrollHeight;
        
        try {
            var r = await fetch('api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg,
                    history: window.chatHistoryArr.slice(-20),
                    context: window.userInvestCtx.context || ''
                })
            });
            var d = await r.json();
            
            var loadingEl = document.getElementById(loadingId);
            if (loadingEl) {
                loadingEl.innerHTML = window.renderMarkdown(d.response || '抱歉，暫時無法回應。');
            }
            
            window.chatHistoryArr.push({ role: 'assistant', content: d.response });
            
        } catch (e) {
            var loadingEl = document.getElementById(loadingId);
            if (loadingEl) {
                loadingEl.innerHTML = '抱歉，網絡錯誤。';
            }
        }
        
        messages.scrollTop = messages.scrollHeight;
    };
    
    // ===== 快捷分析 =====
    
    /**
     * 快捷分析股票
     * @param {string} t - 股票代碼
     */
    window.quickAnalyze = function(t) {
        var input = window.getTickerInput() || $('tickerInput');
        if (input) input.value = t;
        window.showPage('home');
        window.analyze();
    };
    
})();
