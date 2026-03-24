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

## 功能总览

### 已实现功能（当前版本）

#### 1) 数据同步中心

- 支持 **自定义股票代码同步**（如 `000001,600519`）。
- 支持 **全市场一键同步**（自动拉取股票列表后逐只同步）。
- 支持增量天数（`incremental_days`）和周期选择（`daily/weekly/monthly`）。
- 支持任务进度轮询：实时显示 `状态 | done/total | failed`。

#### 2) 盘中实时监听（前端策略触发）

- 前端直连 `WebSocket /ws/realtime` 获取实时行情。
- 支持监听代码过滤、涨跌幅阈值触发信号（买/卖）。
- 信号写入 IndexedDB：`signals`。
- 支持同标的同类型信号冷却（防止短时重复触发）。
- 支持手动“买入100 / 卖出100”。
- 支持“自动模拟下单”（信号触发后自动写入交易）。

#### 3) 模拟交易与持仓

- 本地模拟账户：初始资金、可用资金。
- 持仓管理：数量、成本、现价、更新时间。
- 交易记录：买卖方向、成交额、手续费、时间。
- 资金校验：可用资金不足阻止买入。
- 持仓校验：持仓不足阻止卖出。

#### 4) 数据看板（老板视图）

- 核心指标：账户权益、累计收益、收益率、胜率。
- 统计指标：总交易次数、信号数、持仓数。
- 详情面板：最近交易列表、最近信号列表。
- 数据全部来自前端本地库（IndexedDB）。

#### 5) 信号日志页

- 展示信号时间、代码、策略、方向、价格、涨跌幅、备注。
- 支持按股票代码筛选。

#### 6) 一键启动（Windows）

- `start.bat`：双击即可启动后端与前端两个窗口。
- `start.ps1`：PowerShell 一键启动。
- 前端自动检查 `node_modules`，缺失时自动 `npm install`。

### 后端接口（已接入）

- `GET /api/stock/list`：股票列表（本地为空会自动刷新）。
- `GET /api/stock/info/{symbol}`：股票基础信息占位接口。
- `GET /api/historical`：查询历史K线（来自数据库）。
- `GET /api/realtime`：批量实时行情查询。
- `POST /api/sync/historical`：发起同步任务。
- `GET /api/sync/status/{task_id}`：查询同步进度。
- `GET /api/market/index`：大盘指数行情。
- `WebSocket /ws/realtime`：实时行情推送。

## 前端本地数据库设计（IndexedDB）

- `strategies`：策略配置
- `signals`：信号日志
- `trades`：模拟交易记录
- `positions`：当前持仓
- `syncSettings`：同步设置与模拟账户
- `watchlist`：自选股票

## 前端自治原则

- 所有策略、交易、信号、配置尽量本地存储，支持离线可用。
- 后端仅负责行情采集、历史数据持久化、实时推送。
- 所有重计算任务（回测、批量指标）应迁移到 Web Worker。
- 任务可视化：任何异步任务必须有状态、进度、失败重试。
- 可追溯性：信号 -> 交易全链路可查询、可回放。

## 下一步规划

- 策略编辑器（指标组合、AND/OR/NOT、模板导入导出）。
- 回测引擎（本地执行 + 绩效指标 + 报告导出）。
- 看板图表增强（净值曲线、收益分布、月度热力图）。
- 风险控制中心（仓位限制、日亏损熔断、策略级开关）。
