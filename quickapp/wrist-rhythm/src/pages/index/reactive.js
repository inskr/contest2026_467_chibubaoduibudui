function writeIfChanged(target, key, nextValue) {
  if (!target || target[key] === nextValue) return false;
  target[key] = nextValue;
  return true;
}

module.exports = { writeIfChanged };
