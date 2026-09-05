# 腕上节律运行时、包体与组件优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 降低腕上节律的包体、后台资源占用和无效响应式更新，并将五个视图拆成可维护的展示组件。

**Architecture:** `index.ux` 保持页面状态机和系统资源的唯一所有者；可暂停时钟、订阅幂等和响应式去重下沉为无框架纯逻辑。五个 `.ux` 子组件仅接收 props、渲染视图并通过 `$emit` 上报意图。正式包由 AIoT 工具链原生 release 参数生成。

**Tech Stack:** openvela Quick App UX、JavaScript CommonJS/ES modules、Node.js `assert`、AIoT Toolkit 2.0.5、Python Pillow PNG 量化。

**Spec:** `docs/superpowers/specs/2026-08-24-runtime-package-and-component-optimization-design.md`

## Global Constraints

- Node.js 22 或更高版本；当前工具链为 AIoT Toolkit 2.0.5。
- 不改变 60 秒稳态训练、30 秒节奏拳、评分窗口、心率节拍或健康降级规则。
- 应用隐藏时暂停有效训练时间，并停止健康订阅、动作订阅和全部活动定时器。
- 返回前台后从剩余有效时间继续，拳击不得补记后台节拍或漏拍。
- 圆屏、方屏、compact、regular、spacious 和 short viewport 适配必须保留。
- 子组件不得导入系统 API、算法模块或创建定时器。
- 正式构建必须启用 JSC、PNG8、CSS 属性优化和删除 console。
- 图标保持 512×512 PNG、透明通道和 `/common/app-icon-512.png` 路径。

---

## File Map

**Create**

- `src/pages/index/session-clock.js` — 纯可暂停时钟。
- `src/pages/index/subscription-lifecycle.js` — 计算健康订阅/取消差集。
- `src/pages/index/reactive.js` — 仅在值变化时写响应式字段。
- `src/pages/index/components/home.ux` — 首页展示和开始事件。
- `src/pages/index/components/breathing.ux` — 呼吸训练展示和结束事件。
- `src/pages/index/components/steady-result.ux` — 呼吸结果展示和完成事件。
- `src/pages/index/components/boxing.ux` — 节奏拳展示、模拟和结束事件。
- `src/pages/index/components/boxing-result.ux` — 拳击结果展示和完成事件。
- `test/runtime.test.js` — 时钟、订阅和响应式去重测试。
- `scripts/optimize-icon.py` — 可复现的 PNG 索引色量化工具。

**Modify**

- `src/pages/index/index.ux` — 组件装配、生命周期和资源编排。
- `src/manifest.json` — 移除后台健康声明。
- `src/common/app-icon-512.png` — 256 色索引 PNG。
- `package.json` — 正式构建脚本和测试入口。
- `README.md` — 新结构、生命周期和 release 命令。

---

### Task 1: 可暂停训练时钟

**Files:**

- Create: `src/pages/index/session-clock.js`
- Create: `test/runtime.test.js`
- Modify: `package.json`

**Interfaces:**

- Produces: `createClock(durationMs, startedAt) -> Clock`
- Produces: `pauseClock(clock, now) -> Clock`
- Produces: `resumeClock(clock, now) -> Clock`
- Produces: `elapsedMs(clock, now) -> number`
- Produces: `remainingMs(clock, now) -> number`
- Produces: `remainingSeconds(clock, now) -> number`
- Produces: `isComplete(clock, now) -> boolean`
- `Clock` fields: `{ durationMs, startedAt, pausedAt, pausedMs }`

- [ ] **Step 1: Add runtime test entry and write failing clock tests**

Update `package.json`:

```json
"test:logic": "node test/steady.test.js && node test/runtime.test.js"
```

Create `test/runtime.test.js` with a local `test(name, fn)` runner matching `test/steady.test.js` and these assertions:

```js
const assert = require('assert');
const clock = require('../src/pages/index/session-clock.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test('可暂停时钟只累计前台有效时间', () => {
  let state = clock.createClock(60000, 1000);
  assert.strictEqual(clock.elapsedMs(state, 11000), 10000);
  state = clock.pauseClock(state, 11000);
  assert.strictEqual(clock.elapsedMs(state, 31000), 10000);
  state = clock.resumeClock(state, 31000);
  assert.strictEqual(clock.elapsedMs(state, 36000), 15000);
  assert.strictEqual(clock.remainingSeconds(state, 36000), 45);
});

test('重复暂停和恢复保持幂等', () => {
  const initial = clock.createClock(30000, 0);
  const paused = clock.pauseClock(initial, 5000);
  assert.deepStrictEqual(clock.pauseClock(paused, 9000), paused);
  const resumed = clock.resumeClock(paused, 15000);
  assert.deepStrictEqual(clock.resumeClock(resumed, 18000), resumed);
  assert.strictEqual(clock.elapsedMs(resumed, 20000), 10000);
});

test('时钟在边界完成且剩余值不为负数', () => {
  const state = clock.createClock(30000, 1000);
  assert.strictEqual(clock.isComplete(state, 30999), false);
  assert.strictEqual(clock.isComplete(state, 31000), true);
  assert.strictEqual(clock.remainingMs(state, 32000), 0);
});

console.log(`\n${passed} runtime tests passed`);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test`

Expected: existing 20 tests pass, then `runtime.test.js` fails because `session-clock.js` does not exist.

- [ ] **Step 3: Implement the immutable clock**

Create `src/pages/index/session-clock.js`:

```js
function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function createClock(durationMs, startedAt) {
  return {
    durationMs: Math.max(0, finite(durationMs) ? durationMs : 0),
    startedAt: finite(startedAt) ? startedAt : 0,
    pausedAt: null,
    pausedMs: 0,
  };
}

function pauseClock(clock, now) {
  if (!clock || clock.pausedAt !== null || !finite(now)) return clock;
  return { ...clock, pausedAt: now };
}

function resumeClock(clock, now) {
  if (!clock || clock.pausedAt === null || !finite(now)) return clock;
  return {
    ...clock,
    pausedAt: null,
    pausedMs: clock.pausedMs + Math.max(0, now - clock.pausedAt),
  };
}

function elapsedMs(clock, now) {
  if (!clock || !finite(now)) return 0;
  const effectiveNow = clock.pausedAt === null ? now : clock.pausedAt;
  return Math.max(0, effectiveNow - clock.startedAt - clock.pausedMs);
}

function remainingMs(clock, now) {
  return Math.max(0, clock.durationMs - elapsedMs(clock, now));
}

function remainingSeconds(clock, now) {
  return Math.ceil(remainingMs(clock, now) / 1000);
}

function isComplete(clock, now) {
  return remainingMs(clock, now) === 0;
}

module.exports = {
  createClock,
  pauseClock,
  resumeClock,
  elapsedMs,
  remainingMs,
  remainingSeconds,
  isComplete,
};
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test`

Expected: 20 existing tests and 3 runtime tests pass with exit code 0.

- [ ] **Step 5: Commit the clock**

```powershell
git add -- package.json test/runtime.test.js src/pages/index/session-clock.js
git commit -m "feat: add pausable training clock"
```

---

### Task 2: 幂等健康订阅状态

**Files:**

- Create: `src/pages/index/subscription-lifecycle.js`
- Modify: `test/runtime.test.js`
- Modify: `src/manifest.json`

**Interfaces:**

- Produces: `createSubscriptionState(types) -> { desiredTypes, activeTypes }`
- Produces: `typesToSubscribe(state) -> number[]`
- Produces: `typesToUnsubscribe(state) -> number[]`
- Produces: `markSubscribed(state, type) -> SubscriptionState`
- Produces: `markUnsubscribed(state, type) -> SubscriptionState`
- Consumes later: parent page stores returned state after every system call.

- [ ] **Step 1: Write failing subscription state tests**

Append to `test/runtime.test.js`:

```js
const subscriptions = require('../src/pages/index/subscription-lifecycle.js');

test('显示时只计划尚未激活的健康订阅', () => {
  let state = subscriptions.createSubscriptionState([0, 9]);
  assert.deepStrictEqual(subscriptions.typesToSubscribe(state), [0, 9]);
  state = subscriptions.markSubscribed(state, 0);
  state = subscriptions.markSubscribed(state, 9);
  assert.deepStrictEqual(subscriptions.typesToSubscribe(state), []);
});

test('隐藏时只取消实际激活的类型且重复取消幂等', () => {
  let state = subscriptions.createSubscriptionState([0, 9]);
  state = subscriptions.markSubscribed(state, 0);
  assert.deepStrictEqual(subscriptions.typesToUnsubscribe(state), [0]);
  state = subscriptions.markUnsubscribed(state, 0);
  assert.deepStrictEqual(subscriptions.typesToUnsubscribe(state), []);
  assert.deepStrictEqual(subscriptions.markUnsubscribed(state, 0), state);
});

test('失败类型从激活集合移除并可在下次显示重试', () => {
  let state = subscriptions.createSubscriptionState([0, 9]);
  state = subscriptions.markSubscribed(state, 0);
  state = subscriptions.markSubscribed(state, 9);
  state = subscriptions.markUnsubscribed(state, 9);
  assert.deepStrictEqual(subscriptions.typesToSubscribe(state), [9]);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node test/runtime.test.js`

Expected: FAIL because `subscription-lifecycle.js` does not exist.

- [ ] **Step 3: Implement subscription set transitions**

Create `src/pages/index/subscription-lifecycle.js`:

```js
function unique(values) {
  return Array.from(new Set(Array.isArray(values) ? values : []));
}

function createSubscriptionState(types) {
  return { desiredTypes: unique(types), activeTypes: [] };
}

function typesToSubscribe(state) {
  return state.desiredTypes.filter((type) => !state.activeTypes.includes(type));
}

function typesToUnsubscribe(state) {
  return state.activeTypes.slice();
}

function markSubscribed(state, type) {
  if (state.activeTypes.includes(type)) return state;
  return { ...state, activeTypes: state.activeTypes.concat([type]) };
}

function markUnsubscribed(state, type) {
  if (!state.activeTypes.includes(type)) return state;
  return { ...state, activeTypes: state.activeTypes.filter((item) => item !== type) };
}

module.exports = {
  createSubscriptionState,
  typesToSubscribe,
  typesToUnsubscribe,
  markSubscribed,
  markUnsubscribed,
};
```

- [ ] **Step 4: Remove the background health declaration**

In `src/manifest.json`, remove only this object:

```json
"background": {
  "features": [
    "service.health"
  ]
}
```

Keep `features: [{ "name": "service.health" }]` and `hapjs.permission.HEALTH` unchanged.

- [ ] **Step 5: Run tests and build**

Run: `npm test`

Expected: 20 existing tests and 6 runtime tests pass.

Run: `npm run build`

Expected: build exits 0 without manifest or UX warnings.

- [ ] **Step 6: Commit subscription state and manifest**

```powershell
git add -- test/runtime.test.js src/pages/index/subscription-lifecycle.js src/manifest.json
git commit -m "feat: scope health subscriptions to foreground"
```

---

### Task 3: 响应式写入去重

**Files:**

- Create: `src/pages/index/reactive.js`
- Modify: `test/runtime.test.js`
- Modify: `src/pages/index/index.ux`

**Interfaces:**

- Produces: `writeIfChanged(target, key, nextValue) -> boolean`
- Consumes: parent `tick()` and `boxingTick()` call it for countdown and other tick-driven display fields.

- [ ] **Step 1: Write a failing setter-count test**

Append to `test/runtime.test.js`:

```js
const reactive = require('../src/pages/index/reactive.js');

test('相同显示值不会重复触发响应式 setter', () => {
  let writes = 0;
  let stored = '30';
  const target = {};
  Object.defineProperty(target, 'remaining', {
    get() { return stored; },
    set(value) { writes += 1; stored = value; },
  });

  assert.strictEqual(reactive.writeIfChanged(target, 'remaining', '30'), false);
  assert.strictEqual(reactive.writeIfChanged(target, 'remaining', '29'), true);
  assert.strictEqual(reactive.writeIfChanged(target, 'remaining', '29'), false);
  assert.strictEqual(writes, 1);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node test/runtime.test.js`

Expected: FAIL because `reactive.js` does not exist.

- [ ] **Step 3: Implement minimal guarded write**

Create `src/pages/index/reactive.js`:

```js
function writeIfChanged(target, key, nextValue) {
  if (!target || target[key] === nextValue) return false;
  target[key] = nextValue;
  return true;
}

module.exports = { writeIfChanged };
```

- [ ] **Step 4: Apply guarded writes to timer-driven UI fields**

Import in `index.ux`:

```js
import reactive from './reactive.js';
```

Replace unconditional tick assignments with guarded writes. The minimum required replacements are:

```js
reactive.writeIfChanged(this, 'remainingText', String(clock.remainingSeconds(this.trainingClock, now)));
reactive.writeIfChanged(this, 'breathPhase', phase.phase);
reactive.writeIfChanged(this, 'phaseLabel', phase.label);
reactive.writeIfChanged(this, 'boxingRemainingText', String(clock.remainingSeconds(this.boxingClock, now)));
```

Keep event-driven assignments for target activation, hit, miss, score and page transitions; optionally route them through the same helper only when the caller can genuinely repeat the same value.

- [ ] **Step 5: Run tests and build**

Run: `npm test`

Expected: 20 existing tests and 7 runtime tests pass.

Run: `npm run build`

Expected: exit 0 with no new warnings.

- [ ] **Step 6: Commit guarded writes**

```powershell
git add -- test/runtime.test.js src/pages/index/reactive.js src/pages/index/index.ux
git commit -m "perf: avoid redundant timer UI writes"
```

---

### Task 4: 父页面暂停恢复与资源清理

**Files:**

- Modify: `src/pages/index/index.ux`
- Modify: `test/runtime.test.js`

**Interfaces:**

- Consumes: all Task 1 clock functions.
- Consumes: all Task 2 subscription state functions.
- Consumes: Task 3 `writeIfChanged`.
- Produces parent methods: `startHealth()`, `stopHealth()`, `pauseActiveSession(now)`, `resumeActiveSession(now)`, `startBoxingRuntime()`, `stopRuntimeResources()`.

- [ ] **Step 1: Add a failing boxing-resume scheduling test**

Extend `session-clock.js` contract with `nextBeatAfterResume(effectiveElapsed, interval)`. Append to `test/runtime.test.js`:

```js
test('拳击恢复后从下一个节拍开始且不补发后台目标', () => {
  assert.strictEqual(clock.nextBeatAfterResume(5000, 1000), 6000);
  assert.strictEqual(clock.nextBeatAfterResume(5500, 1200), 6000);
  assert.strictEqual(clock.nextBeatAfterResume(0, 1000), 1000);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node test/runtime.test.js`

Expected: FAIL because `nextBeatAfterResume` is not exported.

- [ ] **Step 3: Implement the next-beat calculation**

Add to `session-clock.js` and export:

```js
function nextBeatAfterResume(effectiveElapsed, interval) {
  const elapsed = Math.max(0, effectiveElapsed || 0);
  const beatInterval = Math.max(1, interval || 1);
  return (Math.floor(elapsed / beatInterval) + 1) * beatInterval;
}
```

- [ ] **Step 4: Replace absolute training timestamps with clocks**

In `index.ux` private state, replace `startedAt` and `boxingStartedAt` with:

```js
trainingClock: null,
boxingClock: null,
healthSubscriptions: subscriptions.createSubscriptionState(TYPES),
visible: false,
recentHealthPending: false,
```

`startTraining()` creates `clock.createClock(steady.SESSION_MS, Date.now())`. `tick()` derives `elapsed` from `clock.elapsedMs(this.trainingClock, now)` and completion from `clock.isComplete(...)`.

`startBoxing()` creates `clock.createClock(boxing.GAME_MS, Date.now())`. Store `boxingBeatAt` and `boxingNextBeatAt` in effective elapsed milliseconds, not wall-clock timestamps. Convert an incoming punch timestamp to effective elapsed with `clock.elapsedMs(this.boxingClock, timestamp)` before calling `scorePunch`.

- [ ] **Step 5: Move health subscription ownership to onShow/onHide**

Implement:

```js
onReady() {
  getScreenLayout().then((screenLayout) => this.applyScreenLayout(screenLayout));
},

onShow() {
  this.visible = true;
  this.startHealth();
  this.resumeActiveSession(Date.now());
},

onHide() {
  this.visible = false;
  this.pauseActiveSession(Date.now());
  this.stopRuntimeResources();
  this.stopHealth();
},

onDestroy() {
  this.visible = false;
  this.stopRuntimeResources();
  this.stopHealth();
},
```

`startHealth()` calls `getRecent(TYPES)` only when both health values are absent and `recentHealthPending` is false. It sets the pending flag before the request and clears it in both success and failure branches, so an empty/failed read can retry on a later `onShow`. It calls `typesToSubscribe`, marks each type active before invoking `subscribe`, and removes that type again inside the error callback so a later `onShow` retries it.

`stopHealth()` calls `typesToUnsubscribe`, invokes `unsubscribe(type)`, and marks each type inactive.

- [ ] **Step 6: Implement pause/resume runtime behavior**

`pauseActiveSession(now)` pauses the active clock for `breathing` or `boxing`.

`resumeActiveSession(now)` resumes the active clock. For breathing, call `tick()` and restore the 250 ms interval. For boxing, compute the next effective beat using `nextBeatAfterResume`, restart motion connection, call `boxingTick()`, and restore the 50 ms interval.

`stopRuntimeResources()` calls `clearTimer()`, `clearMotionConnectTimer()`, and `stopMotion()`; every method remains idempotent.

- [ ] **Step 7: Run full tests and build**

Run: `npm test`

Expected: 20 existing tests and 8 runtime tests pass.

Run: `npm run build`

Expected: exit 0 without lifecycle, template or style warnings.

- [ ] **Step 8: Commit lifecycle integration**

```powershell
git add -- test/runtime.test.js src/pages/index/session-clock.js src/pages/index/index.ux
git commit -m "perf: pause watch resources while hidden"
```

---

### Task 5: 拆分首页和结果组件

**Files:**

- Create: `src/pages/index/components/home.ux`
- Create: `src/pages/index/components/steady-result.ux`
- Create: `src/pages/index/components/boxing-result.ux`
- Modify: `src/pages/index/index.ux`

**Interfaces:**

- `home.ux` props: `screenShape`, `screenSize`, `screenViewport`, `suggest`, `statusTitle`, `statusSubtitle`, `heartRateText`, `stressText`, `healthMessage`.
- `home.ux` emits: `start-training`, `start-boxing`.
- `steady-result.ux` props: layout fields, both detail/delta fields and improvement booleans; emits `return-home`.
- `boxing-result.ux` props: layout fields, score/hits/streak/heart-rate strings; emits `return-home`.

- [ ] **Step 1: Extract the home component with explicit props and events**

Create `home.ux` by moving the current home template and all home-only style rules. Its script follows this exact event boundary:

```js
export default {
  props: {
    screenShape: { type: String, default: 'round' },
    screenSize: { type: String, default: 'regular' },
    screenViewport: { type: String, default: 'normal' },
    suggest: { type: Boolean, default: false },
    statusTitle: { type: String, default: '' },
    statusSubtitle: { type: String, default: '' },
    heartRateText: { type: String, default: '--' },
    stressText: { type: String, default: '--' },
    healthMessage: { type: String, default: '' },
  },
  startTraining() { this.$emit('start-training'); },
  startBoxing() { this.$emit('start-boxing'); },
};
```

- [ ] **Step 2: Import and mount home from the parent**

At the top of `index.ux`:

```html
<import name="home-view" src="./components/home.ux"></import>
```

Replace the home block with:

```html
<home-view
  if="{{ view === 'home' }}"
  screen-shape="{{ screenShape }}"
  screen-size="{{ screenSize }}"
  screen-viewport="{{ screenViewport }}"
  suggest="{{ suggest }}"
  status-title="{{ statusTitle }}"
  status-subtitle="{{ statusSubtitle }}"
  heart-rate-text="{{ heartRateText }}"
  stress-text="{{ stressText }}"
  health-message="{{ healthMessage }}"
  onstart-training="startTraining"
  onstart-boxing="startBoxing">
</home-view>
```

- [ ] **Step 3: Extract both result components**

Move each result template and its exclusive styles into the corresponding file. Each component declares all listed props with literal safe defaults. Both expose:

```js
returnHome() { this.$emit('return-home'); }
```

The parent imports them as `steady-result-view` and `boxing-result-view`, mounts them under the existing view conditions, passes every displayed field, and binds `onreturn-home="returnHome"`.

- [ ] **Step 4: Build after static component extraction**

Run: `npm run build`

Expected: custom components compile, all imports resolve, and there are no unsupported selector or unknown event warnings.

Run: `npm test`

Expected: all logic and runtime tests remain green.

- [ ] **Step 5: Commit static components**

```powershell
git add -- src/pages/index/components/home.ux src/pages/index/components/steady-result.ux src/pages/index/components/boxing-result.ux src/pages/index/index.ux
git commit -m "refactor: extract home and result views"
```

---

### Task 6: 拆分实时训练组件

**Files:**

- Create: `src/pages/index/components/breathing.ux`
- Create: `src/pages/index/components/boxing.ux`
- Modify: `src/pages/index/index.ux`

**Interfaces:**

- `breathing.ux` props: layout fields, `remainingText`, `breathPhase`, `phaseLabel`, `patternLabel`; emits `stop-training`.
- `boxing.ux` props: layout fields, remaining/score/streak/prompt/pace/target/message strings and `boxingFallback`; emits `simulate-punch`, `stop-boxing`.

- [ ] **Step 1: Extract breathing display**

Move the breathing template and its styles to `breathing.ux`. Use this script boundary:

```js
export default {
  props: {
    screenShape: { type: String, default: 'round' },
    screenSize: { type: String, default: 'regular' },
    screenViewport: { type: String, default: 'normal' },
    remainingText: { type: String, default: '60' },
    breathPhase: { type: String, default: 'inhale' },
    phaseLabel: { type: String, default: '慢慢吸气' },
    patternLabel: { type: String, default: '标准节奏 · 4-2-4' },
  },
  stopTraining() { this.$emit('stop-training'); },
};
```

Import as `breathing-view`, pass every prop, and bind `onstop-training="stopTraining"`.

- [ ] **Step 2: Build and verify the breathing component**

Run: `npm run build`

Expected: build exits 0 and the generated page bundle contains the imported component.

- [ ] **Step 3: Extract boxing display**

Move the boxing template and styles to `boxing.ux`. Its script must contain:

```js
export default {
  props: {
    screenShape: { type: String, default: 'round' },
    screenSize: { type: String, default: 'regular' },
    screenViewport: { type: String, default: 'normal' },
    boxingRemainingText: { type: String, default: '30' },
    boxingScoreText: { type: String, default: '0' },
    boxingStreakText: { type: String, default: '0' },
    boxingPrompt: { type: String, default: '准备' },
    boxingPaceLabel: { type: String, default: '' },
    boxingTargetClass: { type: String, default: 'target-waiting' },
    boxingFallback: { type: Boolean, default: false },
    boxingMessage: { type: String, default: '' },
  },
  simulatePunch() { this.$emit('simulate-punch'); },
  stopBoxing() { this.$emit('stop-boxing'); },
};
```

Import as `boxing-view`, pass every prop, and bind both events to the existing parent handlers.

- [ ] **Step 4: Remove migrated template and CSS from the parent**

After all five components compile, `index.ux` keeps only:

- five component imports;
- the `.app` wrapper and five conditional component mounts;
- controller script;
- `.app` root style.

No display component contains system API imports, timers or training algorithm imports.

- [ ] **Step 5: Run full regression**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: exit 0 without component, event, prop or style warnings.

- [ ] **Step 6: Commit real-time components**

```powershell
git add -- src/pages/index/components/breathing.ux src/pages/index/components/boxing.ux src/pages/index/index.ux
git commit -m "refactor: extract training views"
```

---

### Task 7: 图标量化与正式构建

**Files:**

- Create: `scripts/optimize-icon.py`
- Modify: `src/common/app-icon-512.png`
- Modify: `package.json`

**Interfaces:**

- Produces: `npm run build:release` and `npm run release` with identical production behavior.
- Produces: 512×512 indexed PNG with transparency and target size 50–100 KB.

- [ ] **Step 1: Record baseline sizes**

Run:

```powershell
Get-Item src/common/app-icon-512.png, dist/*.rpk | Select-Object FullName,Length
```

Expected baseline icon: 390,550 bytes. Save the displayed values in the task notes for final comparison.

- [ ] **Step 2: Render and inspect the original icon**

Use the local image viewer on `src/common/app-icon-512.png`. Check transparent corners, circular edge, central mark and gradients before modifying the binary.

- [ ] **Step 3: Quantize through a temporary output and replace only after validation**

Create `scripts/optimize-icon.py` so the optimization is reproducible:

```python
import sys
from pathlib import Path
from PIL import Image

source = Path(sys.argv[1])
target = Path(sys.argv[2])
image = Image.open(source).convert("RGBA")
quantized = image.quantize(
    colors=256,
    method=Image.Quantize.FASTOCTREE,
    dither=Image.Dither.FLOYDSTEINBERG,
)
quantized.save(target, format="PNG", optimize=True)
print(target.stat().st_size)
```

Use the bundled Python executable reported by `load_workspace_dependencies`, then run:

```powershell
$runtimePython = 'C:\Users\12618\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$optimizedIcon = Join-Path ([System.IO.Path]::GetTempPath()) 'wristrhythm-app-icon-512.png'
& $runtimePython scripts/optimize-icon.py src/common/app-icon-512.png $optimizedIcon
```

View the temporary PNG. Confirm dimensions are 512×512, transparency is retained, the edge has no halo, the central mark is intact and color banding is not distracting. Then replace `src/common/app-icon-512.png` with that validated binary using one native PowerShell `Copy-Item -LiteralPath` command.

- [ ] **Step 4: Add deterministic release scripts**

Set scripts in `package.json` to:

```json
"build:release": "aiot release --enable-jsc --optimize-css-attr --enable-image-png8 --drop-console true",
"release": "npm run build:release"
```

Keep `build: "aiot build"` unchanged.

- [ ] **Step 5: Verify image and both build modes**

Run a Pillow inspection and assert:

```python
from PIL import Image
image = Image.open(r"F:\项目\openvela\src\common\app-icon-512.png")
assert image.size == (512, 512)
assert image.mode == "P"
assert "transparency" in image.info
```

Run: `npm run build`

Expected: development build exits 0.

Run: `npm run build:release`

Expected build log: production release command exits 0 and reports `enableJsc: true`, `optimizeCssAttr: true`, `dropConsole: true`, and PNG8/image compression enabled. A release RPK is generated; no fallback debug package is accepted.

- [ ] **Step 6: Record optimized sizes**

Run:

```powershell
Get-Item src/common/app-icon-512.png, dist/*.rpk | Sort-Object FullName | Select-Object FullName,Length
```

Expected: source icon is materially below 390,550 bytes; target is 50–100 KB. Record development and release RPK sizes separately.

- [ ] **Step 7: Commit resource and scripts**

```powershell
git add -- scripts/optimize-icon.py src/common/app-icon-512.png package.json
git commit -m "build: optimize icon and release package"
```

---

### Task 8: 文档与最终验证

**Files:**

- Modify: `README.md`
- Verify: all files from Tasks 1–7

**Interfaces:**

- Consumes all preceding tasks.
- Produces final user-facing build instructions and measured optimization report.

- [ ] **Step 1: Update README structure and commands**

Document:

```text
npm test
npm run build
npm run build:release
```

Update the engineering tree with `components/`, `session-clock.js`, `subscription-lifecycle.js`, `reactive.js`, and `test/runtime.test.js`. State that hiding the app pauses the session and releases health, motion and timer resources; returning resumes the remaining time.

- [ ] **Step 2: Run fresh full verification**

Run in this order:

```powershell
npm test
npm run build
npm run build:release
```

Expected:

- 20 existing tests plus all new runtime tests pass;
- development build exits 0 without new warnings;
- release build exits 0 with production flags visible in the log;
- both expected RPK artifacts exist.

- [ ] **Step 3: Inspect final diff and resource ownership**

Run:

```powershell
git diff --check
git status --short
Select-String -Path src/pages/index/components/*.ux -Pattern '@service.health|@system.sensor|setInterval|setTimeout'
```

Expected: `git diff --check` is clean, and the component scan returns no matches.

Read `index.ux` and confirm `onHide` stops timer, motion connection timer, accelerometer and health subscriptions before returning.

- [ ] **Step 4: Commit documentation**

```powershell
git add -- README.md
git commit -m "docs: document optimized watch lifecycle"
```

- [ ] **Step 5: Request code review and address findings**

Dispatch a read-only reviewer with the spec, this plan, the relevant commit range and the measured test/build output. Fix every Critical and Important finding, re-run the affected test plus the full verification sequence, and commit fixes with a scoped message.

- [ ] **Step 6: Report measured outcome**

Final report must include:

- original and optimized icon byte sizes and percentage reduction;
- development and release RPK byte sizes;
- test count and exact commands run;
- confirmation that background resources pause and sessions resume;
- component file list;
- any emulator or physical-device visual checks still requiring user action.
