/**
 * StockAI - 自選股模組
 * 自選股管理、分組、批量操作等
 */
(function() {
    'use strict';
    
    var $ = window.$;
    
    // ===== 切換自選狀態 =====
    
    /**
     * 切換股票的自選狀態
     * @param {string} t - 股票代碼
     */
    window.toggleWatchlist = async function(t) {
        var tickers = window.gWL();
        
        if (window.currentUser) {
            if (tickers.includes(t)) {
                await fetch('api/watchlist/' + t, { method: 'DELETE' });
                window.showToast('已從自選移除');
            } else {
                await fetch('api/watchlist/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticker: t })
                });
                window.showToast('已添加到自選');
            }
            if (window.loadSrvData) await window.loadSrvData();
        } else {
            var i = window.offWatchlist.indexOf(t);
            if (i > -1) {
                window.offWatchlist.splice(i, 1);
                window.showToast('已從自選移除');
            } else {
                window.offWatchlist.push(t);
                window.showToast('已添加到自選');
            }
            window.saveLS('stock_watchlist', window.offWatchlist);
        }
        
        if (window.renderWatchlist) window.renderWatchlist();
    };
    
    // ===== 直接添加自選 =====
    
    /**
     * 直接添加自選股
     */
    window.addToWatchlistDirect = async function() {
        var input = $('wlTickerInput');
        if (!input) return;
        
        var t = input.value.trim().toUpperCase();
        if (!t) {
            window.showToast('請輸入股票代碼');
            return;
        }
        
        if (window.currentUser) {
            var r = await fetch('api/watchlist/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: t })
            });
            var d = await r.json();
            if (!d.success) {
                window.showToast(d.error);
                return;
            }
            if (window.loadSrvData) await window.loadSrvData();
        } else {
            if (window.offWatchlist.includes(t)) {
                window.showToast(t + ' 已在自選中');
                return;
            }
            window.offWatchlist.push(t);
            window.saveLS('stock_watchlist', window.offWatchlist);
        }
        
        input.value = '';
        window.showToast('✅ 已添加 ' + t);
        if (window.renderWatchlist) window.renderWatchlist();
    };
    
    // ===== 分組管理 =====
    
    /**
     * 顯示新增分組對話框
     */
    window.showAddGroupDialog = function() {
        window.showModal(
            '<div class="modal-title">📁 新增自選分組</div>' +
            '<input class="modal-input" id="newGroupName" placeholder="分組名稱">' +
            '<div class="modal-btn-row">' +
            '<button class="modal-btn cancel" onclick="closeModal()">取消</button>' +
            '<button class="modal-btn primary" onclick="addWLGroup()">新增</button>' +
            '</div>'
        );
    };
    
    /**
     * 添加自選分組
     */
    window.addWLGroup = async function() {
        var input = $('newGroupName');
        if (!input) return;
        
        var n = input.value.trim();
        if (!n) {
            window.showToast('請輸入名稱');
            return;
        }
        
        if (window.currentUser) {
            await fetch('api/watchlist/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: n })
            });
            if (window.loadSrvData) await window.loadSrvData();
        } else {
            window.offWLGroups.push(n);
            window.saveLS('stock_watchlist_groups', window.offWLGroups);
        }
        
        window.closeModal();
        if (window.renderWatchlist) window.renderWatchlist();
        window.showToast('✅ 已新增：' + n);
    };
    
    // ===== 移除自選 =====
    
    /**
     * 從自選列表移除股票
     * @param {string} t - 股票代碼
     */
    window.removeFromWatchlist = async function(t) {
        if (window.currentUser) {
            await fetch('api/watchlist/' + t, { method: 'DELETE' });
            if (window.loadSrvData) await window.loadSrvData();
        } else {
            window.offWatchlist = window.offWatchlist.filter(function(x) { return x !== t; });
            window.saveLS('stock_watchlist', window.offWatchlist);
        }
        
        if (window.renderWatchlist) window.renderWatchlist();
        window.showToast('已移除 ' + t);
    };
    
    // ===== 渲染自選列表 =====
    
    /**
     * 渲染自選股列表
     */
    window.renderWatchlist = async function() {
        var container = $('watchlistCards');
        var tickers = window.gWL();
        var groups = window.gWLGroups();
        
        // 更新分組下拉框
        var gsel = $('wlGroupSelect');
        if (gsel) {
            var cv = gsel.value;
            gsel.innerHTML = '<option value="all">全部分組</option>' +
                groups.map(function(g) { return '<option value="' + g + '">' + g + '</option>'; }).join('');
            gsel.value = cv || 'all';
        }
        
        // 空列表
        if (!tickers.length) {
            container.innerHTML = '<div class="empty"><div class="empty-icon">⭐</div><div class="empty-text">' +
                (window.currentUser ? '輸入代碼添加自選股' : '登錄後可同步自選股數據，或直接添加') + '</div></div>';
            return;
        }
        
        container.innerHTML = '<div class="loading show"><div class="spinner"></div></div>';
        
        try {
            // 獲取報價
            var r = await fetch('api/quotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tickers: tickers })
            });
            var d = await r.json();
            
            if (!d.success) throw new Error('獲取失敗');
            
            var quotes = d.quotes.filter(function(q) { return q.success; });
            
            // 排序
            var sort = $('wlSortSelect') ? $('wlSortSelect').value : 'default';
            if (sort === 'change-desc') {
                quotes.sort(function(a, b) { var ap = window.dailyChange(a).changePercent || 0; var bp = window.dailyChange(b).changePercent || 0; return bp - ap; });
            } else if (sort === 'change-asc') {
                quotes.sort(function(a, b) { var ap = window.dailyChange(a).changePercent || 0; var bp = window.dailyChange(b).changePercent || 0; return ap - bp; });
            } else if (sort === 'name-asc') {
                quotes.sort(function(a, b) { return (a.name || a.ticker).localeCompare(b.name || b.ticker); });
            } else if (sort === 'priority' && window.currentUser) {
                var wlm = {};
                window.srvWatchlist.forEach(function(w) { wlm[w.ticker] = w.priority || 0; });
                quotes.sort(function(a, b) { return (wlm[b.ticker] || 0) - (wlm[a.ticker] || 0); });
            }
            
            // 分組過濾
            var grp = $('wlGroupSelect') ? $('wlGroupSelect').value : 'all';
            if (grp !== 'all' && window.currentUser) {
                var gMap = {};
                window.srvWatchlist.forEach(function(w) { gMap[w.ticker] = w.group_name; });
                quotes = quotes.filter(function(q) { return gMap[q.ticker] === grp; });
            }
            
            // 渲染卡片
            container.innerHTML = quotes.map(function(q) {
                // 統一透過 window.dailyChange 重算當日漲跌，入源 = q.price + q.prevClose
                var dc = window.dailyChange(q);
                var qChange = dc.change;
                var qPct = dc.changePercent;
                var up = (qChange || 0) >= 0;
                var meta = {};
                
                if (window.currentUser) {
                    var w = window.srvWatchlist.find(function(x) { return x.ticker === q.ticker; });
                    if (w) meta = w;
                } else {
                    var wlMeta = JSON.parse(localStorage.getItem('stock_watchlist_meta') || '{}');
                    meta = wlMeta[q.ticker] || {};
                }
                
                var priority = meta.priority || 0;
                var targetBuy = meta.target_buy_price || 0;
                var targetSell = meta.target_sell_price || 0;
                var note = meta.note || '';
                var group = meta.group_name || '';
                
                var cardStyle = priority ? ' style="border-left:3px solid #ef4442"' : '';
                
                return '<div class="wl-card"' + cardStyle + '>' +
                    '<div class="wl-header">' +
                    '<div>' +
                    '<div class="wl-ticker">' + q.ticker +
                    (priority ? ' <span class="priority-tag">🔴重點</span>' : '') +
                    (group ? ' <span class="wl-group-tag">' + group + '</span>' : '') +
                    '</div>' +
                    '<div class="wl-name">' + q.name + '</div>' +
                    '</div>' +
                    '<div style="text-align:right">' +
                    '<div class="wl-current" style="color:' + window.udC(qChange) + '">' + window.fmtP(q.price) + '</div>' +
                    '<div class="wl-change" style="color:' + window.udC(qChange) + '">' + window.udA(qChange) + ' ' + window.fmtPct(qPct) + '</div>' +
                    '</div></div>' +
                    
                    (note ? '<div class="wl-note"><div class="wl-note-text">📝 ' + note + '</div>' +
                        '<button class="wl-btn note" style="padding:2px 8px;font-size:10px" onclick="showWLNoteModal(\'' + q.ticker + '\')">✏️</button></div>' : '') +
                    
                    (targetBuy || targetSell ? '<div style="margin-top:6px;font-size:11px">' +
                        (targetBuy ? '<span class="target-price-tag target-buy">🎯 買 ' + window.fmtP(targetBuy) + (q.price <= targetBuy ? ' ✓到價' : '') + '</span>' : '') +
                        (targetSell ? '<span class="target-price-tag target-sell">🎯 賣 ' + window.fmtP(targetSell) + (q.price >= targetSell ? ' ✓到價' : '') + '</span>' : '') +
                        '</div>' : '') +
                    
                    '<div class="wl-actions">' +
                    '<button class="wl-btn analyze" onclick="quickAnalyze(\'' + q.ticker + '\')">🎯 分析</button>' +
                    '<button class="wl-btn buy" onclick="showBuyDialogFor(\'' + q.ticker + '\',' + q.price + ')">📈 買入</button>' +
                    '<button class="wl-btn note" onclick="showWLNoteModal(\'' + q.ticker + '\')">📝 備註</button>' +
                    (window.currentUser ? '<button class="wl-btn" onclick="setWLPriority(\'' + q.ticker + '\',' + priority + ')" style="color:' + (priority ? '#ef4444' : '#6b7280') + ';border-color:' + (priority ? '#ef4444' : '#e5e7eb') + '">' + (priority ? '🔴 取消重點' : '📍 重點') + '</button>' : '') +
                    '<button class="wl-btn remove" onclick="removeFromWatchlist(\'' + q.ticker + '\')">✕ 移除</button>' +
                    '</div></div>';
            }).join('');
            
            if (!quotes.length) {
                container.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">此分組無股票</div></div>';
            }
            
        } catch (e) {
            container.innerHTML = '<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">載入失敗：' + e.message + '</div></div>';
        }
    };
    
    // ===== 自選股備註 =====
    
    /**
     * 顯示自選股備註對話框
     * @param {string} t - 股票代碼
     */
    window.showWLNoteModal = function(t) {
        if (window.currentUser) {
            var w = window.srvWatchlist.find(function(x) { return x.ticker === t; }) || {};
            
            window.showModal(
                '<div class="modal-title">📝 ' + t + ' 備註</div>' +
                '<div class="modal-label">觀察備註</div>' +
                '<textarea class="modal-input" id="wlNoteTA" rows="3" style="resize:vertical">' + (w.note || '') + '</textarea>' +
                '<div class="modal-label">分組</div>' +
                '<select class="modal-input" id="wlGroupSel" style="margin-bottom:0">' +
                '<option value="">不分組</option>' +
                window.srvWLGroups.map(function(g) {
                    return '<option value="' + g + '" ' + (w.group_name === g ? 'selected' : '') + '>' + g + '</option>';
                }).join('') +
                '</select>' +
                '<div class="modal-label">目標買入價</div>' +
                '<input class="modal-input" type="number" id="wlTargetBuy" step="0.01" value="' + (w.target_buy_price || '') + '">' +
                '<div class="modal-label">目標賣出價</div>' +
                '<input class="modal-input" type="number" id="wlTargetSell" step="0.01" value="' + (w.target_sell_price || '') + '">' +
                '<div class="modal-btn-row">' +
                '<button class="modal-btn cancel" onclick="closeModal()">取消</button>' +
                '<button class="modal-btn primary" onclick="saveWLNote(\'' + t + '\')">儲存</button>' +
                '</div>'
            );
        } else {
            var wlMeta = JSON.parse(localStorage.getItem('stock_watchlist_meta') || '{}');
            var m = wlMeta[t] || {};
            
            window.showModal(
                '<div class="modal-title">📝 ' + t + ' 備註</div>' +
                '<textarea class="modal-input" id="wlNoteTA" rows="3" placeholder="觀察理由">' + (m.note || '') + '</textarea>' +
                '<div class="modal-btn-row">' +
                '<button class="modal-btn cancel" onclick="closeModal()">取消</button>' +
                '<button class="modal-btn primary" onclick="saveWLNoteOff(\'' + t + '\')">儲存</button>' +
                '</div>'
            );
        }
    };
    
    /**
     * 保存自選股備註（服務器模式）
     * @param {string} t - 股票代碼
     */
    window.saveWLNote = async function(t) {
        var noteEl = $('wlNoteTA');
        var groupSel = $('wlGroupSel');
        var targetBuyEl = $('wlTargetBuy');
        var targetSellEl = $('wlTargetSell');
        
        if (!noteEl) return;
        
        var note = noteEl.value.trim();
        var group = groupSel ? groupSel.value : '';
        var tb = parseFloat(targetBuyEl ? targetBuyEl.value : '') || 0;
        var ts = parseFloat(targetSellEl ? targetSellEl.value : '') || 0;
        
        var w = window.srvWatchlist.find(function(x) { return x.ticker === t; }) || {};
        
        await fetch('api/watchlist/' + t, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                group_name: group,
                note: note,
                target_buy_price: tb,
                target_sell_price: ts,
                priority: w.priority || 0
            })
        });
        
        if (window.loadSrvData) await window.loadSrvData();
        window.closeModal();
        if (window.renderWatchlist) window.renderWatchlist();
        window.showToast('備註已儲存');
    };
    
    /**
     * 保存自選股備註（離線模式）
     * @param {string} t - 股票代碼
     */
    window.saveWLNoteOff = function(t) {
        var noteEl = $('wlNoteTA');
        if (!noteEl) return;
        
        var wlMeta = JSON.parse(localStorage.getItem('stock_watchlist_meta') || '{}');
        if (!wlMeta[t]) wlMeta[t] = {};
        wlMeta[t].note = noteEl.value.trim();
        window.saveLS('stock_watchlist_meta', wlMeta);
        
        window.closeModal();
        if (window.renderWatchlist) window.renderWatchlist();
        window.showToast('備註已儲存');
    };
    
    /**
     * 設置自選股重點標記
     * @param {string} t - 股票代碼
     * @param {number} cur - 當前狀態
     */
    window.setWLPriority = async function(t, cur) {
        if (!window.currentUser) return;
        
        var w = window.srvWatchlist.find(function(x) { return x.ticker === t; });
        if (!w) return;
        
        await fetch('api/watchlist/' + t, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priority: cur ? 0 : 1 })
        });
        
        if (window.loadSrvData) await window.loadSrvData();
        if (window.renderWatchlist) window.renderWatchlist();
        window.showToast(cur ? '已取消重點' : '🔴 已標記重點觀察');
    };
    
    // ===== 批量分析自選 =====
    
    /**
     * 批量分析自選股
     */
    window.batchAnalyzeWatchlist = async function() {
        var tickers = window.gWL();
        if (!tickers.length) {
            window.showToast('自選列表為空');
            return;
        }
        
        // 創建進度條
        var bar = $('progressBar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'progressBar';
            bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(90deg,#00C853,#4ADE80);padding:12px;color:#fff;font-size:14px;text-align:center';
            document.body.appendChild(bar);
        }
        
        bar.style.display = 'block';
        
        var c = 0;
        for (var i = 0; i < tickers.length; i++) {
            var t = tickers[i];
            
            try {
                var r = await fetch('api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticker: t, type: 'signal' })
                });
                var d = await r.json();
                
                if (d.success) {
                    var rec = '';
                    var m1 = d.content.match(/\*\*最終建議：?\*\* (.*?)(?:\n|$)/);
                    if (m1) rec = m1[1].trim();
                    if (!rec) {
                        var m2 = d.content.match(/\*\*當前建議：?\*\* (.*?)(?:\n|$)/);
                        if (m2) rec = m2[1].trim();
                    }
                    
                    if (window.currentUser) {
                        var ww = window.srvWatchlist.find(function(x) { return x.ticker === t; }) || {};
                        await fetch('api/watchlist/' + t, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ note: ww.note || '' })
                        });
                    }
                }
            } catch (e) {}
            
            c++;
            var pct = Math.round(c / tickers.length * 100);
            bar.innerHTML = '分析中... (' + c + '/' + tickers.length + ') <div style="background:rgba(255,255,255,.3);border-radius:4px;height:6px;margin-top:8px"><div style="background:#fff;height:6px;border-radius:4px;width:' + pct + '%;transition:width .3s"></div></div>';
        }
        
        setTimeout(function() { if (bar) bar.style.display = 'none'; }, 500);
        window.showToast('✅ 批量分析完成！');
        if (window.renderWatchlist) window.renderWatchlist();
    };
    
    // ===== 向後兼容別名 =====
    
    /**
     * 向後兼容：舊函數名 addToWatchlist → addToWatchlistDirect
     */
    window.addToWatchlist = window.addToWatchlist || window.addToWatchlistDirect;
    
    /**
     * 向後兼容：舊函數名 deleteFromWatchlist → removeFromWatchlist
     */
    window.deleteFromWatchlist = window.deleteFromWatchlist || window.removeFromWatchlist;
    
    /**
     * 向後兼容：舊函數名 batchAnalyze → batchAnalyzeWatchlist
     */
    window.batchAnalyze = window.batchAnalyze || window.batchAnalyzeWatchlist;
    
    /**
     * 向後兼容：舊函數名 batchAddToWatchlist → addToWatchlistDirect
     */
    window.batchAddToWatchlist = window.batchAddToWatchlist || window.addToWatchlistDirect;
    
    /**
     * 向後兼容：toggleWatchlistGroup（該函數已整合到分組下拉框）
     */
    window.toggleWatchlistGroup = window.toggleWatchlistGroup || function() {};
    
    /**
     * 向後兼容：renderMarketStats（該函數已整合到 loadMarketIndices）
     */
    window.renderMarketStats = window.renderMarketStats || function() {};
    
})();
