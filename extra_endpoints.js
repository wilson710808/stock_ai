
// ============================================
// 最終升級 - 新增的完整數據 API 端點
// ============================================

// 估值與安全邊際 API
app.get('/api/valuation/:ticker', async (req, res) => {
  const ticker = req.params.ticker?.toUpperCase();
  if (!ticker) return res.status(400).json({error: '請提供股票代碼'});
  try {
    const result = await new Promise((resolve) => {
      const python = spawn('python3', [path.join(__dirname, 'financial_data.py'), ticker, '--valuation']);
      let data = '';
      python.stdout.on('data', chunk => data += chunk);
      python.stderr.on('data', chunk => console.error('估值數據錯誤:', chunk.toString()));
      python.on('close', code => {
        if (code === 0 && data) {
          try { resolve(JSON.parse(data)); }
          catch (e) {
            console.error('估值數據解析失敗:', e.message);
            resolve(getFallbackData('valuation'));
          }
        } else {
          console.error('估值數據查詢失敗，退出碼:', code);
          resolve(getFallbackData('valuation'));
        }
      });
    });
    res.json(result);
  } catch (e) {
    console.error('估值API錯誤:', e.message);
    res.status(500).json(getFallbackData('valuation'));
  }
});

// 管理層評估 API
app.get('/api/management/:ticker', async (req, res) => {
  const ticker = req.params.ticker?.toUpperCase();
  if (!ticker) return res.status(400).json({error: '請提供股票代碼'});
  try {
    const result = await new Promise((resolve) => {
      const python = spawn('python3', [path.join(__dirname, 'financial_data.py'), ticker, '--management']);
      let data = '';
      python.stdout.on('data', chunk => data += chunk);
      python.stderr.on('data', chunk => console.error('管理層數據錯誤:', chunk.toString()));
      python.on('close', code => {
        if (code === 0 && data) {
          try { resolve(JSON.parse(data)); }
          catch (e) {
            console.error('管理層數據解析失敗:', e.message);
            resolve(getFallbackData('management'));
          }
        } else {
          console.error('管理層數據查詢失敗，退出碼:', code);
          resolve(getFallbackData('management'));
        }
      });
    });
    res.json(result);
  } catch (e) {
    console.error('管理層API錯誤:', e.message);
    res.status(500).json(getFallbackData('management'));
  }
});

// 風險提示 API
app.get('/api/risks/:ticker', async (req, res) => {
  const ticker = req.params.ticker?.toUpperCase();
  if (!ticker) return res.status(400).json({error: '請提供股票代碼'});
  try {
    const result = await new Promise((resolve) => {
      const python = spawn('python3', [path.join(__dirname, 'financial_data.py'), ticker, '--risks']);
      let data = '';
      python.stdout.on('data', chunk => data += chunk);
      python.stderr.on('data', chunk => console.error('風險數據錯誤:', chunk.toString()));
      python.on('close', code => {
        if (code === 0 && data) {
          try { resolve(JSON.parse(data)); }
          catch (e) {
            console.error('風險數據解析失敗:', e.message);
            resolve(getFallbackData('risks'));
          }
        } else {
          console.error('風險數據查詢失敗，退出碼:', code);
          resolve(getFallbackData('risks'));
        }
      });
    });
    res.json(result);
  } catch (e) {
    console.error('風險API錯誤:', e.message);
    res.status(500).json(getFallbackData('risks'));
  }
});

// 升級 getFallbackData 函數
function getFallbackData(endpoint) {
  if (endpoint === 'financial') {
    return {
      success: false,
      metrics: {
        roe: 12.0,
        roic: 10.0,
        freeCashFlow: 500000000,
        avgGrossMargin: 35.0,
        avgNetMargin: 10.0,
        pe_ratio: 32.5,
        peg_ratio: 1.8,
        debt_ratio: 0.45,
        interest_coverage: 8.5,
        dividend_yield: 0.6
      },
      source: 'fallback',
      note: '財務數據為示範值'
    };
  } else if (endpoint === 'moat') {
    return {
      success: false,
      moat: {
        brand: '⚠️',
        cost: '⚠️',
        network: '⚠️',
        switching: '⚠️'
      },
      moat_details: {
        brand: {exists: '⚠️', description: '需查詢品牌影響力', score: 2},
        cost: {exists: '⚠️', description: '需分析成本結構', score: 2},
        network: {exists: '⚠️', description: '需檢查網絡效應', score: 2},
        switching: {exists: '⚠️', description: '需評估轉換成本', score: 2}
      },
      overall_moat_rating: '待確認',
      note: '護城河數據為示範值'
    };
  } else if (endpoint === 'valuation') {
    return {
      success: false,
      valuation: {
        pe_ratio: 32.5,
        pe_rating: '需對比行業平均',
        peg_ratio: 1.8,
        peg_rating: '成長性指標',
        intrinsic_value: {low: 140, mid: 160, high: 180},
        margin_of_safety: '待評估'
      },
      note: '估值數據為示範值'
    };
  } else if (endpoint === 'management') {
    return {
      success: false,
      management: {
        integrity: {rating: '⚠️', note: '需查閱管理層歷史記錄'},
        capital_allocation: {rating: '⚠️', note: '觀察過去投資決策'},
        shareholder_focus: {rating: '⚠️', note: '查看股息政策和回購記錄'}
      },
      note: '管理層數據為示範值'
    };
  } else if (endpoint === 'risks') {
    return {
      success: false,
      risks: [
        '數據不完整風險：當前分析基於有限信息',
        '市場風險：整體市場波動影響',
        '行業風險：行業週期性變化'
      ],
      note: '風險提示為示範值'
    };
  }
}

// 升級 fetchWithRetry，擴展支持新端點
async function fetchWithRetry(ticker, endpoint, maxRetries = 3, delayMs = 1000) {
  let lastError = null;
  const endpoints = {
    financial: '/api/financial/' + ticker,
    moat: '/api/moat/' + ticker,
    valuation: '/api/valuation/' + ticker,
    management: '/api/management/' + ticker,
    risks: '/api/risks/' + ticker
  };
  
  if (!endpoints[endpoint]) {
    throw new Error('不支持的端點: ' + endpoint);
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('http://localhost:' + PORT + endpoints[endpoint]);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      
      const data = await response.json();
      
      // 基本驗證
      if ((endpoint === 'financial' && data.metrics) ||
          (endpoint === 'moat' && data.moat) ||
          (endpoint === 'valuation' && data.valuation) ||
          (endpoint === 'management' && data.management) ||
          (endpoint === 'risks' && data.risks)) {
        return { success: true, data };
      }
      throw new Error('數據不完整');
    } catch (error) {
      lastError = error;
      console.warn('[' + endpoint + '][嘗試' + attempt + '/' + maxRetries + '] 獲取失敗:', error.message);
      if (attempt < maxRetries) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // 重試失敗後返回備用數據
  return {
    success: false,
    data: getFallbackData(endpoint),
    note: '數據獲取失敗（已重試' + maxRetries + '次），使用備用值'
  };
}
