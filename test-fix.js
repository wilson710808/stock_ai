// 測試修復後的 isUSMarketOpen
const now = new Date();
const day = now.getUTCDay(); 
const hour = now.getUTCHours();
const minute = now.getUTCMinutes();

console.log('=== 測試美股交易時間 ===');
console.log('當前時間（UTC）:', now.toISOString());
console.log('週幾（0=週日）:', day);
console.log('時:分（UTC）:', hour + ':' + minute);

const month = now.getUTCMonth() + 1;
const dateInMonth = now.getUTCDate();
const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), month - 1, 1)).getUTCDay();
const secondSundayMarch = firstDayOfMonth === 0 ? 8 : (14 - firstDayOfMonth); 
const firstSundayNov = firstDayOfMonth === 0 ? 1 : (7 - firstDayOfMonth); 

const isDST = (month > 3 && month < 11) || 
               (month === 3 && dateInMonth >= secondSundayMarch) || 
               (month === 11 && dateInMonth < firstSundayNov);

const openHour = isDST ? 13 : 14; 
const closeHour = isDST ? 20 : 21; 
const nowMinutes = hour * 60 + minute;
const openMinutes = openHour * 60 + 30;
const closeMinutes = closeHour * 60;
const isOpen = nowMinutes >= openMinutes && nowMinutes < closeMinutes;

console.log('是否夏令時:', isDST);
console.log('開市時間（UTC）:', openHour + ':30');
console.log('收市時間（UTC）:', closeHour + ':00');
console.log('現在分鐘數:', nowMinutes, '(開市:', openMinutes, '收市:', closeMinutes, ')');
console.log('\n✨ 美股是否正在交易:', isOpen ? '是' : '否（已收盤）');
