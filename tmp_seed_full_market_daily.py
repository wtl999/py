import json
import sqlite3
import time
from datetime import datetime, timedelta

import akshare as ak
import pandas as pd


DB_PATH = r"D:\lh\py\backend\data\quant.db"
PROGRESS_PATH = r"D:\lh\py\backend\data\seed_progress_daily.json"
PERIOD = "daily"
DAYS = 730


def market_symbol(code: str) -> str:
    c = code.zfill(6)
    return ("sh" if c.startswith(("5", "6", "9")) else "sz") + c


def norm_rows(df: pd.DataFrame, symbol: str) -> list[tuple]:
    if df is None or df.empty:
        return []
    if "date" in df.columns:
        d = df.copy()
    else:
        d = df.reset_index().rename(columns={"index": "date"})
    out: list[tuple] = []
    cutoff = (datetime.now().date() - timedelta(days=DAYS)).strftime("%Y%m%d")
    created_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    for _, r in d.iterrows():
        ds = str(r.get("date", "")).replace("-", "")[:8]
        if not ds or ds < cutoff:
            continue
        out.append(
            (
                symbol,
                PERIOD,
                ds,
                float(r.get("open", 0) or 0),
                float(r.get("high", 0) or 0),
                float(r.get("low", 0) or 0),
                float(r.get("close", 0) or 0),
                float(r.get("volume", 0) or 0),
                float(r.get("amount", 0) or 0),
                created_at,
            )
        )
    return out


def save_progress(done: int, total: int, ok: int, fail: int, current: str, last_error: str = "") -> None:
    with open(PROGRESS_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {
                "done": done,
                "total": total,
                "ok": ok,
                "fail": fail,
                "current": current,
                "last_error": last_error,
                "updated_at": datetime.now().isoformat(timespec="seconds"),
            },
            f,
            ensure_ascii=False,
            indent=2,
        )


def main() -> None:
    stock_df = ak.stock_info_a_code_name()
    code_col = "code" if "code" in stock_df.columns else stock_df.columns[0]
    symbols = [str(x).zfill(6) for x in stock_df[code_col].tolist()]
    total = len(symbols)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    sql = """
    INSERT INTO kline_bars
    (symbol, period, trade_date, open, high, low, close, volume, amount, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(symbol, period, trade_date) DO UPDATE SET
      open=excluded.open,
      high=excluded.high,
      low=excluded.low,
      close=excluded.close,
      volume=excluded.volume,
      amount=excluded.amount
    """

    ok = 0
    fail = 0
    done = 0
    for sym in symbols:
        err = ""
        try:
            df = ak.stock_zh_a_daily(symbol=market_symbol(sym), adjust="qfq")
            rows = norm_rows(df, sym)
            if rows:
                cur.executemany(sql, rows)
                conn.commit()
            ok += 1
        except Exception as ex:
            fail += 1
            err = str(ex)
        done += 1
        if done % 10 == 0 or done == total:
            print(f"[seed] {done}/{total} ok={ok} fail={fail} current={sym}", flush=True)
        save_progress(done, total, ok, fail, sym, err)
        time.sleep(0.08)

    conn.close()
    print(f"[seed] DONE total={total} ok={ok} fail={fail}", flush=True)


if __name__ == "__main__":
    main()
