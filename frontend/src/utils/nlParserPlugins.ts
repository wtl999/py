import type { Condition, LogicOp, StrategyDSL } from "./strategyTypes";

type ParseState = {
  text: string;
  logic: LogicOp;
  parts: string[];
  conditions: Condition[];
};

export interface NlParsePlugin {
  name: string;
  run(state: ParseState): ParseState;
}

export interface AiParserConfig {
  enabled: boolean;
  endpoint: string;
  model: string;
  apiKey?: string;
  timeoutMs: number;
}

const AI_CFG_KEY = "aq_ai_parser_cfg_v1";

export function getAiParserConfig(): AiParserConfig {
  try {
    const raw = localStorage.getItem(AI_CFG_KEY);
    if (!raw) {
      return {
        enabled: false,
        endpoint: "http://127.0.0.1:11434/v1/chat/completions",
        model: "qwen2.5:7b",
        apiKey: "",
        timeoutMs: 8000
      };
    }
    const v = JSON.parse(raw) as Partial<AiParserConfig>;
    return {
      enabled: Boolean(v.enabled),
      endpoint: String(v.endpoint || "http://127.0.0.1:11434/v1/chat/completions"),
      model: String(v.model || "qwen2.5:7b"),
      apiKey: String(v.apiKey || ""),
      timeoutMs: Number(v.timeoutMs || 8000)
    };
  } catch {
    return {
      enabled: false,
      endpoint: "http://127.0.0.1:11434/v1/chat/completions",
      model: "qwen2.5:7b",
      apiKey: "",
      timeoutMs: 8000
    };
  }
}

export function setAiParserConfig(v: AiParserConfig): void {
  try {
    localStorage.setItem(AI_CFG_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

function normalizeText(raw: string): string {
  return raw
    .trim()
    .replaceAll("涨停板", "涨停")
    .replaceAll("中规过", "出现过")
    .replaceAll("冲过", "出现过")
    .replaceAll("同花顺", "")
    .replaceAll("通达信", "")
    .replaceAll("ths", "")
    .replaceAll("tdx", "")
    .replace(/\s+/g, " ")
    .trim();
}

const logicPlugin: NlParsePlugin = {
  name: "logic",
  run(state) {
    const logic: LogicOp = /或者|或\b/.test(state.text) ? "or" : "and";
    const parts = state.text.split(/并且|且|同时|或者|或/).map((s) => s.trim()).filter(Boolean);
    return { ...state, logic, parts: parts.length ? parts : [state.text] };
  }
};

const tdxThsIndicatorPlugin: NlParsePlugin = {
  name: "tdx-ths-indicator",
  run(state) {
    const out: Condition[] = [];
    for (const rawPart of state.parts) {
      const s = rawPart.toLowerCase();
      const mLimit = rawPart.match(/(?:近|最近)?\s*(\d+)\s*(?:个)?\s*(?:交易日|天).*?(?:出现过|有过|触及过|曾经)?\s*涨停/);
      if (rawPart.includes("涨停")) {
        out.push({ type: "limit_up_within", lookback: mLimit ? Number(mLimit[1]) : 5, thresholdPct: 9.8 });
        continue;
      }

      const mDay = rawPart.match(/(?:近|最近)\s*(\d+)\s*个?\s*交易日|(\d+)\s*天内/);
      const mMa = rawPart.match(/(\d+)\s*日均线|ma\s*(\d+)/i);
      if ((rawPart.includes("没有跌破") || rawPart.includes("未跌破")) && (rawPart.includes("均线") || /ma\s*\d+/i.test(rawPart))) {
        out.push({
          type: "ma_not_below",
          maPeriod: Number((mMa?.[1] || mMa?.[2] || "5")),
          lookback: Number((mDay?.[1] || mDay?.[2] || "20")),
          useClose: true
        });
        continue;
      }

      if (rawPart.includes("金叉") && (s.includes("macd") || s.includes("dif") || s.includes("dea"))) {
        out.push({ type: "macd_cross", direction: "golden" });
        continue;
      }
      if (rawPart.includes("死叉") && (s.includes("macd") || s.includes("dif") || s.includes("dea"))) {
        out.push({ type: "macd_cross", direction: "death" });
        continue;
      }
      if ((rawPart.includes("0轴上方") || rawPart.includes("零轴上方")) && s.includes("macd")) {
        out.push({ type: "macd_zone", zone: "above_zero" });
        continue;
      }
      if ((rawPart.includes("0轴下方") || rawPart.includes("零轴下方")) && s.includes("macd")) {
        out.push({ type: "macd_zone", zone: "below_zero" });
        continue;
      }

      const mRsiLt = rawPart.match(/rsi\s*(\d+)?\s*(?:小于|低于|<)\s*(\d+(\.\d+)?)/i);
      if (mRsiLt) {
        out.push({ type: "rsi", period: Number(mRsiLt[1] || 14), op: "lt", value: Number(mRsiLt[2]) });
        continue;
      }
      const mRsiGt = rawPart.match(/rsi\s*(\d+)?\s*(?:大于|高于|>)\s*(\d+(\.\d+)?)/i);
      if (mRsiGt) {
        out.push({ type: "rsi", period: Number(mRsiGt[1] || 14), op: "gt", value: Number(mRsiGt[2]) });
        continue;
      }

      const mPriceMa = rawPart.match(/(?:收盘|股价).*(?:站上|高于|突破)\s*(\d+)\s*日均线|(?:收盘|股价).*(?:站上|高于|突破)\s*ma\s*(\d+)/i);
      if (mPriceMa) {
        out.push({ type: "price_ma", period: Number(mPriceMa[1] || mPriceMa[2]), op: "above" });
        continue;
      }
      const mPriceMaDown = rawPart.match(/(?:收盘|股价).*(?:跌破|低于|下穿)\s*(\d+)\s*日均线|(?:收盘|股价).*(?:跌破|低于|下穿)\s*ma\s*(\d+)/i);
      if (mPriceMaDown) {
        out.push({ type: "price_ma", period: Number(mPriceMaDown[1] || mPriceMaDown[2]), op: "below" });
        continue;
      }

      if ((rawPart.includes("布林") || s.includes("boll")) && (rawPart.includes("上轨") || s.includes("upper")) && (rawPart.includes("突破") || rawPart.includes("站上"))) {
        out.push({ type: "boll_break", period: 20, mult: 2, direction: "up" });
        continue;
      }
      if ((rawPart.includes("布林") || s.includes("boll")) && (rawPart.includes("下轨") || s.includes("lower")) && (rawPart.includes("跌破") || rawPart.includes("下穿"))) {
        out.push({ type: "boll_break", period: 20, mult: 2, direction: "down" });
        continue;
      }

      const mVol = rawPart.match(/放量.*?(\d+(\.\d+)?)\s*倍|量比.*?(\d+(\.\d+)?)/);
      if (rawPart.includes("放量") || mVol) {
        const ratio = Number(mVol?.[1] || mVol?.[3] || "1.5");
        out.push({ type: "vol_ratio", period: 5, minRatio: ratio });
      }
    }
    return { ...state, conditions: [...state.conditions, ...out] };
  }
};

const plugins: NlParsePlugin[] = [logicPlugin, tdxThsIndicatorPlugin];

export function parseNlByPlugins(expr: string): StrategyDSL | undefined {
  const text = normalizeText(expr);
  if (!text) return undefined;
  let state: ParseState = { text, logic: "and", parts: [text], conditions: [] };
  for (const p of plugins) state = p.run(state);
  if (!state.conditions.length) return undefined;
  return { version: 1, logic: state.logic, conditions: state.conditions };
}

function safeParseDsl(raw: string): StrategyDSL | undefined {
  try {
    const x = JSON.parse(raw) as StrategyDSL;
    if (!x || x.version !== 1 || (x.logic !== "and" && x.logic !== "or") || !Array.isArray(x.conditions)) return undefined;
    return x;
  } catch {
    return undefined;
  }
}

export async function parseNlByAiPlugin(expr: string, cfgIn?: Partial<AiParserConfig>): Promise<StrategyDSL | undefined> {
  const text = normalizeText(expr);
  if (!text) return undefined;
  const cfg = { ...getAiParserConfig(), ...cfgIn };
  if (!cfg.enabled || !cfg.endpoint || !cfg.model) return undefined;
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), Math.max(1000, cfg.timeoutMs || 8000));
  try {
    const prompt = [
      "你是量化策略解析器。把用户中文选股描述转换成 JSON。",
      "只允许输出 JSON，不允许输出解释文本。",
      'JSON 结构必须是 {"version":1,"logic":"and|or","conditions":[...]}。',
      "conditions 允许类型：macd_cross/macd_zone/ma_cross/price_ma/rsi/kdj_j/boll_break/vol_ratio/limit_up_within/ma_not_below。",
      "字段必须合法；无法解析时输出空对象 {}。",
      `用户输入：${text}`
    ].join("\n");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
    const resp = await fetch(cfg.endpoint, {
      method: "POST",
      headers,
      signal: ac.signal,
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!resp.ok) return undefined;
    const data = await resp.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      message?: { content?: string };
      response?: string;
    };
    const content =
      data.choices?.[0]?.message?.content ??
      data.message?.content ??
      data.response ??
      "";
    const jsonLike = String(content).trim();
    if (!jsonLike) return undefined;
    const dsl = safeParseDsl(jsonLike);
    return dsl;
  } catch {
    return undefined;
  } finally {
    clearTimeout(tid);
  }
}

