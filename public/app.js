/**
 * StockAI - 主入口文件 v2.3.1
 * 
 * 本文件為模組化重構後的入口點，負責加載各個功能模組。
 * 完整的代碼已拆分到以下模組：
 * 
 * 加載順序（重要）：
 * 1. app-config.js  - 全局配置和常量
 * 2. app-utils.js    - 工具函數
 * 3. app-auth.js     - 用戶認證
 * 4. app-data.js     - 數據管理
 * 5. app-analysis.js - 股票分析
 * 6. app-portfolio.js - 持倉管理
 * 7. app-watchlist.js - 自選股管理
 * 8. app-recommend.js - 推薦功能
 * 9. app-init.js     - 初始化
 * 
 * 所有模組都通過 IIFE 封裝，僅將必要函數導出到 window 對象。
 */

'use strict';

// ===== 版本標識 =====

console.log('StockAI v2.3.1 - Daily Change Recalc');

// ===== 模組加載狀態 =====

var modulesLoaded = false;

function onModulesReady() {
    if (modulesLoaded) return;
    modulesLoaded = true;
    
    // 觸發 app-init.js 中的初始化邏輯
    if (window.__initReady) {
        window.__initReady();
    }
}

// ===== 兼容性聲明 =====

/**
 * 以下函數在本版本中已移動到對應模組：
 * 
 * - 格式化函數 → app-utils.js
 * - 認證函數 → app-auth.js  
 * - 數據函數 → app-data.js
 * - 分析函數 → app-analysis.js
 * - 持倉函數 → app-portfolio.js
 * - 自選函數 → app-watchlist.js
 * - 推薦函數 → app-recommend.js
 * - 初始化 → app-init.js
 * 
 * 如需調試函數是否存在，可調用：
 * window.__checkFunctions()
 */

// ===== 向後兼容（可選） =====

// 為了保持向後兼容，我們在 window 上添加一些別名
// 這些可以在未來版本中移除

window.StockAI = {
    version: '2.3.1',
    modules: [
        'app-config.js',
        'app-utils.js',
        'app-auth.js',
        'app-data.js',
        'app-analysis.js',
        'app-portfolio.js',
        'app-watchlist.js',
        'app-recommend.js',
        'app-init.js'
    ],
    
    /**
     * 檢查所有模組函數是否就緒
     */
    checkReady: function() {
        return window.__checkFunctions ? window.__checkFunctions() : false;
    },
    
    /**
     * 獲取模組信息
     */
    getInfo: function() {
        return {
            version: this.version,
            modules: this.modules,
            currentUser: !!window.currentUser,
            historyCount: window.stockHistory ? window.stockHistory.length : 0,
            portfolioCount: window.gPF ? window.gPF().length : 0,
            watchlistCount: window.gWL ? window.gWL().length : 0
        };
    }
};

// ===== 調試輔助 =====

/**
 * 打印調試信息到控制台
 */
window.__debug = function() {
    console.log('StockAI Debug Info:', window.StockAI.getInfo());
    
    // 檢查關鍵變量
    console.log('currentUser:', window.currentUser);
    console.log('SECTOR_MAP:', typeof window.SECTOR_MAP);
    console.log('showPage:', typeof window.showPage);
    console.log('analyze:', typeof window.analyze);
    console.log('renderPortfolio:', typeof window.renderPortfolio);
    console.log('renderWatchlist:', typeof window.renderWatchlist);
};

// 自動觸發
if (typeof console !== 'undefined') {
    setTimeout(function() {
        console.log('StockAI loaded. Run window.__debug() for info.');
    }, 100);
}
