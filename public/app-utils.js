/**
 * StockAI - 工具函數模組
 * DOM 操作、格式化、localStorage 等工具函數
 */
(function() {
    'use strict';
    
    // ===== DOM 快捷函數 =====
    const $ = function(id) { return document.getElementById(id); };
    
    // 預先綁定常用 DOM 元素
    let _tickerInput, _searchBtn, _loading, _resultView, _historyList, _toastEl;
    const _initDOM = function() {
        _tickerInput = $('tickerInput');
        _searchBtn = $('searchBtn');
        _loading = $('loading');
        _resultView = $('resultView');
        _historyList = $('historyList');
        _toastEl = $('toast');
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _initDOM);
    } else {
        _initDOM();
    }
    
    // ===== Toast 提示 =====
    window.showToast = function(m) {
        const el = _toastEl || $('toast');
        if (!el) return;
        el.textContent = m;
        el.classList.add('show');
        setTimeout(function() { el.classList.remove('show'); }, 2500);
    };
    
    // ===== 格式化函數 =====
    
    /**
     * 格式化價格
     * @param {number} n - 價格數值
     * @returns {string} 格式化後的價格字符串
     */
    window.fmtP = function(n) {
        return n != null ? '$' + Number(n).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) : '-';
    };
    
    /**
     * 格式化百分比
     * @param {number} n - 百分比數值
     * @returns {string} 格式化後的百分比字符串
     */
    window.fmtPct = function(n) {
        return n != null ? (n >= 0 ? '+' : '') + n.toFixed(2) + '%' : '-';
    };
    
    /**
     * 格式化日期時間
     * @param {number} ts - 時間戳
     * @returns {string} 格式化後的日期字符串
     */
    window.fmtD = function(ts) {
        if (!ts) return '-';
        return new Date(ts).toLocaleDateString('zh-TW', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    /**
     * 格式化持有天數
     * @param {number} ts - 時間戳
     * @returns {string} 持有天數字符串
     */
    window.fmtDays = function(ts) {
        if (!ts) return '-';
        const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
        return d + '天';
    };
    
    // ===== 顏色與箭頭 =====
    
    /**
     * 根據漲跌返回顏色
     * @param {number} v - 數值
     * @returns {string} 顏色代碼
     */
    window.udC = function(v) { return v >= 0 ? '#22c55e' : '#ef4444'; };
    
    /**
     * 根據漲跌返回箭頭
     * @param {number} v - 數值
     * @returns {string} 箭頭字符
     */
    window.udA = function(v) { return v >= 0 ? '▲' : '▼'; };
    
    // ===== 行業板塊 =====
    
    /**
     * 獲取股票的行業板塊
     * @param {string} t - 股票代碼
     * @returns {string} 行業板塊名稱
     */
    window.getSector = function(t) {
        if (window.SECTOR_MAP && window.SECTOR_MAP[t.toUpperCase()]) {
            return window.SECTOR_MAP[t.toUpperCase()];
        }
        return '其他';
    };
    
    // ===== LocalStorage 工具 =====
    
    /**
     * 保存數據到 localStorage
     * @param {string} k - 鍵名
     * @param {*} v - 值
     */
    window.saveLS = function(k, v) { localStorage.setItem(k, JSON.stringify(v)); };
    
    // ===== Modal 函數 =====
    
    /**
     * 關閉 Modal
     */
    window.closeModal = function() {
        const m = document.querySelector('.modal-overlay');
        if (m) m.remove();
    };
    
    /**
     * 顯示 Modal
     * @param {string} h - HTML 內容
     */
    window.showModal = function(h) {
        window.closeModal();
        const d = document.createElement('div');
        d.className = 'modal-overlay';
        d.innerHTML = '<div class="modal-box">' + h + '</div>';
        d.onclick = function(e) { if (e.target === d) window.closeModal(); };
        var box = d.querySelector('.modal-box');
        if (box) box.onclick = function(e) { e.stopPropagation(); };
        document.body.appendChild(d);
    };
    
    // ===== 頁面切換 =====
    
    /**
     * 切換頁面
     * @param {string} p - 頁面標識
     */
    window.showPage = async function(p) {
        document.querySelectorAll('.page').forEach(function(x) { x.classList.remove('active'); });
        document.querySelectorAll('.nav-item').forEach(function(x) { x.classList.remove('active'); });
        var pageEl = $(p + 'Page');
        if (pageEl) pageEl.classList.add('active');
        var navEl = document.querySelector('.nav-item[data-page="' + p + '"]');
        if (navEl) navEl.classList.add('active');

        // v2.2.5: 進入持倉/自選頁時強制從服務端同步一次，避免舊快取或初始化順序導致空資料
        if ((p === 'watchlist' || p === 'portfolio') && window.currentUser && window.loadSrvData && !window._loadingSrvDataForPage) {
            window._loadingSrvDataForPage = true;
            try { await window.loadSrvData(); } catch(e) {}
            window._loadingSrvDataForPage = false;
        }

        if (p === 'watchlist' && window.renderWatchlist) window.renderWatchlist();
        if (p === 'portfolio' && window.renderPortfolio) window.renderPortfolio();
    };
    
    // ===== 返回首頁 =====
    
    /**
     * 返回首頁
     */
    window.backToHome = function() {
        window.showPage('home');
        var rv = _resultView || $('resultView');
        if (rv) rv.classList.remove('show');
    };
    
    // ===== DOM 元素獲取器（供其他模組使用） =====
    window.$ = $;
    window.getTickerInput = function() { return _tickerInput || $('tickerInput'); };
    window.getSearchBtn = function() { return _searchBtn || $('searchBtn'); };
    window.getLoading = function() { return _loading || $('loading'); };
    window.getResultView = function() { return _resultView || $('resultView'); };
    window.getHistoryList = function() { return _historyList || $('historyList'); };
    
})();
