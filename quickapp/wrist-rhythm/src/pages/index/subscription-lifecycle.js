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
