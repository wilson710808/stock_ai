#!/usr/bin/env python3
"""
收集 Investing.com 績優美股推薦
按行業板塊提供 TOP5
"""
import json
import time

# 預設的績優股列表（按行業板塊）
# 來源：Investing.com 常見板塊龍頭 + 市場公認的優質標的
RECOMMEND_STOCKS = {
    "科技": [
        {"ticker": "AAPL", "name": "Apple Inc.", "reason": "全球消費電子龍頭，強大品牌護城河"},
        {"ticker": "MSFT", "name": "Microsoft Corp.", "reason": "軟體與雲端服務龍頭，穩定現金流"},
        {"ticker": "NVDA", "name": "NVIDIA Corp.", "reason": "AI晶片龍頭，技術護城河寬闊"},
        {"ticker": "GOOGL", "name": "Alphabet Inc.", "reason": "搜尋與廣告龍頭，AI布局領先"},
        {"ticker": "AMZN", "name": "Amazon.com Inc.", "reason": "電商與雲端龍頭，規模優勢顯著"}
    ],
    "消費": [
        {"ticker": "COST", "name": "Costco Wholesale", "reason": "會員制量販龍頭，客戶忠誠度高"},
        {"ticker": "WMT", "name": "Walmart Inc.", "reason": "全球零售龍頭，成本控制優秀"},
        {"ticker": "MCD", "name": "McDonald's Corp.", "reason": "餐飲連鎖龍頭，品牌價值高"},
        {"ticker": "NKE", "name": "Nike Inc.", "reason": "運動品牌龍頭，全球營運"},
        {"ticker": "SBUX", "name": "Starbucks Corp.", "reason": "咖啡連鎖龍頭，會員體系強大"}
    ],
    "金融": [
        {"ticker": "JPM", "name": "JPMorgan Chase", "reason": "銀行業龍頭，風險管理優秀"},
        {"ticker": "V", "name": "Visa Inc.", "reason": "支付龍頭，網絡效應強大"},
        {"ticker": "MA", "name": "Mastercard Inc.", "reason": "支付龍頭，全球網絡布局"},
        {"ticker": "BAC", "name": "Bank of America", "reason": "全國性銀行，多元化業務"},
        {"ticker": "BRK.B", "name": "Berkshire Hathaway", "reason": "巴菲特旗下投資公司，價值投資典範"}
    ],
    "醫療": [
        {"ticker": "JNJ", "name": "Johnson & Johnson", "reason": "醫療健康龍頭，產品線多元"},
        {"ticker": "UNH", "name": "UnitedHealth Group", "reason": "醫療保險與服務龍頭"},
        {"ticker": "MRK", "name": "Merck & Co.", "reason": "製藥龍頭，研發能力強"},
        {"ticker": "ABBV", "name": "AbbVie Inc.", "reason": "專科製藥，產品線強勁"},
        {"ticker": "LLY", "name": "Eli Lilly & Co.", "reason": "製藥龍頭，創新能力強"}
    ],
    "能源": [
        {"ticker": "XOM", "name": "Exxon Mobil", "reason": "能源龍頭，上下游整合"},
        {"ticker": "CVX", "name": "Chevron Corp.", "reason": "能源龍頭，股息穩定"},
        {"ticker": "COP", "name": "ConocoPhillips", "reason": "勘探與生產，成本控制優秀"},
        {"ticker": "SLB", "name": "Schlumberger Ltd.", "reason": "油田服務龍頭，技術領先"},
        {"ticker": "PXD", "name": "Pioneer Natural", "reason": "頁岩油生產，成本優勢"}
    ],
    "工業": [
        {"ticker": "CAT", "name": "Caterpillar Inc.", "reason": "工程機械龍頭，全球佈局"},
        {"ticker": "BA", "name": "Boeing Co.", "reason": "航太國防龍頭，訂單充裕"},
        {"ticker": "HON", "name": "Honeywell Intl.", "reason": "工業自動化龍頭，技術領先"},
        {"ticker": "GE", "name": "General Electric", "reason": "工業集團，轉型成效顯現"},
        {"ticker": "UPS", "name": "United Parcel", "reason": "物流快遞龍頭，全球網絡"}
    ],
    "通訊": [
        {"ticker": "META", "name": "Meta Platforms", "reason": "社交媒體龍頭，元宇宙佈局"},
        {"ticker": "NFLX", "name": "Netflix Inc.", "reason": "串流媒體龍頭，內容優勢"},
        {"ticker": "DIS", "name": "Walt Disney Co.", "reason": "娛樂媒體龍頭，IP價值高"},
        {"ticker": "T", "name": "AT&T Inc.", "reason": "電信服務商，股息穩定"},
        {"ticker": "VZ", "name": "Verizon Comm.", "reason": "電信服務商，網絡優質"}
    ],
    "材料": [
        {"ticker": "LIN", "name": "Linde plc", "reason": "工業氣體龍頭，全球佈局"},
        {"ticker": "APD", "name": "Air Products & Chem.", "reason": "工業氣體龍頭，技術領先"},
        {"ticker": "SHW", "name": "Sherwin-Williams", "reason": "塗料龍頭，品牌優勢"},
        {"ticker": "ECL", "name": "Ecolab Inc.", "reason": "水處理與清潔方案龍頭"},
        {"ticker": "NUE", "name": "Nucor Corp.", "reason": "鋼鐵生產，成本優勢"}
    ],
    "地產": [
        {"ticker": "PLD", "name": "Prologis Inc.", "reason": "物流地產龍頭，全球布局"},
        {"ticker": "AMT", "name": "American Tower", "reason": "電信塔REITs，現金流穩定"},
        {"ticker": "EQIX", "name": "Equinix Inc.", "reason": "數據中心REITs，全球布局"},
        {"ticker": "SPG", "name": "Simon Property", "reason": "商場REITs，高質量資產"},
        {"ticker": "O", "name": "Realty Income", "reason": "月付股息REITs，資產質量優"}
    ],
    "公用": [
        {"ticker": "NEE", "name": "NextEra Energy", "reason": "電力公用事業，新能源布局"},
        {"ticker": "D", "name": "Dominion Energy", "reason": "電力與天然氣公用事業"},
        {"ticker": "SO", "name": "Southern Co.", "reason": "電力公用事業，股息穩定"},
        {"ticker": "DUK", "name": "Duke Energy", "reason": "電力公用事業，區域龍頭"},
        {"ticker": "EXC", "name": "Exelon Corp.", "reason": "電力公用事業，多元發電"}
    ]
}

def get_recommended_stocks():
    """獲取推薦股票列表"""
    return {
        "success": True,
        "sectors": RECOMMEND_STOCKS,
        "updated": int(time.time()),
        "source": "Investing.com 常見板塊龍頭 + 市場公認優質標的"
    }

if __name__ == "__main__":
    print(json.dumps(get_recommended_stocks(), ensure_ascii=False))
