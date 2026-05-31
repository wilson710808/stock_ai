// 直接替換 /api/financial/:ticker 和添加 /api/moat/:ticker 端點
const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverFile, 'utf8');

// 替換現有 /api/financial/:ticker 端點
const newFinancialEndpoint = `
// 財務指標 API（更新版本）
app.get('/api/financial/:ticker', async (req, res) => {
  const ticker = req.params.ticker?.toUpperCase();
  if (!ticker) return res.status(400).json({ error: '請提供股票代碼' });
  try {
    const result = await new Promise((resolve) => {
      // 傳入 --financial 參數明確調用財務數據函數
      const python = spawn('python3', [path.join(__dirname, 'financial_data.py'), ticker, '--financial']);
      let data = '';
      python.stdout.on('data', (chunk) => {
        data += chunk;
      });
      python.stderr.on('data', (chunk) => {
        console.error('財務數據錯誤:', chunk.toString());
      });
      python.on('close', (code) => {
        if (code === 0 && data) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            console.error('財務數據解析失敗:', e.message);
            resolve({ success: false, error: '解析失敗', raw: data });
          }
        } else {
          console.error('財務數據查詢失敗，退出碼:', code);
          resolve({ success: false, error: '財務數據查詢失敗' });
        }
      });
    });
    
    // 強制返回結構化數據（即使失敗也回退模擬數據）
    if (!result.success) {
      result.metrics = {
        roe: 18.5,
        roic: 15.2,
        freeCashFlow: 1000000000,
        fcfHistory: [1000000000, 900000000, 850000000],
        interestCoverage: 8.5,
        deRatio: 0.45,
        avgGrossMargin: 42.5,
        avgNetMargin: 25.3,
        netIncome: 5000000000,
        shareholderEquity: 25000000000,
        totalDebt: 10000000000
      };
      result.source = 'fallback';
      result.note = '財務數據為示範值，建議使用真實 API';
    }
    res.json(result);
  } catch (e) {
    console.error('財務數據API錯誤:', e.message);
    res.status(500).json({
      error: '財務數據API錯誤',
      metrics: {
        roe: 18.5,
        roic: 15.2,
        freeCashFlow: 1000000000,
        avgGrossMargin: 42.5,
        avgNetMargin: 25.3
      }
    });
  }
});`;

const newMoatEndpoint = `
// 護城河分析 API
app.get('/api/moat/:ticker', async (req, res) => {
  const ticker = req.params.ticker?.toUpperCase();
  if (!ticker) return res.status(400).json({ error: '請提供股票代碼' });
  try {
    const result = await new Promise((resolve) => {
      // 傳入 --moat 參數調用護城河分析
      const python = spawn('python3', [path.join(__dirname, 'financial_data.py'), ticker, '--moat']);
      let data = '';
      python.stdout.on('data', (chunk) => {
        data += chunk;
      });
      python.stderr.on('data', (chunk) => {
        console.error('護城河數據錯誤:', chunk.toString());
      });
      python.on('close', (code) => {
        if (code === 0 && data) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            console.error('護城河數據解析失敗:', e.message);
            resolve({ success: false, error: '解析失敗', raw: data });
          }
        } else {
          console.error('護城河數據查詢失敗，退出碼:', code);
          resolve({
            success: false,
            error: '護城河數據查詢失敗',
            moat: {
              brand: '✅',
              cost: '⚠️ 需進一步分析成本結構',
              network: '⚠️ 視具體業務模式而定',
              switching: '⚠️ 客戶黏著度待評估'
            }
          });
        }
      });
    });
    
    // 回退模擬數據
    if (!result.success) {
      result.moat = {
        brand: '✅',
        cost: '⚠️ 需進一步分析成本結構',
        network: '⚠️ 視具體業務模式而定',
        switching: '⚠️ 客戶黏著度待評估'
      };
      result.note = '護城河數據為模擬值';
    }
    res.json(result);
  } catch (e) {
    console.error('護城河API錯誤:', e.message);
    res.status(500).json({
      error: '護城河API錯誤',
      moat: {
        brand: '✅',
        cost: '⚠️',
        network: '⚠️',
        switching: '⚠️'
      }
    });
  }
});`;

// 使用簡單字符串替換定位現有端點
const targetFinancial = "app.get('/api/financial/:ticker', async (req, res) => {";
const targetEndFinancial = "res.status(500).json({ error: '財務數據API錯誤' });";

const startIdx = content.indexOf(targetFinancial);
const endIdx = content.indexOf(targetEndFinancial, startIdx) + targetEndFinancial.length;

if (startIdx === -1 || endIdx === -1) {
  console.error('❌ 無法找到 /api/financial/:ticker 端點，請手動檢查');
  process.exit(1);
}

// 替換舊端點
content = content.slice(0, startIdx) + newFinancialEndpoint.trim() + content.slice(endIdx);

// 添加 /api/moat/:ticker 端點
const insertPos = content.indexOf("// 內在價值估算 API");
if (insertPos === -1) {
  console.error('❌ 無法找到插入位置，請手動添加 /api/moat/:ticker 端點');
  process.exit(1);
}

content = content.slice(0, insertPos) + newMoatEndpoint.trim() + "\n\n" + content.slice(insertPos);

fs.writeFileSync(serverFile, content);
console.log('✅ /api/financial/:ticker 和 /api/moat/:ticker {}
