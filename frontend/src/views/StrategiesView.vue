<template>
  <div class="page">
    <div class="head">
      <h2 class="aq-title">策略中心</h2>
      <p class="aq-subtitle">指标 / 组合 / 模板 / 备份 — 全部存于本机 IndexedDB</p>
    </div>

    <el-tabs type="border-card" class="tabs">
      <el-tab-pane label="我的策略">
        <div class="toolbar">
          <el-button type="primary" @click="openEditor()">新建策略</el-button>
          <el-dropdown @command="addFromTemplate">
            <el-button>从模板添加</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="(t, idx) in TEMPLATE_STRATEGIES" :key="idx" :command="idx">
                  {{ t.name }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button @click="openCombo()">新建组合</el-button>
        </div>
        <el-table :data="rows" class="mt" size="small" stripe>
          <el-table-column prop="name" label="名称" min-width="140" />
          <el-table-column prop="kind" label="类型" width="100" />
          <el-table-column label="启用" width="90">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" @change="persistRow(row)" />
            </template>
          </el-table-column>
          <el-table-column prop="updatedAt" label="更新" width="170">
            <template #default="{ row }">{{ fmt(row.updatedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="260" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" text @click="row.kind === 'combo' ? openCombo(row) : openEditor(row)">编辑</el-button>
              <el-button v-if="row.kind === 'combo'" text @click="copyCombo(row)">复制</el-button>
              <el-button type="danger" text @click="remove(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="数据备份">
        <el-card class="aq-card inner">
          <p class="hint">导出包含：策略、信号、成交、持仓、预警、自选、账户设置。</p>
          <el-space wrap>
            <el-button type="primary" @click="doExport">导出 JSON</el-button>
            <el-upload :auto-upload="false" :show-file-list="false" accept="application/json" @change="onImportFile">
              <el-button>导入（合并）</el-button>
            </el-upload>
            <el-upload :auto-upload="false" :show-file-list="false" accept="application/json" @change="onImportReplace">
              <el-button type="danger">导入（覆盖全部）</el-button>
            </el-upload>
          </el-space>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="editorVisible" :title="editorId ? '编辑策略' : '新建策略'" width="640px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="名称"><el-input v-model="editorName" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="editorKind" style="width: 100%">
            <el-option label="指标" value="indicator" />
            <el-option label="图形" value="pattern" />
            <el-option label="白话文" value="nl" />
          </el-select>
        </el-form-item>
        <el-form-item label="白话文/备注（可选）"><el-input v-model="editorExpr" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="DSL（JSON）">
          <el-input v-model="editorDslJson" type="textarea" :rows="12" class="mono" placeholder='{"version":1,"logic":"and","conditions":[...]}' />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEditor">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="comboVisible" :title="comboEditId ? '编辑组合策略' : '新建组合策略'" width="520px">
      <el-form label-position="top">
        <el-form-item label="名称"><el-input v-model="comboName" /></el-form-item>
        <el-form-item label="逻辑">
          <el-radio-group v-model="comboLogic">
            <el-radio-button label="and">全部满足 (AND)</el-radio-button>
            <el-radio-button label="or">任一满足 (OR)</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="包含策略">
          <el-select v-model="comboIds" multiple filterable style="width: 100%" placeholder="选择子策略">
            <el-option v-for="s in indicatorOnly" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="触发模式">
          <el-radio-group v-model="comboTriggerMode">
            <el-radio-button label="logic">按逻辑</el-radio-button>
            <el-radio-button label="score">按权重分数</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="comboTriggerMode === 'score'" label="最小触发分数">
          <el-input-number v-model="comboMinScore" :min="0.1" :step="0.1" :precision="1" />
        </el-form-item>
        <el-form-item label="子策略权重与优先级">
          <el-table :data="comboRefRows" size="small" stripe style="width: 100%">
            <el-table-column prop="name" label="策略" min-width="140" />
            <el-table-column label="权重" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.weight" :min="0.1" :step="0.1" :precision="1" />
              </template>
            </el-table-column>
            <el-table-column label="优先级" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.priority" :min="1" :step="1" />
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="comboVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCombo">保存组合</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, onMounted, ref, watch } from "vue";
import {
  deleteStrategyDoc,
  exportFullBackup,
  importFullBackup,
  listStrategyDocs,
  saveStrategyDoc
} from "../db/idb";
import {
  STRATEGY_SCHEMA_VERSION,
  TEMPLATE_STRATEGIES as STRATEGY_TEMPLATES,
  type StrategyDoc,
  type StrategyDSL
} from "../utils/strategyTypes";

const TEMPLATE_STRATEGIES = STRATEGY_TEMPLATES;

const rows = ref<StrategyDoc[]>([]);
const editorVisible = ref(false);
const editorId = ref<string | null>(null);
const editorName = ref("");
const editorKind = ref<StrategyDoc["kind"]>("indicator");
const editorExpr = ref("");
const editorDslJson = ref("");

const comboVisible = ref(false);
const comboEditId = ref<string | null>(null);
const comboName = ref("");
const comboLogic = ref<"and" | "or">("and");
const comboIds = ref<string[]>([]);
const comboTriggerMode = ref<"logic" | "score">("logic");
const comboMinScore = ref(1);
const comboRefRows = ref<Array<{ id: string; name: string; weight: number; priority: number }>>([]);

const indicatorOnly = computed(() => rows.value.filter((r) => r.kind !== "combo"));

function uid(): string {
  return `stg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function fmt(ts: number): string {
  return ts ? new Date(ts).toLocaleString() : "-";
}

async function load() {
  rows.value = await listStrategyDocs();
}

function defaultDsl(): StrategyDSL {
  return {
    version: STRATEGY_SCHEMA_VERSION,
    logic: "and",
    conditions: [{ type: "macd_cross", direction: "golden" }],
    exit: { logic: "and", conditions: [{ type: "macd_cross", direction: "death" }] }
  };
}

function openEditor(row?: StrategyDoc) {
  if (row && row.kind === "combo") {
    ElMessage.info("请使用「新建组合」管理组合策略");
    return;
  }
  editorId.value = row?.id ?? null;
  editorName.value = row?.name ?? "新策略";
  editorKind.value = row?.kind ?? "indicator";
  editorExpr.value = row?.exprText ?? "";
  editorDslJson.value = JSON.stringify(row?.dsl ?? defaultDsl(), null, 2);
  editorVisible.value = true;
}

async function saveEditor() {
  let dsl: StrategyDSL | undefined;
  try {
    dsl = JSON.parse(editorDslJson.value) as StrategyDSL;
  } catch {
    ElMessage.error("DSL JSON 格式错误");
    return;
  }
  const now = Date.now();
  const doc: StrategyDoc = {
    id: editorId.value ?? uid(),
    name: editorName.value.trim(),
    kind: editorKind.value,
    enabled: true,
    schemaVersion: STRATEGY_SCHEMA_VERSION,
    dsl,
    exprText: editorExpr.value.trim() || undefined,
    createdAt: editorId.value ? rows.value.find((r) => r.id === editorId.value)?.createdAt ?? now : now,
    updatedAt: now
  };
  await saveStrategyDoc(doc);
  editorVisible.value = false;
  await load();
  ElMessage.success("已保存");
}

async function persistRow(row: StrategyDoc) {
  await saveStrategyDoc({ ...row, updatedAt: Date.now() });
}

async function remove(id: string) {
  await ElMessageBox.confirm("确定删除该策略？", "确认", { type: "warning" });
  await deleteStrategyDoc(id);
  await load();
  ElMessage.success("已删除");
}

async function addFromTemplate(idx: number) {
  const tpl = TEMPLATE_STRATEGIES[idx];
  if (!tpl) return;
  const now = Date.now();
  const doc: StrategyDoc = {
    ...tpl,
    id: uid(),
    createdAt: now,
    updatedAt: now
  };
  await saveStrategyDoc(doc);
  await load();
  ElMessage.success(`已添加模板：${doc.name}`);
}

function openCombo(row?: StrategyDoc) {
  comboEditId.value = row?.kind === "combo" ? row.id : null;
  comboName.value = row?.kind === "combo" ? row.name : "新组合";
  comboLogic.value = row?.kind === "combo" ? row.combo?.logic ?? "and" : "and";
  const ids =
    row?.kind === "combo"
      ? row.combo?.strategyRefs?.map((x) => x.id) ?? row.combo?.strategyIds ?? []
      : [];
  comboIds.value = [...ids];
  comboTriggerMode.value = row?.kind === "combo" ? row.combo?.triggerMode ?? "logic" : "logic";
  comboMinScore.value = row?.kind === "combo" ? row.combo?.minScore ?? 1 : 1;
  const oldRows = row?.kind === "combo" ? row.combo?.strategyRefs ?? [] : [];
  comboRefRows.value = ids.map((id, idx) => {
    const prev = oldRows.find((x) => x.id === id);
    return {
      id,
      name: indicatorOnly.value.find((s) => s.id === id)?.name ?? id,
      weight: prev?.weight ?? 1,
      priority: prev?.priority ?? idx + 1
    };
  });
  comboVisible.value = true;
}

async function saveCombo() {
  if (!comboName.value.trim() || !comboIds.value.length) {
    ElMessage.warning("请填写名称并选择子策略");
    return;
  }
  const now = Date.now();
  const old = comboEditId.value ? rows.value.find((r) => r.id === comboEditId.value) : undefined;
  const doc: StrategyDoc = {
    id: comboEditId.value ?? uid(),
    name: comboName.value.trim(),
    kind: "combo",
    enabled: true,
    schemaVersion: STRATEGY_SCHEMA_VERSION,
    combo: {
      logic: comboLogic.value,
      strategyIds: [...comboIds.value],
      strategyRefs: comboRefRows.value.map((r) => ({
        id: r.id,
        weight: r.weight,
        priority: r.priority
      })),
      triggerMode: comboTriggerMode.value,
      minScore: comboTriggerMode.value === "score" ? comboMinScore.value : undefined
    },
    createdAt: old?.createdAt ?? now,
    updatedAt: now
  };
  await saveStrategyDoc(doc);
  comboEditId.value = null;
  comboVisible.value = false;
  await load();
  ElMessage.success(old ? "组合已更新" : "组合已保存");
}

async function copyCombo(row: StrategyDoc) {
  if (row.kind !== "combo") return;
  const now = Date.now();
  const doc: StrategyDoc = {
    ...row,
    id: uid(),
    name: `${row.name}_副本`,
    createdAt: now,
    updatedAt: now,
    combo: row.combo
      ? {
          ...row.combo,
          strategyIds: row.combo.strategyIds ? [...row.combo.strategyIds] : undefined,
          strategyRefs: row.combo.strategyRefs ? row.combo.strategyRefs.map((x) => ({ ...x })) : undefined
        }
      : undefined
  };
  await saveStrategyDoc(doc);
  await load();
  ElMessage.success("组合已复制");
}

watch(
  comboIds,
  (ids) => {
    const keep = new Map(comboRefRows.value.map((r) => [r.id, r]));
    comboRefRows.value = ids.map((id, idx) => {
      const old = keep.get(id);
      const name = indicatorOnly.value.find((s) => s.id === id)?.name ?? id;
      return {
        id,
        name,
        weight: old?.weight ?? 1,
        priority: old?.priority ?? idx + 1
      };
    });
    if (comboTriggerMode.value === "score" && comboRefRows.value.length && comboMinScore.value <= 0) {
      comboMinScore.value = 1;
    }
  },
  { deep: true }
);

async function doExport() {
  const json = await exportFullBackup();
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ai-quant-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  ElMessage.success("已导出");
}

async function onImportFile(ev: { raw?: File }) {
  const f = ev.raw;
  if (!f) return;
  const text = await f.text();
  await importFullBackup(text, "merge");
  await load();
  ElMessage.success("合并导入完成");
}

async function onImportReplace(ev: { raw?: File }) {
  const f = ev.raw;
  if (!f) return;
  await ElMessageBox.confirm("覆盖将清空本地策略、成交、信号等全部数据，确定？", "危险操作", { type: "error" });
  const text = await f.text();
  await importFullBackup(text, "replace");
  await load();
  ElMessage.success("已覆盖导入");
}

onMounted(load);
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.head {
  margin-bottom: 4px;
}
.tabs :deep(.el-tabs__content) {
  padding: 12px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.mt {
  margin-top: 12px;
}
.inner {
  border: none;
  box-shadow: none;
}
.hint {
  color: #64748b;
  font-size: 13px;
  margin: 0 0 12px;
}
.mono :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}
</style>
