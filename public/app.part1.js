// StockAI Enhanced - Part 1: Core, Home, Chat, History, Market Indices

// ===== Market Indices Bar =====
async function loadMarketIndices() {
  const bar = document.getElementById('marketBar');
  if (!bar) return;
  try {
    const r = await fetch('api/market/indices');
    const d = await r.json();
    if (!d.success || !d.indices) return;
    bar.innerHTML = d.indices.map(idx => {
      const up = (idx.change || 0) >= 0;
      const color = up ? '#22c55e' : '#ef4444';
      const arrow = up ? '▲' : '▼';
      return '<div class="market-idx">' +
        '<div class="market-idx-name">' + (idx.name || idx.ticker) + '</div>' +
        '<div class="market-idx-val">' + fmtP(idx.price) + '</div>' +
        '<div class="market-idx-chg" style="color:' + color + '">' + arrow + ' ' + fmtPct(idx.changePercent) + '</div>' +
        '</div>';
    }).join('');
  } catch(e) { console.log('Market indices load failed', e); }
}
setTimeout(loadMarketIndices, 1500);
window.onerror=function(m,s,l,c,e){console.error("JS Error:",m,"Line:",l);return false};

let currentType='overview',currentTicker='';
let history=JSON.parse(localStorage.getItem('stock_history')||'[]');
let chatHistory=[];
let watchlist=JSON.parse(localStorage.getItem('stock_watchlist')||'[]');
let watchlistMeta=JSON.parse(localStorage.getItem('stock_watchlist_meta')||'{}');
let watchlistGroups=JSON.parse(localStorage.getItem('stock_watchlist_groups')||'["科技股","消費股","金融股","觀察池"]');
let watchlistAnalysis=JSON.parse(localStorage.getItem('stock_watchlist_analysis')||'{}');
let priceAlerts=JSON.parse(localStorage.getItem('stock_alerts')||'[]');
let portfolio=JSON.parse(localStorage.getItem('stock_portfolio')||'[]');
let portfolioMeta=JSON.parse(localStorage.getItem('stock_portfolio_meta')||'{}');
let portfolioAnalysis=JSON.parse(localStorage.getItem('stock_portfolio_analysis')||'{}');
let transactions=JSON.parse(localStorage.getItem('stock_transactions')||'[]');
let totalCash=100000;
let cash=parseFloat(localStorage.getItem('stock_cash')||totalCash);

const $=id=>document.getElementById(id);
const tickerInput=$('tickerInput'),searchBtn=$('searchBtn'),loading=$('loading'),resultView=$('resultView'),historyList=$('historyList'),toastEl=$('toast');

function showToast(m){toastEl.textContent=m;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),2500)}
function fmtP(n){return n!=null?'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'-'}
function fmtPct(n){return n!=null?(n>=0?'+':'')+n.toFixed(2)+'%':'-'}
function fmtD(ts){if(!ts)return'-';return new Date(ts).toLocaleDateString('zh-TW',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
function saveLS(k,v){localStorage.setItem(k,JSON.stringify(v))}
function udC(v){return v>=0?'#22c55e':'#ef4444'}
function udA(v){return v>=0?'▲':'▼'}
function closeModal(){const m=document.querySelector('.modal-overlay');if(m)m.remove()}
function showModal(h){closeModal();const d=document.createElement('div');d.className='modal-overlay';d.innerHTML='<div class="modal-box">'+h+'</div>';d.onclick=e=>{if(e.target===d)closeModal()};document.body.appendChild(d)}

function showPage(p){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  $(p+'Page').classList.add('active');
  document.querySelector('.nav-item[data-page="'+p+'"]')?.classList.add('active');
  if(p==='watchlist')renderWatchlist();
  if(p==='portfolio')renderPortfolio();
}

async function loadAnalysisTypes(){
  try{
    const r=await fetch('api/config'),d=await r.json();
    if(!d.success)return;
    const ts=d.config.analysisTypes.filter(t=>t.enabled).sort((a,b)=>a.order-b.order);
    const c=document.querySelector('.analysis-types');if(!c)return;
    c.innerHTML=ts.map((t,i)=>'<button class="type-btn '+(i===0?'active':'')+'" data-type="'+t.id+'"><span class="type-icon">'+t.icon+'</span>'+t.label+'</button>').join('');
    bindTypes(c);if(ts.length>0)currentType=ts[0].id;
  }catch(e){bindTypes(document.querySelector('.analysis-types'))}
}
function bindTypes(c){
  if(!c)return;
  c.querySelectorAll('.type-btn').forEach(b=>{b.onclick=()=>{c.querySelectorAll('.type-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentType=b.dataset.type}})
}
loadAnalysisTypes();

function renderMarkdown(t){
  if(typeof marked!=='undefined'){try{return marked.parse(t)}catch(e){}}
  let h=t;
  h=h.replace(/\|(.*)\|\n\|[-\s|]+\|\n((?:\|.*\|\n?)+)/g,(m,hd,rs)=>{
    const hs=hd.split('|').filter(x=>x.trim()).map(x=>'<th>'+x.trim()+'</th>').join('');
    const rws=rs.trim().split('\n').map(r=>'<tr>'+r.split('|').filter(x=>x.trim()).map(x=>'<td>'+x.trim()+'</td>').join('')+'</tr>').join('');
    return '<table style="width:100%;border-collapse:collapse;margin:12px 0"><thead><tr>'+hs+'</tr></thead><tbody>'+rws+'</tbody></table>'
  });
  h=h.replace(/## (.*)/g,'<h2 style="font-size:17px;font-weight:700;margin:16px 0 8px;border-bottom:2px solid #00C853;padding-bottom:4px">$1</h2>');
  h=h.replace(/### (.*)/g,'<h3 style="font-size:15px;font-weight:600;margin:12px 0 6px">$1</h3>');
  h=h.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
  h=h.replace(/^- (.*)$/gm,'<li style="margin:4px 0">$1</li>');
  h=h.replace(/---/g,'<hr style="border:none;border-top:1px solid #eee;margin:16px 0">');
  h=h.replace(/\n\n/g,'</p><p style="margin:8px 0">');
  h=h.replace(/\n/g,'<br>');
  return h
}

async function analyze(){
  const t=tickerInput.value.trim().toUpperCase();
  if(!t){showToast('請輸入股票代碼');return}
  currentTicker=t;loading.classList.add('show');resultView.classList.remove('show');
  loading.querySelector('.loading-text').textContent='正在獲取股價數據...';
  try{
    const qr=await fetch('api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticker:t})});
    const q=await qr.json();
    if(q&&q.success)renderQuoteOnly(t,q);
    loading.querySelector('.loading-text').textContent='🤖 AI 分析師正在分析中...';
    const r=await fetch('api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticker:t,type:currentType})});
    const d=await r.json();if(!d.success)throw new Error(d.error||'分析失敗');
    renderResult(t,currentType,d.content,q);addToHistory(t,currentType);
    showToast('分析完成！');
  }catch(e){showToast(e.message||'發生錯誤')}finally{loading.classList.remove('show')}
}

function renderQuoteOnly(t,q){
  if(!q||!q.success)return;
  const up=q.change>=0;
  resultView.innerHTML='<div class="result-header"><button class="back-btn" onclick="backToHome()">← 返回</button><span class="ticker-badge">'+t+'</span></div><div class="result-card" style="background:linear-gradient(135deg,var(--primary),#2d2d4a);color:#fff"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px"><div><div style="font-size:14px;opacity:0.8">'+(q.name||t)+'</div><div style="font-size:28px;font-weight:700">'+fmtP(q.price)+'</div></div><div style="text-align:right"><div style="font-size:16px;font-weight:600;color:'+(up?'#4ADE80':'#F87171')+'">'+(up?'▲':'▼')+' '+fmtP(Math.abs(q.change))+'</div><div style="font-size:14px;color:'+(up?'#4ADE80':'#F87171')+'">('+(up?'+':'')+(q.changePercent||0).toFixed(2)+'%)</div></div></div><div style="font-size:12px;opacity:0.7">'+(q.note||'')+'</div></div><div class="loading show" style="background:transparent"><div class="spinner"></div><div class="loading-text">🤖 AI 分析師正在分析中...</div></div>';
  resultView.classList.add('show')
}

function renderResult(t,type,content,q){
  const tl={overview:'全面分析',technical:'技術面分析',fundamental:'基本面分析',compare:'比較分析',risk:'風險評估',signal:'買賣信號'};
  let qh='';
  if(q&&q.success){const up=q.change>=0;qh='<div class="result-card" style="background:linear-gradient(135deg,var(--primary),#2d2d4a);color:#fff"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px"><div><div style="font-size:14px;opacity:0.8">'+(q.name||t)+'</div><div style="font-size:28px;font-weight:700">'+fmtP(q.price)+'</div></div><div style="text-align:right"><div style="font-size:16px;font-weight:600;color:'+(up?'#4ADE80':'#F87171')+'">'+(up?'▲':'▼')+' '+fmtP(Math.abs(q.change))+'</div><div style="font-size:14px;color:'+(up?'#4ADE80':'#F87171')+'">('+(up?'+':'')+q.changePercent.toFixed(2)+'%)</div></div></div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:12px;opacity:0.8"><div>開盤: '+fmtP(q.open)+'</div><div>最高: '+fmtP(q.high)+'</div><div>最低: '+fmtP(q.low)+'</div><div>成交量: '+(q.volume/1e6).toFixed(1)+'M</div><div>52週高: '+fmtP(q.fiftyTwoWeekHigh)+'</div><div>52週低: '+fmtP(q.fiftyTwoWeekLow)+'</div><div>市值: '+(q.marketCap/1e12).toFixed(1)+'T</div><div>本益比: '+(q.peRatio?.toFixed(1)||'-')+'</div></div></div>'}
  let rec=null;const lc=content.toLowerCase();
  if(lc.includes('買入')||lc.includes('建議買入')||lc.includes('bullish')||lc.includes('加碼'))rec={icon:'🚀',label:'建議買入',cls:'rec-buy'};
  else if(lc.includes('賣出')||lc.includes('建議賣出')||lc.includes('bearish')||lc.includes('減碼'))rec={icon:'⚠️',label:'建議賣出',cls:'rec-sell'};
  else if(lc.includes('持有')||lc.includes('觀望')||lc.includes('中性'))rec={icon:'⏸️',label:'建議持有',cls:'rec-hold'};
  const rh=rec?'<div class="recommendation"><span class="rec-icon">'+rec.icon+'</span><div><div class="rec-label">投資建議</div><div class="rec-value '+rec.cls+'">'+rec.label+'</div></div></div>':'';
  const isIn=watchlist.includes(t);
  resultView.innerHTML='<div class="result-header"><button class="back-btn" onclick="backToHome()">← 返回</button><span class="ticker-badge">'+t+'</span></div>'+qh+rh+'<div class="chart-container" id="chartContainer"><div class="chart-header"><span class="chart-title">📈 K線走勢圖</span><span class="chart-badge" id="chartBadge">加載中...</span></div><div id="chart"></div></div><div class="result-card"><div class="result-title">'+(tl[type]||'分析結果')+'</div><div class="result-content markdown-body">'+renderMarkdown(content)+'</div></div><div class="action-row"><button class="action-btn secondary" onclick="toggleWatchlist(\''+t+'\')">'+(isIn?'⭐ 已加入自選':'☆ 加入自選')+'</button><button class="action-btn secondary" onclick="copyResult()">📋 複製</button><button class="action-btn primary" onclick="askMore()">💬 追問</button></div>';
  resultView.classList.add('show');setTimeout(()=>loadChart(t),500)
}

let chart=null;
async function loadChart(t){
  const el=$('chart'),bd=$('chartBadge');if(!el)return;
  if(typeof LightweightCharts==='undefined'){await new Promise(r=>setTimeout(r,1500));if(typeof LightweightCharts==='undefined'){el.innerHTML='<div class="chart-error">⚠️ K線圖庫載入失敗</div>';return}}
  try{
    const r=await fetch('api/chart/'+t),d=await r.json();
    if(d.success&&d.candles&&d.candles.length>0){
      if(chart)chart.remove();
      chart=LightweightCharts.createChart(el,{width:el.clientWidth,height:280,layout:{backgroundColor:'#fff',textColor:'#333'},grid:{vertLines:{color:'#e5e7eb'},horLines:{color:'#e5e7eb'}},crosshair:{mode:LightweightCharts.CrosshairMode.Normal},rightPriceScale:{borderColor:'#e5e7eb'},timeScale:{borderColor:'#e5e7eb'}});
      const s=chart.addCandlestickSeries({upColor:'#22c55e',downColor:'#ef4444',borderUpColor:'#22c55e',borderDownColor:'#ef4444',wickUpColor:'#22c55e',wickDownColor:'#ef4444'});
      s.setData(d.candles);chart.timeScale().fitContent();bd.textContent='✅ 實時數據';bd.style.color='var(--accent)';
      window.addEventListener('resize',()=>{if(chart)chart.resize(el.clientWidth,280)})
    }else{el.innerHTML='<div class="chart-error">📊 K 線圖需要 API Key</div>';bd.textContent='⚠️ 需要 API'}
  }catch(e){el.innerHTML='<div class="chart-error">載入失敗</div>';bd.textContent='❌ 錯誤'}
}

function backToHome(){resultView.classList.remove('show');renderHistory()}
function copyResult(){const c=document.querySelector('.result-content');if(c)navigator.clipboard.writeText(c.textContent);showToast('已複製')}
function askMore(){showPage('chat')}

function addToHistory(t,type){history=[{ticker:t,type,time:Date.now()},...history.filter(h=>h.ticker!==t)].slice(0,10);saveLS('stock_history',history)}
function renderHistory(){
  if(!history.length){historyList.innerHTML='<div class="empty"><div class="empty-icon">📊</div><div class="empty-text">開始分析你的第一支股票</div></div>';return}
  const tl={overview:'全面',technical:'技術',fundamental:'基本面',compare:'比較',risk:'風險',signal:'信號'};
  historyList.innerHTML=history.map(h=>'<div class="history-item" onclick="loadHistory(\''+h.ticker+'\',\''+h.type+'\')"><div class="history-ticker">'+h.ticker.substring(0,4)+'</div><div class="history-info"><div class="history-title">'+h.ticker+'</div><div class="history-type">'+(tl[h.type]||h.type)+'</div></div><div class="history-arrow">›</div></div>').join('')
}
function loadHistory(t,type){tickerInput.value=t;document.querySelectorAll('.type-btn').forEach(b=>b.classList.toggle('active',b.dataset.type===type));currentType=type;analyze()}

// Chat
const chatInput=$('chatInput'),chatSend=$('chatSend'),chatMessages=$('chatMessages');
async function sendChat(){
  const msg=chatInput.value.trim();if(!msg)return;
  chatMessages.innerHTML+='<div class="chat-msg user">'+msg+'</div>';chatInput.value='';chatMessages.scrollTop=chatMessages.scrollHeight;
  chatMessages.innerHTML+='<div class="chat-msg ai">思考中...</div>';chatMessages.scrollTop=chatMessages.scrollHeight;
  try{
    const res=await fetch('api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:msg}]})});
    const data=await res.json();chatMessages.lastElementChild.remove();
    chatMessages.innerHTML+='<div class="chat-msg ai markdown-body">'+renderMarkdown(data.content)+'</div>';chatMessages.scrollTop=chatMessages.scrollHeight;
  }catch(e){chatMessages.lastElementChild.remove();chatMessages.innerHTML+='<div class="chat-msg ai">發生錯誤，請稍後再試</div>'}
}
chatSend.onclick=sendChat;chatInput.onkeypress=e=>{if(e.key==='Enter')sendChat()};
