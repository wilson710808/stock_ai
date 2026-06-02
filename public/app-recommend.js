/**
 * StockAI - 推薦模組
 * 板塊推薦、批量分析、股票選擇等
 */
(function() {
    'use strict';
    
    var $ = window.$;
    
    // ===== 推薦數據狀態 =====
    window.recommendData = null;
    window.selectedTickers = new Set();
    
    // ===== 攔截 showPage 添加推薦頁支持 =====
    
    // 保存原始 showPage 函數
    var _originalShowPage = window.showPage;
    
    window.showPage = function(p) {
        // 處理推薦頁
        if (p === 'recommend') {
            var el = $('recommendPage');
            if (!el) {
                // 動態創建推薦頁
                el = document.createElement('main');
                el.id = 'recommendPage';
                el.className = 'main page';
                el.innerHTML = getRecommendPageHTML();
                document.body.appendChild(el);
            }
        }
        
        // 調用原始函數
        if (_originalShowPage) {
            _originalShowPage(p);
        }
        
        // 首次進入推薦頁時載入數據
        if (p === 'recommend' && !window.recommendData) {
            window.loadRecommend();
        }
    };
    
    // ===== 獲取推薦頁 HTML =====
    
    function getRecommendPageHTML() {
        return '<div class="section-header" style="margin-bottom:16px"><h2 class="section-title">🎯 板塊推薦</h2></div>' +
            '<div style="background:#E8F5E9;padding:14px;border-radius:12px;margin-bottom:16px;font-size:13px;color:#1B5E20;line-height:1.6">📊 按行業板塊精選的績優美股（基於常見板塊龍頭 + 市場公認優質標的），勾選後可單個或批量分析，以巴菲特/芒格策略篩選。</div>' +
            '<div id="recommendActions" style="display:flex;gap:10px;margin-bottom:16px;display:none;flex-wrap:wrap">' +
            '<button class="action-btn secondary" onclick="analyzeSelected()">🎯 分析選中的</button>' +
            '<button class="action-btn primary" onclick="analyzeAll()">🤖 全部分析</button>' +
            '<button class="action-btn secondary" onclick="clearSelection()">🔄 清空選擇</button>' +
            '</div>' +
            '<div id="recommendList"></div>';
    }
    
    // ===== 載入推薦列表 =====
    
    /**
     * 載入推薦股票列表
     */
    window.loadRecommend = function() {
        var container = $('recommendList');
        if (!container) return;
        
        container.innerHTML = '<div class="loading show"><div class="spinner"></div><div class="loading-text">載入推薦列表...</div></div>';
        
        fetch('api/recommend')
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (!d.success) throw new Error(d.error);
                window.recommendData = d;
                window.renderRecommend();
            })
            .catch(function(e) {
                container.innerHTML = '<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">載入失敗：' + e.message + '</div></div>';
            });
    };
    
    // ===== 渲染推薦列表 =====
    
    /**
     * 渲染推薦股票列表
     */
    window.renderRecommend = function() {
        var container = $('recommendList');
        var actions = $('recommendActions');
        if (!container) return;
        
        if (!window.recommendData || !window.recommendData.sectors) {
            container.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><div class="empty-text">無推薦數據</div></div>';
            return;
        }
        
        if (actions) actions.style.display = 'flex';
        container.innerHTML = '';
        
        Object.keys(window.recommendData.sectors).forEach(function(sector) {
            var stocks = window.recommendData.sectors[sector];
            var color = window.SCOLORS ? window.SCOLORS[sector] : '#9ca3af';
            
            var div = document.createElement('div');
            div.className = 'result-card';
            div.style.marginBottom = '16px';
            
            var stocksHtml = stocks.map(function(s) {
                var isSelected = window.selectedTickers.has(s.ticker);
                var borderColor = isSelected ? 'var(--accent)' : 'var(--border)';
                var bgColor = isSelected ? '#E8F5E9' : '#fff';
                
                return '<div class="wl-card" style="margin-bottom:0;cursor:pointer;border:2px solid ' + borderColor + ';background:' + bgColor + '" onclick="toggleSelect(\'' + s.ticker + '\')">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center">' +
                    '<div>' +
                    '<div style="display:flex;align-items:center;gap:8px">' +
                    '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' style="cursor:pointer;width:18px;height:18px">' +
                    '<span style="font-weight:600;font-size:15px">' + s.ticker + '</span>' +
                    '</div>' +
                    '<div style="font-size:12px;color:#6b7280;margin-top:2px">' + s.name + '</div>' +
                    '</div></div>' +
                    '<div style="font-size:11px;color:#6b7280;margin-top:8px">' + s.reason + '</div>' +
                    '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
                    '<button class="action-btn" style="padding:6px 12px;font-size:12px" onclick="event.stopPropagation();quickAnalyze(\'' + s.ticker + '\')">🎯 分析</button>' +
                    '<button class="action-btn" style="padding:6px 12px;font-size:12px" onclick="event.stopPropagation();addToWatchlistDirectFromRecommend(\'' + s.ticker + '\')">⭐ 加自選</button>' +
                    '</div></div>';
            }).join('');
            
            div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
                '<div style="display:flex;align-items:center;gap:8px">' +
                '<span style="width:12px;height:12px;background:' + color + ';border-radius:4px"></span>' +
                '<span style="font-weight:600;font-size:15px">' + sector + '</span></div>' +
                '<span style="font-size:12px;color:#6b7280">' + stocks.length + ' 支</span></div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">' + stocksHtml + '</div>';
            
            container.appendChild(div);
        });
    };
    
    // ===== 選擇功能 =====
    
    /**
     * 切換股票選擇狀態
     * @param {string} ticker - 股票代碼
     */
    window.toggleSelect = function(ticker) {
        if (window.selectedTickers.has(ticker)) {
            window.selectedTickers.delete(ticker);
        } else {
            window.selectedTickers.add(ticker);
        }
        window.renderRecommend();
    };
    
    /**
     * 清空選擇
     */
    window.clearSelection = function() {
        window.selectedTickers.clear();
        window.renderRecommend();
    };
    
    // ===== 從推薦頁添加到自選 =====
    
    /**
     * 從推薦頁直接添加自選
     * @param {string} ticker - 股票代碼
     */
    window.addToWatchlistDirectFromRecommend = async function(ticker) {
        if (window.currentUser) {
            await fetch('api/watchlist/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: ticker })
            });
            if (window.loadSrvData) await window.loadSrvData();
        } else {
            if (!window.offWatchlist.includes(ticker)) {
                window.offWatchlist.push(ticker);
                window.saveLS('stock_watchlist', window.offWatchlist);
            }
        }
        window.showToast('✅ 已添加 ' + ticker + ' 到自選');
    };
    
    // ===== 批量分析 =====
    
    /**
     * 分析選中的股票
     */
    window.analyzeSelected = async function() {
        var tickers = Array.from(window.selectedTickers);
        if (!tickers.length) {
            window.showToast('請先選擇要分析的股票');
            return;
        }
        await window.doBatchAnalysis(tickers);
    };
    
    /**
     * 分析所有推薦股票
     */
    window.analyzeAll = function() {
        if (!window.recommendData || !window.recommendData.sectors) return;
        
        var allTickers = [];
        Object.values(window.recommendData.sectors).forEach(function(stocks) {
            stocks.forEach(function(s) {
                allTickers.push(s.ticker);
            });
        });
        
        window.doBatchAnalysis(allTickers);
    };
    
    // ===== 執行批量分析 =====
    
    /**
     * 執行批量分析
     * @param {Array} tickers - 股票代碼數組
     */
    window.doBatchAnalysis = async function(tickers) {
        if (!tickers || !tickers.length) return;
        
        // 創建進度條
        var bar = $('progressBar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'progressBar';
            bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(90deg,#00C853,#4ADE80);padding:12px;color:#fff;font-size:14px;text-align:center';
            document.body.appendChild(bar);
        }
        
        bar.style.display = 'block';
        
        var results = [];
        var count = 0;
        var total = tickers.length;
        
        for (var i = 0; i < tickers.length; i++) {
            var t = tickers[i];
            
            try {
                bar.innerHTML = '分析 ' + t + '... (' + (count + 1) + '/' + total + ') <div style="background:rgba(255,255,255,.3);border-radius:4px;height:6px;margin-top:8px"><div style="background:#fff;height:6px;border-radius:4px;width:' + Math.round(count / total * 100) + '%;transition:width .3s"></div></div>';
                
                var r = await fetch('api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticker: t, type: 'overview' })
                });
                var d = await r.json();
                
                if (d.success) {
                    results.push({
                        ticker: t,
                        content: d.content,
                        time: Date.now()
                    });
                }
            } catch (e) {
                console.error('Analysis failed for', t, e);
            }
            
            count++;
            var pct = Math.round(count / total * 100);
            bar.innerHTML = '分析中... (' + count + '/' + total + ') <div style="background:rgba(255,255,255,.3);border-radius:4px;height:6px;margin-top:8px"><div style="background:#fff;height:6px;border-radius:4px;width:' + pct + '%;transition:width .3s"></div></div>';
        }
        
        setTimeout(function() { if (bar) bar.style.display = 'none'; }, 500);
        
        // 顯示結果
        var resultsHtml = results.map(function(r) {
            return '<div class="result-card" style="margin-bottom:10px">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
                '<span style="font-weight:600;font-size:15px">🎯 ' + r.ticker + '</span>' +
                '<button class="wl-btn analyze" onclick="saveAndGo(\'' + r.ticker + '\')">查看詳細</button></div>' +
                '<div style="font-size:12px;color:#6b7280;line-height:1.8">' + r.content.substring(0, 300) + '...</div></div>';
        }).join('');
        
        window.showModal(
            '<div class="modal-title">🤖 批量分析完成</div>' +
            '<div style="font-size:14px;color:#6b7280;margin-bottom:12px">完成 ' + results.length + '/' + tickers.length + ' 支股票分析</div>' +
            '<div style="max-height:50vh;overflow:auto;margin-bottom:16px">' + resultsHtml + '</div>' +
            '<div class="modal-btn-row"><button class="modal-btn cancel" onclick="closeModal()">關閉</button></div>' +
            '<script>window.saveAndGo = function(t) {' +
            'sessionStorage.setItem("pendingTicker", t);' +
            'closeModal();' +
            'window.location.hash = "home";' +
            'setTimeout(function() {' +
            'var saved = sessionStorage.getItem("pendingTicker");' +
            'if (saved) {' +
            'sessionStorage.removeItem("pendingTicker");' +
            'var input = document.getElementById("tickerInput");' +
            'if (input) input.value = saved;' +
            'if (window.analyze) window.analyze();' +
            '}}, 100);' +
            '}</script>'
        );
    };
    
    // ===== 初始化：創建推薦頁 DOM =====
    
    document.addEventListener('DOMContentLoaded', function() {
        // 檢查是否有 recommendPage，沒有就創建
        if (!$('recommendPage')) {
            var el = document.createElement('main');
            el.id = 'recommendPage';
            el.className = 'main page';
            el.innerHTML = getRecommendPageHTML();
            document.body.appendChild(el);
        }
        
        // 動態修改底部導航，加入推薦
        var bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav && bottomNav.innerHTML.indexOf('data-page="recommend"') === -1) {
            bottomNav.innerHTML =
                '<button class="nav-item active" data-page="home"><span class="icon">🏠</span>首頁</button>' +
                '<button class="nav-item" data-page="recommend"><span class="icon">🎯</span>推薦</button>' +
                '<button class="nav-item" data-page="chat"><span class="icon">💬</span>提問</button>' +
                '<button class="nav-item" data-page="watchlist"><span class="icon">⭐</span>自選</button>' +
                '<button class="nav-item" data-page="portfolio"><span class="icon">💼</span>持倉</button>';
        }
    });
    
})();
