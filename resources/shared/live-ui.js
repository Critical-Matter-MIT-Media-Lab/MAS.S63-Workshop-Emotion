// Shared camera state and keyboard navigation; no expression counters or storage.
if (new URLSearchParams(location.search).has('embed')) document.body.classList.add('embedded');
let liveRunning = false;
function publishLiveState() { if (parent !== window) parent.postMessage({type:'affective-live-state',running:liveRunning},location.origin); }
function setLiveRunning(value) { liveRunning = value; publishLiveState(); }
window.addEventListener('message',event => {
  if (event.origin !== location.origin || event.source !== parent) return;
  if (event.data?.type === 'affective-stop') stopCamera();
  if (event.data?.type === 'affective-state-request') publishLiveState();
});
document.addEventListener('keydown',event => {
  if (parent === window || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.target.closest('input,textarea,select,[contenteditable]')) return;
  if (['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); parent.postMessage({type:'affective-nav',direction:event.key === 'ArrowRight' ? 'next' : 'previous'},location.origin); }
});
