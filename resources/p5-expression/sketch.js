// p5 camera and the original expression-enabled ml5 model. Weights load on entry.
let video, faceapi, running = false, generation = 0, modelPromise;
let inferenceQueue = Promise.resolve();
const names = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'];
const statusText = text => document.querySelector('#status').textContent = text;
function setup() {
  noCanvas(); liveLabels = names; renderLog();
  const select = document.querySelector('#ignore-label');
  names.forEach(name => select.add(new Option(name,name)));
  select.addEventListener('change', () => { eventLog.ignored = select.value ? [select.value] : []; eventLog.resetTracking(); renderLog(); });
  document.querySelector('#start').disabled = false;
  statusText('Camera off. Start when you are ready.');
  ensureModel().catch(() => {});
}
function ensureModel() {
  if (faceapi) return Promise.resolve(faceapi);
  if (modelPromise) return modelPromise;
  document.querySelector('#model-state').textContent = 'Preloading expression model…';
  modelPromise = Promise.resolve().then(() => {
    if (!window.ml5) throw new Error('ml5.js could not load.');
    return ml5.faceApi({withLandmarks:false,withDescriptors:false,withExpressions:true,minConfidence:0.5});
  }).then(model => {
    faceapi = model;
    document.querySelector('#model-state').textContent = 'Expression model ready.';
    return model;
  }).catch(error => {
    modelPromise = null;
    document.querySelector('#model-state').textContent = 'Model unavailable. Start will retry the download.';
    throw error;
  });
  return modelPromise;
}
function infer(input) {
  const task = inferenceQueue.catch(() => {}).then(async () => {
    await ensureModel();
    return input ? faceapi.detect(input) : faceapi.detect();
  });
  inferenceQueue = task;
  return task;
}
function emptyValues() { return Object.fromEntries([...names,'confidence','hasFace'].map(name => [name,0])); }
async function startCamera() {
  const token = ++generation;
  document.querySelector('#start').disabled = true; document.querySelector('#stop').disabled = false;
  statusText(faceapi ? 'Requesting camera…' : 'Finishing model preload…');
  try {
    await ensureModel();
    if (token !== generation) return;
    const stream = await navigator.mediaDevices.getUserMedia({video:{width:480,height:360},audio:false});
    if (token !== generation) { stream.getTracks().forEach(t => t.stop()); return; }
    video = createVideo([]); video.elt.srcObject = stream; video.elt.muted = true; video.elt.playsInline = true;
    video.size(480,360); video.parent('camera'); await video.elt.play();
    if (token !== generation) { stream.getTracks().forEach(t => t.stop()); return; }
    faceapi.video = video.elt;
    running = true; setLiveRunning(true); statusText('Model ready. Try an expression.');
    detect(token);
  } catch(error) { stopCamera(); statusText('Could not start: '+error.message); }
}
async function detect(token) {
  if (!running || token !== generation) return;
  try {
    const faces = await infer();
    if (!running || token !== generation) return;
    const values = emptyValues(); let label = '';
    if (faces?.length) {
      names.forEach(name => values[name] = Number(faces[0].expressions[name]) || 0);
      label = names.reduce((a,b) => values[a] > values[b] ? a : b);
      values.confidence = values[label]; values.hasFace = 1;
      document.querySelector('#result').textContent = label+' / '+Math.round(values[label]*100)+'% model score';
      document.querySelector('#scores').textContent = names.map(name => name+': '+(values[name]*100).toFixed(1)+'%').join('\n');
    } else {
      document.querySelector('#result').textContent = 'No face detected'; document.querySelector('#scores').textContent = '';
    }
    logPredictions(values.hasFace ? names.map(name => ({label:name,score:values[name]})) : []);
    sendToTouchDesigner(values,label);
    setTimeout(() => detect(token),100);
  } catch(error) { if (token === generation) { stopCamera(); statusText('Detection stopped: '+error.message); } }
}
function stopCamera() {
  running = false; generation++; setLiveRunning(false);
  video?.elt.srcObject?.getTracks().forEach(track => track.stop()); video?.remove(); video = null;
  document.querySelector('#start').disabled = false; document.querySelector('#stop').disabled = true;
  document.querySelector('#result').textContent = 'No prediction'; document.querySelector('#scores').textContent = '';
  statusText('Camera off. Your log is preserved.'); sendToTouchDesigner(emptyValues());
}
// The face-mesh slide asks this preloaded model to read its rendered image.
window.addEventListener('message', async event => {
  if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'affective-classify') return;
  const {id,image} = event.data;
  if (typeof image !== 'string' || !/^data:image\/(png|jpeg);base64,/.test(image) || image.length > 2500000) return;
  try {
    const img = new Image(); img.src = image; await img.decode();
    const faces = await infer(img);
    const scores = faces?.length ? names.map(label => ({label,score:Number(faces[0].expressions[label]) || 0})) : [];
    event.source.postMessage({type:'affective-expression-result',id,scores},location.origin);
  } catch(error) { event.source.postMessage({type:'affective-expression-result',id,error:error.message},location.origin); }
});
document.querySelector('#start').addEventListener('click',startCamera);
document.querySelector('#stop').addEventListener('click',stopCamera);
window.addEventListener('pagehide',stopCamera);
