import { ref } from "vue";
import { getSyncStatus, postSync } from "../api/client";
const symbols = ref("000001,600519");
const days = ref(365);
const progress = ref(0);
const statusText = ref("未开始");
let timer = null;
async function start() {
    const list = symbols.value.split(",").map((x) => x.trim()).filter(Boolean);
    const res = await postSync({ symbols: list, incremental_days: days.value, period: "daily" });
    const taskId = res.task_id;
    statusText.value = `任务 ${taskId} 已提交`;
    if (timer)
        window.clearInterval(timer);
    timer = window.setInterval(async () => {
        const s = await getSyncStatus(taskId);
        const total = s.total || 0;
        const done = s.done || 0;
        progress.value = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
        statusText.value = `${s.status} | ${done}/${total} | 失败 ${s.failed}`;
        if (["done", "done_with_errors", "unknown"].includes(s.status)) {
            if (timer)
                window.clearInterval(timer);
            timer = null;
        }
    }, 1500);
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
const __VLS_0 = {}.ElPageHeader;
/** @type {[typeof __VLS_components.ElPageHeader, typeof __VLS_components.elPageHeader, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    content: "数据同步",
}));
const __VLS_2 = __VLS_1({
    content: "数据同步",
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
    label: "股票代码",
}));
const __VLS_14 = __VLS_13({
    label: "股票代码",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
const __VLS_16 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    modelValue: (__VLS_ctx.symbols),
    placeholder: "000001,600519",
    ...{ style: {} },
}));
const __VLS_18 = __VLS_17({
    modelValue: (__VLS_ctx.symbols),
    placeholder: "000001,600519",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
var __VLS_15;
const __VLS_20 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    label: "增量天数",
}));
const __VLS_22 = __VLS_21({
    label: "增量天数",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
const __VLS_24 = {}.ElInputNumber;
/** @type {[typeof __VLS_components.ElInputNumber, typeof __VLS_components.elInputNumber, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    modelValue: (__VLS_ctx.days),
    min: (1),
    max: (3650),
}));
const __VLS_26 = __VLS_25({
    modelValue: (__VLS_ctx.days),
    min: (1),
    max: (3650),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
var __VLS_23;
const __VLS_28 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    ...{ 'onClick': {} },
    type: "primary",
}));
const __VLS_30 = __VLS_29({
    ...{ 'onClick': {} },
    type: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
let __VLS_32;
let __VLS_33;
let __VLS_34;
const __VLS_35 = {
    onClick: (__VLS_ctx.start)
};
__VLS_31.slots.default;
var __VLS_31;
var __VLS_11;
const __VLS_36 = {}.ElProgress;
/** @type {[typeof __VLS_components.ElProgress, typeof __VLS_components.elProgress, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    percentage: (__VLS_ctx.progress),
    ...{ style: {} },
}));
const __VLS_38 = __VLS_37({
    percentage: (__VLS_ctx.progress),
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: {} },
});
(__VLS_ctx.statusText);
var __VLS_7;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            symbols: symbols,
            days: days,
            progress: progress,
            statusText: statusText,
            start: start,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
