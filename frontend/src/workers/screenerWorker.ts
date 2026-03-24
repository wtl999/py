import { evaluateStrategyDoc } from "../utils/strategyEngine";
import type { Bar } from "../utils/indicators";
import type { StrategyDoc } from "../utils/strategyTypes";

type Req = {
  type: "eval";
  reqId: number;
  strategy: StrategyDoc;
  strategies: StrategyDoc[];
  bars: Bar[];
};

type Res =
  | { type: "ok"; reqId: number; buy: boolean }
  | { type: "error"; reqId: number; message: string };

self.onmessage = (ev: MessageEvent<Req>) => {
  const p = ev.data;
  if (p.type !== "eval") return;
  try {
    const i = p.bars.length - 1;
    if (i < 0) {
      self.postMessage({ type: "ok", reqId: p.reqId, buy: false } as Res);
      return;
    }
    const map = new Map(p.strategies.map((s) => [s.id, s] as const));
    const { buy } = evaluateStrategyDoc(p.strategy, p.bars, i, (id) => map.get(id));
    self.postMessage({ type: "ok", reqId: p.reqId, buy } as Res);
  } catch (e) {
    self.postMessage({ type: "error", reqId: p.reqId, message: (e as Error).message } as Res);
  }
};
