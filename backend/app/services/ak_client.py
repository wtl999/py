from datetime import datetime, timedelta

import akshare as ak
import pandas as pd


def fetch_stock_list() -> pd.DataFrame:
    """获取A股股票列表，增加备用机制"""
    try:
        df = ak.stock_info_a_code_name()
        if not df.empty and len(df) > 100:
            return df
        print("[ak_client] ak.stock_info_a_code_name() 返回数据不足，尝试备用接口")
    except Exception as e:
        print(f"[ak_client] 获取股票列表失败: {e}")

    # 备用：使用实时行情接口（数据更稳定）
    try:
        df = ak.stock_zh_a_spot_em()
        if not df.empty and len(df) > 100:
            # 统一列名
            if '代码' in df.columns:
                df = df.rename(columns={'代码': 'code', '名称': 'name'})
            elif 'code' not in df.columns and len(df.columns) >= 2:
                df.columns = ['code', 'name'] + list(df.columns[2:])
            print(f"[ak_client] 使用 spot_em 接口返回 {len(df)} 条股票")
            return df
    except Exception as e:
        print(f"[ak_client] 备用接口也失败: {e}")

    # 最终硬编码兜底（保证一定有数据）
    print("[ak_client] 使用硬编码股票列表兜底")
    fallback_data = {
        'code': ['000001', '600519', '000725', '601318', '600036', '601166', '600900', '601398', '600016', '601288'],
        'name': ['上证指数', '贵州茅台', '京东方A', '中国平安', '招商银行', '兴业银行', '长江电力', '工商银行', '民生银行', '农业银行']
    }
    return pd.DataFrame(fallback_data)


def fetch_hist(symbol: str, start: str, end: str, period: str = "daily") -> pd.DataFrame:
    freq = period if period in {"daily", "weekly", "monthly"} else "daily"
    return ak.stock_zh_a_hist(symbol=symbol, period=freq, start_date=start, end_date=end, adjust="qfq")


def fetch_spot_all() -> pd.DataFrame:
    return ak.stock_zh_a_spot_em()


def fetch_index_spot() -> pd.DataFrame:
    return ak.stock_zh_index_spot_sina()


def default_date_range(days: int) -> tuple[str, str]:
    end = datetime.now().date()
    start = end - timedelta(days=days)
    return start.strftime("%Y%m%d"), end.strftime("%Y%m%d")
