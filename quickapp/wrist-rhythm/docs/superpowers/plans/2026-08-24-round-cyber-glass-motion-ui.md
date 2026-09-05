# Round Cyber Glass Motion UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将腕上节律改造成只面向圆屏、具有智能分级动效和霓虹线框拳击手的赛博玻璃手表 UI。

**Architecture:** `index.ux` 继续作为页面、健康、训练和生命周期状态的唯一所有者；五个 `.ux` 子组件只消费展示 props 并发出用户意图。动效只由现有状态类和 CSS 动画驱动，健康脉冲用交替 class 重新触发，不增加高频视觉计时器。

**Tech Stack:** openvela Quick App `.ux`、JavaScript CommonJS 纯逻辑模块、Node.js `assert` 契约测试、AIoT Toolkit 构建链。

**Spec:** `docs/superpowers/specs/2026-08-24-round-cyber-glass-motion-ui-design.md`

## Global Constraints

- 设计基准为 480×480，只支持圆形表盘；所有重要信息和操作位于中央约 340×400 安全区域。
- 保留 `compact` 和 `short` 圆屏适配，删除所有 `square` 分支、类名和测试契约。
- 不改变稳态训练、节奏拳评分、健康数据、传感器降级、会话时钟或前后台资源生命周期规则。
- 青绿用于健康与稳态；暖橙只用于活力、压力提醒、节拍目标和命中反馈。
- 动效失败或停止后，文字、颜色、数值和点击区域仍必须完整可用。
- 不增加逐帧 JavaScript 动画或高频视觉计时器；页面隐藏后不得留下视觉调度工作。
- 保留工作树中已有的用户改动，逐文件增量编辑，不回退或覆盖无关差异。

---

### Task 1: 固化圆屏唯一布局契约

**Files:**
- Modify: `test/steady.test.js`
- Modify: `test/component-contract.test.js`
- Modify: `src/pages/index/layout.js`
- Modify: `src/pages/index/index.ux`
- Modify: `src/pages/index/components/home.ux`
- Modify: `src/pages/index/components/breathing.ux`
- Modify: `src/pages/index/components/steady-result.ux`
- Modify: `src/pages/index/components/boxing.ux`
- Modify: `src/pages/index/components/boxing-result.ux`

**Interfaces:**
- Consumes: `layout.resolveLayout(info)` 与现有 `screenSize`、`screenViewport` 组件 props。
- Produces: `resolveLayout(info) -> { size, viewport, className }`，其中 `className` 固定以 `screen-round` 开头；子组件不再声明或消费 `screenShape`。

- [ ] **Step 1: 写入失败的圆屏布局测试**

在 `test/steady.test.js` 将矩形设备期望改为圆屏安全布局，并明确窗口高度仍控制 `viewport`：

```js
test('所有设备形态统一使用圆屏安全布局', () => {
  assert.deepStrictEqual(layout.resolveLayout({
    screenWidth: 480,
    screenHeight: 480,
    screenShape: 'rect',
  }), {
    size: 'regular',
    viewport: 'normal',
    className: 'screen-round size-regular viewport-normal',
  });
});

test('圆屏短视口仍压缩纵向布局', () => {
  assert.deepStrictEqual(layout.resolveLayout({
    windowWidth: 480,
    windowHeight: 320,
    screenShape: 'rect',
  }), {
    size: 'compact',
    viewport: 'short',
    className: 'screen-round size-compact viewport-short',
  });
});
```

在 `test/component-contract.test.js` 从全部 `props` 删除 `screenShape`，删除“圆方屏”测试，并新增源码扫描：

```js
test('展示组件只保留圆屏、尺寸和短视口契约', () => {
  for (const contract of contracts) {
    const source = componentSource(contract.file);
    const definition = componentDefinition(source);
    assert(!Object.hasOwn(definition.props, 'screenShape'));
    assert(!source.includes('-square'));
    assert(!source.includes('{{ screenShape }}'));
  }
});
```

- [ ] **Step 2: 运行测试并确认旧实现失败**

Run: `node test/steady.test.js && node test/component-contract.test.js`

Expected: FAIL，旧 `resolveLayout()` 仍返回 `shape: 'square'`，组件仍包含 `screenShape` 和 `-square`。

- [ ] **Step 3: 实现圆屏唯一布局**

将 `resolveLayout()` 返回值收敛为：

```js
return {
  size,
  viewport,
  className: `screen-round size-${size} viewport-${viewport}`,
};
```

从 `index.ux` 的 private state、布局赋值和五个组件挂载中删除 `screenShape`。从五个组件的 props、模板动态类和样式中删除 `screenShape`、`*-round`、`*-square`；将原圆屏基础样式作为默认样式，保留 `*-compact`、`*-spacious` 和 `*-short` 中确实用于圆屏安全区的规则。

- [ ] **Step 4: 运行圆屏契约测试**

Run: `node test/steady.test.js && node test/component-contract.test.js`

Expected: PASS，且输出不再描述方屏契约。

- [ ] **Step 5: 提交圆屏布局改造**

```powershell
git add -- test/steady.test.js test/component-contract.test.js src/pages/index/layout.js src/pages/index/index.ux src/pages/index/components/home.ux src/pages/index/components/breathing.ux src/pages/index/components/steady-result.ux src/pages/index/components/boxing.ux src/pages/index/components/boxing-result.ux
git commit -m "refactor: target round watch layouts"
```

---

### Task 2: 实现首页赛博玻璃生命仪表与数据脉冲

**Files:**
- Modify: `test/component-contract.test.js`
- Modify: `src/pages/index/index.ux`
- Modify: `src/pages/index/components/home.ux`

**Interfaces:**
- Consumes: 现有 `suggest`、`heartRateText`、`stressText` 和健康数据提交路径。
- Produces: `vitalPulseClass: String` prop，值在 `pulse-a` 与 `pulse-b` 间交替；`home.ux` 用该 class 触发单次数据脉冲。

- [ ] **Step 1: 写入失败的首页动效契约测试**

在首页 contract 的 props 加入 `vitalPulseClass`，并加入：

```js
test('首页生命仪表具有三层结构与可重触发数据脉冲', () => {
  const template = templateSource(componentSource('home.ux'));
  assert(template.includes('class="vital-orbit'));
  assert(template.includes('class="orbit-pulse {{ vitalPulseClass }}"'));
  assert(template.includes('class="orbit-ring'));
  assert(template.includes("suggest ? 'orbit-alert' : 'orbit-steady'"));
});
```

- [ ] **Step 2: 运行契约测试并确认失败**

Run: `node test/component-contract.test.js`

Expected: FAIL，`vitalPulseClass` prop 和 `.orbit-pulse` 尚不存在。

- [ ] **Step 3: 在父页面派生脉冲 class**

在 `index.ux` private state 增加：

```js
vitalPulseClass: 'pulse-a',
vitalPulseGeneration: 0,
```

在实际接受到新心率或压力样本、且页面为 `home` 时执行：

```js
this.vitalPulseGeneration += 1;
this.vitalPulseClass = this.vitalPulseGeneration % 2 === 0 ? 'pulse-a' : 'pulse-b';
```

父页面向 `<home-view>` 传入 `vital-pulse-class="{{ vitalPulseClass }}"`。不得为清除 class 新建 `setTimeout`。

- [ ] **Step 4: 构建三层玻璃仪表与低频动效**

在 `home.ux` 新增 `.orbit-pulse` 层，使用两组内容相同、名称不同的单次 keyframes 让每次 class 交替都能重新播放。最外层保持低对比边框；中层以 3–4 秒低频呼吸；数据脉冲持续 500–700 ms。`orbit-alert` 只改变环境边缘和状态点为暖橙，不移动文字。

页面总宽度、模式按钮和免责声明继续落在圆屏安全区；`compact` 与 `short` 同步缩小三层圆环。

- [ ] **Step 5: 运行契约测试与开发构建**

Run: `node test/component-contract.test.js && npm run build`

Expected: PASS；AIoT 编译器接受动画属性，首页组件无未知属性错误。

- [ ] **Step 6: 提交首页动态仪表**

```powershell
git add -- test/component-contract.test.js src/pages/index/index.ux src/pages/index/components/home.ux
git commit -m "feat: animate round vital dashboard"
```

---

### Task 3: 让呼吸球随训练阶段平滑变化

**Files:**
- Modify: `test/component-contract.test.js`
- Modify: `src/pages/index/components/breathing.ux`

**Interfaces:**
- Consumes: `breathPhase: 'inhale' | 'hold' | 'exhale'`、`remainingText`、`phaseLabel`、`patternLabel`。
- Produces: `.breath-halo`、`.breath-orb`、`.orb-core` 三层阶段视觉；不新增事件或计时器。

- [ ] **Step 1: 扩充失败的呼吸阶段契约**

```js
test('呼吸球三层均由呼吸阶段驱动且文字不参与缩放', () => {
  const template = templateSource(componentSource('breathing.ux'));
  assert(template.includes('class="breath-halo breath-halo-{{ screenViewport }} {{ breathPhase }}"'));
  assert(template.includes('class="breath-orb breath-orb-{{ screenViewport }} {{ breathPhase }}"'));
  assert(template.includes('class="orb-core {{ breathPhase }}-core"'));
  assert(!attributesForClass(template, 'phase-label').class.includes('breathPhase'));
});
```

- [ ] **Step 2: 运行契约测试并确认失败**

Run: `node test/component-contract.test.js`

Expected: FAIL，核心尚未绑定 `${breathPhase}-core`。

- [ ] **Step 3: 实现阶段动效和圆屏安全尺寸**

为核心加入 `{{ breathPhase }}-core`。吸气阶段扩大并增亮，停留阶段维持尺寸并进行低幅亮度呼吸，呼气阶段收缩并降低透明度；所有变化使用阶段 class 和 CSS animation/transition，不更改父页面 tick。

常规圆屏主球外径不超过 250px，`compact` 不超过 230px，`short` 不超过 150px。剩余时间、阶段文案、节奏文案和结束按钮使用固定布局槽，动画不得引起它们位移。

- [ ] **Step 4: 运行契约测试和构建**

Run: `node test/component-contract.test.js && npm run build`

Expected: PASS，三种阶段样式均成功编译。

- [ ] **Step 5: 提交呼吸动效**

```powershell
git add -- test/component-contract.test.js src/pages/index/components/breathing.ux
git commit -m "feat: animate breathing phase orb"
```

---

### Task 4: 将节奏拳靶标替换为霓虹线框拳击手

**Files:**
- Modify: `test/component-contract.test.js`
- Modify: `src/pages/index/components/boxing.ux`

**Interfaces:**
- Consumes: `boxingTargetClass` 的现有 `target-waiting`、`target-active`、`target-hit`、`target-missed` 状态和 `simulatePunch()` 事件。
- Produces: 可点击 `.fighter-stage`，内部固定包含 `.fighter-head`、`.fighter-body`、左右手臂和双腿；人物根节点同时消费 `boxingTargetClass`。

- [ ] **Step 1: 将旧靶标契约改为人物契约**

删除 `target-ring` 断言，加入：

```js
test('节奏拳使用可点击线框人物并绑定节拍状态', () => {
  const template = templateSource(componentSource('boxing.ux'));
  const stage = attributesForClass(template, 'fighter-stage');
  assert.strictEqual(stage.onclick, 'simulatePunch');
  assert(stage.class.includes('{{ boxingTargetClass }}'));
  for (const part of ['fighter-head', 'fighter-body', 'fighter-arm-left', 'fighter-arm-right', 'fighter-leg-left', 'fighter-leg-right']) {
    assert(template.includes(part), part);
  }
  assert(template.includes('class="impact-wave impact-wave-one"'));
  assert(template.includes('class="impact-wave impact-wave-two"'));
});
```

- [ ] **Step 2: 运行契约测试并确认旧靶标失败**

Run: `node test/component-contract.test.js`

Expected: FAIL，模板仍是 `.punch-target` 与 `.target-ring`。

- [ ] **Step 3: 构建人物模板和基础姿态**

将中心靶标替换为一个 210×210 以内的 `.fighter-stage`。人物用嵌套 `div` 组合圆形头部、竖向躯干、四肢和拳端；人物整体点击仍调用 `simulatePunch`。文字评分区、提示区和结束按钮保持原业务绑定。

待机时人物处于防守姿态并低幅弹跳；`target-active` 让身体蓄力并高亮右拳；`target-hit` 完成短促出拳并显示两层冲击波；`target-missed` 只让暖橙轮廓快速衰减。

- [ ] **Step 4: 加入连击感知但不增加新业务状态**

在人物舞台已有 `boxingStreakText` 可见的前提下，不新增连击等级算法。命中态统一播放一次拖影和亮度提升；连续命中通过现有更频繁的 `target-hit` 状态自然形成更强节奏感。避免依赖动态数值拼接 CSS 类。

- [ ] **Step 5: 验证点击降级和编译**

Run: `node test/component-contract.test.js && npm run build`

Expected: PASS；`.fighter-stage` 始终可点击，`boxingFallback` 为真时现有“点击模拟出拳”按钮仍存在。

- [ ] **Step 6: 提交拳击手主视觉**

```powershell
git add -- test/component-contract.test.js src/pages/index/components/boxing.ux
git commit -m "feat: add animated neon boxing fighter"
```

---

### Task 5: 统一两个结果页的完成入场反馈

**Files:**
- Modify: `test/component-contract.test.js`
- Modify: `src/pages/index/components/steady-result.ux`
- Modify: `src/pages/index/components/boxing-result.ux`

**Interfaces:**
- Consumes: 现有结果 props 与 `returnHome()` 事件。
- Produces: `.completion-halo` 单次入场动画、稳定的结果玻璃卡和圆屏底部安全操作。

- [ ] **Step 1: 写入失败的结果页结构测试**

```js
test('两个结果页共享单次完成光环语法', () => {
  for (const file of ['steady-result.ux', 'boxing-result.ux']) {
    const template = templateSource(componentSource(file));
    const source = componentSource(file);
    assert(template.includes('completion-halo'), file);
    assert(source.includes('@KEYFRAMES completion-enter') || source.includes('@keyframes completion-enter'), file);
  }
});
```

- [ ] **Step 2: 运行契约测试并确认失败**

Run: `node test/component-contract.test.js`

Expected: FAIL，两个结果页尚未包含统一完成光环。

- [ ] **Step 3: 实现一次性入场和玻璃结果卡**

稳态页在完成图标外增加 `.completion-halo`；拳击页在主分数外增加同名光环。两页各自定义相同的 `completion-enter` 单次动画，持续 500–700 ms，结束后保持静态。结果卡使用统一深色表面、细边缘、青绿主强调；拳击最高连击保留局部暖橙。

常规圆屏的结果卡宽度不超过 338px；完成按钮宽度约 220px，底边保持在圆屏安全区内。同步校正 `compact` 与 `short` 间距。

- [ ] **Step 4: 运行契约测试和构建**

Run: `node test/component-contract.test.js && npm run build`

Expected: PASS，两个页面均包含且仅自动播放一次完成反馈。

- [ ] **Step 5: 提交结果页动效**

```powershell
git add -- test/component-contract.test.js src/pages/index/components/steady-result.ux src/pages/index/components/boxing-result.ux
git commit -m "feat: animate training completion views"
```

---

### Task 6: 全量回归、圆屏视觉验收与文档同步

**Files:**
- Modify: `README.md`
- Verify: `src/pages/index/index.ux`
- Verify: `src/pages/index/components/*.ux`
- Verify: `test/*.test.js`

**Interfaces:**
- Consumes: Tasks 1–5 的圆屏组件、动效类和现有构建脚本。
- Produces: 通过的逻辑测试、开发 RPK、release RPK，以及明确的圆屏视觉验收记录。

- [ ] **Step 1: 清理残留方屏语义**

Run:

```powershell
Get-ChildItem src,test,README.md -Recurse -File | Select-String -Pattern 'screenShape|screen-square|-square|圆方屏|方屏'
```

Expected: 不返回 UI 方屏分支；若 README 的历史说明仍声称支持方屏，将其改为“480×480 圆形表盘布局，并保留紧凑圆屏与短视口保护”。

- [ ] **Step 2: 运行完整逻辑测试**

Run: `npm test`

Expected: 所有 steady、runtime、page-lifecycle、component-contract 和 release-runner 测试通过。

- [ ] **Step 3: 运行开发与发布构建**

Run: `npm run build && npm run build:release`

Expected: `dist/com.openvela.wristrhythm.debug.1.0.0.rpk` 与 `dist/com.openvela.wristrhythm.release.1.0.0.rpk` 成功生成，无新增 CSS 或模板编译错误。

- [ ] **Step 4: 在模拟器执行圆屏视觉验收**

启动仓库 README 指定的 `vela-miwear-watch-5.0(开发者大赛)` 模拟器，逐项检查并保存验收截图：

```text
首页：正常、压力提醒、数据脉冲
稳态：吸气、停留、呼气
节奏拳：待机、目标、命中、漏拍、点击降级
结果：稳态完成、拳击完成
布局：480×480、compact、short 圆屏安全区
```

Expected: 标题、指标、人物、提示、按钮均未被圆形边缘裁切；动效结束后页面稳定；点击人物和底部按钮可达。

- [ ] **Step 5: 更新 README 验收描述**

在“已完成功能”和“模拟器验收”中加入：圆屏赛博玻璃视觉、智能分级动效、线框拳击手，以及后台停止视觉反馈。删除方屏支持表述，不更改健康与训练免责声明。

- [ ] **Step 6: 检查差异并提交最终验收文档**

Run: `git diff --check && git status --short`

Expected: 无空白错误；仅有本计划范围内改动和用户原有的未跟踪预览图。

```powershell
git add -- README.md
git commit -m "docs: document round motion interface"
```
