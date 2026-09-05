# 腕上节律 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建可独立参赛的 openvela 手表快应用“腕上节律”，完成健康状态展示、稳态提示、60 秒自适应呼吸训练和前后结果对比。

**Architecture:** 单页快应用以 `view` 状态切换首页、训练和结果界面；健康系统调用封装在适配层，所有判定与计时算法放入无框架依赖的纯逻辑模块。第二阶段的体感训练通过并列训练控制器扩展，不侵入首版健康数据层。

**Tech Stack:** openvela 快应用 UX/JavaScript/CSS、`@service.health`、Node.js `assert`、AIoT Toolkit 2.0.5。

**Spec:** `docs/superpowers/specs/2026-08-23-wrist-rhythm-design.md`

## Global Constraints

- 目标设备为 watch，基准设计尺寸为 480×480 圆屏。
- 仅使用 HEART_RATE 与 STRESS；两者均需支持最近值读取和后台订阅。
- 训练固定持续 60 秒，计时依据实际经过时间而不是 interval 次数。
- 应用不得使用医疗诊断或疗效承诺文案。
- 健康数据不可用时，呼吸训练仍可独立运行。

---

### Task 1: 建立可测试的快应用骨架

**Files:**
- Create: `package.json`
- Create: `src/manifest.json`
- Create: `src/app.ux`
- Create: `src/config-watch.json`
- Create: `test/steady.test.js`

**Interfaces:**
- Produces: `npm run test:logic` 与 `npm run build` 命令；测试预期加载 `src/pages/index/steady.js`。

- [ ] **Step 1: 写入只引用预期逻辑接口的测试入口**
- [ ] **Step 2: 运行 `npm run test:logic`，确认因 `steady.js` 缺失而失败**
- [ ] **Step 3: 写入官方 health-demo 对齐的 manifest、构建脚本和应用根组件**
- [ ] **Step 4: 安装依赖并确认脚手架文件可被工具链识别**

### Task 2: 以 TDD 实现稳态判定和呼吸算法

**Files:**
- Create: `src/pages/index/steady.js`
- Modify: `test/steady.test.js`

**Interfaces:**
- Produces: `pushWindow(values, value, max) -> number[]`
- Produces: `shouldSuggest(hrSamples, stressSamples) -> {suggest: boolean, reason: string}`
- Produces: `selectPattern(stress, currentHr, baselineHr) -> BreathPattern`
- Produces: `phaseAt(elapsedMs, pattern) -> {phase, label, progress, complete}`
- Produces: `buildResult(baseline, latest) -> Result`

- [ ] **Step 1: 写窗口和状态阈值测试，运行并确认缺少导出而失败**
- [ ] **Step 2: 实现最小窗口与判定逻辑并运行至通过**
- [ ] **Step 3: 写呼吸边界、完成态和结果差值测试，运行并确认失败**
- [ ] **Step 4: 实现呼吸与结果逻辑，运行全部逻辑测试至通过**
- [ ] **Step 5: 重构命名和常量，复跑测试保持全绿**

### Task 3: 接入健康数据适配层

**Files:**
- Create: `src/pages/index/health.js`

**Interfaces:**
- Produces: `DATA_TYPES`
- Produces: `getRecent(dataTypes) -> Promise<HealthSample[]>`
- Produces: `subscribe(dataType, onSample, onError)`
- Produces: `unsubscribe(dataType)`

- [ ] **Step 1: 按官方 `service.health` 契约实现规范化适配器**
- [ ] **Step 2: 检查错误码 203、空列表和原始时间戳的处理**

### Task 4: 完成三态单页交互

**Files:**
- Create: `src/pages/index/index.ux`

**Interfaces:**
- Consumes: Task 2 的全部纯逻辑接口与 Task 3 的健康适配接口。
- Produces: `home | breathing | result` 三个页面状态以及完整训练生命周期。

- [ ] **Step 1: 实现冷启动最近值读取和一次性订阅**
- [ ] **Step 2: 实现首页状态卡、双指标和单一主操作**
- [ ] **Step 3: 实现基于实际经过时间的训练计时与呼吸阶段 UI**
- [ ] **Step 4: 实现中止、自然完成和结果返回流程**
- [ ] **Step 5: 实现订阅错误降级与销毁清理**

### Task 5: 构建与交付验证

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: 完整应用工程。
- Produces: 可安装 RPK、运行说明与模拟器验收清单。

- [ ] **Step 1: 运行 `npm run test:logic` 并保存全绿证据**
- [ ] **Step 2: 运行 `npm run build`，修复所有编译问题**
- [ ] **Step 3: 检查 RPK 产物和 manifest 内容**
- [ ] **Step 4: 写明 IDE 插件、比赛镜像、构建和模拟器验证步骤**
- [ ] **Step 5: 重新运行测试与构建作为最终验证**

### Task 6: 以 TDD 实现节奏拳逻辑

**Files:**
- Create: `src/pages/index/boxing.js`
- Modify: `test/steady.test.js`

**Interfaces:**
- Produces: `createPunchDetector(options).push(sample, timestamp) -> boolean`
- Produces: `scorePunch(punchAt, beatAt) -> {points, grade}`
- Produces: `beatIntervalForHeartRate(heartRate) -> number`
- Produces: `recordHit(stats, points) -> BoxingStats`
- Produces: `recordMiss(stats) -> BoxingStats`

- [ ] **Step 1: 写动作突变、冷却、评分边界与统计测试并确认模块缺失失败**
- [ ] **Step 2: 实现最小纯逻辑使测试通过**
- [ ] **Step 3: 做突变检查并复跑全部逻辑测试**

### Task 7: 接入加速度计与节奏拳界面

**Files:**
- Create: `src/pages/index/motion.js`
- Modify: `src/manifest.json`
- Modify: `src/pages/index/index.ux`
- Modify: `README.md`

**Interfaces:**
- Consumes: `@system.sensor.subscribeAccelerometer({ interval: 'game' })`
- Produces: 30 秒节拍训练、真实动作识别、显式模拟降级和拳击结果页。

- [ ] **Step 1: 在 manifest 声明 `system.sensor` 并封装订阅生命周期**
- [ ] **Step 2: 首页增加第二个训练入口**
- [ ] **Step 3: 实现节拍目标、动作命中、连击和心率自适应间隔**
- [ ] **Step 4: 实现传感器失败时的模拟点击模式**
- [ ] **Step 5: 实现游戏结果并补充兼容性文档**
- [ ] **Step 6: 运行完整测试和构建，检查组合 RPK**
