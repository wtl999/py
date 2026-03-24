from datetime import datetime, timedelta

import akshare as ak
import pandas as pd


def fetch_stock_list() -> pd.DataFrame:
    return ak.stock_info_a_code_name()


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
