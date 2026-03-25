from typing import Dict, List, Any, Optional
from datetime import datetime
import re
import json

class StrategyParser:
    """专业的选股策略解析AI
    
    支持自然语言白话文 + 通达信/同花顺公式
    输出标准结构化JSON供后端执行
    """
    
    def __init__(self):
        self.condition_map = {
            # 行情类
            r'(\d+)[日天]?(?:内|涨幅|涨跌幅|涨跌).*?(?:上涨|大于|超过|>|≥|超过)(\d+)%?': lambda m: {"type": "change_pct", "period": int(m[1]), "op": "gt", "value": float(m[2])},
            r'(\d+)[日天]?(?:内|涨幅|涨跌幅|涨跌).*?(?:下跌|小于|<|≤)(\d+)%?': lambda m: {"type": "change_pct", "period": int(m[1]), "op": "lt", "value": float(m[2])},
            r'(?:涨停|封板|涨停板)': lambda _: {"type": "limit_up", "threshold": 9.8},
            r'(?:跌停|跌停板)': lambda _: {"type": "limit_down", "threshold": -9.8},
            r'量比.*?(?:大于|超过|>|≥)(\d+\.?\d*)': lambda m: {"type": "volume_ratio", "op": "gt", "value": float(m[1])},
            r'(?:换手|换手率).*?(?:大于|超过|>|≥)(\d+\.?\d*)': lambda m: {"type": "turnover", "op": "gt", "value": float(m[1])},
            r'(?:成交量|成交额|放量).*?(?:大于|超过|>|≥)(\d+)': lambda m: {"type": "volume", "op": "gt", "value": int(m[1])},
            
            # 技术指标
            r'MACD.*?金叉|dif.*?上穿|dif.*?金叉': lambda _: {"type": "macd_cross", "direction": "golden"},
            r'MACD.*?死叉|dif.*?下穿': lambda _: {"type": "macd_cross", "direction": "death"},
            r'RSI.*?(\d+)?\s*(?:小于|低于|<|超卖)(\d+)': lambda m: {"type": "rsi", "period": int(m[1]) or 14, "op": "lt", "value": int(m[2] or 30)},
            r'KDJ.*?J.*?(\d+)': lambda m: {"type": "kdj_j", "op": "gt", "value": int(m[1])},
            r'(?:站上|突破|高于)(?:MA|均线)?(\d+)': lambda m: {"type": "price_above_ma", "period": int(m[1]), "op": "above"},
            r'(?:跌破|低于)(?:MA|均线)?(\d+)': lambda m: {"type": "price_above_ma", "period": int(m[1]), "op": "below"},
            
            # 财务/估值
            r'(?:PE|市盈率).*?(?:小于|低于|<)(\d+)': lambda m: {"type": "pe", "op": "lt", "value": int(m[1])},
            r'(?:PB|市净率).*?(?:小于|低于|<)(\d+)': lambda m: {"type": "pb", "op": "lt", "value": float(m[1])},
            r'(?:总市值|市值).*?(?:大于|超过|>|≥)(\d+)': lambda m: {"type": "market_cap", "op": "gt", "value": int(m[1]) * 100000000},
            
            # 过滤类
            r'(?:排除|不要|不含|过滤).*?ST|ST股': lambda _: {"type": "exclude_st", "enabled": True},
            r'(?:排除|不要|过滤).*?(?:新股|次新股|未开板)': lambda _: {"type": "exclude_new_stock", "enabled": True},
            r'(?:排除|不要|过滤).*?停牌|停牌股': lambda _: {"type": "exclude_suspended", "enabled": True},
            r'(?:排除|不要).*?(?:科创板|创业板|北交所)': lambda _: {"type": "exclude_board", "board": "kcb_cyb_bjs", "enabled": True},
        }
    
    def parse(self, text: str) -> Dict[str, Any]:
        """主解析入口"""
        if not text or not text.strip():
            return self._default_response("请输入选股条件")
            
        text = text.strip()
        desc = text
        
        # 分割多条策略（支持 ; 和换行）
        strategies = [s.strip() for s in re.split(r'[;\n]+', text) if s.strip()]
        
        conditions = []
        filters = []
        
        for strategy in strategies:
            conds = self._parse_single_strategy(strategy)
            if conds:
                if any(c.get('type', '').startswith('exclude_') for c in conds):
                    filters.extend([c for c in conds if c.get('type', '').startswith('exclude_')])
                else:
                    conditions.extend(conds)
        
        result = {
            "version": "1.0",
            "conditions": conditions,
            "filters": filters,
            "sort": [{"field": "change_pct", "direction": "desc"}],
            "limit": 100,
            "desc": desc,
            "formula": self._generate_formula(text),
            "parsed_at": datetime.now().isoformat(),
            "strategy_count": len(strategies)
        }
        
        return result
    
    def _parse_single_strategy(self, text: str) -> List[Dict]:
        """解析单条策略 - 增强版"""
        text_lower = text.lower().replace("，", ",").replace("。", " ").replace("；", ";")
        conditions = []
        
        # 遍历所有正则规则
        for pattern, handler in self.condition_map.items():
            matches = re.finditer(pattern, text_lower, re.IGNORECASE)
            for m in matches:
                try:
                    cond = handler(m)
                    if cond and cond not in conditions:
                        conditions.append(cond)
                except Exception:
                    continue
        
        # 高级兜底逻辑
        if not conditions:
            text_lower_clean = re.sub(r'[^\w\u4e00-\u9fa5]', ' ', text_lower)
            keywords = {
                '上涨': {"type": "change_pct", "period": 5, "op": "gt", "value": 5.0},
                '大涨': {"type": "change_pct", "period": 1, "op": "gt", "value": 8.0},
                '强势': {"type": "change_pct", "period": 5, "op": "gt", "value": 3.0},
                '放量': {"type": "volume_ratio", "op": "gt", "value": 2.0},
                '金叉': {"type": "macd_cross", "direction": "golden"},
                '死叉': {"type": "macd_cross", "direction": "death"},
                '超卖': {"type": "rsi", "period": 14, "op": "lt", "value": 30},
                '涨停': {"type": "limit_up", "threshold": 9.8},
            }
            for kw, cond in keywords.items():
                if kw in text_lower_clean:
                    conditions.append(cond)
                    break
        
        return conditions
    
    def _generate_formula(self, text: str) -> str:
        """生成对应的通达信/同花顺公式"""
        text_lower = text.lower()
        if '涨停' in text_lower:
            return "CLOSE/REF(CLOSE,1)>=1.098 AND VOLUME>REF(VOLUME,1)*1.5"
        if '金叉' in text_lower or 'macd' in text_lower:
            return "CROSS(MACD.DIF,MACD.DEA)"
        if '站上' in text_lower and 'ma' in text_lower:
            return "CLOSE>MA(CLOSE,20)"
        if 'rsi' in text_lower and '超卖' in text_lower:
            return "RSI(14)<30"
        return "// 根据白话文解析生成（可扩展）"
    
    def _default_response(self, message: str) -> Dict:
        return {
            "version": "1.0",
            "conditions": [],
            "filters": [],
            "sort": [],
            "limit": 50,
            "desc": message,
            "formula": "",
            "error": message
        }


# 单例
strategy_parser = StrategyParser()


def parse_selection_strategy(text: str) -> Dict[str, Any]:
    """供路由调用的解析函数"""
    return strategy_parser.parse(text)