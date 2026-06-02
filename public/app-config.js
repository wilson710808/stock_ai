/**
 * StockAI - 配置文件
 * 全局常量和配置
 */
(function() {
    'use strict';
    
    // ===== 行業板塊映射 =====
    window.SECTOR_MAP = {
        'AAPL': '科技', 'MSFT': '科技', 'NVDA': '科技', 'AMD': '科技',
        'GOOGL': '科技', 'GOOG': '科技', 'META': '通訊', 'NFLX': '通訊',
        'T': '通訊', 'VZ': '通訊', 'AMZN': '消費', 'TSLA': '消費',
        'WMT': '消費', 'COST': '消費', 'NKE': '消費', 'SBUX': '消費',
        'MCD': '消費', 'JPM': '金融', 'V': '金融', 'BRK.B': '金融',
        'GS': '金融', 'BAC': '金融', 'UNH': '醫療', 'JNJ': '醫療',
        'PFE': '醫療', 'ABBV': '醫療', 'XOM': '能源', 'CVX': '能源',
        'CAT': '工業', 'BA': '工業', 'HON': '工業', 'UPS': '工業',
        'LIN': '材料', 'PLD': '地產', 'NEE': '公用', 'DUK': '公用'
    };
    
    // ===== 板塊顏色配置 =====
    window.SCOLORS = {
        '科技': '#3b82f6', '消費': '#f59e0b', '金融': '#22c55e',
        '通訊': '#8b5cf6', '醫療': '#ec4899', '能源': '#f97316',
        '工業': '#06b6d4', '材料': '#84cc16', '地產': '#a855f7',
        '公用': '#64748b', '其他': '#9ca3af', '現金': '#9ca3af'
    };
    
    // ===== 版本信息 =====
    window.APP_VERSION = '2.2.0';
    
    // ===== API 配置 =====
    window.API_ENDPOINTS = {
        AUTH_ME: 'api/auth/me',
        AUTH_LOGIN: 'api/auth/login',
        AUTH_REGISTER: 'api/auth/register',
        AUTH_LOGOUT: 'api/auth/logout',
        AUTH_PROFILE: 'api/auth/profile',
        AUTH_PASSWORD: 'api/auth/password',
        AUTH_MIGRATE: 'api/auth/migrate',
        PORTFOLIO: 'api/portfolio',
        PORTFOLIO_BUY: 'api/portfolio/buy',
        PORTFOLIO_SELL: 'api/portfolio/sell',
        WATCHLIST: 'api/watchlist',
        WATCHLIST_ADD: 'api/watchlist/add',
        TRANSACTIONS: 'api/transactions',
        ALERTS: 'api/alerts',
        CONFIG: 'api/config',
        QUOTE: 'api/quote',
        QUOTES: 'api/quotes',
        ANALYZE: 'api/analyze',
        ANALYSIS_HISTORY: 'api/analysis-history',
        MARKET_INDICES: 'api/market/indices',
        USER_CONTEXT: 'api/user-context',
        RECOMMEND: 'api/recommend',
        FAVORITES: 'api/favorites',
        FAVORITES_ADD: 'api/favorites/add',
        FAVORITES_GROUPED: 'api/favorites/grouped',
        VERSION: 'api/version'
    };
    
})();
