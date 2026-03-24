import type { TradeRecord } from "../db/idb";

export interface EquityPoint {
  time: number;
  equity: number;
  label: string;
}

/** 按成交回放权益曲线（用成交价作为持仓市值标记） */
export function buildEquitySeries(trades: TradeRecord[], initCash: number): EquityPoint[] {
  const sorted = [...trades].sort((a, b) => a.time - b.time);
  let cash = initCash;
  const pos = new Map<string, { qty: number; avgCost: number; lastPrice: number }>();
  const points: EquityPoint[] = [];

  for (const t of sorted) {
    if (t.side === "buy") {
      cash -= t.amount + t.fee;
      const p = pos.get(t.symbol) ?? { qty: 0, avgCost: 0, lastPrice: t.price };
      const nq = p.qty + t.quantity;
      const avgCost = nq > 0 ? (p.qty * p.avgCost + t.amount) / nq : t.price;
      pos.set(t.symbol, { qty: nq, avgCost, lastPrice: t.price });
    } else {
      cash += t.amount - t.fee;
      const p = pos.get(t.symbol);
      if (p) {
        const nq = p.qty - t.quantity;
        if (nq <= 0) pos.delete(t.symbol);
        else pos.set(t.symbol, { ...p, qty: nq, lastPrice: t.price });
      }
    }
    let mv = 0;
    for (const [, v] of pos) mv += v.qty * v.lastPrice;
    points.push({
      time: t.time,
      equity: Math.round((cash + mv) * 100) / 100,
      label: new Date(t.time).toLocaleDateString()
    });
  }
  return points;
}

export function dailyReturnHistogram(points: EquityPoint[]): number[] {
  const rets: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1].equity;
    const b = points[i].equity;
    if (a > 0) rets.push((b - a) / a);
  }
  return rets.map((r) => Math.round(r * 10000) / 100);
}

/** 月度收益热力：key "2024-01" -> 累计涨跌% */
export function monthlyReturnMap(points: EquityPoint[]): Record<string, number> {
  const byMonth = new Map<string, { first: number; last: number }>();
  for (const p of points) {
    const d = new Date(p.time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cur = byMonth.get(key);
    if (!cur) byMonth.set(key, { first: p.equity, last: p.equity });
    else cur.last = p.equity;
  }
  const out: Record<string, number> = {};
  for (const [k, v] of byMonth) {
    if (v.first > 0) out[k] = Math.round(((v.last - v.first) / v.first) * 10000) / 100;
  }
  return out;
}
