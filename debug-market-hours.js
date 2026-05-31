
// 檢查是否在美股交易時間（北京時間，夏令時 21:30-04:00，冬令時 22:30-05:00）
function isUSMarketOpen() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=週日, 1-5=週一到週五
  const hour = now.getUTCHours(); // UTC 小時
  const minute = now.getUTCMinutes();
  
  console.log('[DEBUG] 當前時間（UTC）:', now.toISOString());
  console.log('[DEBUG] 週幾（UTC 0=週日）:', day);
  console.log('[DEBUG] 時:分（UTC）:', hour + ':' + minute);
  
  // 週末不開市
  if (day === 0 || day === 6) {
    console.log('[DEBUG] 週末，不開市');
    return false;
  }
  
  // 夏令時（3月第二個週日到11月第一個週日）：21:30-04:00 UTC = 北京 05:30-12:00
  // 冬令時：22:30-05:00 UTC = 北京 06:30-13:00
  const month = now.getUTCMonth() + 1;
  const dateInMonth = now.getUTCDate();
  const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), month - 1, 1)).getUTCDay();
  const secondSunday = firstDayOfMonth === 0 ? 8 : (14 - firstDayOfMonth); // 3月第二個週日
  const firstSundayNov = firstDayOfMonth === 0 ? 1 : (7 - firstDayOfMonth); // 11月第一個週日
  
  const isDST = (month > 3 && month < 11) || 
                 (month === 3 && dateInMonth >= secondSunday) || 
                 (month === 11 && dateInMonth < firstSundayNov);
  
  console.log('[DEBUG] 月份:', month, '日期:', dateInMonth);
  console.log('[DEBUG] 3月第二個週日:', secondSunday, '11月第一個週日:', firstSundayNov);
  console.log('[DEBUG] 是否夏令時:', isDST);
  
  const openHour = isDST ? 21 : 22;
  const closeHour = isDST ? 4 : 5;
  
  console.log('[DEBUG] 開市時間（UTC）:', openHour + ':30');
  console.log('[DEBUG] 收市時間（UTC）:', closeHour + ':00');
  
  // 轉換為分鐘數比較
  const nowMinutes = hour * 60 + minute;
  const openMinutes = openHour * 60 + 30;
  const closeMinutes = closeHour * 60;
  
  console.log('[DEBUG] 現在分鐘數:', nowMinutes);
  console.log('[DEBUG] 開市分鐘數:', openMinutes);
  console.log('[DEBUG] 收市分鐘數:', closeMinutes);
  
  let result;
  if (openHour < closeHour) {
    // 同一天（例如 00:00-04:00）
    result = nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  } else {
    // 跨天（例如 21:30-04:00）
    result = nowMinutes >= openMinutes || nowMinutes < closeMinutes;
  }
  
  console.log('[DEBUG] isUSMarketOpen 返回:', result);
  return result;
}

console.log('=== 測試 isUSMarketOpen 函數 ===');
const result = isUSMarketOpen();
console.log('\n最終結果: 美股' + (result ? '正在開市' : '已收盤'));
