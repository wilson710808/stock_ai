
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
