// StockAI Enhanced - Part 3: Portfolio (持倉)

// 買入對話框
function showBuyDialog(tickerPreset,pricePreset){
  const t=tickerPreset||'',p=pricePreset||0;
  showModal('<div class="modal-title">📈 模擬買入</div><div class="modal-info">可用現金: '+fmtP(cash)+'</div><div class="modal-label">股票代碼</div><input class="modal-input" id="buyTicker" value="'+t+'" placeholder="AAPL" style="text-transform:uppercase"><div class="modal-label">買入價格</div><input class="modal-input" type="number" id="buyPrice" step="0.01" value="'+(p?p.toFixed(2):'')+'" placeholder="0.00"><div class="modal-label">買入股數</div><input class="modal-input" type="number" id="buyShares" min="1" value="1" placeholder="1" oninput="updateBuyCost()"><div class="modal-cost" id="buyCostEst">預估花費: $0.00 | 餘額: '+fmtP(cash)+'</div><div class="modal-label">止損價（選填）</div><input class="modal-input" type="number" id="buySL" step="0.01" placeholder="止損價"><div class="modal-label">止盈價（選填）</div><input class="modal-input" type="number" id="buyTP" step="0.01" placeholder="止盈價"><div class="modal-btn-row"><button class="modal-btn cancel" onclick="closeModal()">取消</button><button class="modal-btn primary" onclick="doBuy()">確認買入</button></div>')
}
function updateBuyCost(){
  const shares=parseInt($('buyShares').value)||0,price=parseFloat($('buyPrice').value)||0;
  const total=shares*price;const el=$('buyCostEst');
  if(el){el.textContent='預估花費: '+fmtP(total)+' | 餘額: '+fmtP(cash-total);el.style.color=total>cash?'#ef4444':''}
}
function doBuy(){
  const t=$('buyTicker').value.trim().toUpperCase(),p=parseFloat($('buyPrice').value),s=parseInt($('buyShares').value);
  const sl=parseFloat($('buySL').value)||0,tp=parseFloat($('buyTP').value)||0;
  if(!t||!p||!s||s<=0||p<=0){showToast('請填寫完整買入資訊');return}
  const cost=s*p;if(cost>cash){showToast('現金不足！需要 '+fmtP(cost)+'，只有 '+fmtP(cash));return}
  cash-=cost;localStorage.setItem('stock_cash',cash.toString());
  const exist=portfolio.find(x=>x.ticker===t);
  if(exist){const ts=exist.shares+s;const tc=exist.shares*exist.buyPrice+s*p;exist.shares=ts;exist.buyPrice=tc/ts;exist.transactions=exist.transactions||[];exist.transactions.push({type:'buy',shares:s,price:p,date:Date.now()})}
  else{portfolio.push({ticker:t,shares:s,buyPrice:p,date:Date.now(),transactions:[{type:'buy',shares:s,price:p,date:Date.now()}]})}
  if(!portfolioMeta[t])portfolioMeta[t]={};if(sl)portfolioMeta[t].stopLoss=sl;if(tp)portfolioMeta[t].takeProfit=tp;
  saveLS('stock_portfolio',portfolio);saveLS('stock_portfolio_meta',portfolioMeta);
  transactions.push({type:'buy',ticker:t,shares:s,price:p,cost,date:Date.now()});saveLS('stock_transactions',transactions);
  closeModal();renderPortfolio();showToast('✅ 已買入 '+t+' '+s+' 股 @ '+fmtP(p))
}

// 加碼
function showAddPositionDialog(t,cp){
  const h=portfolio.find(x=>x.ticker===t);if(!h)return;
  showModal('<div class="modal-title">📈 加碼 '+t+'</div><div class="modal-info">持有: '+h.shares+'股 @ '+fmtP(h.buyPrice)+' | 可用現金: '+fmtP(cash)+'</div><div class="modal-label">買入價格</div><input class="modal-input" type="number" id="addPrice" step="0.01" value="'+cp.toFixed(2)+'"><div class="modal-label">加碼股數</div><input class="modal-input" type="number" id="addShares" min="1" value="1" oninput="updateAddCost()"><div class="modal-cost" id="addCostEst">預估花費: '+fmtP(cp)+'</div><div class="modal-btn-row"><button class="modal-btn cancel" onclick="closeModal()">取消</button><button class="modal-btn primary" onclick="doAddPosition(\''+t+'\')">確認加碼</button></div>')
}
function updateAddCost(){const s=parseInt($('addShares').value)||0,p=parseFloat($('addPrice').value)||0;const el=$('addCostEst');if(el)el.textContent='預估花費: '+fmtP(s*p)+' | 餘額: '+fmtP(cash-s*p)}
function doAddPosition(t){
  const p=parseFloat($('addPrice').value),s=parseInt($('addShares').value);
  if(!p||!s||s<=0){showToast('請填寫有效資訊');return}
  const cost=s*p;if(cost>cash){showToast('現金不足');return}
  cash-=cost;localStorage.setItem('stock_cash',cash.toString());
  const h=portfolio.find(x=>x.ticker===t);if(!h)return;
  const ts=h.shares+s;const tc=h.shares*h.buyPrice+s*p;h.shares=ts;h.buyPrice=tc/ts;
  h.transactions=h.transactions||[];h.transactions.push({type:'buy',shares:s,price:p,date:Date.now()});
  transactions.push({type:'buy',ticker:t,shares:s,price:p,cost,date:Date.now()});
  saveLS('stock_portfolio',portfolio);saveLS('stock_transactions',transactions);
  closeModal();renderPortfolio();showToast('✅ 已加碼 '+t+' '+s+' 股 @ '+fmtP(p))
}

// 賣出
function showSellDialog(t,shares,cp){
  const h=portfolio.find(x=>x.ticker===t);if(!h)return;
  const sl=portfolioMeta[t]?.stopLoss||0,tp=portfolioMeta[t]?.takeProfit||0;
  showModal('<div class="modal-title">📉 賣出 '+t+'</div><div class="modal-info">持有: '+h.shares+'股 | 成本均價: '+fmtP(h.buyPrice)+' | 當前: '+fmtP(cp)+'</div><div class="modal-label">賣出股數（最多 '+h.shares+'）</div><input class="modal-input" type="number" id="sellShares" min="1" max="'+h.shares+'" value="'+h.shares+'" oninput="updateSellRev()"><div class="modal-cost" id="sellRevEst">預估收入: '+fmtP(h.shares*cp)+'</div>'+(sl?'<div style="font-size:12px;color:#ef4444;margin-bottom:8px">🛑 止損價: '+fmtP(sl)+(cp<=sl?' ⚠️ 已觸及止損！':'')+'</div>':'')+(tp?'<div style="font-size:12px;color:#22c55e;margin-bottom:8px">🎯 止盈價: '+fmtP(tp)+(cp>=tp?' ⚠️ 已觸及止盈！':'')+'</div>':'')+'<div class="modal-btn-row"><button class="modal-btn cancel" onclick="closeModal()">取消</button><button class="modal-btn danger" onclick="doSell(\''+t+'\')">確認賣出</button></div>')
}
function updateSellRev(){const s=parseInt($('sellShares').value)||0;const h=portfolio.find(x=>x.ticker===currentTicker);const el=$('sellRevEst');if(el)el.textContent='預估收入: '+fmtP(s*parseFloat($('sellDialogPrice')?.textContent?.replace('$','')||0))}
function doSell(t){
  const s=parseInt($('sellShares').value);const h=portfolio.find(x=>x.ticker===t);if(!h||s<=0||s>h.shares){showToast('無效股數');return}
  // 獲取當前價格
  fetch('api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticker:t})}).then(r=>r.json()).then(q=>{
    if(!q.success){showToast('無法獲取價格');return}
    const cp=q.price;const rev=s*cp;const profit=(cp-h.buyPrice)*s;
    h.shares-=s;if(h.shares<=0)portfolio=portfolio.filter(x=>x.ticker!==t);
    h.transactions=h.transactions||[];h.transactions.push({type:'sell',shares:s,price:cp,date:Date.now()});
    cash+=rev;localStorage.setItem('stock_cash',cash.toString());
    transactions.push({type:'sell',ticker:t,shares:s,price:cp,revenue:rev,profit,date:Date.now()});
    saveLS('stock_portfolio',portfolio);saveLS('stock_transactions',transactions);
    closeModal();renderPortfolio();
    showToast('✅ 已賣出 '+t+' '+s+' 股 @ '+fmtP(cp)+'，'+(profit>=0?'賺':'虧')+' '+fmtP(Math.abs(profit)))
  })
}

// 止損止盈設置
function showSLTPDialog(t,cp){
  const m=portfolioMeta[t]||{};
  showModal('<div class="modal-title">🛑🎯 '+t+' 止損止盈</div><div class="modal-info">當前價格: '+fmtP(cp)+'</div><div class="modal-label">止損價（跌破自動提醒）</div><input class="modal-input" type="number" id="slInput" step="0.01" value="'+(m.stopLoss||'')+'" placeholder="設置止損價"><div class="modal-label">止盈價（漲破自動提醒）</div><input class="modal-input" type="number" id="tpInput" step="0.01" value="'+(m.takeProfit||'')+'" placeholder="設置止盈價"><div class="modal-btn-row"><button class="modal-btn cancel" onclick="closeModal()">取消</button><button class="modal-btn primary" onclick="saveSLTP(\''+t+'\')">儲存</button></div>')
}
function saveSLTP(t){
  if(!portfolioMeta[t])portfolioMeta[t]={};
  portfolioMeta[t].stopLoss=parseFloat($('slInput').value)||0;
  portfolioMeta[t].takeProfit=parseFloat($('tpInput').value)||0;
  saveLS('stock_portfolio_meta',portfolioMeta);closeModal();renderPortfolio();showToast('止損止盈已更新')
}

// 交易記錄面板
function toggleTxPanel(){
  const p=$('txPanel'),o=$('txOverlay');
  const isOpen=p.classList.contains('open');
  p.classList.toggle('open');o.classList.toggle('open');
  if(!isOpen)renderTxPanel()
}
function renderTxPanel(){
  const body=$('txPanelBody');transactions=JSON.parse(localStorage.getItem('stock_transactions')||'[]');
  if(!transactions.length){body.innerHTML='<div class="empty" style="padding:40px 20px"><div class="empty-icon">📋</div><div class="empty-text">尚無交易記錄</div></div>';return}
  body.innerHTML=transactions.slice().reverse().map(tx=>{
    const isBuy=tx.type==='buy';
    return '<div class="tx-item"><span class="tx-type '+(isBuy?'buy':'sell')+'">'+(isBuy?'買入':'賣出')+'</span><div class="tx-info"><div class="tx-ticker">'+tx.ticker+'</div><div class="tx-detail">'+tx.shares+'股 @ '+fmtP(tx.price)+' | '+fmtD(tx.date)+'</div></div><div class="tx-amount" style="color:'+(isBuy?'#ef4444':'#22c55e')+'">'+(isBuy?'-':'+')+fmtP(isBuy?tx.cost:tx.revenue)+'</div></div>'
  }).join('')
}

// AI組合分析（基於即時報價計算市值佔比）
async function analyzePortfolioAll(){
  portfolio=JSON.parse(localStorage.getItem('stock_portfolio')||'[]');
  if(!portfolio.length){showToast('尚無持倉');return}
  const list=$('portfolioList');
  list.innerHTML+='<div class="loading show" id="pfAILoading"><div class="spinner"></div><div style="text-align:center;padding:16px;color:var(--text-secondary)">🤖 AI 正在獲取即時報價並分析持倉...</div></div>';
  try{
    const tickers=portfolio.map(p=>p.ticker);
    // 獲取即時報價
    const qr=await fetch('api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tickers})});
    const qd=await qr.json();
    let quotes={};if(qd.success&&qd.quotes){const qArr=Array.isArray(qd.quotes)?qd.quotes:qd.quotes;qArr.forEach(q=>{if(q.success)quotes[q.ticker]=q});}
    let totalValue=0,totalCost=0;
    const details=portfolio.map(p=>{
      const cp=quotes[p.ticker]?.price||p.buyPrice;
      const mv=p.shares*cp;
      const cost=p.shares*p.buyPrice;
      const pnl=mv-cost;
      const pnlPct=cost>0?(pnl/cost*100):0;
      totalValue+=mv;
      totalCost+=cost;
      return{t:p.ticker,sh:p.shares,bp:p.buyPrice,cp,mv,cost,pnl,pnlPct};
    });
    const totalPnL=totalValue-totalCost;
    const totalPnLPct=totalCost>0?(totalPnL/totalCost*100):0;
    // 構建基於市值佔比的明細
    let summary='持倉組合明細（基於即時報價，佔比以市值計算）：\n';
    summary+=`總本金：$${totalCost.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}\n`;
    summary+=`總市值：$${totalValue.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}\n`;
    summary+=`總損益：$${totalPnL.toFixed(2)} (${totalPnLPct>=0?'+':''}${totalPnLPct.toFixed(2)}%)\n\n`;
    summary+='| 股票 | 持股 | 成本均價 | 現價 | 本金 | 市值 | 佔比 | 損益金額 | 損益比例 |\n';
    summary+='|------|------|----------|------|------|------|------|----------|----------|\n';
    details.sort((a,b)=>b.mv-a.mv).forEach(d=>{
      const w=totalValue>0?(d.mv/totalValue*100):0;
      summary+=`| ${d.t} | ${d.sh}股 | $${d.bp.toFixed(2)} | $${d.cp.toFixed(2)} | $${d.cost.toFixed(2)} | $${d.mv.toFixed(2)} | ${w.toFixed(1)}% | $${d.pnl.toFixed(2)} | ${d.pnlPct>=0?'+':''}${d.pnlPct.toFixed(2)}% |\n`;
    });
    summary+='\n請基於以上**真實市值佔比數據**進行分析，重點關注：\n';
    summary+='1. 個股佔比是否合理（單股>30%屬過度集中）\n';
    summary+='2. 行業集中度風險\n';
    summary+='3. 具體加倉/減倉/提倉建議（請引用實際佔比數字）\n';
    summary+='4. 是否需要新增新的個股標的以分散風險\n';
    summary+='5. 組合整體風險評估和優化方向\n';
    summary+='6. 請在最後提供一段總結，明確指出每支個股的加倉/減倉/提倉/新增建議';
    const r=await fetch('api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticker:tickers.join(','),type:'portfolio',question:summary})});
    const d=await r.json();
    const ld=$('pfAILoading');if(ld)ld.remove();
    if(d.success){
      list.innerHTML='<div class="result-card" style="border-left:4px solid var(--accent)"><div class="result-title">🤖 AI 持倉組合分析</div><div class="result-content markdown-body">'+renderMarkdown(d.content)+'</div></div>'+list.innerHTML
    }else{showToast('分析失敗：'+(d.error||'未知'))}
  }catch(e){const ld=$('pfAILoading');if(ld)ld.remove();showToast('AI 分析服務暫時不可用')}
}

// 持倉頁渲染（增強版）
async function renderPortfolio(){
  portfolio=JSON.parse(localStorage.getItem('stock_portfolio')||'[]');
  portfolioMeta=JSON.parse(localStorage.getItem('stock_portfolio_meta')||'{}');
  portfolioAnalysis=JSON.parse(localStorage.getItem('stock_portfolio_analysis')||'{}');
  cash=parseFloat(localStorage.getItem('stock_cash')||totalCash);
  const summaryEl=$('pfSummary'),listEl=$('portfolioList');

  if(!portfolio.length){
    summaryEl.innerHTML='<div class="pf-summary-grid"><div class="pf-stat"><div class="pf-stat-label">總資產</div><div class="pf-stat-value">'+fmtP(cash)+'</div></div><div class="pf-stat"><div class="pf-stat-label">持倉市值</div><div class="pf-stat-value">$0.00</div></div><div class="pf-stat"><div class="pf-stat-label">可用現金</div><div class="pf-stat-value">'+fmtP(cash)+'</div></div><div class="pf-stat"><div class="pf-stat-label">總損益</div><div class="pf-stat-value">$0.00</div></div></div>';
    listEl.innerHTML='<div class="empty"><div class="empty-icon">💼</div><div class="empty-text">尚無持倉，點擊「買入股票」開始模擬投資</div></div>';
    return
  }

  listEl.innerHTML='<div class="loading show"><div class="spinner"></div></div>';
  try{
    const tickers=portfolio.map(p=>p.ticker);let quotes={};
    if(tickers.length){
      const r=await fetch('api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tickers})});
      const d=await r.json();d.quotes?.forEach(q=>{if(q.success)quotes[q.ticker]=q})
    }

    let totalCost=0,totalValue=0;
    portfolio.forEach(p=>{totalCost+=p.shares*p.buyPrice;totalValue+=p.shares*(quotes[p.ticker]?.price||p.buyPrice)});
    const totalAssets=totalValue+cash;
    const totalPnL=totalValue-totalCost;
    const totalPnLPct=totalCost>0?(totalPnL/totalCost*100):0;

    // 資金概覽
    summaryEl.innerHTML='<div class="pf-summary-grid">'+
      '<div class="pf-stat"><div class="pf-stat-label">總資產</div><div class="pf-stat-value">'+fmtP(totalAssets)+'</div></div>'+
      '<div class="pf-stat"><div class="pf-stat-label">持倉市值</div><div class="pf-stat-value">'+fmtP(totalValue)+'</div></div>'+
      '<div class="pf-stat"><div class="pf-stat-label">可用現金</div><div class="pf-stat-value">'+fmtP(cash)+'</div></div>'+
      '<div class="pf-stat"><div class="pf-stat-label">總損益</div><div class="pf-stat-value '+(totalPnL>=0?'up':'down')+'">'+fmtPct(totalPnLPct)+' ('+fmtP(totalPnL)+')</div></div>'+
      '</div>'+
      // 持倉佔比
      '<div class="pf-alloc"><div style="font-size:12px;opacity:0.7;margin-bottom:8px">持倉佔比</div>'+
      portfolio.map(p=>{
        const v=p.shares*(quotes[p.ticker]?.price||p.buyPrice);
        const pct=totalValue>0?(v/totalValue*100):0;
        const colors=['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4'];
        const ci=portfolio.indexOf(p)%colors.length;
        return '<div class="pf-alloc-item"><span style="width:50px">'+p.ticker+'</span><div class="pf-alloc-bar"><div class="pf-alloc-fill" style="width:'+pct+'%;background:'+colors[ci]+'"></div></div><span class="pf-alloc-pct">'+pct.toFixed(1)+'%</span></div>'
      }).join('')+
      (cash>0?'<div class="pf-alloc-item"><span style="width:50px">現金</span><div class="pf-alloc-bar"><div class="pf-alloc-fill" style="width:'+(totalAssets>0?cash/totalAssets*100:0)+'%;background:#9ca3af"></div></div><span class="pf-alloc-pct">'+(totalAssets>0?cash/totalAssets*100:0).toFixed(1)+'%</span></div>':'')+
      '</div>';

// 健康度計算（基於市值佔比，不含現金）
let healthScore=3;
const maxRatio=portfolio.length?Math.max(...portfolio.map(p=>{const v=p.shares*(quotes[p.ticker]?.price||p.buyPrice);return v/totalValue})):0;
if(maxRatio<0.2)healthScore++;
if(maxRatio<0.3)healthScore++;
if(portfolio.every(p=>portfolioMeta[p.ticker]?.stopLoss))healthScore++;
if(portfolio.length>=3)healthScore--;
if(healthScore>5)healthScore=5;
if(healthScore<1)healthScore=1;
let healthDesc="";
if(healthScore>=5)healthDesc="🟢 組合極度均衡，分散風險表現優異，值得保持";
else if(healthScore>=4)healthDesc="🟢 組合分散良好，個股集中度可控，可繼續持有";
else if(healthScore>=3)healthDesc="🟡 組合適中，部分個股佔比偏高，建議關注集中度風險";
else if(healthScore>=2)healthDesc="🟠 組合偏集中，單一股位影響過大，建議適度減碼分散";
else healthDesc="🔴 組合高度集中，風險暴露顯著，強烈建議分散持倉";
summaryEl.innerHTML+='<div class="health-score" style="margin-top:12px;font-size:12px;opacity:.9">持倉健康度: '+'★'.repeat(healthScore)+'☆'.repeat(5-healthScore)+'<div style="margin-top:4px;font-size:11px;opacity:.8;line-height:1.4">'+healthDesc+'</div></div>';

    // 持倉卡片
    listEl.innerHTML=portfolio.map(p=>{
      const q=quotes[p.ticker];const cp=q?.price||p.buyPrice;
      const cost=p.shares*p.buyPrice;const value=p.shares*cp;
      const profit=value-cost;const profitPct=cost>0?(profit/cost*100):0;
      const ratio=totalValue>0?(value/totalValue*100):0;
      const up=profit>=0;
      const m=portfolioMeta[p.ticker]||{};
      const chg=q?.change||0;const chgPct=q?.changePercent||0;
      const dayUp=chg>=0;

      return '<div class="holding-card"><div class="holding-header"><div><div class="holding-ticker">'+p.ticker+(m.group?' <span class="wl-group-tag">'+m.group+'</span>':'')+'</div><div class="holding-name">'+(q?.name||'')+'</div></div><div style="text-align:right"><div class="holding-current" style="color:'+udC(chg)+'">'+fmtP(cp)+'</div><div class="holding-change" style="color:'+udC(chg)+'">'+udA(chg)+' '+fmtPct(chgPct)+'</div></div></div>'+
        '<div class="holding-details"><div><div class="holding-detail-label">持股數</div><div class="holding-detail-value">'+p.shares+'</div></div><div><div class="holding-detail-label">成本均價</div><div class="holding-detail-value">'+fmtP(p.buyPrice)+'</div></div><div><div class="holding-detail-label">持倉佔比</div><div class="holding-detail-value">'+ratio.toFixed(1)+'%</div></div><div><div class="holding-detail-label">成本總額</div><div class="holding-detail-value">'+fmtP(cost)+'</div></div><div><div class="holding-detail-label">市值</div><div class="holding-detail-value">'+fmtP(value)+'</div></div><div><div class="holding-detail-label">損益</div><div class="holding-detail-value holding-pnl" style="color:'+udC(profit)+'">'+(up?'+':'')+fmtP(profit)+' ('+fmtPct(profitPct)+')</div></div></div>'+
        (m.stopLoss?'<span class="sl-tp-tag sl-tag">🛑 SL '+fmtP(m.stopLoss)+(cp<=m.stopLoss?' ⚠️':'')+'</span>':'')+
        (m.takeProfit?'<span class="sl-tp-tag tp-tag">🎯 TP '+fmtP(m.takeProfit)+(cp>=m.takeProfit?' ⚠️':'')+'</span>':'')+
        '<div class="holding-actions"><button class="h-btn analyze" onclick="quickAnalyze(\''+p.ticker+'\')">🎯 分析</button><button class="h-btn buy" onclick="showAddPositionDialog(\''+p.ticker+'\','+cp+')">📈 加碼</button><button class="h-btn sell" onclick="showSellDialog(\''+p.ticker+'\','+p.shares+','+cp+')">📉 賣出</button><button class="h-btn alert" onclick="setWatchlistAlert(\''+p.ticker+'\','+cp+')">🔔 提醒</button><button class="h-btn" onclick="showSLTPDialog(\''+p.ticker+'\','+cp+')">🛑🎯 止損止盈</button></div></div>'
    }).join('')
  }catch(e){listEl.innerHTML='<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">載入失敗：'+e.message+'</div></div>'}
}
