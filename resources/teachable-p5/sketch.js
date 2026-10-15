// Load a Teachable Machine image model and run it on a p5.js canvas.
let model, video, cameraCanvas, running = false, generation = 0, labels = [];
let modelKey = '';
const $ = selector => document.querySelector(selector);
const statusText = text => $('#status').textContent = text;
function setup() {
  cameraCanvas = createCanvas(360,360); cameraCanvas.parent('camera');
  pixelDensity(1); noLoop(); background(238);
  try { if (!$('#model-url').value.trim()) $('#model-url').value = sessionStorage.getItem('affective-tm-model-url') || ''; } catch {}
  $('#load-model').disabled = false;
}
function draw() {
  background(238);
  if (running && video?.elt.readyState >= 2) {
    // Teachable Machine uses a mirrored square crop. Keep all UI outside the input.
    const side = Math.min(video.elt.videoWidth, video.elt.videoHeight);
    const x = (video.elt.videoWidth-side)/2, y = (video.elt.videoHeight-side)/2;
    push(); translate(width,0); scale(-1,1); image(video,0,0,width,height,x,y,side,side); pop();
  }
}
function normalizeModelURL(value) {
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.hostname !== 'teachablemachine.withgoogle.com') throw new Error('Use the HTTPS shareable link from Teachable Machine.');
  const match = url.pathname.match(/^\/models\/([A-Za-z0-9_-]+)(?:\/(?:model\.json)?)?$/);
  if (!match) throw new Error('Copy the model link from Export Model, not the training page URL.');
  return 'https://teachablemachine.withgoogle.com/models/' + match[1] + '/';
}
async function loadModel() {
  let base;
  try { base = normalizeModelURL($('#model-url').value); } catch(error) { statusText(error.message); return; }
  stopCamera();
  model?.model?.dispose(); model = null; labels = [];
  eventLog = new ExpressionLog({key:'affective-tm-log:'+base, ignored:[]}); liveLabels = []; renderLog();
  const token = ++generation;
  $('#load-model').disabled = true; $('#start').disabled = true;
  statusText('Loading your model…');
  let loaded;
  try {
    if (!window.tmImage) throw new Error('Libraries are unavailable. Check the connection and reload.');
    loaded = await tmImage.load(base+'model.json', base+'metadata.json');
    if (token !== generation) { loaded.model?.dispose(); return; }
    const nextLabels = loaded.getClassLabels();
    if (nextLabels.length < 2 || new Set(nextLabels).size !== nextLabels.length) throw new Error('Use a model with at least two distinct class names.');
    model?.model?.dispose(); model = loaded; labels = nextLabels; modelKey = base;
    const ignored = labels.find(label => /^(neutral|background|no expression|rest)$/i.test(label)) || '';
    eventLog = new ExpressionLog({key:'affective-tm-log:'+base, ignored:ignored ? [ignored] : []}); liveLabels = labels;
    $('#ignore-label').replaceChildren(new Option('None',''), ...labels.map(label => new Option(label,label)));
    $('#ignore-label').value = ignored;
    $('#model-url').value = base;
    try { sessionStorage.setItem('affective-tm-model-url', base); } catch {}
    renderLog(); $('#start').disabled = false;
    statusText('Model ready / '+labels.join(', ')+'. Start the camera to test it.');
  } catch(error) { statusText('Could not load this image model: '+error.message); $('#start').disabled = !model; }
  finally { $('#load-model').disabled = false; }
}
async function startCamera() {
  if (!model || running) return;
  const token = ++generation;
  $('#start').disabled = true; $('#stop').disabled = false; $('#load-model').disabled = true;
  statusText('Requesting camera…');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({video:{width:480,height:360},audio:false});
    if (token !== generation) { stream.getTracks().forEach(track => track.stop()); return; }
    video = createVideo([]); video.elt.srcObject = stream; video.elt.muted = true; video.elt.playsInline = true; video.hide();
    await video.elt.play();
    if (token !== generation) { stream.getTracks().forEach(track => track.stop()); video.remove(); return; }
    running = true; setLiveRunning(true); statusText('Live / testing your model.');
    loop(); predict(token);
  } catch(error) { stopCamera(); statusText('Camera unavailable: '+error.message); }
}
async function predict(token) {
  if (!running || token !== generation) return;
  try {
    draw(); // Refresh even when this iframe is hidden on another slide.
    const predictions = await model.predict(cameraCanvas.elt);
    if (!running || token !== generation) return;
    const top = predictions.reduce((a,b) => a.probability > b.probability ? a : b);
    $('#result').textContent = `${top.className} / ${(top.probability*100).toFixed(0)}% model score`;
    $('#scores').textContent = predictions.map(p => p.className+': '+(p.probability*100).toFixed(1)+'%').join('\n');
    logPredictions(predictions.map(p => ({label:p.className,score:p.probability})));
    sendToTouchDesigner({classA:predictions[0]?.probability || 0,classB:predictions[1]?.probability || 0,confidence:top.probability,active:1},top.className);
    setTimeout(() => predict(token),100);
  } catch(error) { stopCamera(); statusText('Prediction stopped: '+error.message); }
}
function stopCamera() {
  generation++; running = false; setLiveRunning(false);
  video?.elt.srcObject?.getTracks().forEach(track => track.stop()); video?.remove(); video = null;
  noLoop(); redraw();
  $('#start').disabled = !model; $('#stop').disabled = true; $('#load-model').disabled = false;
  $('#result').textContent = 'No prediction'; $('#scores').textContent = '';
  statusText(model ? 'Camera off. Model and log are preserved.' : 'Paste your exported image model URL first.');
  sendToTouchDesigner({classA:0,classB:0,confidence:0,active:0});
}
$('#load-model').addEventListener('click',loadModel);
$('#start').addEventListener('click',startCamera);
$('#stop').addEventListener('click',stopCamera);
$('#ignore-label').addEventListener('change', () => { eventLog.ignored = $('#ignore-label').value ? [$('#ignore-label').value] : []; eventLog.resetTracking(); renderLog(); });
window.addEventListener('pagehide',stopCamera);

