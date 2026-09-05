const assert = require('assert');
const clock = require('../src/pages/index/session-clock.js');
const healthAdapter = require('../src/pages/index/health-adapter.js');
const healthCore = require('../src/pages/index/health-core.js');
const lifecycle = require('../src/pages/index/page-lifecycle.js');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function createResourceHarness(overrides) {
  const calls = {
    healthSubscriptions: [],
    healthUnsubscriptions: [],
    healthSamples: [],
    healthErrors: [],
    motionSubscriptions: [],
    motionUnsubscriptions: 0,
    motionSamples: [],
    motionErrors: [],
  };
  const options = overrides || {};
  const controller = lifecycle.createResourceController({
    healthTypes: [0, 9],
    getRecentHealth: options.getRecentHealth,
    subscribeHealth(type, onSample, onError) {
      calls.healthSubscriptions.push({ type, onSample, onError });
      if (options.subscribeHealth) options.subscribeHealth(type, onSample, onError);
    },
    unsubscribeHealth(type) {
      calls.healthUnsubscriptions.push(type);
      if (options.unsubscribeHealth) return options.unsubscribeHealth(type);
      return { ok: true };
    },
    subscribeMotion(onSample, onError) {
      calls.motionSubscriptions.push({ onSample, onError });
      if (options.subscribeMotion) options.subscribeMotion(onSample, onError);
    },
    unsubscribeMotion() {
      calls.motionUnsubscriptions += 1;
      if (options.unsubscribeMotion) return options.unsubscribeMotion();
      return { ok: true };
    },
    onHealthSample: (sample) => calls.healthSamples.push(sample),
    onHealthError: (error) => calls.healthErrors.push(error),
    onMotionSample: (sample) => calls.motionSamples.push(sample),
    onMotionError: (error) => calls.motionErrors.push(error),
  });
  return { calls, controller };
}

test('健康回调按类型和显示代际隔离，旧失败不会取消新订阅', () => {
  const { calls, controller } = createResourceHarness();
  controller.enterForeground();
  controller.startHealth(false);
  controller.startHealth(false);
  assert.deepStrictEqual(calls.healthSubscriptions.map((call) => call.type), [0, 9]);

  const oldHeart = calls.healthSubscriptions[0];
  controller.leaveForeground();
  controller.stopHealth();
  controller.stopHealth();
  assert.deepStrictEqual(calls.healthUnsubscriptions, [0, 9]);

  controller.enterForeground();
  controller.startHealth(false);
  const newHeart = calls.healthSubscriptions[2];
  oldHeart.onSample({ ok: true, dataType: 0, value: 88 });
  oldHeart.onError({ code: 203, unsupported: true });
  assert.deepStrictEqual(calls.healthSamples, []);
  assert.deepStrictEqual(calls.healthErrors, []);

  controller.startHealth(false);
  assert.strictEqual(calls.healthSubscriptions.length, 4);
  newHeart.onSample({ ok: true, dataType: 0, value: 72 });
  assert.deepStrictEqual(calls.healthSamples.map((sample) => sample.value), [72]);
});

test('同步健康订阅失败走正常错误路径并允许下次显示重试', () => {
  let firstHeartAttempt = true;
  const expectedError = { code: 203, unsupported: true };
  const { calls, controller } = createResourceHarness({
    subscribeHealth(type) {
      if (type === 0 && firstHeartAttempt) {
        firstHeartAttempt = false;
        throw expectedError;
      }
    },
  });

  controller.enterForeground();
  controller.startHealth(false);
  assert.deepStrictEqual(calls.healthSubscriptions.map((call) => call.type), [0, 9]);
  assert.deepStrictEqual(calls.healthErrors, [expectedError]);
  controller.startHealth(false);
  assert.deepStrictEqual(calls.healthSubscriptions.map((call) => call.type), [0, 9, 0]);
});

test('健康清理在单项取消抛错时继续并保持幂等状态', () => {
  const { calls, controller } = createResourceHarness({
    unsubscribeHealth(type) {
      if (type === 0) throw new Error('heart cleanup failed');
      return { ok: true };
    },
  });
  controller.enterForeground();
  controller.startHealth(false);
  controller.leaveForeground();
  const failures = controller.stopHealth();

  assert.deepStrictEqual(calls.healthUnsubscriptions, [0, 9]);
  assert.strictEqual(failures.length, 1);
  controller.stopHealth();
  assert.deepStrictEqual(calls.healthUnsubscriptions, [0, 9]);
  controller.enterForeground();
  controller.startHealth(false);
  assert.deepStrictEqual(calls.healthSubscriptions.map((call) => call.type), [0, 9, 0, 9]);
});

test('排队中的旧加速度成功和失败在隐藏恢复后均被忽略', () => {
  const { calls, controller } = createResourceHarness();
  controller.enterForeground();
  controller.startMotion();
  controller.startMotion();
  assert.strictEqual(calls.motionSubscriptions.length, 1);
  const oldMotion = calls.motionSubscriptions[0];

  controller.leaveForeground();
  controller.stopMotion();
  controller.enterForeground();
  controller.startMotion();
  const newMotion = calls.motionSubscriptions[1];

  oldMotion.onSample({ x: 5, y: 0, z: 0 });
  oldMotion.onError({ code: 200 });
  assert.deepStrictEqual(calls.motionSamples, []);
  assert.deepStrictEqual(calls.motionErrors, []);
  controller.startMotion();
  assert.strictEqual(calls.motionSubscriptions.length, 2);

  newMotion.onSample({ x: 1, y: 2, z: 3 });
  assert.deepStrictEqual(calls.motionSamples, [{ x: 1, y: 2, z: 3 }]);
});

test('最近健康请求的旧代际不会越过隐藏和再次显示', async () => {
  let resolveOldRequest;
  const oldRequest = new Promise((resolve) => { resolveOldRequest = resolve; });
  const { calls, controller } = createResourceHarness({
    getRecentHealth: () => oldRequest,
  });
  controller.enterForeground();
  controller.startHealth(true);
  controller.leaveForeground();
  controller.stopHealth();
  controller.enterForeground();
  controller.startHealth(false);
  resolveOldRequest([{ ok: true, dataType: 0, value: 99 }]);
  await oldRequest;
  await Promise.resolve();
  assert.deepStrictEqual(calls.healthSamples, []);
});

test('健康系统适配器把同步订阅和取消异常规范化为失败回调', () => {
  const errors = [];
  const systemHealth = {
    subscribeSample() {
      const error = new Error('unsupported');
      error.code = 203;
      throw error;
    },
    unsubscribeSample() {
      throw new Error('cleanup failed');
    },
  };

  healthAdapter.subscribe(systemHealth, healthCore, 0, () => {}, (error) => errors.push(error));
  const result = healthAdapter.unsubscribe(systemHealth, healthCore, 0, (error) => errors.push(error));
  assert.deepStrictEqual(errors, [
    { ok: false, code: 203, unsupported: true },
    { ok: false, code: 200, unsupported: false },
  ]);
  assert.strictEqual(result.ok, false);
});

test('拳击在完成边界恢复时先完成且不会重启动作或计时资源', () => {
  const paused = clock.pauseClock(clock.createClock(30000, 1000), 31000);
  const order = [];
  const result = lifecycle.resumeSession(paused, 51000, {
    updateClock: () => order.push('clock'),
    complete: () => order.push('complete'),
    rearm: () => order.push('rearm'),
  });
  assert.strictEqual(result.completed, true);
  assert.deepStrictEqual(order, ['clock', 'complete']);
});

(async () => {
  let passed = 0;
  for (const entry of tests) {
    await entry.fn();
    passed += 1;
    console.log(`ok - ${entry.name}`);
  }
  console.log(`\n${passed} page lifecycle tests passed`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
