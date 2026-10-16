// ML5 Model Loader Sketch / custom Teachable Machine image models.
// Use with index.html and style.css from the model loader guide.
// Paste your exported model URL on the next line.
const MODEL_URL = 'PASTE_YOUR_TEACHABLE_MACHINE_MODEL_URL_HERE/';
let model, video, ready = false, starting = false, generation = 0, message;
const modelInput = document.createElement('canvas');
modelInput.width = modelInput.height = 224;
function setup() {
  createCanvas(640,480).parent('loader-camera');
  message = select('#loader-message');
  select('#loader-start').mousePressed(startModel);
  select('#loader-stop').mousePressed(stopModel);
}

async function startModel() {
  if (ready || starting) return;
  const token = ++generation;starting = true;
  try {
    message.html('Loading model libraries…');
    if (MODEL_URL.includes('PASTE_')) throw new Error('Replace MODEL_URL near the top of sketch.js.');
    const base = MODEL_URL.replace(/\/+$/,'')+'/';
    if (!model) model = await window.tmImage.load(base+'model.json',base+'metadata.json');
    if (token !== generation) return;
    const stream = await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false});
    if (token !== generation) {stream.getTracks().forEach(t => t.stop());return;}
    video = createVideo([]);video.elt.srcObject = stream;video.elt.muted = true;video.elt.playsInline = true;video.hide();
    await video.elt.play();
    if (token !== generation) return;
    // Keep the entire webcam view, including widescreen cameras.
    resizeCanvas(640,Math.round(640*video.elt.videoHeight/video.elt.videoWidth));
    ready = true;predict(token);
  } catch(error) {stopModel();message.elt.textContent = error.message;}
  finally {starting = false;}
}
function stopModel() {
  generation++;ready = false;
  video?.elt.srcObject?.getTracks().forEach(t => t.stop());video?.remove();video = null;
  if (message) message.elt.textContent = 'Camera off';
}
function draw() {
  background(238);
  if (ready && video?.elt.readyState >= 2) {
    push();translate(width,0);scale(-1,1);image(video,0,0,width,height);pop();
  }
}
async function predict(token) {
  if (!ready || token !== generation) return;
  try {
    // Only the model input uses TM's square center crop; the displayed webcam stays complete.
    const el = video.elt,side = Math.min(el.videoWidth,el.videoHeight),ctx = modelInput.getContext('2d');
    ctx.setTransform(-1,0,0,1,224,0);
    ctx.drawImage(el,(el.videoWidth-side)/2,(el.videoHeight-side)/2,side,side,0,0,224,224);
    const predictions = await model.predict(modelInput);
    if (!ready || token !== generation) return;
    const best = predictions.reduce((a,b) => a.probability > b.probability ? a : b);
    message.elt.textContent = best.className+' / '+Math.round(best.probability*100)+'%';
    // Use best.className or best.probability to control your own p5.js drawing.
    setTimeout(() => predict(token),100);
  } catch(error) {stopModel();message.elt.textContent = error.message;}
}
window.addEventListener('pagehide',stopModel);
