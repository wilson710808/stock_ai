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

// Alpha Vantage K 線數據
async function fetchAlphaVantageHistorical(ticker) {
  if (!config.alphaVantageKey || config.alphaVantageKey === 'demo') {
    return null;
  }
  
  try {
    // 獲取每日 K 線數據
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${config.alphaVantageKey}&outputsize=compact`;
    const response = await fetch(url);
    const data = await response.json();
    
    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) return null;
    
    const candles = Object.entries(timeSeries).slice(0, 90).reverse().map(([date, values]) => ({
      time: Math.floor(new Date(date).getTime() / 1000), // TradingView 需要 Unix 秒
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume'])
    }));
    
    return candles;
  } catch (e) {
    console.error('Alpha Vantage Historical error:', e.message);
    return null;
  }
}

// K 線 API
app.get('/api/chart/:ticker', async (req, res) => {
  const ticker = req.params.ticker?.toUpperCase();
  if (!ticker) return res.status(400).json({ error: '請提供股票代碼' });
  
  const candles = await fetchAlphaVantageHistorical(ticker);
  
  if (candles) {
    return res.json({ success: true, candles, source: 'alphavantage' });
  }
  
  // 返回模擬數據（說明需要 API Key）
  res.json({ 
    success: false, 
    error: '需要 Alpha Vantage API Key 來獲取 K 線數據',
    hint: '請在 .env 中設置 ALPHA_VANTAGE_KEY'
  });
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
const SYSTEM_PROMPT = `你是一位擁有 30 年華爾街經驗的資深美股投資顧問，曾任職高盛、摩根士丹利。

你的專業背景：
- 深度研究美股科技、醫療、金融、能源等各大板塊
- 精通技術分析（K線、均線、RSI、MACD、布林帶）
- 擅長基本面分析（PE、PB、EPS、自由現金流、護城河）
- 熟悉宏觀經濟對股市的影響

你的溝通風格：
- 直接、專業、有洞察力，不說廢話
- 給出具體的數字和理由，不模糊
- 主動提示風險，不只說好話
- 用繁體中文回答

重要聲明：你的建議僅供參考，不構成正式投資建議。`;

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasAPI: !!config.apiKey, model: config.model });
});

// 嘗試獲取實時股價（Python 爬蟲）
function getStockPricePython(ticker) {
  return new Promise((resolve) => {
    const python = spawn('python3', [path.join(__dirname, 'stock_price.py'), ticker]);
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
  
  // Step 1: 嘗試 Alpha Vantage (優先)
  const alphaResult = await fetchAlphaVantage(t);
  if (alphaResult && alphaResult.price) {
    return res.json({ success: true, ...alphaResult });
  }
  
  // Step 2: 嘗試 Python 爬蟲
  const pythonResult = await getStockPricePython(t);
  if (pythonResult && pythonResult.price) {
    pythonResult.source = 'python';
    pythonResult.note = '實時數據';
    return res.json({ success: true, ...pythonResult });
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
    overview: `請對 ${ticker} 進行全面分析，包含：1.公司基本面 2.財務表現 3.估值分析 4.技術面 5.風險 6.投資建議（買入/持有/觀望/賣出）及目標價`,
    technical: `請對 ${ticker} 進行技術分析：1.趨勢判斷 2.支撐壓力位 3.RSI、MACD 均線信號 4.短期操作建議`,
    fundamental: `請對 ${ticker} 進行基本面分析：1.商業模式 2.財務健康度 3.成長性 4.估值合理性 5.長期投資價值`,
    compare: `請比較分析：${ticker}（業務差異、財務對比、競爭優勢、估值、哪個更值得投資）`,
    portfolio: `請分析持倉：${ticker}（行業分佈、風險評估、調整建議、優化方向）`,
    risk: `請對 ${ticker} 進行風險評估：1.估值風險 2.業務風險 3.競爭風險 4.宏觀風險 5.最大虧損評估 6.風險評分1-10 7.黑天鵝風險`,
    signal: `請對 ${ticker} 給出具體買賣信號：1.買入價格範圍 2.止損價格 3.目標價格 4.風險回報比 5.建議倉位 6.持有期限 7.現在適合買/賣/觀望？`,
    chat: question || `請分析 ${ticker}`
  };

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
  const { messages } = req.body;
  if (!messages?.length) {
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
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 1500
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
