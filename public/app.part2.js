// StockAI Enhanced - Part 2: Watchlist (自選股)

function toggleWatchlist(t){
  const i=watchlist.indexOf(t);
  if(i>-1){watchlist.splice(i,1);showToast('已從自選移除')}else{watchlist.push(t);showToast('已添加到自選')}
  saveLS('stock_watchlist',watchlist);renderWatchlist()
}

function addToWatchlistDirect(){
  const t=$('wlTickerInput').value.trim().toUpperCase();
  if(!t){showToast('請輸入股票代碼');return}
  if(watchlist.includes(t)){showToast(t+' 已在自選中');return}
  watchlist.push(t);saveLS('stock_watchlist',watchlist);$('wlTickerInput').value='';
  showToast('✅ 已添加 '+t+' 到自選');renderWatchlist()
}

function setWatchlistNote(t){
  const m=watchlistMeta[t]||{};
  showModal('<div class="modal-title">📝 '+t+' 備註</div><div class="modal-info">記錄觀察理由、關注點等</div><textarea class="modal-input" id="wlNoteTA" rows="3" style="resize:vertical" placeholder="例：Q3財報預期強勁">'+(m.note||'')+'</textarea><div class="modal-label">分組</div><select class="modal-input" id="wlGroupSel" style="margin-bottom:0"><option value="">不分組</option>'+watchlistGroups.map(g=>'<option value="'+g+'" '+(m.group===g?'selected':'')+'>'+g+'</option>').join('')+'</select><div class="modal-btn-row"><button class="modal-btn cancel" onclick="closeModal()">取消</button><button class="modal-btn primary" onclick="saveWLNote(\''+t+'\')">儲存</button></div>')
}
function saveWLNote(t){
  if(!watchlistMeta[t])watchlistMeta[t]={};
  watchlistMeta[t].note=$('wlNoteTA').value.trim();watchlistMeta[t].group=$('wlGroupSel').value;
  saveLS('stock_watchlist_meta',watchlistMeta);closeModal();renderWatchlist();showToast('備註已儲存')
}

function showAddGroupDialog(){
  showModal('<div class="modal-title">📁 新增自選分組</div><input class="modal-input" id="newGroupName" placeholder="分組名稱，如：半導體"><div class="modal-btn-row"><button class="modal-btn cancel" onclick="closeModal()">取消</button><button class="modal-btn primary" onclick="addWLGroup()">新增</button></div>')
}
function addWLGroup(){
  const n=$('newGroupName').value.trim();if(!n){showToast('請輸入分組名稱');return}
  watchlistGroups.push(n);saveLS('stock_watchlist_groups',watchlistGroups);closeModal();renderWatchlist();showToast('✅ 已新增分組：'+n)
}
function removeWLGroup(g){
  if(!confirm('確定刪除分組「'+g+'」？'))return;
  watchlistGroups=watchlistGroups.filter(x=>x!==g);saveLS('stock_watchlist_groups',watchlistGroups);
  Object.keys(watchlistMeta).forEach(t=>{if(watchlistMeta[t]&&watchlistMeta[t].group===g)delete watchlistMeta[t].group});
  saveLS('stock_watchlist_meta',watchlistMeta);renderWatchlist();showToast('已刪除分組：'+g)
}

function setWatchlistAlert(t,p){
  showModal('<div class="modal-title">🔔 '+t+' 價格提醒</div><div class="modal-info">當前價格: '+fmtP(p)+'</div><input class="modal-input" type="number" id="alertPriceVal" step="0.01" value="'+(p||0).toFixed(2)+'" placeholder="提醒價格"><div class="modal-btn-row"><button class="modal-btn primary" style="background:#22c55e" onclick="addAlert(\''+t+'\',\'above\')">🔔 漲破提醒</button><button class="modal-btn danger" onclick="addAlert(\''+t+'\',\'below\')">📉 跌至提醒</button></div><div style="margin-top:12px"><button class="modal-btn cancel" onclick="closeModal()">取消</button></div>')
}
function addAlert(t,type){
  const p=parseFloat($('alertPriceVal').value);if(!p||p<=0){showToast('請輸入有效價格');return}
  priceAlerts.push({ticker:t,price:p,type,created:Date.now()});saveLS('stock_alerts',priceAlerts);
  closeModal();renderWatchlist();showToast('✅ 已設置'+(type==='above'?'漲破':'跌至')+' $'+p.toFixed(2)+' 提醒')
}
function removeAlert(idx){priceAlerts.splice(idx,1);saveLS('stock_alerts',priceAlerts);renderWatchlist();showToast('已移除提醒')}

async function renderWatchlist(){
  const container=$('watchlistCards');
  watchlist=JSON.parse(localStorage.getItem('stock_watchlist')||'[]');
  watchlistMeta=JSON.parse(localStorage.getItem('stock_watchlist_meta')||'{}');
  watchlistAnalysis=JSON.parse(localStorage.getItem('stock_watchlist_analysis')||'{}');
  priceAlerts=JSON.parse(localStorage.getItem('stock_alerts')||'[]');
  watchlistGroups=JSON.parse(localStorage.getItem('stock_watchlist_groups')||'["科技股","消費股","金融股","觀察池"]');

  // 更新分組下拉
  const gsel=$('wlGroupSelect');if(gsel){
    const cv=gsel.value;gsel.innerHTML='<option value="all">全部分組</option>'+watchlistGroups.map(g=>'<option value="'+g+'">'+g+'</option>').join('');gsel.value=cv||'all'
  }

  if(!watchlist.length){container.innerHTML='<div class="empty"><div class="empty-icon">⭐</div><div class="empty-text">輸入代碼添加自選股，或在首頁分析後加入</div></div>';return}
  container.innerHTML='<div class="loading show"><div class="spinner"></div></div>';
  try{
    const r=await fetch('api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tickers:watchlist})});
    const d=await r.json();if(!d.success)throw new Error('獲取失敗');
    let quotes=d.quotes.filter(q=>q.success);

    // 排序
    const sort=$('wlSortSelect')?.value||'default';
    if(sort==='change-desc')quotes.sort((a,b)=>(b.changePercent||0)-(a.changePercent||0));
    else if(sort==='change-asc')quotes.sort((a,b)=>(a.changePercent||0)-(b.changePercent||0));
    else if(sort==='name-asc')quotes.sort((a,b)=>(a.name||a.ticker).localeCompare(b.name||b.ticker));

    // 分組篩選
    const grp=$('wlGroupSelect')?.value||'all';
    if(grp!=='all'){quotes=quotes.filter(q=>watchlistMeta[q.ticker]&&watchlistMeta[q.ticker].group===grp)}

    container.innerHTML=quotes.map(q=>{
      const up=q.change>=0;
      const m=watchlistMeta[q.ticker]||{};
      const a=watchlistAnalysis[q.ticker];
      const alerts=priceAlerts.filter(al=>al.ticker===q.ticker);
      const rec=a?.recommendation||'';
      const recC=rec.includes('買')||rec.includes('加碼')?'color:#22c55e':rec.includes('賣')||rec.includes('減碼')?'color:#ef4444':rec.includes('觀望')?'color:#f59e0b':'color:#6b7280';

      return '<div class="wl-card"><div class="wl-header"><div><div class="wl-ticker">'+q.ticker+(m.group?' <span class="wl-group-tag">'+m.group+'</span>':'')+'</div><div class="wl-name">'+q.name+'</div></div><div style="text-align:right"><div class="wl-current" style="color:'+udC(q.change)+'">'+fmtP(q.price)+'</div><div class="wl-change" style="color:'+udC(q.change)+'">'+udA(q.change)+' '+fmtPct(q.changePercent)+'</div></div></div>'+
        (m.note?'<div class="wl-note"><div class="wl-note-text">📝 '+m.note+'</div><button class="wl-btn note" style="padding:2px 8px;font-size:10px" onclick="setWatchlistNote(\''+q.ticker+'\')">✏️</button></div>':'')+
        (alerts.length?'<div class="wl-alerts">'+alerts.map((al,i)=>{const ai=priceAlerts.indexOf(al);return '<span class="wl-alert-tag '+(al.type==='above'?'above':'below')+'" onclick="removeAlert('+ai+')" title="點擊移除">'+(al.type==='above'?'🔔↑':'📉↓')+' $'+al.price.toFixed(2)+'</span>'}).join('')+'</div>':'')+
        (rec?'<div style="margin-top:8px;font-size:12px"><span style="font-weight:600">建議：</span><span style="'+recC+'">'+rec+'</span>'+(a?.date?'<span style="color:#6b7280;font-size:11px;margin-left:6px">'+new Date(a.date).toLocaleDateString()+'</span>':'')+'</div>':'')+
        '<div class="wl-actions"><button class="wl-btn analyze" onclick="quickAnalyze(\''+q.ticker+'\')">🎯 分析</button><button class="wl-btn buy" onclick="showBuyDialogFor(\''+q.ticker+'\','+q.price+')">📈 買入</button><button class="wl-btn alert" onclick="setWatchlistAlert(\''+q.ticker+'\','+q.price+')">🔔 提醒</button><button class="wl-btn note" onclick="setWatchlistNote(\''+q.ticker+'\')">📝 備註</button><button class="wl-btn remove" onclick="removeFromWatchlist(\''+q.ticker+'\')">✕ 移除</button></div></div>'
    }).join('');
    if(!quotes.length)container.innerHTML='<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">此分組無股票</div></div>'
  }catch(e){container.innerHTML='<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">載入失敗：'+e.message+'</div></div>'}
}

function removeFromWatchlist(t){watchlist=watchlist.filter(x=>x!==t);saveLS('stock_watchlist',watchlist);renderWatchlist();showToast('已移除 '+t)}
function quickAnalyze(t){tickerInput.value=t;showPage('home');analyze()}
function showBuyDialogFor(t,p){showBuyDialog(t,p)}

// 進度條
function showProgressBar(txt){let bar=$('progressBar');if(!bar){bar=document.createElement('div');bar.id='progressBar';bar.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(90deg,#00C853,#4ADE80);padding:12px;color:#fff;font-size:14px;text-align:center';document.body.appendChild(bar)}bar.innerHTML='<div style="background:rgba(255,255,255,0.3);border-radius:4px;height:6px"><div id="progressFill" style="background:#fff;height:6px;border-radius:4px;width:0%;transition:width 0.3s"></div></div><div style="margin-top:8px">'+txt+'</div>';bar.style.display='block'}
function updateProgressBar(txt,pct){const b=$('progressBar'),f=$('progressFill');if(b)b.querySelector('div:last-child').textContent=txt;if(f)f.style.width=(pct*100)+'%'}
function hideProgressBar(){const b=$('progressBar');if(b)setTimeout(()=>b.style.display='none',500)}

async function batchAnalyzeWatchlist(){
  if(!watchlist.length){showToast('自選列表為空');return}
  showProgressBar('分析中... (0/'+watchlist.length+')');let c=0;
  for(const t of watchlist){
    try{
      const r=await fetch('api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticker:t,type:'signal'})});
      const d=await r.json();
      if(d.success){
        let rec='';const m1=d.content.match(/\*\*最終建議：?\*\* (.*?)(?:\n|$)/);if(m1)rec=m1[1].trim();
        if(!rec){const m2=d.content.match(/\*\*當前建議：?\*\* (.*?)(?:\n|$)/);if(m2)rec=m2[1].trim()}
        watchlistAnalysis[t]={recommendation:rec,date:Date.now(),type:'signal',content:d.content};saveLS('stock_watchlist_analysis',watchlistAnalysis)
      }
    }catch(e){console.error(t+' 分析失敗',e)}
    c++;updateProgressBar('分析中... ('+c+'/'+watchlist.length+')',c/watchlist.length)
  }
  hideProgressBar();showToast('✅ 批量分析完成！');renderWatchlist()
}
