// p5 camera and the original expression-enabled ml5 model. Weights load on entry.
let video, faceapi, running = false, generation = 0, modelPromise;
let inferenceQueue = Promise.resolve();
let names = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'];
const statusText = text => document.querySelector('#status').textContent = text;
let activeModel = 'pretrained', customScores = [], targetBox = null, displayBox = null;
const overlay = document.querySelector('#face-overlay');
const overlayContext = overlay.getContext('2d');
function setup() {
  noCanvas();
  document.querySelector('#start').disabled = false;
  statusText('Camera off. Start when you are ready.');
  paintOverlay(); ensureModel().catch(() => {});
}
function ensureModel() {
  if (faceapi) return Promise.resolve(faceapi);
  if (modelPromise) return modelPromise;
  document.querySelector('#model-state').textContent = 'Preloading expression model…';
  modelPromise = Promise.resolve().then(() => {
    if (!window.ml5) throw new Error('ml5.js could not load.');
    return ml5.faceApi({withLandmarks:false,withDescriptors:false,withExpressions:true,minConfidence:0.5,Mobilenetv1Model:new URL('models/ssd_mobilenetv1_model-weights_manifest.json',location.href).href,FaceLandmarkModel:new URL('models/face_landmark_68_model-weights_manifest.json',location.href).href,FaceRecognitionModel:new URL('models/face_recognition_model-weights_manifest.json',location.href).href,FaceExpressionModel:new URL('models/face_expression_model-weights_manifest.json',location.href).href});
  }).then(model => {
    faceapi = model;
    if (Array.isArray(model.model.FACE_EXPRESSION_LABELS)) names = [...model.model.FACE_EXPRESSION_LABELS];
    document.querySelector('#model-state').textContent = 'Expression model ready.';
    return model;
  }).catch(error => {
    modelPromise = null;
    document.querySelector('#model-state').textContent = 'Model unavailable. Start will retry the download.';
    throw error;
  });
  return modelPromise;
}
function infer(input, knownMesh = false) {
  const task = inferenceQueue.catch(() => {}).then(async () => {
    await ensureModel();
    if(knownMesh){
      // The mesh renderer supplies an already cropped face. Keep the existing
      // expression weights, without imposing the SSD photo detector on synthetic geometry.
      const expressions=await faceapi.model.nets.faceExpressionNet.predictExpressions(input);
      return [{expressions}];
    }
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
    video.size(480,360); video.elt.style.width = '100%'; video.elt.style.height = '100%'; video.parent('camera'); await video.elt.play();
    if (token !== generation) { stream.getTracks().forEach(t => t.stop()); return; }
    faceapi.video = video.elt;
    running = true; document.querySelector('#dock-stop').hidden = true; setLiveRunning(true); statusText('Model ready. Try an expression.');
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
      trackFace(faces[0]);
      if (activeModel === 'pretrained') showScores(names.map(name => ({label:name,score:values[name]})));
    } else {
      targetBox = null;
      if (activeModel === 'pretrained') { document.querySelector('#result').textContent = 'No face detected'; document.querySelector('#scores').replaceChildren(); }
    }
    sendToTouchDesigner(values,label);
    setTimeout(() => detect(token),100);
  } catch(error) { if (token === generation) { stopCamera(); statusText('Detection stopped: '+error.message); } }
}
function stopCamera() {
  running = false; generation++; document.querySelector('#dock-stop').hidden = true; setLiveRunning(false);
  video?.elt.srcObject?.getTracks().forEach(track => track.stop()); video?.remove(); video = null;
  if (faceapi) faceapi.video = undefined;
  document.querySelector('#start').disabled = false; document.querySelector('#stop').disabled = true;
  document.querySelector('#result').textContent = 'No prediction'; document.querySelector('#scores').textContent = '';
  targetBox = displayBox = null;
  statusText('Camera off.'); sendToTouchDesigner(emptyValues());
}
// The face-mesh slide asks this preloaded model to read its rendered image.
window.addEventListener('message', async event => {
  if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'affective-classify') return;
  const {id,image} = event.data;
  if (typeof image !== 'string' || !/^data:image\/(png|jpeg);base64,/.test(image) || image.length > 2500000) return;
  try {
    const img = new Image(); img.src = image; await img.decode();
    const faces = await infer(img,event.data.knownMesh === true);
    const scores = faces?.length ? names.map(label => ({label,score:Number(faces[0].expressions[label]) || 0})) : [];
    event.source.postMessage({type:'affective-expression-result',id,scores},location.origin);
  } catch(error) { event.source.postMessage({type:'affective-expression-result',id,error:error.message},location.origin); }
});
document.querySelector('#start').addEventListener('click',startCamera);
document.querySelector('#stop').addEventListener('click',stopCamera);
window.addEventListener('pagehide',stopCamera);

function showScores(scores) {
  const top = scores.reduce((a,b) => b.score > (a?.score ?? -1) ? b : a,null);
  document.querySelector('#result').textContent = top ? top.label+' / '+Math.round(top.score*100)+'%' : 'Waiting for predictions';
  const table = document.querySelector('#scores'); table.replaceChildren();
  scores.forEach(score => { const row = document.createElement('div'), name = document.createElement('span'), value = document.createElement('span'); name.textContent = score.label; value.textContent = Math.round(score.score*100)+'%'; row.append(name,value); table.append(row); });
}
function trackFace(face) {
  const box = face.detection?.box || face.detection?._box || face.alignedRect?.box || face.alignedRect?._box || face.box;
  if (!box) { targetBox = null; return; }
  const x = box.x ?? box._x, y = box.y ?? box._y, w = box.width ?? box._width, h = box.height ?? box._height;
  if (![x,y,w,h].every(Number.isFinite)) { targetBox = null; return; }
  const size = Math.min(Math.max(w,h),360);
  targetBox = {x:Math.max(0,Math.min(480-size,x+w/2-size/2)),y:Math.max(0,Math.min(360-size,y+h/2-size/2)),size};
}
function paintOverlay() {
  const ctx = overlayContext; ctx.clearRect(0,0,480,360);
  if (running) {
    if (targetBox) {
      if (!displayBox) displayBox = {...targetBox};
      for (const key of ['x','y','size']) displayBox[key] += (targetBox[key]-displayBox[key])*.18;
      const {x,y,size} = displayBox;
      ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.strokeRect(x,y,size,size);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(x,y,size,size);
    } else displayBox = null;
    const text = document.querySelector('#result').textContent;
    const x = displayBox?.x ?? 10, y = Math.max(25,(displayBox?.y ?? 35)-5);
    ctx.font = 'bold 19px Arial'; const width = Math.min(460,ctx.measureText(text).width+14);
    const left = Math.min(x,480-width); ctx.fillStyle = '#111'; ctx.fillRect(left,y-25,width,27);
    ctx.fillStyle = '#fff'; ctx.fillText(text,left+7,y-6);
  }
  requestAnimationFrame(paintOverlay);
}
function frameImage(square) {
  if (!running || !video || video.elt.readyState < 2) return null;
  const canvas = document.createElement('canvas'); canvas.width = square ? 224 : 480; canvas.height = square ? 224 : 360;
  const ctx = canvas.getContext('2d'), el = video.elt;
  if (square) { const side = Math.min(el.videoWidth,el.videoHeight); ctx.translate(224,0);ctx.scale(-1,1);ctx.drawImage(el,(el.videoWidth-side)/2,(el.videoHeight-side)/2,side,side,0,0,224,224); }
  else ctx.drawImage(el,0,0,480,360);
  return canvas.toDataURL('image/jpeg',.85);
}
window.addEventListener('message',async event => {
  if (event.origin !== location.origin || event.source !== parent) return;
  const data = event.data;
  if (data?.type === 'affective-camera-layout') {document.body.classList.remove('docked','transitioning');document.body.classList.toggle('camera-only',data.docked || data.transitioning);document.querySelector('#dock-stop').hidden=true;}

  if (data?.type === 'affective-labels-request') {
    await ensureModel(); parent.postMessage({type:'affective-model-labels',labels:names},location.origin);
  }
  if (data?.type === 'affective-camera-frame-request') parent.postMessage({type:'affective-camera-frame',id:data.id,image:frameImage(data.square !== false)},location.origin);
  if (data?.type === 'affective-use-model') {
    activeModel = data.mode; customScores = [];
    document.querySelector('#model-title').textContent = data.mode === 'teachable' ? 'Your Teachable Machine model' : 'Expression model';
    document.querySelector('#pretrained').hidden = data.mode !== 'teachable';
    showScores([]);
  }
  if (data?.type === 'affective-custom-prediction' && activeModel === 'teachable') { customScores = data.scores; showScores(customScores); }
});
document.querySelector('#dock-stop').addEventListener('click',stopCamera);
document.querySelector('#pretrained').addEventListener('click',() => { activeModel = 'pretrained'; document.querySelector('#pretrained').hidden = true; document.querySelector('#model-title').textContent = 'Expression model'; parent.postMessage({type:'affective-pretrained-selected'},location.origin); });

function publishCameraGeometry(){
  const r=document.querySelector('.camera-window').getBoundingClientRect();
  if(parent!==window && r.width>0 && r.height>0)parent.postMessage({type:'affective-camera-geometry',rect:{x:r.x,y:r.y,width:r.width,height:r.height}},location.origin);
}
const cameraGeometryObserver=new ResizeObserver(publishCameraGeometry);
['.camera-window','.controls','#status'].forEach(selector=>cameraGeometryObserver.observe(document.querySelector(selector)));
