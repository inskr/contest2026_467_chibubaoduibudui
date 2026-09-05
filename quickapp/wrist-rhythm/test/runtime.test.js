const assert = require('assert');
const clock = require('../src/pages/index/session-clock.js');
const subscriptions = require('../src/pages/index/subscription-lifecycle.js');
const reactive = require('../src/pages/index/reactive.js');

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

test('呼吸训练在完成边界恢复时不重启计时器', () => {
  const state = clock.createClock(60000, 1000);
  assert.strictEqual(clock.shouldScheduleInterval(state, 60999), true);
  assert.strictEqual(clock.shouldScheduleInterval(state, 61000), false);
});

test('拳击恢复后从下一个节拍开始且不补发后台目标', () => {
  assert.strictEqual(clock.nextBeatAfterResume(5000, 1000), 6000);
  assert.strictEqual(clock.nextBeatAfterResume(5500, 1200), 6000);
  assert.strictEqual(clock.nextBeatAfterResume(0, 1000), 1000);
});

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

console.log(`\n${passed} runtime tests passed`);
