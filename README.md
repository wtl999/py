# AI 量化交易系统（前端自治版）

## 启动

### 一键启动（Windows）

- 双击项目根目录下的 `start.bat`，或在 CMD 中执行 `start.bat`。
- 也可在 PowerShell 中执行：`powershell -ExecutionPolicy Bypass -File .\start.ps1`  
  会各打开一个窗口：后端 `8000`、前端 `5173`；若不存在 `frontend\node_modules`，前端窗口会自动执行 `npm install`。

**首次使用后端**：若尚未创建虚拟环境，请先在 `backend` 目录执行：

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

之后 `start.bat` 会优先使用 `.venv` 启动。

### 后端

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

## 前端自治原则补充

- 所有策略、交易、信号、配置数据本地存储（IndexedDB）并支持一键备份/恢复。
- 后端仅提供行情与历史数据，避免后端承载业务状态。
- 所有耗时计算（回测、批量选股、指标计算）迁移到 Web Worker。
- 交互优先：任何任务都应可见状态（进行中、完成、失败、重试）。
- 可追溯性：每次信号触发和自动交易要有日志，可回放。

## 建议新增页面

- 策略组合编辑器（权重、优先级、冲突处理）。
- 风险控制中心（单票仓位上限、日亏损熔断、策略级开关）。
- 数据治理页（本地数据量、清理策略、索引重建、导入导出）。
- 任务中心（同步、回测、批量选股统一队列）。

## 建议新增前端操作细节

- 所有 destructive 操作二次确认（删除策略、清空日志）。
- 默认开启自动草稿（策略编辑器每 3 秒本地保存）。
- 重要操作加撤销窗口（例如 5 秒内撤销模拟下单）。
- 通知中心支持静音时段和去重（同一策略同一股票短时只提示一次）。
