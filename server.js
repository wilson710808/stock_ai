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

// 配置 - 多模型降級機制
const config = {
  apiKey: process.env.OPENAI_API_KEY || '',
  baseUrl: process.env.OPENAI_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  model: process.env.OPENAI_MODEL || 'meta/llama-3.1-8b-instruct',
  alphaVantageKey: process.env.ALPHA_VANTAGE_KEY || 'demo',
  // 降級模型列表（按優先順序）
  fallbackModels: [
    { url: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.1-8b-instruct', key: process.env.OPENAI_API_KEY },
    { url: 'https://integrate.api.nvidia.com/v1', model: 'nvidia/llama-3.1-nemotron-70b-instruct', key: process.env.OPENAI_API_KEY },
  ],
  aiTimeout: 30000, // 30秒超時（8B模型只需幾秒）
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
const SYSTEM_PROMPT = `你是巴菲特和查理·芒格的價值投資助手，請用繁體中文回答。

## 核心理念

> "用合理價格買優秀公司，而不是用便宜價格買普通公司。"
> — 巴菲特

## 分析框架

### 一、經濟護城河（最重要）
- 無形資產（品牌、專利）
- 成本優勢
- 網絡效應
- 轉換成本
- 規模效應

### 二、財務品質
- ROE > 15%
- 毛利率 > 40%
- 自由現金流為正
- 負債率 < 50%

### 三、安全邊際
- 內在價值 vs 市場價格
- 安全邊際 > 30% 理想

### 四、管理層品質
- 誠信、理性、股東導向

### 五、能力圈原則
- 只投資自己懂的業務

## 嚴格格式要求

1. 每個章節用 ## 標題
2. 數據用表格呈現
3. 重要結論用 **粗體**
4. 優缺點用 ✅ ❌ 標注
5. 分隔線用 ---
6. 免責聲明放最後

## 買賣決策標準

### 買入條件（必須滿足）
- [ ] 有護城河
- [ ] ROE > 15%
- [ ] 自由現金流為正
- [ ] 安全邊際 > 30%

### 賣出條件
- [ ] 基本面惡化
- [ ] 價格嚴重高估
- [ ] 發現更好機會

**免責聲明：** 本分析僅供參考，不構成投資建議。`;

// 本地備用分析（當 API 失敗時使用）
function generateFallbackAnalysis(ticker, type) {
  const analyses = {
    overview: `## 🏰 經濟護城河分析

| 護城河類型 | 存在與否 | 說明 |
|------------|----------|------|
| 品牌價值 | ✅ | ${ticker} 具有較強品牌認知度 |
| 成本優勢 | ⚠️ | 需進一步分析成本結構 |
| 網絡效應 | ⚠️ | 視具體業務模式而定 |
| 轉換成本 | ⚠️ | 客戶黏著度待評估 |

**護城河評級：** 中等（需更多數據確認）

---

## 💰 財務健康度（巴菲特標準）

| 指標 | 數值 | 標準 | 評價 |
|------|------|------|------|
| ROE | 待查詢 | >15% | ⏳ |
| 毛利率 | 待查詢 | >40% | ⏳ |
| 自由現金流 | 待查詢 | 正數 | ⏳ |
| 負債率 | 待查詢 | <50% | ⏳ |

---

## 📊 估值與安全邊際

| 指標 | 數值 | 評價 |
|------|------|------|
| P/E | 待查詢 | 需對比行業平均 |
| PEG | 待查詢 | 成長性指標 |
| 內在價值估算 | 待計算 | 需要更多財務數據 |
| 當前價格 | 請查看報價 | - |
| **安全邊際** | 待評估 | 需要完整分析 |

---

## 👔 管理層評估

- **誠信度：** 需查閱管理層歷史記錄
- **資本配置：** 觀察過去投資決策
- **股東導向：** 查看股息政策和回購記錄

---

## ⚠️ 風險提示

1. **數據不完整風險**：當前分析基於有限信息
2. **市場風險**：整體市場波動影響
3. **行業風險**：行業週期性變化

---

## 🎯 投資結論（巴菲特標準）

**能力圈判斷：** 建議深入研究公司業務模式

**護城河：** 待確認

**安全邊際：** 待計算

**最終建議：** 🟡 觀望 - 需要更多數據進行完整分析

**理由：** AI 分析服務暫時不可用，建議參考專業財經網站獲取完整分析。

---

**免責聲明：** 本分析為簡化版本，僅供參考。AI 服務暫時不可用，建議使用其他專業工具進行完整分析。`,

    technical: `## 📈 趨勢判斷
- 日線趨勢：請查看 K 線圖
- 週線趨勢：請查看 K 線圖

## 📍 關鍵位置
| 類型 | 價格 | 說明 |
|------|------|------|
| 壓力位 1 | 待計算 | 近期高點 |
| 壓力位 2 | 待計算 | 歷史高點 |
| 支撐位 1 | 待計算 | 近期低點 |
| 支撐位 2 | 待計算 | 歷史低點 |

## 📊 技術指標
| 指標 | 數值 | 信號 |
|------|------|------|
| RSI | 請查看圖表 | - |
| MACD | 請查看圖表 | - |
| 均線 | 請查看圖表 | - |

## 🎯 操作建議
- **短線：** 請參考 K 線圖技術分析
- **中線：** 建議等待更明確趨勢
- **停損點：** 建議設置在支撐位下方 5-8%

---
**注意：** AI 技術分析服務暫時不可用，請參考圖表自行判斷。`,

    fundamental: `## 🏢 商業模式
- 核心產品/服務：請查閱公司年報
- 營收來源結構：請查閱財務報表

## 💰 財務健康度
| 指標 | 數值 | 評分 |
|------|------|------|
| 營收增長率 | 待查詢 | ⏳ |
| 淨利率 | 待查詢 | ⏳ |
| 負債率 | 待查詢 | ⏳ |
| 現金流 | 待查詢 | ⏳ |

## 📊 成長性分析
- 過去3年複合成長率：待計算
- 未來預期成長：請參考分析師預測
- 成長驅動因素：需深入研究

## 💎 估值合理性
- P/E ratio vs 行業平均：待比較
- PEG ratio：待計算
- 是否被低估/高估：需完整分析

## ✅ 投資結論
**長期投資價值：** 待評估
**建議：** 請參考專業財經網站獲取完整基本面分析

---
**注意：** AI 基本面分析服務暫時不可用。`,

    risk: `## ⚠️ 風險評估報告

### 📊 風險評分
| 風險類型 | 評分 (1-10) | 說明 |
|----------|-------------|------|
| 估值風險 | 待評估 | 需要完整財務數據 |
| 業務風險 | 待評估 | 需了解業務模式 |
| 競爭風險 | 待評估 | 需行業分析 |
| 宏觀風險 | 待評估 | 需經濟環境分析 |

### 🔴 主要風險點
1. **數據不完整風險**
   - 影響程度：高
   - 發生概率：確定

2. **AI 服務不可用風險**
   - 影響程度：中
   - 發生概率：暫時性

### 🦢 黑天鵝風險
- 潛在黑天鵝事件：市場系統性風險
- 可能影響：整體投資組合

### 💰 最大虧損評估
- 極端情況下可能跌幅：無法估算
- 建議停損位置：請自行設定

### ✅ 風險結論
**風險等級：** 無法評估（數據不足）
**適合投資者：** 建議等待完整分析

---
**注意：** AI 風險評估服務暫時不可用。`,

    signal: `## 🎯 買賣信號分析

### 📊 綜合評分
| 項目 | 評分 | 說明 |
|------|------|------|
| 技術面 | ⏳ | 請查看 K 線圖 |
| 基本面 | ⏳ | 數據不足 |
| 籌碼面 | ⏳ | 數據不足 |
| 消息面 | ⏳ | 請關注新聞 |

### 💰 價位建議
| 操作 | 價格區間 | 說明 |
|------|----------|------|
| 買入區間 | 待計算 | 請參考技術分析 |
| 目標價 1 | 待計算 | 短期目標 |
| 目標價 2 | 待計算 | 中期目標 |
| 停損價 | 待計算 | 請自行設定 |

### ⚖️ 風險回報比
- 預期收益：無法估算
- 潛在虧損：無法估算
- 風險回報比：無法計算

### 📅 持有建議
- **持有期限：** 建議觀望
- **建議倉位：** 請根據風險承受能力決定

### ✅ 操作結論
**當前建議：** 🟡 觀望
**理由：** AI 分析服務暫時不可用，建議參考其他專業工具

---
**注意：** AI 信號分析服務暫時不可用。`
  };
  
  return analyses[type] || analyses.overview;
}

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasAPI: !!config.apiKey, model: config.model });
});

// 插拔式：返回可用分析类型配置
app.get('/api/config', (req, res) => {
  try {
    const cfg = JSON.parse(require('fs').readFileSync(path.join(__dirname, 'analysis-config.json'), 'utf8'));
    res.json({ success: true, config: cfg });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
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

    // 3個月短期投資策略（專業投顧視角）
    signal3m: `
請對 ${ticker} 進行 3 個月短期專業投資分析：

## 📊 專業投顧 3 個月投資評估

### 🎯 核心策略框架
本分析基於北美資深投顧的短期選股策略，結合：
- 技術面動能分析
- 基本面催化劑識別
- 市場情緒評估
- 風險管理原則

---

## 📈 價格動能分析

| 指標 | 數值 | 信號 |
|------|------|------|
| 20日均線位置 | $XXX | 價格 >/< 均線 |
| 50日均線位置 | $XXX | 趨勢方向 |
| RSI (14日) | XX | <30超賣/ >70超買 |
| MACD 信號 | 金叉/死叉/中性 | 動能方向 |

---

## 💡 短期催化劑識別

### 基本面催化劑
| 催化劑類型 | 是否存在 | 說明 |
|------------|----------|------|
| 財報發布 | 有/無 | 下次財報日期 |
| 產品發布 | 有/無 | 即將發布的產品 |
| 機構增持 | 有/無 | 機構持股變動 |
| 政策利好 | 有/無 | 政府政策影響 |

### 市場情緒
- **散戶情緒：** 樂觀/中性/悲觀
- **機構立場：** 增持/中性/減持
- **分析師評級：** 買入/持有/賣出

---

## 🎯 技術面進場點位

| 價位類型 | 價格 | 說明 |
|----------|------|------|
| 理想買入價 | $XXX | 回調支撐位 |
| 合理買入價 | $XXX | 盤整區間 |
| 目標價 1 (1個月) | $XXX | 預期漲幅 XX% |
| 目標價 2 (3個月) | $XXX | 預期漲幅 XX% |
| 停損價 | $XXX | 跌破止損 |

---

## 📊 3 個月預期收益分析

| 情景 | 概率 | 目標價 | 預期收益 | 說明 |
|------|------|--------|----------|------|
| 樂觀情景 | XX% | $XXX | +XX% | 催化劑如期兌現 |
| 基本情景 | XX% | $XXX | +XX% | 按計劃達成 |
| 保守情景 | XX% | $XXX | XX% | 低於預期 |

**基本情景 3 個月預期收益：** **+XX%**

---

## ⚠️ 風險管理

### 風險評估
| 風險類型 | 等級 | 說明 |
|----------|------|------|
| 市場風險 | 高/中/低 | 整體市場回調 |
| 波動性風險 | 高/中/低 | 歷史波動率 |

### 最大虧損保護
- **建議停損：** $XXX（-XX%）
- **風險回報比：** 1:X
- **頭寸建議：** XX% 資金

---

## 🎯 3 個月操作建議

### 進場策略
1. **首批進場：** 30% 資金 @ $XXX
2. **回調加碼：** 30% 資金 @ $XXX
3. **突破加碼：** 40% 資金 @ $XXX

### 持有期間
- **目標持有：** 60-90 天
- **中期評估：** 30 天後複查
- **紀律執行：** 嚴守停損

### ✅ 最終建議

**綜合評級：** 強烈買入 / 謹慎買入 / 觀望 / 避開

**3 個月目標價：** $XXX

**預期收益率：** +XX%

**理由：** 基於專業投顧分析

---

**免責聲明：** 本分析為 3 個月短期投顧建議，基於公開信息和技術分析，僅供參考，不構成投資建議。短期投資風險較高，請謹慎操作。`,

    chat: question || `請分析 ${ticker}`
  }

  try {
    // 多模型降級呼叫
    let content = null;
    let usedModel = null;

    // 構建嘗試列表：主模型 + 備用模型
    const tryModels = [
      { url: config.baseUrl, model: config.model, key: config.apiKey },
      ...config.fallbackModels.filter(m => m.model !== config.model)
    ];

    for (const m of tryModels) {
      if (!m.key) continue;
      try {
        console.log(`🔄 嘗試模型: ${m.model} @ ${m.url}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.aiTimeout);

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${m.key}`,
          'HTTP-Referer': 'https://stockai.local',
          'X-Title': 'StockAI'
        };

        const response = await fetch(`${m.url}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          headers,
          body: JSON.stringify({
            model: m.model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: prompts[type] || prompts.chat }
            ],
            temperature: 0.7,
            max_tokens: 2000
          })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const err = await response.text();
          console.log(`❌ 模型 ${m.model} 返回 ${response.status}: ${err.substring(0, 100)}`);
          continue; // 嘗試下一個模型
        }

        const data = await response.json();
        content = data.choices?.[0]?.message?.content;
        usedModel = m.model;
        console.log(`✅ 模型 ${m.model} 成功`);
        break; // 成功就跳出
      } catch (err) {
        console.log(`❌ 模型 ${m.model} 失敗: ${err.message}`);
        continue; // 嘗試下一個
      }
    }

    if (content) {
      res.json({ success: true, content, ticker, type, model: usedModel });
    } else {
      // 所有模型都失敗，使用本地備用分析
      console.log('⚠️ 所有模型失敗，使用本地備用分析');
      const fallbackContent = generateFallbackAnalysis(ticker, type);
      res.json({ success: true, content: fallbackContent, ticker, type, fallback: true });
    }
  } catch (error) {
    console.error('Analyze error:', error.message);
    const fallbackContent = generateFallbackAnalysis(ticker, type);
    res.json({ success: true, content: fallbackContent, ticker, type, fallback: true });
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
    // 多模型降級呼叫
    let content = null;
    let usedModel = null;

    const tryModels = [
      { url: config.baseUrl, model: config.model, key: config.apiKey },
      ...config.fallbackModels.filter(m => m.model !== config.model)
    ];

    for (const m of tryModels) {
      if (!m.key) continue;
      try {
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), config.aiTimeout);

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${m.key}`,
          'HTTP-Referer': 'https://stockai.local',
          'X-Title': 'StockAI'
        };

        const response = await fetch(`${m.url}/chat/completions`, {
          method: 'POST',
          signal: controller2.signal,
          headers,
          body: JSON.stringify({
            model: m.model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              ...chatMessages
            ],
            temperature: 0.7,
            max_tokens: 2500
          })
        });

        clearTimeout(timeoutId2);
        const data = await response.json();
        content = data.choices?.[0]?.message?.content;
        usedModel = m.model;
        break;
      } catch (err) {
        continue;
      }
    }

    if (content) {
      res.json({ success: true, content, model: usedModel });
    } else {
      res.json({ 
        success: true, 
        content: `抱歉，AI 分析服務暫時不可用。

請稍後重試，或嘗試以下替代方案：
1. 刷新頁面後重新搜索
2. 查看 K 線圖進行技術分析
3. 參考其他專業財經網站

**免責聲明：** 本系統提供的分析僅供參考，不構成投資建議。`,
        fallback: true
      });
    }
  } catch (error) {
    res.json({ 
      success: true, 
      content: `抱歉，AI 服務暫時不可用。請稍後重試。`,
      fallback: true
    });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`📈 美股 AI 投顧助手已啟動: http://0.0.0.0:${PORT}`);
  console.log(`🔑 API: ${config.apiKey ? '已配置' : '未配置'}`);
  console.log(`🤖 模型: ${config.model}`);
});

// 分析记录保存 API
app.post('/api/save-analysis', (req, res) => {
  const { ticker, type, content, quote, conclusion } = req.body;
  const fs = require('fs');
  const path = require('path');
  
  const today = new Date().toISOString().split('T')[0];
  const record = {
    timestamp: new Date().toISOString(),
    ticker,
    type,
    content,
    quote,
    conclusion
  };
  
  // 保存到记忆区域
  const memoryDir = path.join(__dirname, '..', 'memory', 'analysis');
  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }
  
  const filename = `${today}_${ticker}_${type}.json`;
  fs.writeFileSync(path.join(memoryDir, filename), JSON.stringify(record, null, 2));
  
  // 同时追加到每日汇总
  const summaryFile = path.join(__dirname, '..', 'memory', `analysis_${today}.md`);
  const summaryEntry = `
## ${new Date().toLocaleTimeString('zh-TW')} - ${ticker} (${type})

### 核心结论
${conclusion || '无'}

### 关键数据
- 价格: ${quote?.price ? '$' + quote.price : '-'}
- 涨跌: ${quote?.changePercent ? quote.changePercent + '%' : '-'}

---
`;
  
  if (fs.existsSync(summaryFile)) {
    fs.appendFileSync(summaryFile, summaryEntry);
  } else {
    fs.writeFileSync(summaryFile, `# ${today} 分析记录\n${summaryEntry}`);
  }
  
  res.json({ success: true, filename });
});

// 获取历史分析记录
app.get('/api/analysis-history', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  const memoryDir = path.join(__dirname, '..', 'memory', 'analysis');
  if (!fs.existsSync(memoryDir)) {
    return res.json({ success: true, records: [] });
  }
  
  const files = fs.readdirSync(memoryDir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 20);
  
  const records = files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(memoryDir, f), 'utf8'));
    } catch {
      return null;
    }
  }).filter(Boolean);
  
  res.json({ success: true, records });
});
