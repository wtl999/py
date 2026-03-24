<template>
  <div class="page">
    <div>
      <h2 class="aq-title">报告与导出中心</h2>
      <p class="aq-subtitle">统一入口：跳转到各模块生成 CSV / HTML / PDF / 图片，数据均在本地浏览器</p>
    </div>

    <el-row :gutter="12">
      <el-col :span="12">
        <el-card class="aq-card">
          <template #header>绩效与图表</template>
          <el-space direction="vertical" alignment="start" :size="12">
            <el-button type="primary" @click="router.push('/')">数据看板（权益图可导出 PNG）</el-button>
            <el-button @click="router.push('/backtest')">策略回测（CSV / HTML / PDF）</el-button>
          </el-space>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="aq-card">
          <template #header>数据与校验</template>
          <el-space direction="vertical" alignment="start" :size="12">
            <el-button @click="router.push('/signals')">信号日志（导出 CSV）</el-button>
            <el-button @click="router.push('/paper')">模拟成交（导出 CSV）</el-button>
            <el-button @click="router.push('/indicator-lab')">指标快照与通达信对照校验</el-button>
            <el-button @click="router.push('/strategies')">策略备份（JSON 全量导出/导入）</el-button>
            <el-button type="primary" :loading="weeklyLoading" @click="exportWeeklyPdf">一键生成本周交易总结 PDF</el-button>
            <el-button :loading="weeklyLoading" @click="exportWeeklyHtml">导出本周交易总结 HTML</el-button>
          </el-space>
        </el-card>
      </el-col>
    </el-row>

    <el-alert type="info" :closable="false" title="说明：本页不存储文件，仅提供导航；导出文件由浏览器下载到本机。" />
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { listSignals, listTrades } from "../db/idb";

const router = useRouter();
const weeklyLoading = ref(false);

function weekStartTs(now = Date.now()): number {
  const d = new Date(now);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

async function exportWeeklyPdf() {
  weeklyLoading.value = true;
  try {
    const start = weekStartTs();
    const [trades, signals] = await Promise.all([listTrades(5000), listSignals(5000)]);
    const wTrades = trades.filter((t) => t.time >= start);
    const wSignals = signals.filter((s) => s.time >= start);
    const buyCount = wTrades.filter((t) => t.side === "buy").length;
    const sellCount = wTrades.filter((t) => t.side === "sell").length;
    const feeSum = wTrades.reduce((s, t) => s + t.fee, 0);
    const amountSum = wTrades.reduce((s, t) => s + t.amount, 0);
    const symbolCount = new Set(wTrades.map((t) => t.symbol)).size;

    const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text("Weekly Trading Summary", 40, 44);
    doc.setFontSize(11);
    doc.text(
      `Trades ${wTrades.length} | Signals ${wSignals.length} | Buy ${buyCount} | Sell ${sellCount} | Symbols ${symbolCount}`,
      40,
      66
    );
    doc.text(`Amount ${amountSum.toFixed(2)} | Fee ${feeSum.toFixed(2)}`, 40, 84);
    autoTable(doc, {
      startY: 100,
      head: [["Time", "Symbol", "Side", "Price", "Qty", "Amount", "Fee", "Strategy"]],
      body: wTrades.slice(0, 300).map((t) => [
        new Date(t.time).toLocaleString(),
        t.symbol,
        t.side,
        String(t.price),
        String(t.quantity),
        String(t.amount.toFixed(2)),
        String(t.fee.toFixed(2)),
        t.strategy ?? "-"
      ]),
      styles: { fontSize: 8, cellPadding: 3 }
    });
    doc.save(`weekly_summary_${Date.now()}.pdf`);
    ElMessage.success("本周交易总结 PDF 已导出");
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    weeklyLoading.value = false;
  }
}

async function exportWeeklyHtml() {
  weeklyLoading.value = true;
  try {
    const start = weekStartTs();
    const [trades, signals] = await Promise.all([listTrades(5000), listSignals(5000)]);
    const wTrades = trades.filter((t) => t.time >= start);
    const wSignals = signals.filter((s) => s.time >= start);
    const buyCount = wTrades.filter((t) => t.side === "buy").length;
    const sellCount = wTrades.filter((t) => t.side === "sell").length;
    const feeSum = wTrades.reduce((s, t) => s + t.fee, 0);
    const amountSum = wTrades.reduce((s, t) => s + t.amount, 0);
    const symbolCount = new Set(wTrades.map((t) => t.symbol)).size;
    const rows = wTrades
      .slice(0, 500)
      .map(
        (t) =>
          `<tr><td>${new Date(t.time).toLocaleString()}</td><td>${t.symbol}</td><td>${t.side}</td><td>${t.price}</td><td>${t.quantity}</td><td>${t.amount.toFixed(2)}</td><td>${t.fee.toFixed(2)}</td><td>${t.strategy ?? "-"}</td></tr>`
      )
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Weekly Summary</title>
<style>body{font-family:system-ui;margin:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #e5e7eb;padding:6px;text-align:left}th{background:#f8fafc}</style></head><body>
<h2>Weekly Trading Summary</h2>
<p>Trades ${wTrades.length} | Signals ${wSignals.length} | Buy ${buyCount} | Sell ${sellCount} | Symbols ${symbolCount}</p>
<p>Amount ${amountSum.toFixed(2)} | Fee ${feeSum.toFixed(2)}</p>
<table><thead><tr><th>Time</th><th>Symbol</th><th>Side</th><th>Price</th><th>Qty</th><th>Amount</th><th>Fee</th><th>Strategy</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `weekly_summary_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    ElMessage.success("本周交易总结 HTML 已导出");
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    weeklyLoading.value = false;
  }
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
