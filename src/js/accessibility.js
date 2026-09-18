// Keep regions mounted and announce only completed user actions, not rerenders.
export function createLiveStatus({ $ }) {
  const timers = new Map();
  function announce(message, id = 'liveStatus') {
    clearTimeout(timers.get(id));
    const region = $(id);
    region.textContent = '';
    // A separate update also makes repeated identical outcomes announceable.
    timers.set(id, setTimeout(() => {
      region.textContent = message;
      timers.delete(id);
    }, 100));
  }
  announce.clear = () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    for (const id of ['liveStatus', 'infoLiveStatus']) $(id).textContent = '';
  };
  return announce;
}
