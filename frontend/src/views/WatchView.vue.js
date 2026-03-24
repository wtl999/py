import { ElMessage } from "element-plus";
import { onBeforeUnmount, ref } from "vue";
import { executePaperTrade, saveSignal } from "../db/idb";
const symbolsInput = ref("000001,600519");
const upThreshold = ref(2);
const downThreshold = ref(-2);
const autoTrade = ref(false);
const connected = ref(false);
const rows = ref([]);
let ws = null;
const signalCooldown = new Map();
function getSymbols() {
    return new Set(symbolsInput.value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.padStart(6, "0")));
}
function safeNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}
async function onSignal(sig) {
    const cooldownKey = `${sig.symbol}_${sig.signalType}`;
    const now = Date.now();
    const last = signalCooldown.get(cooldownKey) ?? 0;
    if (now - last < 60000) {
        return;
    }
    signalCooldown.set(cooldownKey, now);
    const saved = await saveSignal(sig);
    ElMessage.warning(`${sig.symbol} ${sig.signalType.toUpperCase()} 信号`);
    if (autoTrade.value && (sig.signalType === "buy" || sig.signalType === "sell")) {
        try {
            await executePaperTrade({
                symbol: sig.symbol,
                side: sig.signalType,
                price: sig.price,
                quantity: 100,
                strategy: sig.strategy,
                signalId: saved.id
            });
            ElMessage.success(`${sig.symbol} 已自动${sig.signalType === "buy" ? "买入" : "卖出"}100股`);
        }
        catch (e) {
            ElMessage.error(e.message);
        }
    }
}
function parseRows(dataRows, symbols) {
    const parsed = [];
    for (const item of dataRows) {
        const row = item;
        const code = String(row["代码"] ?? row["code"] ?? "").padStart(6, "0");
        if (!code || !symbols.has(code))
            continue;
        parsed.push({
            code,
            name: String(row["名称"] ?? row["name"] ?? ""),
            price: safeNumber(row["最新价"] ?? row["price"]),
            changePct: safeNumber(row["涨跌幅"] ?? row["changePct"])
        });
    }
    return parsed;
}
async function evaluateSignals(list) {
    for (const q of list) {
        if (q.changePct >= upThreshold.value) {
            await onSignal({
                symbol: q.code,
                name: q.name,
                strategy: "pct_breakout",
                signalType: "buy",
                price: q.price,
                changePct: q.changePct,
                note: `涨幅达到 ${q.changePct.toFixed(2)}%`
            });
        }
        else if (q.changePct <= downThreshold.value) {
            await onSignal({
                symbol: q.code,
                name: q.name,
                strategy: "pct_breakout",
                signalType: "sell",
                price: q.price,
                changePct: q.changePct,
                note: `跌幅达到 ${q.changePct.toFixed(2)}%`
            });
        }
    }
}
function connect() {
    if (ws)
        ws.close();
    const symbols = getSymbols();
    ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/realtime`);
    ws.onopen = () => {
        connected.value = true;
        ElMessage.success("实时连接已建立");
    };
    ws.onclose = () => {
        connected.value = false;
    };
    ws.onerror = () => {
        ElMessage.error("实时连接异常");
    };
    ws.onmessage = async (evt) => {
        try {
            const payload = JSON.parse(String(evt.data));
            const nextRows = parseRows(payload.rows ?? [], symbols);
            rows.value = nextRows;
            await evaluateSignals(nextRows);
        }
        catch {
            // ignore malformed message
        }
    };
}
function disconnect() {
    if (ws) {
        ws.close();
        ws = null;
    }
    connected.value = false;
}
async function manualTrade(row, side) {
    try {
        await executePaperTrade({
            symbol: row.code,
            side,
            price: row.price,
            quantity: 100,
            strategy: "manual_watch"
        });
        ElMessage.success(`${row.code} ${side === "buy" ? "买入" : "卖出"}成功`);
    }
    catch (e) {
        ElMessage.error(e.message);
    }
}
onBeforeUnmount(() => {
    disconnect();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
const __VLS_0 = {}.ElPageHeader;
/** @type {[typeof __VLS_components.ElPageHeader, typeof __VLS_components.elPageHeader, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    content: "盘中实时监听（信号+模拟下单）",
}));
const __VLS_2 = __VLS_1({
    content: "盘中实时监听（信号+模拟下单）",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const __VLS_4 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    ...{ style: {} },
}));
const __VLS_6 = __VLS_5({
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
const __VLS_8 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    inline: true,
}));
const __VLS_10 = __VLS_9({
    inline: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
const __VLS_12 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    label: "监听代码",
}));
const __VLS_14 = __VLS_13({
    label: "监听代码",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
const __VLS_16 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    modelValue: (__VLS_ctx.symbolsInput),
    placeholder: "000001,600519",
    ...{ style: {} },
}));
const __VLS_18 = __VLS_17({
    modelValue: (__VLS_ctx.symbolsInput),
    placeholder: "000001,600519",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
var __VLS_15;
const __VLS_20 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    label: "涨幅触发(%)",
}));
const __VLS_22 = __VLS_21({
    label: "涨幅触发(%)",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
const __VLS_24 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    modelValue: (__VLS_ctx.upThreshold),
    step: (0.1),
}));
const __VLS_26 = __VLS_25({
    modelValue: (__VLS_ctx.upThreshold),
    step: (0.1),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
var __VLS_23;
const __VLS_28 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    label: "跌幅触发(%)",
}));
const __VLS_30 = __VLS_29({
    label: "跌幅触发(%)",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
const __VLS_32 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    modelValue: (__VLS_ctx.downThreshold),
    step: (0.1),
}));
const __VLS_34 = __VLS_33({
    modelValue: (__VLS_ctx.downThreshold),
    step: (0.1),
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
var __VLS_31;
const __VLS_36 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({}));
const __VLS_38 = __VLS_37({}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_39.slots.default;
const __VLS_40 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    modelValue: (__VLS_ctx.autoTrade),
    activeText: "自动模拟下单",
}));
const __VLS_42 = __VLS_41({
    modelValue: (__VLS_ctx.autoTrade),
    activeText: "自动模拟下单",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
var __VLS_39;
const __VLS_44 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    ...{ 'onClick': {} },
    type: "primary",
}));
const __VLS_46 = __VLS_45({
    ...{ 'onClick': {} },
    type: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
let __VLS_48;
let __VLS_49;
let __VLS_50;
const __VLS_51 = {
    onClick: (__VLS_ctx.connect)
};
__VLS_47.slots.default;
var __VLS_47;
const __VLS_52 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    ...{ 'onClick': {} },
}));
const __VLS_54 = __VLS_53({
    ...{ 'onClick': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
let __VLS_56;
let __VLS_57;
let __VLS_58;
const __VLS_59 = {
    onClick: (__VLS_ctx.disconnect)
};
__VLS_55.slots.default;
var __VLS_55;
var __VLS_11;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: {} },
});
(__VLS_ctx.connected ? "已连接" : "未连接");
var __VLS_7;
const __VLS_60 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    ...{ style: {} },
}));
const __VLS_62 = __VLS_61({
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_63.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_63.slots;
}
const __VLS_64 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    data: (__VLS_ctx.rows),
    size: "small",
    maxHeight: "360",
}));
const __VLS_66 = __VLS_65({
    data: (__VLS_ctx.rows),
    size: "small",
    maxHeight: "360",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_67.slots.default;
const __VLS_68 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    prop: "code",
    label: "代码",
    width: "100",
}));
const __VLS_70 = __VLS_69({
    prop: "code",
    label: "代码",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
const __VLS_72 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    prop: "name",
    label: "名称",
    minWidth: "120",
}));
const __VLS_74 = __VLS_73({
    prop: "name",
    label: "名称",
    minWidth: "120",
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
const __VLS_76 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    prop: "price",
    label: "最新价",
    width: "110",
}));
const __VLS_78 = __VLS_77({
    prop: "price",
    label: "最新价",
    width: "110",
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
const __VLS_80 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    prop: "changePct",
    label: "涨跌幅%",
    width: "110",
}));
const __VLS_82 = __VLS_81({
    prop: "changePct",
    label: "涨跌幅%",
    width: "110",
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
const __VLS_84 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    label: "操作",
    width: "260",
}));
const __VLS_86 = __VLS_85({
    label: "操作",
    width: "260",
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_87.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_88 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        ...{ 'onClick': {} },
        type: "success",
        size: "small",
    }));
    const __VLS_90 = __VLS_89({
        ...{ 'onClick': {} },
        type: "success",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    let __VLS_92;
    let __VLS_93;
    let __VLS_94;
    const __VLS_95 = {
        onClick: (...[$event]) => {
            __VLS_ctx.manualTrade(row, 'buy');
        }
    };
    __VLS_91.slots.default;
    var __VLS_91;
    const __VLS_96 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        ...{ 'onClick': {} },
        type: "danger",
        size: "small",
    }));
    const __VLS_98 = __VLS_97({
        ...{ 'onClick': {} },
        type: "danger",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    let __VLS_100;
    let __VLS_101;
    let __VLS_102;
    const __VLS_103 = {
        onClick: (...[$event]) => {
            __VLS_ctx.manualTrade(row, 'sell');
        }
    };
    __VLS_99.slots.default;
    var __VLS_99;
}
var __VLS_87;
var __VLS_67;
var __VLS_63;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            symbolsInput: symbolsInput,
            upThreshold: upThreshold,
            downThreshold: downThreshold,
            autoTrade: autoTrade,
            connected: connected,
            rows: rows,
            connect: connect,
            disconnect: disconnect,
            manualTrade: manualTrade,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
