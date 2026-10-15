// Optional connection to the local TouchDesigner Web Server DAT.
// Hosted HTTPS examples must be downloaded and opened on localhost first.
let tdSocket;
function sendToTouchDesigner(values, label = '') {
  if (tdSocket?.readyState === WebSocket.OPEN)
    tdSocket.send(JSON.stringify({type: 'affective_sensing', label, values}));
}
document.querySelector('#connect').addEventListener('click', () => {
  const status = document.querySelector('#bridge-status');
  if (location.protocol === 'https:') {
    status.textContent = 'Download the kit and open it at http://localhost:8000 to connect to local TouchDesigner.';
    return;
  }
  if (tdSocket && tdSocket.readyState < WebSocket.CLOSING) { tdSocket.close(); return; }
  try {
    tdSocket = new WebSocket('ws://127.0.0.1:9981');
    status.textContent = 'Connecting…';
    tdSocket.onopen = () => { status.textContent = 'Connected to TouchDesigner.'; document.querySelector('#connect').textContent = 'Disconnect'; };
    tdSocket.onclose = () => { status.textContent = 'Disconnected.'; document.querySelector('#connect').textContent = 'Connect to TouchDesigner'; };
    tdSocket.onerror = () => { status.textContent = 'Cannot connect. Start the TouchDesigner receiver on port 9981.'; };
  } catch { status.textContent = 'Connection unavailable. Open this page on localhost.'; }
});
window.addEventListener('pagehide', () => tdSocket?.close());
