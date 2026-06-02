/**
 * StockAI - 認證模組
 * 用戶登錄、註冊、登出、資料管理
 */
(function() {
    'use strict';
    
    var $ = window.$;
    
    // ===== 當前用戶狀態 =====
    window.currentUser = null;
    
    // ===== 檢查認證狀態 =====
    
    /**
     * 檢查並載入用戶認證狀態
     */
    window.checkAuth = async function() {
        try {
            var r = await fetch('api/auth/me');
            var d = await r.json();
            if (d.loggedIn) {
                window.currentUser = d.user;
                window.renderUserArea();
                if (window.loadSrvData) await window.loadSrvData();
                if (window.loadUserInvestCtx) await window.loadUserInvestCtx();
            } else {
                window.currentUser = null;
                window.renderUserArea();
            }
        } catch (e) {
            window.currentUser = null;
            window.renderUserArea();
        }
    };
    
    // ===== 渲染用戶區域 =====
    
    /**
     * 渲染用戶區域（登入按鈕或用戶名）
     */
    window.renderUserArea = function() {
        var a = $('userArea');
        var dd = $('userDropdown');
        if (!a) return;
        
        if (window.currentUser) {
            a.innerHTML = '<button class="user-btn" onclick="toggleUserDropdown()">👤 ' + 
                (window.currentUser.displayName || window.currentUser.username) + '</button>';
        } else {
            a.innerHTML = '<button onclick="showAuthModal()" style="font-size:13px;padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit">登錄</button>';
            if (dd) dd.classList.remove('show');
        }
    };
    
    // ===== 用戶下拉菜單 =====
    
    /**
     * 切換用戶下拉菜單
     */
    window.toggleUserDropdown = function() {
        var dd = $('userDropdown');
        if (dd) dd.classList.toggle('show');
    };
    
    // 點擊其他地方關閉下拉
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#userArea') && !e.target.closest('#userDropdown')) {
            var dd = $('userDropdown');
            if (dd) dd.classList.remove('show');
        }
    });
    
    // ===== 認證 Modal =====
    
    /**
     * 顯示登入/註冊 Modal
     * @param {string} mode - 'login' 或 'register'
     */
    window.showAuthModal = function(mode) {
        var m = mode || 'login';
        var isL = m === 'login';
        var html = '<div class="auth-tabs">' +
            '<button class="auth-tab ' + (isL ? 'active' : '') + '" onclick="showAuthModal(\'login\')">登錄</button>' +
            '<button class="auth-tab ' + (isL ? '' : 'active') + '" onclick="showAuthModal(\'register\')">註冊</button>' +
            '</div>';
        
        if (isL) {
            html += '<div class="modal-label">用戶名 / 郵箱</div>' +
                '<input class="modal-input" id="authUsername" placeholder="輸入用戶名或郵箱">' +
                '<div class="modal-label">密碼</div>' +
                '<input class="modal-input" type="password" id="authPassword" placeholder="輸入密碼" onkeypress="if(event.key===\'Enter\')doLogin()">' +
                '<div class="modal-btn-row"><button class="modal-btn primary" onclick="doLogin()">登錄</button></div>' +
                '<div class="auth-switch">還沒有帳號？<a onclick="showAuthModal(\'register\')">立即註冊</a></div>';
        } else {
            html += '<div class="modal-label">用戶名</div>' +
                '<input class="modal-input" id="regUsername" placeholder="至少 3 字元">' +
                '<div class="modal-label">郵箱（選填）</div>' +
                '<input class="modal-input" id="regEmail" type="email" placeholder="email@example.com">' +
                '<div class="modal-label">密碼</div>' +
                '<input class="modal-input" type="password" id="regPassword" placeholder="至少 6 字元">' +
                '<div class="modal-label">顯示名稱</div>' +
                '<input class="modal-input" id="regDisplayName" placeholder="你的暱稱">' +
                '<div class="modal-btn-row"><button class="modal-btn primary" onclick="doRegister()">註冊</button></div>' +
                '<div class="auth-switch">已有帳號？<a onclick="showAuthModal(\'login\')">登錄</a></div>';
        }
        
        window.showModal(html);
    };
    
    // ===== 登入 =====
    
    /**
     * 執行登入
     */
    window.doLogin = async function() {
        var uEl = $('authUsername');
        var pEl = $('authPassword');
        if (!uEl || !pEl) return;
        
        var u = uEl.value.trim();
        var p = pEl.value;
        
        if (!u || !p) {
            window.showToast('請填寫用戶名和密碼');
            return;
        }
        
        try {
            var r = await fetch('api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });
            var d = await r.json();
            
            if (!d.success) {
                window.showToast(d.error || '登錄失敗');
                return;
            }
            
            window.currentUser = d.user;
            window.closeModal();
            window.renderUserArea();
            window.showToast('✅ 歡迎回來，' + (window.currentUser.displayName || window.currentUser.username));
            
            if (window.loadSrvData) await window.loadSrvData();
            if (window.loadUserInvestCtx) await window.loadUserInvestCtx();
            if (window.checkLocalMigration) window.checkLocalMigration();
            
        } catch (e) {
            window.showToast('登錄失敗');
        }
    };
    
    // ===== 註冊 =====
    
    /**
     * 執行註冊
     */
    window.doRegister = async function() {
        var uEl = $('regUsername');
        var eEl = $('regEmail');
        var pEl = $('regPassword');
        var nEl = $('regDisplayName');
        if (!uEl || !pEl) return;
        
        var u = uEl.value.trim();
        var e = eEl ? eEl.value.trim() : '';
        var p = pEl.value;
        var n = nEl ? nEl.value.trim() : '';
        
        if (!u || !p) {
            window.showToast('請填寫必填項');
            return;
        }
        
        try {
            var r = await fetch('api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: u,
                    email: e || undefined,
                    password: p,
                    display_name: n || undefined
                })
            });
            var d = await r.json();
            
            if (!d.success) {
                window.showToast(d.error || '註冊失敗');
                return;
            }
            
            window.currentUser = d.user;
            window.closeModal();
            window.renderUserArea();
            window.showToast('✅ 註冊成功！');
            
            if (window.loadSrvData) await window.loadSrvData();
            
        } catch (e) {
            window.showToast('註冊失敗');
        }
    };
    
    // ===== 登出 =====
    
    /**
     * 執行登出
     */
    window.doLogout = async function() {
        var dd = $('userDropdown');
        if (dd) dd.classList.remove('show');
        
        try {
            await fetch('api/auth/logout', { method: 'POST' });
        } catch (e) {}
        
        window.currentUser = null;
        window.renderUserArea();
        window.showToast('已登出');
        
        if (window.renderPortfolio) window.renderPortfolio();
        if (window.renderWatchlist) window.renderWatchlist();
    };
    
    // ===== 個人資料 =====
    
    /**
     * 顯示個人資料 Modal
     */
    window.showProfileModal = function() {
        var dd = $('userDropdown');
        if (dd) dd.classList.remove('show');
        
        if (!window.currentUser) return;
        
        window.showModal(
            '<div class="modal-title">👤 個人資料</div>' +
            '<div class="modal-label">用戶名</div>' +
            '<input class="modal-input" value="' + window.currentUser.username + '" disabled style="opacity:.6">' +
            '<div class="modal-label">顯示名稱</div>' +
            '<input class="modal-input" id="profileName" value="' + (window.currentUser.displayName || '') + '">' +
            '<div class="modal-label">郵箱</div>' +
            '<input class="modal-input" id="profileEmail" value="' + (window.currentUser.email || '') + '">' +
            '<div class="modal-btn-row">' +
            '<button class="modal-btn cancel" onclick="closeModal()">取消</button>' +
            '<button class="modal-btn primary" onclick="doUpdateProfile()">儲存</button>' +
            '</div>'
        );
    };
    
    /**
     * 更新個人資料
     */
    window.doUpdateProfile = async function() {
        var nameEl = $('profileName');
        var emailEl = $('profileEmail');
        if (!nameEl || !emailEl) return;
        
        try {
            var r = await fetch('api/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    display_name: nameEl.value,
                    email: emailEl.value
                })
            });
            var d = await r.json();
            
            if (d.success) {
                window.showToast('✅ 已更新');
                window.closeModal();
                await window.checkAuth();
            } else {
                window.showToast(d.error);
            }
        } catch (e) {
            window.showToast('更新失敗');
        }
    };
    
    // ===== 修改密碼 =====
    
    /**
     * 顯示修改密碼 Modal
     */
    window.showPasswordModal = function() {
        var dd = $('userDropdown');
        if (dd) dd.classList.remove('show');
        
        window.showModal(
            '<div class="modal-title">🔑 修改密碼</div>' +
            '<div class="modal-label">舊密碼</div>' +
            '<input class="modal-input" type="password" id="oldPwd">' +
            '<div class="modal-label">新密碼</div>' +
            '<input class="modal-input" type="password" id="newPwd" placeholder="至少 6 字元">' +
            '<div class="modal-btn-row">' +
            '<button class="modal-btn cancel" onclick="closeModal()">取消</button>' +
            '<button class="modal-btn primary" onclick="doChangePwd()">確認修改</button>' +
            '</div>'
        );
    };
    
    /**
     * 執行修改密碼
     */
    window.doChangePwd = async function() {
        var oEl = $('oldPwd');
        var nEl = $('newPwd');
        if (!oEl || !nEl) return;
        
        var o = oEl.value;
        var n = nEl.value;
        
        if (!o || !n) {
            window.showToast('請填寫完整');
            return;
        }
        
        try {
            var r = await fetch('api/auth/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_password: o, new_password: n })
            });
            var d = await r.json();
            
            if (d.success) {
                window.showToast('✅ 密碼已修改');
                window.closeModal();
            } else {
                window.showToast(d.error);
            }
        } catch (e) {
            window.showToast('修改失敗');
        }
    };
    
    // ===== 數據遷移 =====
    
    /**
     * 檢查並提示本地數據遷移
     */
    window.checkLocalMigration = function() {
        if (!window.currentUser) return;
        
        var lp = JSON.parse(localStorage.getItem('stock_portfolio') || '[]');
        var lw = JSON.parse(localStorage.getItem('stock_watchlist') || '[]');
        var lc = parseFloat(localStorage.getItem('stock_cash') || '0');
        
        if (!lp.length && !lw.length && lc === 0) return;
        
        window.showModal(
            '<div class="modal-title">📥 數據遷移</div>' +
            '<div class="modal-info">偵測到本地有未同步數據：' + lp.length + ' 筆持倉、' + lw.length + ' 筆自選、現金 ' + window.fmtP(lc) + '<br>是否合併到帳號？</div>' +
            '<div class="modal-btn-row">' +
            '<button class="modal-btn cancel" onclick="clearLocalData()">清除本地</button>' +
            '<button class="modal-btn primary" onclick="doMigrate()">合併到帳號</button>' +
            '</div>'
        );
    };
    
    /**
     * 執行數據遷移
     */
    window.doMigrate = async function() {
        try {
            var r = await fetch('api/auth/migrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    portfolio: JSON.parse(localStorage.getItem('stock_portfolio') || '[]'),
                    watchlist: JSON.parse(localStorage.getItem('stock_watchlist') || '[]'),
                    watchlistGroups: JSON.parse(localStorage.getItem('stock_watchlist_groups') || '[]'),
                    cash: parseFloat(localStorage.getItem('stock_cash') || '0')
                })
            });
            var d = await r.json();
            
            if (d.success) {
                window.showToast('✅ 遷移完成');
                window.clearLocalData();
                if (window.loadSrvData) await window.loadSrvData();
            } else {
                window.showToast(d.error);
            }
        } catch (e) {
            window.showToast('遷移失敗');
        }
    };
    
    /**
     * 清除本地數據
     */
    window.clearLocalData = function() {
        var keys = [
            'stock_portfolio', 'stock_portfolio_meta', 'stock_portfolio_analysis',
            'stock_transactions', 'stock_cash', 'stock_alerts',
            'stock_watchlist', 'stock_watchlist_meta', 'stock_watchlist_groups',
            'stock_watchlist_analysis'
        ];
        keys.forEach(function(k) { localStorage.removeItem(k); });
        window.closeModal();
        window.showToast('本地數據已清除');
    };
    
})();
