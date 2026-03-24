import sqlite3

db = sqlite3.connect(r"D:\lh\py\backend\data\quant.db")
cur = db.cursor()

tables = [r[0] for r in cur.execute("select name from sqlite_master where type='table'").fetchall()]
print("tables:", tables)

if "kline_bars" in tables:
    total = cur.execute("select count(*) from kline_bars").fetchone()[0]
    sym = cur.execute("select count(distinct symbol) from kline_bars").fetchone()[0]
    min_d, max_d = cur.execute("select min(trade_date), max(trade_date) from kline_bars").fetchone()
    print("kline_bars:", total, sym, min_d, max_d)
    by_period = cur.execute("select period, count(*), count(distinct symbol) from kline_bars group by period").fetchall()
    print("by_period:", by_period)
