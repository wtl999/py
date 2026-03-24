import { evaluateStrategyDoc } from "../utils/strategyEngine";
import type { Bar } from "../utils/indicators";
import type { StrategyDoc } from "../utils/strategyTypes";

type Req = {
  type: "eval";
  strategy: StrategyDoc;
  strategies: StrategyDoc[];
  bars: Bar[];
};

type Res = { type: "ok"; buy: boolean } | { type: "error"; message: string };

self.onmessage = (ev: MessageEvent<Req>) => {
  try {
    const p = ev.data;
    if (p.type !== "eval") return;
    const i = p.bars.length - 1;
    if (i < 0) {
      self.postMessage({ type: "ok", buy: false } as Res);
      return;
    }
    const map = new Map(p.strategies.map((s) => [s.id, s] as const));
    const { buy } = evaluateStrategyDoc(p.strategy, p.bars, i, (id) => map.get(id));
    self.postMessage({ type: "ok", buy } as Res);
  } catch (e) {
    self.postMessage({ type: "error", message: (e as Error).message } as Res);
  }
};

