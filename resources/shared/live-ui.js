// Shared presentation controls. Camera access always starts with a button.
if (new URLSearchParams(location.search).has('embed')) document.body.classList.add('embedded');
let eventLog = new ExpressionLog({key:document.body.dataset.logKey || 'affective-expression-log'});
let liveRunning = false;
let liveLabels = [];
function renderLog() {
  const counts = eventLog.counts();
  const table = document.querySelector('#tally'); table.replaceChildren();
  const labels = [...new Set([...liveLabels.filter(label => !eventLog.ignored.includes(label)), ...Object.keys(counts)])];
  labels.forEach(label => {
    const row = document.createElement('div'); const name = document.createElement('span'); const value = document.createElement('strong');
    name.textContent = label; value.textContent = counts[label] || 0; row.append(name,value); table.append(row);
  });
  document.querySelector('#total').textContent = eventLog.events.length;
  document.querySelector('#download-log').disabled = eventLog.events.length === 0;
  const latest = eventLog.events.at(-1);
  document.querySelector('#last-event').textContent = latest ? 'Last entry: ' + latest.label + ' / ' + new Date(latest.time).toLocaleTimeString() : 'No counted entries yet.';
  publishLiveState();
}
function publishLiveState() {
  if (window.parent !== window) window.parent.postMessage({type:'affective-live-state', running:liveRunning, total:eventLog.events.length, counts:eventLog.counts()}, location.origin);
}
function setLiveRunning(value) { liveRunning = value; if (!value) eventLog.resetTracking(); publishLiveState(); }
function logPredictions(predictions) { const event = eventLog.update(predictions); if (event) renderLog(); }
document.querySelector('#reset-log').addEventListener('click', () => { eventLog.reset(); renderLog(); });
document.querySelector('#download-log').addEventListener('click', () => eventLog.download());
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== window.parent) return;
  if (event.data?.type === 'affective-stop') stopCamera();
  if (event.data?.type === 'affective-state-request') publishLiveState();
});
window.addEventListener('pagehide', () => setLiveRunning(false));
renderLog();

document.addEventListener('keydown', event => {
  if (window.parent === window || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.target.closest('input,textarea,select,[contenteditable]')) return;
  if (['ArrowLeft','ArrowRight'].includes(event.key)) {
    event.preventDefault();
    window.parent.postMessage({type:'affective-nav',direction:event.key === 'ArrowRight' ? 'next' : 'previous'}, location.origin);
  }
});
