import { computed, onMounted, ref } from "vue";
import { listSignals } from "../db/idb";
const rows = ref([]);
const symbolFilter = ref("");
const filteredRows = computed(() => {
    if (!symbolFilter.value.trim())
        return rows.value;
    const key = symbolFilter.value.trim();
    return rows.value.filter((r) => r.symbol.includes(key));
});
function fmtTime(ts) {
    return new Date(ts).toLocaleString();
}
async function load() {
    rows.value = await listSignals(500);
}
onMounted(load);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
const __VLS_0 = {}.ElPageHeader;
/** @type {[typeof __VLS_components.ElPageHeader, typeof __VLS_components.elPageHeader, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    content: "信号日志",
}));
const __VLS_2 = __VLS_1({
    content: "信号日志",
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
    label: "代码筛选",
}));
const __VLS_14 = __VLS_13({
    label: "代码筛选",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
const __VLS_16 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    modelValue: (__VLS_ctx.symbolFilter),
    placeholder: "如 600519",
    clearable: true,
}));
const __VLS_18 = __VLS_17({
    modelValue: (__VLS_ctx.symbolFilter),
    placeholder: "如 600519",
    clearable: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
var __VLS_15;
const __VLS_20 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ 'onClick': {} },
}));
const __VLS_22 = __VLS_21({
    ...{ 'onClick': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
let __VLS_24;
let __VLS_25;
let __VLS_26;
const __VLS_27 = {
    onClick: (__VLS_ctx.load)
};
__VLS_23.slots.default;
var __VLS_23;
var __VLS_11;
const __VLS_28 = {}.ElTable;
/** @type {[typeof __VLS_components.ElTable, typeof __VLS_components.elTable, typeof __VLS_components.ElTable, typeof __VLS_components.elTable, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    data: (__VLS_ctx.filteredRows),
    size: "small",
    maxHeight: "520",
}));
const __VLS_30 = __VLS_29({
    data: (__VLS_ctx.filteredRows),
    size: "small",
    maxHeight: "520",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
const __VLS_32 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    prop: "time",
    label: "时间",
    width: "180",
}));
const __VLS_34 = __VLS_33({
    prop: "time",
    label: "时间",
    width: "180",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_35.slots;
    const [{ row }] = __VLS_getSlotParams(__VLS_thisSlot);
    (__VLS_ctx.fmtTime(row.time));
}
var __VLS_35;
const __VLS_36 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    prop: "symbol",
    label: "代码",
    width: "100",
}));
const __VLS_38 = __VLS_37({
    prop: "symbol",
    label: "代码",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
const __VLS_40 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    prop: "name",
    label: "名称",
    width: "120",
}));
const __VLS_42 = __VLS_41({
    prop: "name",
    label: "名称",
    width: "120",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
const __VLS_44 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    prop: "strategy",
    label: "策略",
    width: "140",
}));
const __VLS_46 = __VLS_45({
    prop: "strategy",
    label: "策略",
    width: "140",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
const __VLS_48 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    prop: "signalType",
    label: "信号",
    width: "90",
}));
const __VLS_50 = __VLS_49({
    prop: "signalType",
    label: "信号",
    width: "90",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
const __VLS_52 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    prop: "price",
    label: "价格",
    width: "100",
}));
const __VLS_54 = __VLS_53({
    prop: "price",
    label: "价格",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
const __VLS_56 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    prop: "changePct",
    label: "涨跌幅%",
    width: "100",
}));
const __VLS_58 = __VLS_57({
    prop: "changePct",
    label: "涨跌幅%",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
const __VLS_60 = {}.ElTableColumn;
/** @type {[typeof __VLS_components.ElTableColumn, typeof __VLS_components.elTableColumn, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    prop: "note",
    label: "备注",
    minWidth: "180",
}));
const __VLS_62 = __VLS_61({
    prop: "note",
    label: "备注",
    minWidth: "180",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
var __VLS_31;
var __VLS_7;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            symbolFilter: symbolFilter,
            filteredRows: filteredRows,
            fmtTime: fmtTime,
            load: load,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
