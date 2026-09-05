# B1 Prism Glass Wrist Rhythm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将腕上节律的首页、稳态 60、节奏拳和两个结果页实现为已确认的 B1 棱镜夜光毛玻璃界面，同时保持现有训练逻辑、传感器降级和生命周期行为不变。

**Architecture:** `src/pages/index/index.ux` 继续独占业务和运行时状态，五个 `.ux` 展示组件消费现有 props 和一个由连击数派生的纯展示 prop `boxingComboClass`，并发出既有事件。颜色在组件内按统一语义重复声明，以适配 openvela 的样式限制；不增加主题运行时、视觉计时器或外部依赖。

**Tech Stack:** openvela Quick App UX、JavaScript、Node.js 22+、`aiot-toolkit` 2.0.5、Node `assert` 契约测试。

**Spec:** `docs/superpowers/specs/2026-08-28-prism-glass-wrist-rhythm-design.md`

## Global Constraints

- 设计基准为 480×480 圆形表盘，并保留 `regular`、`compact` 和 `short` 现有适配类。
- 原始五色固定为 `#080B1D`、`#20245A`、`#22D3EE`、`#FB7185`、`#FBBF24`。
- 稳态 60 使用青蓝静息能量；节奏拳使用玫红爆发能量，琥珀只用于目标窗口和高连击瞬间。
- 不改变健康数据、稳态判定、呼吸节奏、训练时钟、拳击评分、传感器降级或前后台资源生命周期。
- 不增加运行时换肤、常驻粒子、高频视觉定时器、外部渲染库或新依赖。
- 动画不承载唯一信息；不支持动画时，文字、颜色、数值和点击区域仍须完整工作。
- 当前工作区已有未提交修改。执行前先运行 `git diff -- src/pages/index/components/breathing.ux src/pages/index/components/boxing.ux src/pages/index/index.ux test/component-contract.test.js`；保留现有 `breathRhythmClass` 与 4/2/4、4/2/6 动画时长修改。恢复线框拳击手是本设计明确要求，只定向替换 `boxing.ux` 的中心舞台和相关测试，不覆盖其他未提交工作。
- 每次提交只暂存任务列出的文件；不得使用 `git add .`。

## File Structure

- `src/pages/index/index.ux`：五屏编排与唯一业务状态所有者；本计划只更换应用画布颜色，不新增视觉状态机。
- `src/pages/index/components/home.ux`：B1 首页画布层、生命仪表、数据脉冲和双训练入口。
- `src/pages/index/components/breathing.ux`：青蓝三层呼吸球及 4/2/4、4/2/6 状态动画。
- `src/pages/index/components/boxing.ux`：玫红线框拳击手、琥珀目标、命中冲击环、点击降级和圆屏适配。
- `src/pages/index/components/steady-result.ux`：青蓝单次完成光环和稳态指标玻璃卡。
- `src/pages/index/components/boxing-result.ux`：玫红单次完成光环和拳击指标玻璃卡；琥珀高连击只在训练中的 `combo-hot` 状态出现。
- `test/component-contract.test.js`：组件结构、状态类、语义色、动画次数和安全区契约。
- `README.md`：将旧“青绿/暖橙”视觉说明更新为 B1 棱镜夜光说明。

---

### Task 1: B1 Canvas and Home Glass System

**Files:**
- Modify: `src/pages/index/index.ux:480-489`
- Modify: `src/pages/index/components/home.ux:61-335`
- Modify: `test/component-contract.test.js:197-213`

**Interfaces:**
- Consumes: `suggest: Boolean`、`vitalPulseClass: String`、现有健康文本 props 和 `startTraining` / `startBoxing` 事件。
- Produces: 保持 `vital-orbit`、`orbit-pulse`、`orbit-ring`、`steady-mode`、`boxing-mode` 类名，供现有父页面和后续视觉测试使用。

- [ ] **Step 1: Write the failing B1 home palette contract**

在 `test/component-contract.test.js` 的首页测试之后加入：

```js
test('首页使用 B1 棱镜夜光画布、玻璃和双能量入口', () => {
  const parent = fs.readFileSync(path.join(pageDirectory, 'index.ux'), 'utf8');
  const home = componentSource('home.ux');

  assert.strictEqual(styleDeclarations(parent, '.app')['background-color'], '#080b1d');
  assert.strictEqual(styleDeclarations(home, '.vital-orbit')['background-color'], '#111534');
  assert.strictEqual(styleDeclarations(home, '.orbit-ring')['background-color'], '#171a40');
  assert.strictEqual(styleDeclarations(home, '.orbit-pulse')['border-color'], '#22d3ee');
  assert.strictEqual(styleDeclarations(home, '.steady-mode')['border-color'], '#247f96');
  assert.strictEqual(styleDeclarations(home, '.boxing-mode')['border-color'], '#9d415b');
  assert.strictEqual(styleDeclarations(home, '.status-dot-alert').color, '#fbbf24');
});
```

- [ ] **Step 2: Run the contract test and confirm the old palette fails**

Run: `node test/component-contract.test.js`

Expected: FAIL at `首页使用 B1 棱镜夜光画布、玻璃和双能量入口`, with the current green canvas such as `#020807` or `#0a1d18` differing from B1 values.

- [ ] **Step 3: Apply the B1 canvas and home semantic colors**

Keep the existing template, props, pulse generation and responsive sizes. Change the relevant style declarations to the exact values below:

```css
.app { background-color: #080b1d; color: #f8fafc; }
.brand { color: #f8fafc; }
.eyebrow { color: #8d91bd; }
.vital-orbit { border-color: #343a74; background-color: #111534; }
.orbit-pulse { border-color: #22d3ee; }
.orbit-steady { border-color: #315e83; }
.orbit-alert { border-color: #9d415b; background-color: #21112c; }
.orbit-ring { border-color: #3d417a; background-color: #171a40; }
.status-dot { color: #22d3ee; }
.status-dot-alert { color: #fbbf24; }
.status-title, .metric-value, .mode-title { color: #f8fafc; }
.status-subtitle { color: #a7a9c7; }
.metric-divider { background-color: #3d417a; }
.metric-label { color: #898dad; }
.health-message { color: #fbbf24; }
.steady-mode { border-color: #247f96; background-color: #102338; }
.boxing-mode { border-color: #9d415b; background-color: #2a142b; }
.mode-kicker { color: #67e8f9; }
.boxing-kicker { color: #fda4af; }
.disclaimer { color: #666b91; }
```

Do not add new elements or props. Preserve both one-shot `pulse-a` / `pulse-b` keyframes and all `-short` dimensions.

- [ ] **Step 4: Run the component contract test**

Run: `node test/component-contract.test.js`

Expected: all component contract tests PASS, including the new B1 home contract and the existing 650ms one-shot pulse structure.

- [ ] **Step 5: Commit the home slice**

```bash
git add src/pages/index/index.ux src/pages/index/components/home.ux test/component-contract.test.js
git commit -m "feat: apply prism glass home palette"
```

Before committing, run `git diff --cached --check` and inspect `git diff --cached` to confirm the existing `breathRhythmClass` parent change has not been removed.

---

### Task 2: Calm Cyan Steady 60 Glass

**Files:**
- Modify: `src/pages/index/components/breathing.ux:37-323`
- Modify: `test/component-contract.test.js:224-265`

**Interfaces:**
- Consumes: `remainingText`、`breathPhase` (`inhale | hold | exhale`)、`breathRhythmClass` (`rhythm-standard | rhythm-calming`)、`phaseLabel` 和 `patternLabel`。
- Produces: 保持 `breath-halo`、`breath-orb`、`orb-core` 的阶段与节奏类组合；后续构建依赖这些类的动画时长。

- [ ] **Step 1: Extend the breathing contract with B1 semantic colors and fixed text geometry**

在现有“呼吸球首次吸气”测试之后加入：

```js
test('稳态 60 使用青蓝玻璃且动画不推动文字', () => {
  const source = componentSource('breathing.ux');
  const template = templateSource(source);

  assert.strictEqual(styleDeclarations(source, '.orb-shell')['background-color'], '#0d1630');
  assert.strictEqual(styleDeclarations(source, '.breath-halo')['border-color'], '#247f96');
  assert.strictEqual(styleDeclarations(source, '.breath-orb')['background-color'], '#163c59');
  assert.strictEqual(styleDeclarations(source, '.orb-core')['background-color'], '#a5f3fc');
  assert.strictEqual(styleDeclarations(source, '.phase-label').color, '#f8fafc');
  assert(!attributesForClass(template, 'phase-label').class.includes('breathPhase'));
  assert(!attributesForClass(template, 'remaining').class.includes('breathPhase'));
});
```

- [ ] **Step 2: Run the test and verify the green breathing palette fails**

Run: `node test/component-contract.test.js`

Expected: FAIL at `稳态 60 使用青蓝玻璃且动画不推动文字`, while all earlier rhythm-duration assertions still pass.

- [ ] **Step 3: Recolor the existing three-layer breathing system without changing its timing**

Apply these exact declarations while retaining the existing keyframes and responsive dimensions:

```css
.session-label { color: #8d91bd; }
.remaining { color: #f8fafc; }
.orb-shell { border-color: #2e356d; background-color: #0d1630; }
.breath-halo { border-color: #247f96; background-color: #102944; }
.breath-halo.hold { border-color: #67e8f9; }
.breath-orb { background-color: #163c59; }
.breath-orb.inhale { background-color: #15516d; }
.breath-orb.hold { background-color: #17647d; }
.breath-orb.exhale { background-color: #12324d; }
.orb-core { background-color: #a5f3fc; }
.phase-label { color: #f8fafc; }
.pattern-label { color: #8d91bd; }
.stop-button { border-color: #3b4374; background-color: #11152e; }
.stop-text { color: #a7a9c7; }
```

Do not change `4000ms` inhale, `2000ms` hold, `4000ms` standard exhale or `6000ms` calming exhale. Do not introduce `animation-iteration-count: infinite` or transition-driven width changes.

- [ ] **Step 4: Run focused and full logic tests**

Run: `node test/component-contract.test.js`

Expected: PASS, including 4/2/4 and 4/2/6 duration assertions.

Run: `node test/steady.test.js`

Expected: PASS; the visual recolor must not change pattern selection or phase calculation.

- [ ] **Step 5: Commit the steady slice**

```bash
git add src/pages/index/components/breathing.ux test/component-contract.test.js
git commit -m "feat: style steady training with cyan glass"
```

Inspect the staged diff to verify the existing `breathRhythmClass` prop and timing work are included unchanged rather than reverted.

---

### Task 3: Rose Fighter and Amber Beat Feedback

**Files:**
- Modify: `src/pages/index/index.ux:44-57, 134-154, 329-389`
- Modify: `src/pages/index/components/boxing.ux:19-33, 114-282`
- Modify: `test/component-contract.test.js:267-282`

**Interfaces:**
- Consumes: `boxingTargetClass` (`target-waiting | target-active | target-hit | target-missed`), `boxingComboClass` (`combo-calm | combo-hot`), existing score/streak/timer props, `boxingFallback`, `boxingMessage` and `simulatePunch` / `stopBoxing` events.
- Produces: a clickable `fighter-stage` containing named fighter parts and two `impact-wave` elements. `boxingComboClass` is a presentation-only value derived from the existing streak at the threshold `streak >= 5`; it does not duplicate or change scoring state.

- [ ] **Step 1: Replace the simplified-target contract with the approved fighter contract**

Replace the current `节奏拳使用轻量可点击目标` test with:

```js
test('节奏拳使用可点击线框人物并绑定 B1 节拍状态', () => {
  const source = componentSource('boxing.ux');
  const template = templateSource(source);
  const parent = fs.readFileSync(path.join(pageDirectory, 'index.ux'), 'utf8');
  const stage = attributesForClass(template, 'fighter-stage');

  assert.strictEqual(stage.onclick, 'simulatePunch');
  assert(stage.class.includes('{{ boxingTargetClass }}'));
  for (const part of [
    'fighter-head', 'fighter-body', 'fighter-arm-left', 'fighter-arm-right',
    'fighter-fist-left', 'fighter-fist-right', 'fighter-leg-left', 'fighter-leg-right',
  ]) assert(template.includes(part), part);
  assert(template.includes('impact-wave-one'));
  assert(template.includes('impact-wave-two'));
  assert.strictEqual(styleDeclarations(source, '.fighter-body')['background-color'], '#fb7185');
  assert.strictEqual(styleDeclarations(source, '.target-active-fist-right')['background-color'], '#fbbf24');
  assert.strictEqual(styleDeclarations(source, '.target-hit-arm-right')['background-color'], '#fb7185');
  assert(attributesForClass(template, 'boxing-streak-value').class.includes('{{ boxingComboClass }}'));
  assert(parent.includes("this.boxingComboClass = this.boxingStats.streak >= 5 ? 'combo-hot' : 'combo-calm'"));
});
```

In the `boxing.ux` entry of `contracts`, add `'boxingComboClass'` beside `boxingStreakText`. The generic parent/child contract tests will then require the prop declaration and the parent binding `boxing-combo-class="{{ boxingComboClass }}"`.

Keep the existing test that rejects `animation-iteration-count: infinite`.

- [ ] **Step 2: Run the contract and confirm the simplified target fails**

Run: `node test/component-contract.test.js`

Expected: FAIL because `fighter-stage` and fighter parts are absent.

- [ ] **Step 3: Restore the fighter-stage template while preserving the click fallback**

Replace only the current `punch-target` block with:

```html
<div class="fighter-stage fighter-stage-{{ screenSize }} fighter-stage-{{ screenViewport }} {{ boxingTargetClass }}" onclick="simulatePunch">
  <div class="impact-wave impact-wave-{{ screenViewport }} impact-wave-one {{ boxingTargetClass }}-wave"></div>
  <div class="impact-wave impact-wave-{{ screenViewport }} impact-wave-two {{ boxingTargetClass }}-wave"></div>
  <div class="fighter fighter-{{ screenViewport }} {{ boxingTargetClass }}-fighter">
    <div class="fighter-head {{ boxingTargetClass }}-head"></div>
    <div class="fighter-body {{ boxingTargetClass }}-body"></div>
    <div class="fighter-arm fighter-arm-left {{ boxingTargetClass }}-arm-left"></div>
    <div class="fighter-arm fighter-arm-right {{ boxingTargetClass }}-arm-right"></div>
    <div class="fighter-fist fighter-fist-left {{ boxingTargetClass }}-fist-left"></div>
    <div class="fighter-fist fighter-fist-right {{ boxingTargetClass }}-fist-right"></div>
    <div class="fighter-leg fighter-leg-left {{ boxingTargetClass }}-leg-left"></div>
    <div class="fighter-leg fighter-leg-right {{ boxingTargetClass }}-leg-right"></div>
  </div>
</div>
```

Keep the separate `simulate-button` and its `onclick="simulatePunch"` unchanged.

- [ ] **Step 4: Add the presentation-only high-combo class**

In `index.ux`, add `boxingComboClass: 'combo-calm'` beside the existing boxing display fields, reset it to `'combo-calm'` in `startBoxing()`, and derive it in `syncBoxingStats()`:

```js
syncBoxingStats() {
  this.boxingScoreText = String(this.boxingStats.score);
  this.boxingStreakText = String(this.boxingStats.streak);
  this.boxingComboClass = this.boxingStats.streak >= 5 ? 'combo-hot' : 'combo-calm';
},
```

Pass `boxing-combo-class="{{ boxingComboClass }}"` to `<boxing-view>`. In `boxing.ux`, declare the prop and change the streak value to:

```html
<text class="boxing-stat-value boxing-streak-value {{ boxingComboClass }}">{{ boxingStreakText }}</text>
```

Add `.combo-calm { color: #fda4af; }` and `.combo-hot { color: #fbbf24; }`. Do not derive a second streak counter or change `boxingStats`.

- [ ] **Step 5: Implement finite B1 fighter state styles**

Replace the simplified `punch-target` / `target-ring` rules with a 210×210 `fighter-stage`. Use the existing 104×164 line-figure geometry and these exact state rules:

```css
.fighter-stage { position: relative; width: 210px; height: 210px; margin-top: 5px; border-width: 1px; border-color: #343a74; border-radius: 105px; justify-content: center; align-items: center; background-color: #11152e; }
.impact-wave { position: absolute; left: 34px; top: 34px; width: 140px; height: 140px; border-width: 2px; border-color: #fb7185; border-radius: 70px; opacity: 0; }
.impact-wave-two { left: 19px; top: 19px; width: 170px; height: 170px; border-radius: 85px; }
.target-hit-wave { animation-name: impact-expand; animation-duration: 500ms; animation-timing-function: ease-out; animation-iteration-count: 1; }
.fighter { position: relative; width: 104px; height: 164px; animation-name: fighter-enter; animation-duration: 420ms; animation-timing-function: ease-out; animation-iteration-count: 1; }
.fighter-head { position: absolute; left: 35px; top: 4px; width: 34px; height: 34px; border-width: 3px; border-color: #fda4af; border-radius: 17px; background-color: #2a142b; }
.fighter-body { position: absolute; left: 40px; top: 42px; width: 24px; height: 66px; border-width: 3px; border-color: #fda4af; border-radius: 12px; background-color: #fb7185; }
.fighter-arm { position: absolute; top: 50px; width: 50px; height: 12px; border-radius: 6px; background-color: #fb7185; transform-origin: center center; transition-property: transform, background-color, opacity; transition-duration: 160ms; transition-timing-function: ease-out; }
.fighter-arm-left { left: 3px; transform: rotate(28deg); }
.fighter-arm-right { left: 52px; transform: rotate(-28deg); }
.fighter-fist { position: absolute; top: 45px; width: 20px; height: 20px; border-width: 2px; border-color: #fda4af; border-radius: 10px; background-color: #7f2d4d; transition-property: transform, opacity, background-color; transition-duration: 160ms; }
.fighter-fist-left { left: 0; }
.fighter-fist-right { left: 84px; }
.fighter-leg { position: absolute; top: 100px; width: 14px; height: 62px; border-radius: 7px; background-color: #c45b77; transform-origin: center top; }
.fighter-leg-left { left: 32px; transform: rotate(12deg); }
.fighter-leg-right { left: 58px; transform: rotate(-12deg); }
.target-active-fist-right { background-color: #fbbf24; transform: scale(1.16); }
.target-active-arm-right { background-color: #fbbf24; transform: rotate(-44deg) scaleX(1.08); }
.target-hit-fighter { animation-name: fighter-strike; animation-duration: 320ms; animation-timing-function: ease-out; animation-iteration-count: 1; }
.target-hit-arm-right { background-color: #fb7185; transform: translateX(24px) rotate(-8deg) scaleX(1.22); }
.target-hit-fist-right { background-color: #fda4af; transform: translateX(30px) scale(1.25); }
.target-missed-fighter { opacity: 0.62; animation-name: fighter-miss; animation-duration: 360ms; animation-iteration-count: 1; }
```

Define `fighter-enter`, `fighter-strike`, `fighter-miss` and `impact-expand` keyframes with only `transform` and `opacity`. Every animation must use `animation-iteration-count: 1`. Restore `fighter-stage-compact`, `fighter-stage-short`, `fighter-short` and `impact-wave-short { display: none; }` so the short viewport center stage remains 110×110 and does not show impact rings.

- [ ] **Step 6: Run the component and boxing logic tests**

Run: `node test/component-contract.test.js`

Expected: PASS, including clickable fighter structure and no infinite animation.

Run: `node test/steady.test.js`

Expected: PASS, confirming scoring, debounce and beat-window behavior are unchanged.

- [ ] **Step 7: Commit the boxing slice**

```bash
git add src/pages/index/index.ux src/pages/index/components/boxing.ux test/component-contract.test.js
git commit -m "feat: restore prism glass rhythm fighter"
```

Inspect the staged diff and verify score, streak, timer, fallback text, both click targets and emitted events remain present.

---

### Task 4: Calm and Active Result Glass

**Files:**
- Modify: `src/pages/index/components/steady-result.ux:48-239`
- Modify: `src/pages/index/components/boxing-result.ux:45-229`
- Modify: `test/component-contract.test.js:295-301`

**Interfaces:**
- Consumes: existing result value props and `returnHome` events.
- Produces: both pages retain `completion-halo` and `completion-enter`; steady result uses cyan and boxing result uses rose，结果页不使用琥珀常态强调。

- [ ] **Step 1: Strengthen the shared completion contract**

Replace the existing result-halo test with:

```js
test('结果页共享单次完成光环并使用对应 B1 能量色', () => {
  const steady = componentSource('steady-result.ux');
  const boxingResult = componentSource('boxing-result.ux');

  for (const source of [steady, boxingResult]) {
    assert(templateSource(source).includes('completion-halo'));
    assert(source.includes('@keyframes completion-enter'));
    assert.strictEqual(styleDeclarations(source, '.completion-halo')['animation-iteration-count'], '1');
  }
  assert.strictEqual(styleDeclarations(steady, '.completion-halo')['border-color'], '#22d3ee');
  assert.strictEqual(styleDeclarations(steady, '.result-row')['background-color'], '#11152e');
  assert.strictEqual(styleDeclarations(boxingResult, '.completion-halo')['border-color'], '#fb7185');
  assert.strictEqual(styleDeclarations(boxingResult, '.boxing-result-cell')['background-color'], '#18142f');
  assert.strictEqual(styleDeclarations(boxingResult, '.coral').color, '#fda4af');
});
```

- [ ] **Step 2: Run the contract and verify the old green/orange result palette fails**

Run: `node test/component-contract.test.js`

Expected: FAIL on the new exact result colors.

- [ ] **Step 3: Apply calm cyan styling to the steady result**

Use these semantic declarations without changing markup, props, events, one-shot keyframe or responsive dimensions:

```css
.result-kicker { color: #67e8f9; }
.completion-halo { border-color: #22d3ee; }
.result-icon { border-color: #247f96; background-color: #102338; }
.result-check, .delta-good { color: #67e8f9; }
.result-title, .result-name { color: #f8fafc; }
.result-subtitle, .result-detail { color: #8d91bd; }
.result-row { border-color: #343a74; background-color: #11152e; }
.delta-neutral { color: #a7a9c7; }
.primary-button { border-color: #247f96; background-color: #102338; }
.button-title { color: #a5f3fc; }
```

- [ ] **Step 4: Apply rose styling and localized amber to the boxing result**

Use:

```css
.boxing-result-kicker { color: #fda4af; }
.completion-halo { border-color: #fb7185; }
.boxing-result-score, .boxing-result-value, .boxing-hr-value { color: #f8fafc; }
.boxing-result-score-label, .boxing-result-label, .boxing-hr-label { color: #8d91bd; }
.boxing-result-cell, .boxing-hr-result { border-color: #49345f; background-color: #18142f; }
.coral { color: #fda4af; }
.primary-button { border-color: #9d415b; background-color: #2a142b; }
.button-title { color: #fda4af; }
```

Do not use amber on the result page; the result remains rose glass, while amber is reserved for the live target and `combo-hot` training state.

- [ ] **Step 5: Run the result contracts and commit**

Run: `node test/component-contract.test.js`

Expected: PASS with one-shot completion animation on both result pages.

```bash
git add src/pages/index/components/steady-result.ux src/pages/index/components/boxing-result.ux test/component-contract.test.js
git commit -m "feat: style prism glass training results"
```

---

### Task 5: Documentation, Full Verification, and Visual Acceptance

**Files:**
- Modify: `README.md:1-25, 64-80`
- Verify: `src/pages/index/index.ux`
- Verify: `src/pages/index/components/home.ux`
- Verify: `src/pages/index/components/breathing.ux`
- Verify: `src/pages/index/components/boxing.ux`
- Verify: `src/pages/index/components/steady-result.ux`
- Verify: `src/pages/index/components/boxing-result.ux`
- Verify: `test/component-contract.test.js`
- Output: `dist/com.openvela.wristrhythm.debug.1.0.0.rpk`
- Output: `dist/com.openvela.wristrhythm.release.1.0.0.rpk`

**Interfaces:**
- Consumes: the four independently tested visual slices.
- Produces: verified B1 application packages and a repeatable visual acceptance record.

- [ ] **Step 1: Update README visual terminology**

Change the completed-feature bullet from the old generic cyber-glass wording to:

```markdown
- B1 棱镜夜光毛玻璃视觉：稳态 60 使用青蓝静息能量，节奏拳使用玫红爆发与少量琥珀高光
```

In the simulator acceptance list, add explicit checks for the B1 palette, one-shot completion rings, clickable fallback fighter, and the absence of round-screen clipping. Do not change build, signing or medical-disclaimer instructions.

- [ ] **Step 2: Run the complete automated suite**

Run: `npm test`

Expected: exit code 0; steady, runtime, page lifecycle, component contract and release-runner tests all pass.

- [ ] **Step 3: Build the development package**

Run: `npm run build`

Expected: exit code 0 and a freshly generated `dist/com.openvela.wristrhythm.debug.1.0.0.rpk`.

- [ ] **Step 4: Build the release package**

Run: `npm run build:release`

Expected: exit code 0 and a freshly generated `dist/com.openvela.wristrhythm.release.1.0.0.rpk`; no stale artifact warning.

- [ ] **Step 5: Perform simulator visual acceptance**

Open the project in AIoT IDE with `vela-miwear-watch-5.0(开发者大赛)` and capture screenshots for this exact matrix:

```text
home-normal
home-stress-alert
steady-inhale
steady-hold
steady-exhale-standard
steady-exhale-calming
boxing-waiting
boxing-target-active
boxing-target-hit
boxing-target-missed
boxing-fallback-click
steady-result
boxing-result
compact-round-home
short-viewport-steady
short-viewport-boxing
```

For every screenshot, verify: no title/value/button/fighter clipping; glass borders remain low contrast; cyan is dominant only in calm states; rose is dominant only in boxing feedback; amber is limited to target/high-combo moments; animations never move text or controls. If any frame fails, add a reproducing contract assertion for its measurable geometry or state class before adjusting CSS.

- [ ] **Step 6: Inspect the final diff and commit documentation**

Run:

```bash
git diff --check
git status --short
git diff -- README.md src/pages/index/index.ux src/pages/index/components test/component-contract.test.js
```

Confirm no unrelated user file is staged, then commit only the README change:

```bash
git add README.md
git commit -m "docs: describe prism glass interface"
```

- [ ] **Step 7: Record final evidence in the handoff**

Report the exact commands and exit codes, both RPK paths, the screenshot matrix inspected, any simulator-only limitations, and the final `git status --short`. Do not claim visual acceptance if screenshots were not actually captured and inspected.
