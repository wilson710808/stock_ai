/**
 * 美股 AI 投顧助手 - 後端服務
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

// 配置
const config = {
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: process.env.OPENAI_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  model: process.env.OPENAI_MODEL || 'meta/llama-3.1-405b-instruct',
  alphaVantageKey: process.env.ALPHA_VANTAGE_KEY || 'demo'
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// K 線 API（使用 Python Yahoo Finance 爬虫）
app.get('/api/chart/:ticker', async (req, res) => {
  const ticker = req.params.ticker?.toUpperCase();
  if (!ticker) return res.status(400).json({ error: '請提供股票代碼' });
  
  // 使用 Python 爬虫获取 K 线
  const result = await new Promise((resolve) => {
    const python = spawn('python3', [path.join(__dirname, 'realtime_price.py'), ticker, '--kline']);
    let data = '';
    
    python.stdout.on('data', (chunk) => { data += chunk; });
    python.stderr.on('data', (chunk) => { console.error('K线爬虫错误:', chunk.toString()); });
    python.on('close', (code) => {
      if (code === 0 && data) {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ success: false, error: '解析失败' });
        }
      } else {
        resolve({ success: false, error: '爬虫执行失败' });
      }
    });
  });
  
  res.json(result);
});

// 嘗試使用 Alpha Vantage API
async function fetchAlphaVantage(ticker) {
  if (!config.alphaVantageKey || config.alphaVantageKey === 'demo') {
    return null; // 使用備用數據
  }
  
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${config.alphaVantageKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data['Global Quote'] && data['Global Quote']['05. price']) {
      const q = data['Global Quote'];
      return {
        ticker: q['01. symbol'],
        price: parseFloat(q['05. price']),
        change: parseFloat(q['09. change']),
        changePercent: parseFloat(q['10. change percent']?.replace('%', '') || 0),
        prevClose: parseFloat(q['08. previous close']),
        open: parseFloat(q['02. open']),
        high: parseFloat(q['03. high']),
        low: parseFloat(q['04. low']),
        volume: parseInt(q['06. volume']),
        timestamp: new Date().toISOString(),
        source: 'alphavantage',
        note: '實時數據 (Alpha Vantage)'
      };
    }
    return null;
  } catch (e) {
    console.error('Alpha Vantage error:', e.message);
    return null;
  }
}

// 系統提示
const SYSTEM_PROMPT = `你是巴菲特/芒格價值投資法的專業分析師，請用繁體中文回答。

**核心分析框架（巴菲特/芒格）：**

## 一、經濟護城河（最重要的分析）

### 護城河5種類型：
1. **無形資產** - 品牌、專利、執照
2. **成本優勢** - 規模經濟、獨特位置
3. **網絡效應** - 用戶越多價值越高
4. **高轉換成本** - 客戶更換代價高
5. **高效率規模** - 細分市場領導者

### 護城河評級標準：
- 寬護城河 - 5-10年持續優勢
- 窄護城河 - 具有一定優勢
- 一般 - 正面臨競爭
- 無護城河 - 高度競爭

## 二、財務關鍵指標（巴菲特最重視）

| 指標 | 巴菲特標準 | 重要性 |
|------|-----------|--------|
| ROE | >15% | 最高 |
| 毛利率 | >40% | 最高 |
| 自由現金流 | 正數且穩定 | 最高 |
| 負債率 | <50% | 高 |
| 利息覆蓋率 | >5x | 高 |
| ROIC | >12% | 高 |

## 三、安全邊際計算

目標：安全邊際 > 30%
股價低於內在價值的30%以上買入

## 四、管理層評估（芒格強調）

1. **誠信** - 財務報表真實性
2. **能力** - 資本配置決策
3. **股東導向** - 回購、分紅政策
4. **戰略眼光** - 長期規劃

## 五、能力圈判斷

- 能用一句話解釋商業模式嗎？
- 了解行業未來5-10年趨勢嗎？

## 六、買入/賣出決策標準

### 買入條件：
- [ ] 寬或窄護城河
- [ ] ROE > 15%
- [ ] 自由現金流為正
- [ ] 安全邊際 > 30%

### 賣出條件：
- [ ] 基本面嚴重惡化
- [ ] 價格嚴重高估
- [ ] 護城河消失

**嚴格格式要求：**
1. 每個標題 ## 格式，前後空一行
2. 數據用表格，表格前後空一行
3. 每段不超過2行
4. 重點用符號標注
5. 結論用粗體
6. 分隔線 ---

**免責聲明：** 本分析基於公開信息，僅供參考，不構成投資建議。`;

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasAPI: !!config.apiKey, model: config.model });
});

// 嘗試獲取實時股價（Python 爬蟲）
function getStockPricePython(ticker) {
  return new Promise((resolve) => {
    // 使用新的多数据源爬虫
    const python = spawn('python3', [path.join(__dirname, 'realtime_price.py'), ticker]);
    let data = '';
    let error = '';

    python.stdout.on('data', (chunk) => { data += chunk; });
    python.stderr.on('data', (chunk) => { error += chunk; });
    python.on('close', (code) => {
      if (code === 0 && data) {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
    
    // 10秒超時
    setTimeout(() => {
      python.kill();
      resolve(null);
    }, 10000);
  });
}

// 模擬股價數據（備用）
const stockData = {
  'AAPL': { name: 'Apple Inc.', price: 254.50, change: 3.25, changePercent: 1.29, prevClose: 251.25, high: 255.80, low: 251.00, volume: 42300000, pe: 28.5, eps: 8.93, marketCap: 3850000000000, week52High: 260.10, week52Low: 164.08 },
  'MSFT': { name: 'Microsoft Corp.', price: 425.80, change: -2.15, changePercent: -0.50, prevClose: 427.95, high: 428.50, low: 423.20, volume: 18500000, pe: 35.2, eps: 12.10, marketCap: 3160000000000, week52High: 430.82, week52Low: 309.45 },
  'GOOGL': { name: 'Alphabet Inc.', price: 178.90, change: 1.45, changePercent: 0.82, prevClose: 177.45, high: 180.20, low: 176.80, volume: 22100000, pe: 24.8, eps: 7.21, marketCap: 2200000000000, week52High: 191.75, week52Low: 121.46 },
  'AMZN': { name: 'Amazon.com Inc.', price: 228.50, change: 4.80, changePercent: 2.15, prevClose: 223.70, high: 230.00, low: 224.50, volume: 35200000, pe: 45.6, eps: 5.01, marketCap: 2370000000000, week52High: 238.39, week52Low: 144.05 },
  'NVDA': { name: 'NVIDIA Corp.', price: 175.24, change: -3.50, changePercent: -1.96, prevClose: 178.74, high: 180.50, low: 174.20, volume: 45000000, pe: 65.2, eps: 2.69, marketCap: 4320000000000, week52High: 184.88, week52Low: 47.32 },
  'META': { name: 'Meta Platforms Inc.', price: 512.30, change: 8.90, changePercent: 1.77, prevClose: 503.40, high: 515.60, low: 501.20, volume: 15800000, pe: 32.1, eps: 15.95, marketCap: 1310000000000, week52High: 542.81, week52Low: 274.38 },
  'TSLA': { name: 'Tesla Inc.', price: 175.80, change: -5.20, changePercent: -2.87, prevClose: 181.00, high: 182.50, low: 174.20, volume: 89500000, pe: 52.3, eps: 3.36, marketCap: 560000000000, week52High: 299.29, week52Low: 138.80 },
  'AMD': { name: 'AMD Inc.', price: 158.40, change: 2.30, changePercent: 1.47, prevClose: 156.10, high: 160.50, low: 155.80, volume: 45600000, pe: 285.6, eps: 0.55, marketCap: 256000000000, week52High: 164.46, week52Low: 93.12 },
  'NFLX': { name: 'Netflix Inc.', price: 628.90, change: 12.50, changePercent: 2.03, prevClose: 616.40, high: 632.00, low: 615.50, volume: 5200000, pe: 45.2, eps: 13.91, marketCap: 273000000000, week52High: 639.00, week52Low: 344.73 },
  'BRK.B': { name: 'Berkshire Hathaway', price: 458.20, change: 1.80, changePercent: 0.39, prevClose: 456.40, high: 460.50, low: 455.80, volume: 2800000, pe: 9.2, eps: 49.80, marketCap: 780000000000, week52High: 468.00, week52Low: 362.59 },
  'JPM': { name: 'JPMorgan Chase', price: 248.50, change: 3.20, changePercent: 1.30, prevClose: 245.30, high: 250.00, low: 245.50, volume: 8200000, pe: 11.8, eps: 21.05, marketCap: 715000000000, week52High: 253.94, week52Low: 170.10 },
  'V': { name: 'Visa Inc.', price: 312.40, change: -1.10, changePercent: -0.35, prevClose: 313.50, high: 314.80, low: 311.20, volume: 6100000, pe: 30.5, eps: 10.24, marketCap: 645000000000, week52High: 318.71, week52Low: 227.68 }
};

// 報價 API
app.post('/api/quote', async (req, res) => {
  const { ticker } = req.body;
  if (!ticker) return res.status(400).json({ error: '請提供股票代碼' });
  
  const t = ticker.trim().toUpperCase();
  
  // Step 1: 嘗試 Python 爬蟲（優先 - Yahoo Finance 實時數據）
  const pythonResult = await getStockPricePython(t);
  if (pythonResult && pythonResult.price && !pythonResult.error) {
    return res.json({ success: true, ...pythonResult });
  }
  
  // Step 2: 嘗試 Alpha Vantage（備用）
  const alphaResult = await fetchAlphaVantage(t);
  if (alphaResult && alphaResult.price) {
    return res.json({ success: true, ...alphaResult });
  }
  
  // Step 3: 使用模擬數據
  const data = stockData[t];
  if (data) {
    return res.json({
      success: true,
      ticker: t,
      name: data.name,
      price: data.price,
      change: data.change,
      changePercent: data.changePercent,
      prevClose: data.prevClose,
      open: data.price - data.change,
      high: data.high,
      low: data.low,
      volume: data.volume,
      peRatio: data.pe,
      eps: data.eps,
      marketCap: data.marketCap,
      fiftyTwoWeekHigh: data.week52High,
      fiftyTwoWeekLow: data.week52Low,
      timestamp: Date.now(),
      source: 'demo',
      note: '模擬數據（建議配置 Alpha Vantage API）'
    });
  }
  
  return res.json({ success: false, error: `股票代碼 ${t} 不存在` });
});

// 批量報價
app.post('/api/quotes', async (req, res) => {
  const { tickers } = req.body;
  if (!tickers || !Array.isArray(tickers)) {
    return res.status(400).json({ error: '請提供股票代碼列表' });
  }
  
  const results = [];
  for (const t of tickers) {
    const data = stockData[t.toUpperCase()];
    if (data) {
      results.push({
        success: true,
        ticker: t.toUpperCase(),
        name: data.name,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        prevClose: data.prevClose,
        volume: data.volume,
        peRatio: data.pe,
        source: 'demo'
      });
    } else {
      results.push({ success: false, ticker: t, error: '不存在' });
    }
  }
  
  res.json({ success: true, quotes: results });
});

// 分析 API
app.post('/api/analyze', async (req, res) => {
  const { ticker, question, type } = req.body;
  if (!ticker && !question) {
    return res.status(400).json({ error: '請提供股票代碼或問題' });
  }
  if (!config.apiKey) {
    return res.status(503).json({ error: '未配置 API Key' });
  }

  const prompts = {
    overview: `
請對 ${ticker} 進行巴菲特/芒格價值投資分析，格式如下：

## 🏰 經濟護城河分析

| 護城河類型 | 存在與否 | 說明 |
|------------|----------|------|
| 品牌價值 | ✅/❌ | ... |
| 成本優勢 | ✅/❌ | ... |
| 網絡效應 | ✅/❌ | ... |
| 轉換成本 | ✅/❌ | ... |

**護城河評級：** 寬闊 / 狹窄 / 無

---

## 💰 財務健康度（巴菲特標準）

| 指標 | 數值 | 標準 | 評價 |
|------|------|------|------|
| ROE | XX% | >15% | ✅/❌ |
| 毛利率 | XX% | >40% | ✅/❌ |
| 自由現金流 | $XX | 正數 | ✅/❌ |
| 負債率 | XX% | <50% | ✅/❌ |
| 利息覆蓋率 | XXx | >5x | ✅/❌ |

---

## 📊 估值與安全邊際

| 指標 | 數值 | 評價 |
|------|------|------|
| P/E | XX | ... |
| PEG | XX | ... |
| 內在價值估算 | $XXX | ... |
| 當前價格 | $XXX | ... |
| **安全邊際** | XX% | >30% ✅/❌ |

---

## 👔 管理層評估

- **誠信度：** 高/中/低
- **資本配置：** 優秀/良好/一般
- **股東導向：** ✅/❌

---

## ⚠️ 風險提示

1. 護城河風險
2. 估值風險
3. 行業風險

---

## 🎯 投資結論（巴菲特標準）

**能力圈判斷：** 是否在理解範圍內

**護城河：** 寬闊 / 狹窄 / 無

**安全邊際：** 充足 / 不足

**最終建議：** 🟢 買入 / 🟡 觀望 / 🔴 不符合標準

**理由：** XXX

---

**免責聲明：** 本分析基於巴菲特/芒格價值投資理念，僅供參考，投資者應自行判斷。
`,

    technical: `
請對 ${ticker} 進行技術分析，格式如下：

## 📈 趨勢判斷
- 日線趨勢：上漲 / 震盪 / 下跌
- 週線趨勢：上漲 / 震盪 / 下跌

## 📍 關鍵位置
| 類型 | 價格 | 說明 |
|------|------|------|
| 壓力位 1 | $XXX | ... |
| 壓力位 2 | $XXX | ... |
| 支撐位 1 | $XXX | ... |
| 支撐位 2 | $XXX | ... |

## 📊 技術指標
| 指標 | 數值 | 信號 |
|------|------|------|
| RSI | XX | 超買/超賣/中性 |
| MACD | ... | 金叉/死叉 |
| 均線 | ... | 多頭/空頭排列 |

## 🎯 操作建議
- **短線：** XXX
- **中線：** XXX
- **停損點：** $XXX
`,

    fundamental: `
請對 ${ticker} 進行基本面分析，格式如下：

## 🏢 商業模式
- 核心產品/服務
- 營收來源結構

## 💰 財務健康度
| 指標 | 數值 | 評分 |
|------|------|------|
| 營收增長率 | XX% | ⭐⭐⭐⭐⭐ |
| 淨利率 | XX% | ⭐⭐⭐⭐⭐ |
| 負債率 | XX% | ⭐⭐⭐⭐⭐ |
| 現金流 | XXX | ⭐⭐⭐⭐⭐ |

## 📊 成長性分析
- 過去3年複合成長率
- 未來預期成長
- 成長驅動因素

## 💎 估值合理性
- P/E ratio vs 行業平均
- PEG ratio
- 是否被低估/高估

## ✅ 投資結論
**長期投資價值：** ⭐⭐⭐⭐⭐ (5星制)
**建議：** XXX
`,

    risk: `
請對 ${ticker} 進行風險評估，格式如下：

## ⚠️ 風險評估報告

### 📊 風險評分
| 風險類型 | 評分 (1-10) | 說明 |
|----------|-------------|------|
| 估值風險 | X | ... |
| 業務風險 | X | ... |
| 競爭風險 | X | ... |
| 宏觀風險 | X | ... |
| **總評分** | **X** | ... |

### 🔴 主要風險點
1. **風險一：** XXX
   - 影響程度：高/中/低
   - 發生概率：高/中/低

2. **風險二：** XXX

### 🦢 黑天鵝風險
- 潛在黑天鵝事件
- 可能影響

### 💰 最大虧損評估
- 極端情況下可能跌幅：XX%
- 建議停損位置：$XXX

### ✅ 風險結論
**風險等級：** 低 / 中 / 高
**適合投資者：** 保守型 / 穩健型 / 積極型
`,

    signal: `
請對 ${ticker} 給出具體買賣信號，格式如下：

## 🎯 買賣信號分析

### 📊 綜合評分
| 項目 | 評分 | 說明 |
|------|------|------|
| 技術面 | ⭐⭐⭐⭐⭐ | ... |
| 基本面 | ⭐⭐⭐⭐⭐ | ... |
| 籌碼面 | ⭐⭐⭐⭐⭐ | ... |
| 消息面 | ⭐⭐⭐⭐⭐ | ... |

### 💰 價位建議
| 操作 | 價格區間 | 說明 |
|------|----------|------|
| 買入區間 | $XXX - $XXX | 分批買入 |
| 目標價 1 | $XXX | 短期目標 |
| 目標價 2 | $XXX | 中期目標 |
| 停損價 | $XXX | 跌破則出場 |

### ⚖️ 風險回報比
- 預期收益：XX%
- 潛在虧損：XX%
- 風險回報比：1:X

### 📅 持有建議
- **持有期限：** 短線(X天) / 中線(X週) / 長線(X月)
- **建議倉位：** XX% 資金

### ✅ 操作結論
**當前建議：** 🟢 買入 / 🟡 觀望 / 🔴 賣出
**理由：** XXX
`,

    compare: `
請對 ${ticker} 進行比較分析，格式如下：

## 📊 競爭對比分析

### 🏢 公司對比
| 項目 | ${ticker} | 競爭對手A | 競爭對手B |
|------|-----------|-----------|-----------|
| 市值 | $XXX | $XXX | $XXX |
| 營收 | $XXX | $XXX | $XXX |
| 市佔率 | XX% | XX% | XX% |
| P/E | XX | XX | XX |

### ⚖️ 優勢對比
**${ticker} 優勢：**
- ✅ 優勢一
- ✅ 優勢二

**劣勢：**
- ❌ 劣勢一
- ❌ 劣勢二

### 📈 投資價值排序
1. **XXX** - 理由
2. **XXX** - 理由
3. **XXX** - 理由

### ✅ 結論
**推薦順序：** XXX
`,

    portfolio: `
請分析持倉組合：${ticker}，格式如下：

## 💼 投資組合分析

### 📊 持倉結構
| 股票 | 佔比 | 行業 | 評級 |
|------|------|------|------|
| XXX | XX% | 科技 | ⭐⭐⭐⭐⭐ |
| XXX | XX% | 消費 | ⭐⭐⭐⭐⭐ |

### ⚠️ 風險評估
- 行業集中度：高/中/低
- 單一股最大佔比：XX%
- 整體風險等級：高/中/低

### 🔧 調整建議
1. **加碼：** XXX
2. **減碼：** XXX  
3. **新增：** XXX

### ✅ 優化方向
XXX
`,

    chat: question || `請分析 ${ticker}`
  }

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompts[type] || prompts.chat }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API ${response.status}: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '無回應';
    
    res.json({ success: true, content, ticker, type });
  } catch (error) {
    console.error('Analyze error:', error.message);
    res.status(500).json({ error: '分析失敗', message: error.message });
  }
});

// 問答 API
app.post('/api/chat', async (req, res) => {
  const { messages, question } = req.body;
  
  // 支持两种格式：messages 数组或单个 question
  const chatMessages = messages || (question ? [{ role: 'user', content: question }] : null);
  
  if (!chatMessages?.length) {
    return res.status(400).json({ error: '請提供對話內容' });
  }

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...chatMessages
        ],
        temperature: 0.7,
        max_tokens: 2500
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '無回應';
    
    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ error: '請求失敗', message: error.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`📈 美股 AI 投顧助手已啟動: http://localhost:${PORT}`);
  console.log(`🔑 API: ${config.apiKey ? '已配置' : '未配置'}`);
  console.log(`🤖 模型: ${config.model}`);
});
