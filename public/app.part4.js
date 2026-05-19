// StockAI Enhanced - Part 4: Init & Events

// 初始化事件
searchBtn.onclick=analyze;
tickerInput.onkeypress=e=>{if(e.key==='Enter')analyze()};
document.querySelectorAll('.nav-item').forEach(btn=>{btn.onclick=()=>showPage(btn.dataset.page)});
document.querySelectorAll('.chip').forEach(chip=>{chip.onclick=()=>{tickerInput.value=chip.dataset.ticker;analyze()}});

// Portfolio頁面進入時刷新
const pfPage=$('portfolioPage');
if(pfPage){const obs=new MutationObserver(()=>{if(pfPage.classList.contains('active'))renderPortfolio()});obs.observe(pfPage,{attributes:true,attributeFilter:['class']})}

// Watchlist頁面進入時刷新
const wlPage=$('watchlistPage');
if(wlPage){const wobs=new MutationObserver(()=>{if(wlPage.classList.contains('active'))renderWatchlist()});wobs.observe(wlPage,{attributes:true,attributeFilter:['class']})}

// 自選頁Enter鍵添加
const wlInput=$('wlTickerInput');
if(wlInput)wlInput.onkeypress=e=>{if(e.key==='Enter')addToWatchlistDirect()};

// 初始渲染
renderHistory();

// 價格提醒檢查（每次打開頁面時）
function checkPriceAlerts(){
  if(!priceAlerts.length)return;
  watchlist=JSON.parse(localStorage.getItem('stock_watchlist')||'[]');
  portfolio=JSON.parse(localStorage.getItem('stock_portfolio')||'[]');
  const allTickers=[...new Set([...watchlist,...portfolio.map(p=>p.ticker)])];
  if(!allTickers.length)return;
  fetch('api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tickers:allTickers})}).then(r=>r.json()).then(d=>{
    if(!d.success)return;
    const triggered=[];
    d.quotes?.forEach(q=>{
      if(!q.success)return;
      priceAlerts.forEach((a,i)=>{
        if(a.ticker!==q.ticker)return;
        if(a.type==='above'&&q.price>=a.price)triggered.push({alert:a,idx:i,ticker:q.ticker,price:q.price});
        if(a.type==='below'&&q.price<=a.price)triggered.push({alert:a,idx:i,ticker:q.ticker,price:q.price})
      })
    });
    if(triggered.length){
      triggered.forEach(t=>{
        showToast('🔔 '+t.ticker+' 已'+(t.alert.type==='above'?'漲破':'跌至')+' '+fmtP(t.alert.price)+'！當前: '+fmtP(t.price));
        priceAlerts.splice(t.idx,1)
      });
      saveLS('stock_alerts',priceAlerts)
    }
  }).catch(()=>{})
}

// 每60秒檢查一次
setInterval(checkPriceAlerts,60000);
setTimeout(checkPriceAlerts,5000);

// 每5分鐘刷新市場指數
setInterval(loadMarketIndices,300000);
