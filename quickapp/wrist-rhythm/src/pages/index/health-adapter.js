function errorCode(error) {
  return error && typeof error.code === 'number' ? error.code : 200;
}

function normalizeException(core, error) {
  return core.normalizeError(errorCode(error));
}

function getRecent(systemHealth, core, dataTypes) {
  try {
    return Promise.resolve(systemHealth.getRecentSamples({ dataTypes }))
      .then((list) => core.normalizeRecent(list))
      .catch(() => []);
  } catch (error) {
    return Promise.resolve([]);
  }
}

function subscribe(systemHealth, core, dataType, onSample, onError) {
  const fail = (data, code) => {
    if (onError) onError(core.normalizeError(typeof code === 'number' ? code : 200));
  };
  try {
    systemHealth.subscribeSample({
      dataType,
      callback(sample) {
        const normalized = core.normalizeSample(dataType, sample);
        if (normalized && onSample) onSample(normalized);
      },
      fail,
    });
  } catch (error) {
    if (onError) onError(normalizeException(core, error));
  }
}

function unsubscribe(systemHealth, core, dataType, onError) {
  try {
    systemHealth.unsubscribeSample({ dataType });
    return { ok: true };
  } catch (error) {
    const normalized = normalizeException(core, error);
    if (onError) onError(normalized);
    return { ok: false, error: normalized };
  }
}

module.exports = { getRecent, subscribe, unsubscribe };
