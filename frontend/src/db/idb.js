import { openDB } from "idb";
export const dbPromise = openDB("ai-quant-v1", 1, {
    upgrade(db) {
        db.createObjectStore("strategies", { keyPath: "id" });
        const signals = db.createObjectStore("signals", { keyPath: "id" });
        signals.createIndex("by-time", "time");
        signals.createIndex("by-symbol", "symbol");
        const trades = db.createObjectStore("trades", { keyPath: "id" });
        trades.createIndex("by-time", "time");
        db.createObjectStore("positions", { keyPath: "symbol" });
        db.createObjectStore("syncSettings", { keyPath: "key" });
        db.createObjectStore("watchlist", { keyPath: "symbol" });
    }
});
function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
export async function saveSignal(input) {
    const db = await dbPromise;
    const row = { id: uid("sig"), time: Date.now(), ...input };
    await db.put("signals", row);
    return row;
}
export async function listSignals(limit = 200) {
    const db = await dbPromise;
    const rows = await db.getAll("signals");
    return rows.sort((a, b) => b.time - a.time).slice(0, limit);
}
export async function getPaperAccount() {
    const db = await dbPromise;
    const row = (await db.get("syncSettings", "paperAccount"));
    if (row)
        return row;
    const init = { cash: 1000000, initCash: 1000000, updatedAt: Date.now() };
    await db.put("syncSettings", { key: "paperAccount", ...init });
    return init;
}
export async function savePaperAccount(next) {
    const db = await dbPromise;
    await db.put("syncSettings", { key: "paperAccount", ...next });
}
export async function executePaperTrade(input) {
    const db = await dbPromise;
    const feeRate = 0.0003;
    const amount = input.price * input.quantity;
    const fee = amount * feeRate;
    const now = Date.now();
    const account = await getPaperAccount();
    const oldPos = await db.get("positions", input.symbol);
    let nextPos = oldPos;
    if (input.side === "buy") {
        if (account.cash < amount + fee) {
            throw new Error("可用资金不足");
        }
        const oldQty = oldPos?.quantity ?? 0;
        const oldCost = oldPos?.avgCost ?? 0;
        const nextQty = oldQty + input.quantity;
        const nextAvg = nextQty > 0 ? (oldQty * oldCost + amount) / nextQty : 0;
        nextPos = {
            symbol: input.symbol,
            quantity: nextQty,
            avgCost: nextAvg,
            marketPrice: input.price,
            updatedAt: now
        };
        account.cash = account.cash - amount - fee;
    }
    else {
        const oldQty = oldPos?.quantity ?? 0;
        if (oldQty < input.quantity) {
            throw new Error("持仓不足");
        }
        const remain = oldQty - input.quantity;
        if (remain === 0) {
            nextPos = undefined;
            await db.delete("positions", input.symbol);
        }
        else {
            nextPos = {
                symbol: input.symbol,
                quantity: remain,
                avgCost: oldPos?.avgCost ?? input.price,
                marketPrice: input.price,
                updatedAt: now
            };
        }
        account.cash = account.cash + amount - fee;
    }
    account.updatedAt = now;
    if (nextPos) {
        await db.put("positions", nextPos);
    }
    await savePaperAccount(account);
    const trade = {
        id: uid("trd"),
        time: now,
        symbol: input.symbol,
        side: input.side,
        price: input.price,
        quantity: input.quantity,
        amount,
        fee,
        strategy: input.strategy,
        signalId: input.signalId
    };
    await db.put("trades", trade);
    return { trade, account, position: nextPos };
}
export async function listTrades(limit = 300) {
    const db = await dbPromise;
    const rows = await db.getAll("trades");
    return rows.sort((a, b) => b.time - a.time).slice(0, limit);
}
export async function listPositions() {
    const db = await dbPromise;
    const rows = await db.getAll("positions");
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}
