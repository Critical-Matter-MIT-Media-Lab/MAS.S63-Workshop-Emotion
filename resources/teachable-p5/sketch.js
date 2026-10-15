// One model; the presentation uses its existing persistent camera.
const engine = parent !== window && new URLSearchParams(location.search).has('engine');
document.body.classList.toggle('engine',engine);
const $ = s => document.querySelector(s);
let model, video, canvas, running = false, active = false, revision = 0, requestID = 0;
const requests = new Map();
function setup() { if (engine) noCanvas(); else { canvas = createCanvas(360,360); canvas.parent('camera'); noLoop(); background(238); } $('#load-model').disabled = false; try { $('#model-url').value = sessionStorage.getItem('affective-tm-model-url') || ''; } catch {} }
function draw() { background(238); if (video?.elt.readyState >= 2) { const side = Math.min(video.elt.videoWidth,video.elt.videoHeight); push();translate(width,0);scale(-1,1);image(video,0,0,width,height,(video.elt.videoWidth-side)/2,(video.elt.videoHeight-side)/2,side,side);pop(); } }
function normalizeModelURL(value) { const url = new URL(value.trim()); const match = url.pathname.match(/^\/models\/([A-Za-z0-9_-]+)(?:\/(?:model\.json)?)?$/); if (url.protocol !== 'https:' || url.hostname !== 'teachablemachine.withgoogle.com' || !match) throw new Error('Use the shareable image model URL from Teachable Machine.'); return 'https://teachablemachine.withgoogle.com/models/'+match[1]+'/'; }
async function loadModel() {
  let base; try { base = normalizeModelURL($('#model-url').value); } catch(e) { $('#status').textContent = e.message; return; }
  const token = ++revision; active = false; $('#load-model').disabled = true; $('#status').textContent = 'Loading your model…';
  try {
    if (!window.tmImage) throw new Error('The image library did not load. Check your connection and reload.');
    const loaded = await tmImage.load(base+'model.json',base+'metadata.json');
    if (token !== revision) { loaded.model.dispose(); return; }
    model?.model.dispose(); model = loaded; active = true;
    $('#model-url').value = base; try { sessionStorage.setItem('affective-tm-model-url',base); } catch {}
    $('#start').disabled = false;
    $('#status').textContent = 'Model ready / '+model.getClassLabels().join(', ')+(engine ? '. Using the camera below.' : '. Start the camera.');
    if (engine) { parent.postMessage({type:'affective-tm-ready',labels:model.getClassLabels()},location.origin); predict(token); }
    else if (running) predict(token);
  } catch(e) { $('#status').textContent = 'Could not load model: '+e.message; }
  finally { $('#load-model').disabled = false; }
}
async function startCamera() {
  if (!model || running) return; $('#start').disabled = true;
  try { const stream = await navigator.mediaDevices.getUserMedia({video:true,audio:false}); video = createVideo([]); video.elt.srcObject = stream; video.elt.muted = true; video.hide(); await video.elt.play(); running = true; active = true; $('#stop').disabled = false; loop(); predict(++revision); }
  catch(e) { stopCamera(); $('#status').textContent = e.message; }
}
function stopCamera() { running = false; active = false; revision++; video?.elt.srcObject?.getTracks().forEach(t => t.stop());video?.remove();video = null; if (!engine) noLoop(); $('#start').disabled = !model; $('#stop').disabled = true; }
function sharedImage() { const id = 'tm-'+(++requestID); return new Promise(resolve => { const timer = setTimeout(() => { requests.delete(id);resolve(null); },5000);requests.set(id,{resolve,timer});parent.postMessage({type:'affective-camera-frame-request',id},location.origin); }); }
async function predict(token) {
  if (!active || token !== revision) return;
  try {
    let input;
    if (engine) { const data = await sharedImage(); if (data) { input = new Image();input.src = data;await input.decode(); } }
    else if (running) { draw();input = canvas.elt; }
    if (input && token === revision && active) {
      const results = await model.predict(input); if (token !== revision || !active) return;
      const scores = results.map(p => ({label:p.className,score:p.probability}));
      if (engine) parent.postMessage({type:'affective-custom-prediction',scores},location.origin);
      else { const top = scores.reduce((a,b) => a.score>b.score?a:b); $('#result').textContent = top.label+' / '+Math.round(top.score*100)+'%'; $('#scores').textContent = scores.map(s => s.label+': '+Math.round(s.score*100)+'%').join('\n'); }
    }
    if (active && token === revision) setTimeout(() => predict(token),150);
  } catch(e) { active = false; $('#status').textContent = 'Prediction paused: '+e.message; }
}
window.addEventListener('message',event => { if (event.origin !== location.origin || event.source !== parent) return; const d = event.data;if (d?.type === 'affective-camera-frame') { const r = requests.get(d.id);if (r) {clearTimeout(r.timer);requests.delete(d.id);r.resolve(d.image);} } if (d?.type === 'affective-pause-model') {active = false;revision++;$('#status').textContent = 'Pretrained expression model selected. Load your model to switch back.';} });
$('#load-model').onclick = loadModel;$('#start').onclick = startCamera;$('#stop').onclick = stopCamera;window.addEventListener('pagehide',stopCamera);
