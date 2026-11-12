(function(root) {
  'use strict';
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const clean = value => Object.fromEntries(Object.entries(value || {}).filter(([key]) => key !== 'selectedWeek'));
  const equal = (a, b, key) => owns(a, key) === owns(b, key) && a[key] === b[key];
  const same = (a, b) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every(key => equal(a, b, key));
  };
  function merge(base, local, remote) {
    base = clean(base); local = clean(local); remote = clean(remote);
    const result = {}, conflicts = [];
    for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
      const localChanged = !equal(base, local, key), remoteChanged = !equal(base, remote, key);
      if (localChanged && remoteChanged && !equal(local, remote, key)) conflicts.push(key);
      const source = localChanged ? local : remote;
      if (owns(source, key)) result[key] = source[key];
    }
    return {state: result, conflicts};
  }
  function resolve(base, local, remote, useRemote) {
    const merged = merge(base, local, remote);
    if (useRemote) for (const key of merged.conflicts) {
      if (owns(remote, key)) merged.state[key] = remote[key]; else delete merged.state[key];
    }
    return merged.state;
  }
  const api = {clean, same, merge, resolve};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HealthSyncCore = api;
})(typeof window === 'undefined' ? globalThis : window);
