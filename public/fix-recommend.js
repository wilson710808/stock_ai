// 先備份原始 showPage
let originalShowPage = window.showPage;

// ===== 推薦頁 =====
let recommendData = null;
let selectedTickers = new Set();

// 重寫 showPage 函數 - 修復導航
window.showPage = function(p) {
    // 先動態檢查並創建 recommendPage（如果不存在）
    if (p === 'recommend' && !document.getElementById('recommendPage')) {
        const el = document.createElement('main');
        el.id = 'recommendPage';
        el.className = 'main page';
        el.innerHTML = `
<div class="section-header" style="margin-bottom:16px"><h2 class="section-title">🎯 板塊推薦</h2></div>
<div style="background:#E8F5E9;padding:14px;border-radius:12px;margin-bottom:16px;font-size:13px;color:#1B5E20;line-height:1.6">
  📊 按行業板塊精選的績優美股（基於常見板塊龍頭 + 市場公認優質標的），勾選後可單個或批量分析，以巴菲特/芒格策略篩選。
</div>
<div id="recommendActions" style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
  <button class="action-btn secondary" onclick="analyzeSelected()">🎯 分析選中的</button>
  <button class="action-btn primary" onclick="analyzeAll()">🤖 全部分析</button>
  <button class="action-btn secondary" onclick="clearSelection()">🔄 清空選擇</button>
</div>
<div id="recommendList"></div>`;
        document.body.appendChild(el);
    }
    
    // 調用原始 showPage（或使用手動切換方式）
    document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x.dataset.page === p));
    const el = document.getElementById(p + 'Page');
    if (el) el.classList.add('active');
    
    if (p === 'watchlist' && typeof window.renderWatchlist === 'function') renderWatchlist();
    if (p === 'portfolio' && typeof window.renderPortfolio === 'function') renderPortfolio();
    
    // 如果是推薦頁，加載數據
    if (p === 'recommend') loadRecommend();
}

async function loadRecommend() {
    const container = document.getElementById('recommendList');
    if (!container) return;
    container.innerHTML = '<div class="loading show"><div class="spinner"></div><div class="loading-text">載入推薦列表...</div></div>';
    try {
        const r = await fetch('api/recommend');
        const d = await r.json();
        if (!d.success) throw new Error(d.error);
        recommendData = d;
        renderRecommend();
    } catch(e) {
        container.innerHTML = '<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">載入失敗：'+e.message+'</div></div>';
    }
}

function renderRecommend() {
    const container = document.getElementById('recommendList');
    const actions = document.getElementById('recommendActions');
    if (!container) return;
    if (!recommendData || !recommendData.sectors) {
        container.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><div class="empty-text">無推薦數據</div></div>';
        return;
    }
    if (actions) actions.style.display = 'flex';
    container.innerHTML = '';
    Object.keys(recommendData.sectors).forEach(sector => {
        const stocks = recommendData.sectors[sector];
        const color = SCOLORS[sector] || '#9ca3af';
        const div = document.createElement('div');
        div.className = 'result-card';
        div.style.marginBottom = '16px';
        div.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
  <div style="display:flex;align-items:center;gap:8px">
    <span style="width:12px;height:12px;background:${color};border-radius:4px"></span>
    <span style="font-weight:600;font-size:15px">${sector}</span>
  </div>
  <span style="font-size:12px;color:#6b7280">${stocks.length} 支</span>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
${stocks.map(s => `
<div class="wl-card" style="margin-bottom:0;cursor:pointer;border:2px solid ${selectedTickers.has(s.ticker)?'var(--accent)':'var(--border)'};background:${selectedTickers.has(s.ticker)?'#E8F5E9':'#fff'}" onclick="toggleSelect('${s.ticker}')">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" ${selectedTickers.has(s.ticker)?'checked':''} style="cursor:pointer;width:18px;height:18px">
        <span style="font-weight:600;font-size:15px">${s.ticker}</span>
      </div>
      <div style="font-size:12px;color:#6b7280;margin-top:2px">${s.name}</div>
    </div>
  </div>
  <div style="font-size:11px;color:#6b7280;margin-top:6px">${s.reason}</div>
  <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
    <button class="action-btn" style="padding:6px 12px;font-size:12px" onclick="event.stopPropagation();quickAnalyze('${s.ticker}')">🎯 分析</button>
    <button class="action-btn" style="padding:6px 12px;font-size:12px" onclick="event.stopPropagation();addToWatchlistDirectFromRecommend('${s.ticker}')">⭐ 加自選</button>
  </div>
</div>`).join('')}
</div>`;
        container.appendChild(div);
    });
}

function toggleSelect(ticker) {
    if (selectedTickers.has(ticker)) selectedTickers.delete(ticker);
    else selectedTickers.add(ticker);
    renderRecommend();
}

function clearSelection() { selectedTickers.clear(); renderRecommend(); }

async function addToWatchlistDirectFromRecommend(ticker) {
    if (currentUser) {
        await fetch('api/watchlist/add', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ticker})});
        await loadSrvData();
    } else {
        if (!offWatchlist.includes(ticker)) offWatchlist.push(ticker);
        saveLS('stock_watchlist', offWatchlist);
    }
    showToast('✅ 已添加 '+ticker+' 到自選');
}

async function analyzeSelected() {
    const tickers = Array.from(selectedTickers);
    if (!tickers.length) { showToast('請先選擇要分析的股票'); return; }
    await doBatchAnalysis(tickers);
}

async function analyzeAll() {
    if (!recommendData || !recommendData.sectors) return;
    let allTickers = [];
    Object.values(recommendData.sectors).forEach(stocks => {
        stocks.forEach(s => allTickers.push(s.ticker));
    });
    await doBatchAnalysis(allTickers);
}

// 修復後的批量分析 - 顯示結果
async function doBatchAnalysis(tickers) {
    if (!tickers.length) return;
    
    let bar = document.getElementById('progressBar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'progressBar';
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(90deg,#00C853,#4ADE80);padding:12px;color:#fff;font-size:14px;text-align:center';
        document.body.appendChild(bar);
    }
    bar.style.display = 'block';
    
    let results = [];
    let count = 0;
    
    for (const t of tickers) {
        try {
            bar.innerHTML = `分析 ${t}... (${count+1}/${tickers.length}) <div style="background:rgba(255,255,255,.3);border-radius:4px;height:6px;margin-top:8px"><div style="background:#fff;height:6px;border-radius:4px;width:${Math.round(count/tickers.length*100)}%;transition:width .3s"></div></div>`;
            
            const r = await fetch('api/analyze', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ticker:t, type:'overview'})});
            const d = await r.json();
            if (d.success) results.push({ ticker:t, content:d.content, time:Date.now() });
        } catch(e) { console.error('Analysis failed for', t, e); }
        count++;
        bar.innerHTML = `分析中... (${count}/${tickers.length}) <div style="background:rgba(255,255,255,.3);border-radius:4px;height:6px;margin-top:8px"><div style="background:#fff;height:6px;border-radius:4px;width:${Math.round(count/tickers.length*100)}%;transition:width .3s"></div></div>`;
    }
    
    setTimeout(() => { if (bar) bar.style.display='none'; }, 500);
    
    // 顯示結果對話框
    showModal(`
<div class="modal-title">🤖 批量分析完成 (${results.length}/${tickers.length})</div>
<div style="max-height:50vh;overflow:auto;margin-bottom:16px">
${results.map(r => `
<div class="result-card" style="margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <span style="font-weight:600;font-size:15px">🎯 ${r.ticker}</span>
    <button class="action-btn" style="padding:6px 12px;font-size:12px" onclick="goAnalyze('${r.ticker}')">查看詳細</button>
  </div>
  <div style="font-size:12px;color:#6b7280;line-height:1.8">${r.content.substring(0,300)}...</div>
</div>`).join('')}
</div>
<div class="modal-btn-row">
  <button class="modal-btn cancel" onclick="closeModal()">關閉</button>
</div>`);
}

// 跳轉分析
window.goAnalyze = function(t) {
    closeModal();
    showPage('home');
    setTimeout(() => {
        tickerInput.value = t;
        analyze();
    }, 100);
};

// 修改 quickAnalyze - 調用原函數
if (!window.originalQuickAnalyze) window.originalQuickAnalyze = window.quickAnalyze;
window.quickAnalyze = function(t) {
    if (typeof window.originalQuickAnalyze === 'function') window.originalQuickAnalyze(t);
    else {
        tickerInput.value = t;
        showPage('home');
        analyze();
    }
};

// ===== 修復自選股批量分析 =====
const originalBatchAnalyzeWatchlist = window.batchAnalyzeWatchlist;
window.batchAnalyzeWatchlist = async function() {
    const tickers = gWL();
    if (!tickers.length) { showToast('自選列表為空'); return; }
    await doBatchAnalysis(tickers);
};

console.log('StockAI Recommend Fix loaded');
