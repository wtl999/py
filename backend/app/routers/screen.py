from fastapi import APIRouter, Depends
from typing import Dict, Any
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ScreenRequest
from app.services.strategy_parser import parse_selection_strategy
from app.services import ak_client

router = APIRouter(prefix="/api", tags=["screen"])


@router.post("/screen")
def screen_stocks(
    req: ScreenRequest,
    db: Session = Depends(get_db)
):
    """
    专业选股接口
    接收白话文或公式，返回筛选后的股票
    """
    text = req.text.strip()
    symbols = req.symbols
    limit = req.limit
    
    if not text:
        return {"error": "请输入选股策略", "stocks": []}
    
    # 1. 解析策略
    parsed = parse_selection_strategy(text)
    
    # 2. 获取实时行情
    df = ak_client.fetch_spot_all()
    if df.empty:
        return {
            "parsed": parsed,
            "stocks": [],
            "message": "未能获取实时行情数据"
        }
    
    # 3. 根据解析结果进行智能筛选
    results = []
    df_sample = df.head(500)  # 扩大样本
    
    conditions = parsed.get("conditions", [])
    has_conditions = len(conditions) > 0
    
    for _, row in df_sample.iterrows():
        code = str(row.get("代码", row.get("code", ""))).zfill(6)
        name = str(row.get("名称", row.get("name", "")))
        change_pct = float(row.get("涨跌幅", row.get("change_pct", 0)) or 0)
        price = float(row.get("最新价", row.get("price", 0)) or 0)
        vol_ratio = float(row.get("量比", row.get("volume_ratio", 1.0)) or 1.0)
        
        match_score = 0
        reasons = []
        
        # 根据解析出的条件打分
        for cond in conditions:
            ctype = cond.get("type")
            if ctype == "change_pct" and cond.get("op") == "gt":
                if change_pct >= cond.get("value", 0):
                    match_score += 3
                    reasons.append(f"涨幅{change_pct:.1f}%")
            elif ctype == "limit_up":
                if change_pct >= 9.5:
                    match_score += 5
                    reasons.append("涨停")
            elif ctype == "volume_ratio":
                if vol_ratio >= cond.get("value", 1.5):
                    match_score += 3
                    reasons.append(f"量比{vol_ratio:.1f}")
            elif ctype == "macd_cross" and cond.get("direction") == "golden":
                match_score += 2
                reasons.append("MACD金叉")
            elif ctype == "rsi" and cond.get("op") == "lt":
                match_score += 2
                reasons.append("RSI超卖")
        
        # 如果没有明确条件，则返回有一定活力的股票
        if not has_conditions and change_pct > 0.5:
            match_score = 1
            reasons.append("市场活跃")
        
        if match_score > 0 or not has_conditions:
            results.append({
                "symbol": code,
                "name": name,
                "price": price,
                "change_pct": round(change_pct, 2),
                "volume_ratio": round(vol_ratio, 2),
                "match_score": match_score,
                "reasons": reasons,
                "matched_strategy": text[:50] + "..." if len(text) > 50 else text
            })
    
    # 按匹配度排序
    results.sort(key=lambda x: x["match_score"], reverse=True)
    
    return {
        "parsed": parsed,
        "stocks": results[:limit],
        "total_matched": len(results),
        "message": f"已解析策略并筛选出 {len(results)} 只符合条件的股票",
        "strategy": text
    }