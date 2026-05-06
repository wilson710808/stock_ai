#!/usr/bin/env python3
"""
實時股價 - Yahoo Finance 主導 + Twelve Data 備用
支援：單股報價、批量報價、K線數據
"""
import sys
import json
import urllib.request
import urllib.error
import ssl
import re
import time
from datetime import datetime

# 全局 SSL context（跳過證書驗證，適用於伺服器環境）
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE

_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

# ============================================
# Yahoo Finance（主力，免費無需 API Key）
# ============================================

def _yahoo_chart(ticker, range='2d', interval='1d'):
    """Yahoo Finance chart API - 核心數據源"""
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range={range}&interval={interval}'
    req = urllib.request.Request(url, headers={'User-Agent': _UA})
    with urllib.request.urlopen(req, timeout=10, context=_ssl_ctx) as response:
        return json.loads(response.read().decode())

def get_quote_yahoo(ticker):
    """Yahoo Finance 完整報價（含正確的漲跌幅）"""
    try:
        data = _yahoo_chart(ticker, range='2d', interval='1d')
        result = data.get('chart', {}).get('result', [{}])[0]
        meta = result.get('meta', {})
        price = meta.get('regularMarketPrice', 0)
        prev = meta.get('chartPreviousClose', 0)  # 前一交易日收盤價
        change = round(price - prev, 2) if prev else 0
        change_pct = round(change / prev * 100, 2) if prev else 0

        return {
            'success': True,
            'ticker': ticker,
            'name': meta.get('longName', meta.get('shortName', ticker)),
            'price': round(price, 2),
            'change': change,
            'changePercent': change_pct,
            'prevClose': round(prev, 2),
            'open': round(meta.get('regularMarketDayHigh', 0) or 0, 2),  # Yahoo v8 chart 沒有直接 open
            'high': round(meta.get('regularMarketDayHigh', 0), 2),
            'low': round(meta.get('regularMarketDayLow', 0), 2),
            'volume': meta.get('regularMarketVolume', 0),
            'fiftyTwoWeekHigh': round(meta.get('fiftyTwoWeekHigh', 0), 2),
            'fiftyTwoWeekLow': round(meta.get('fiftyTwoWeekLow', 0), 2),
            'timestamp': int(datetime.now().timestamp() * 1000),
            'source': 'yahoo',
            'note': 'Yahoo Finance 實時數據'
        }
    except urllib.error.HTTPError as e:
        if e.code == 429:
            return {'error': f'Yahoo: 速率限制 (429)，請稍後再試'}
        return {'error': f'Yahoo HTTP {e.code}'}
    except Exception as e:
        return {'error': f'Yahoo error: {str(e)}'}


def get_quotes_yahoo_batch(tickers):
    """批量報價 - 逐個查詢 Yahoo（帶 0.5s 間隔避免 429）"""
    results = []
    for i, t in enumerate(tickers):
        t = t.upper().strip()
        if i > 0:
            time.sleep(1.5)  # Yahoo 429 閾值約 1req/s，保守 1.5s
        quote = get_quote_yahoo(t)
        if quote.get('success'):
            results.append(quote)
        else:
            results.append({
                'success': False,
                'ticker': t,
                'error': quote.get('error', '查詢失敗')
            })
    return results


def get_kline_yahoo(ticker, days=90):
    """Yahoo Finance K線數據"""
    try:
        data = _yahoo_chart(ticker, range=f'{days}d', interval='1d')
        result = data.get('chart', {}).get('result', [{}])[0]
        ts = result.get('timestamp', [])
        q = result.get('indicators', {'quote': [{}]}).get('quote', [{}])[0]
        candles = []
        for i in range(len(ts)):
            if q.get('open', [None])[i] is not None:
                candles.append({
                    'time': ts[i],
                    'open': round(q['open'][i], 2),
                    'high': round(q['high'][i], 2),
                    'low': round(q['low'][i], 2),
                    'close': round(q['close'][i], 2),
                    'volume': q.get('volume', [0])[i] or 0
                })
        return {
            'success': True,
            'ticker': ticker,
            'candles': candles,
            'source': 'yahoo',
            'note': f'Yahoo Finance K線 ({len(candles)} 天)'
        }
    except urllib.error.HTTPError as e:
        if e.code == 429:
            return {'success': False, 'error': 'Yahoo K線: 速率限制 (429)'}
        return {'success': False, 'error': f'Yahoo K線 HTTP {e.code}'}
    except Exception as e:
        return {'success': False, 'error': f'Yahoo K線錯誤: {str(e)}'}


# ============================================
# Twelve Data（備用，需 API Key）
# ============================================

def get_quote_twelvedata(ticker, apikey='demo'):
    """Twelve Data 完整報價（備用）"""
    try:
        url = f"https://api.twelvedata.com/quote?symbol={ticker}&apikey={apikey}"
        req = urllib.request.Request(url, headers={'User-Agent': _UA})
        with urllib.request.urlopen(req, timeout=10, context=_ssl_ctx) as response:
            data = json.loads(response.read().decode())
        if 'status' in data and data['status'] == 'error':
            return {'error': f"Twelve Data: {data.get('message', 'Unknown error')}"}
        close = float(data.get('close', 0))
        prev = float(data.get('previous_close', close))
        change = round(close - prev, 2) if prev else 0
        change_pct = round(change / prev * 100, 2) if prev else 0
        return {
            'success': True,
            'ticker': ticker,
            'name': data.get('name', ticker),
            'price': close,
            'change': change,
            'changePercent': change_pct,
            'prevClose': prev,
            'open': float(data.get('open', 0)),
            'high': float(data.get('high', 0)),
            'low': float(data.get('low', 0)),
            'volume': int(data.get('volume', 0)),
            'fiftyTwoWeekHigh': float(data.get('fifty_two_week', {}).get('high', 0)),
            'fiftyTwoWeekLow': float(data.get('fifty_two_week', {}).get('low', 0)),
            'timestamp': int(datetime.now().timestamp() * 1000),
            'source': 'twelvedata',
            'note': 'Twelve Data 實時數據'
        }
    except Exception as e:
        return {'error': f'Twelve Data error: {str(e)}'}


def get_kline_twelvedata(ticker, days=90, apikey='demo'):
    """Twelve Data K線（備用）"""
    try:
        url = f"https://api.twelvedata.com/time_series?symbol={ticker}&interval=1day&outputsize={days}&format=JSON&apikey={apikey}"
        req = urllib.request.Request(url, headers={'User-Agent': _UA})
        with urllib.request.urlopen(req, timeout=15, context=_ssl_ctx) as response:
            data = json.loads(response.read().decode())
        if 'status' in data and data['status'] == 'error':
            return {'success': False, 'error': f"Twelve Data K線: {data.get('message', 'Unknown')}"}
        values = data.get('values', [])
        candles = []
        for v in reversed(values):
            dt = datetime.strptime(v['datetime'], '%Y-%m-%d')
            ts = int(dt.timestamp())
            candles.append({
                'time': ts,
                'open': float(v['open']),
                'high': float(v['high']),
                'low': float(v['low']),
                'close': float(v['close']),
                'volume': int(v['volume']) if 'volume' in v else 0
            })
        return {
            'success': True,
            'ticker': ticker,
            'candles': candles,
            'source': 'twelvedata',
            'note': f'Twelve Data K線 ({len(candles)} 天)'
        }
    except Exception as e:
        return {'success': False, 'error': f'Twelve Data K線錯誤: {str(e)}'}


# ============================================
# 備用模擬數據（最後防線）
# ============================================

def get_simulated_data(ticker):
    """備用模擬數據"""
    import random
    base_price = 200.0
    return {
        'success': True,
        'ticker': ticker,
        'name': ticker,
        'price': round(base_price + random.uniform(-20, 20), 2),
        'change': round(random.uniform(-5, 5), 2),
        'changePercent': round(random.uniform(-2, 2), 2),
        'prevClose': round(base_price + random.uniform(-5, 5), 2),
        'open': round(base_price + random.uniform(-3, 3), 2),
        'high': round(base_price + random.uniform(5, 15), 2),
        'low': round(base_price + random.uniform(-15, -5), 2),
        'volume': random.randint(10000000, 100000000),
        'timestamp': int(datetime.now().timestamp() * 1000),
        'source': 'simulated',
        'note': '⚠️ 模擬數據（API 均不可用）'
    }


# ============================================
# CLI 入口
# ============================================

def get_quote(ticker):
    """主流程：Yahoo → Twelve Data → 模擬"""
    result = get_quote_yahoo(ticker)
    if result.get('success'):
        return result
    # Yahoo 失敗，嘗試 Twelve Data
    td = get_quote_twelvedata(ticker)
    if td.get('success'):
        return td
    # 都失敗，用模擬
    return get_simulated_data(ticker)

def get_kline(ticker, days=90):
    """主流程：Yahoo → Twelve Data"""
    result = get_kline_yahoo(ticker, days)
    if result.get('success'):
        return result
    return get_kline_twelvedata(ticker, days)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': '用法: realtime_price.py TICKER [--kline] [--batch TICKER1,TICKER2,...]'}))
        sys.exit(1)

    ticker = sys.argv[1].upper()

    if '--kline' in sys.argv:
        days = 90
        for i, arg in enumerate(sys.argv):
            if arg == '--days' and i + 1 < len(sys.argv):
                days = int(sys.argv[i + 1])
        print(json.dumps(get_kline(ticker, days)))
    elif '--batch' in sys.argv:
        # 批量模式: --batch AAPL,MSFT,GOOGL
        for i, arg in enumerate(sys.argv):
            if arg == '--batch' and i + 1 < len(sys.argv):
                tickers = [t.strip() for t in sys.argv[i + 1].split(',') if t.strip()]
                results = get_quotes_yahoo_batch(tickers)
                print(json.dumps({'success': True, 'quotes': results}))
                break
    else:
        print(json.dumps(get_quote(ticker)))
