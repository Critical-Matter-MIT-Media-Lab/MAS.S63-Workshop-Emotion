// ML5 Model Loader Sketch / custom Teachable Machine image models.
// In the p5 editor, replace all of sketch.js with this file.
// Paste your exported URL on the next line. No extra script tags are needed.
const MODEL_URL = 'PASTE_YOUR_TEACHABLE_MACHINE_MODEL_URL_HERE/';
let model, video, ready = false, starting = false, generation = 0, message;
const modelInput = document.createElement('canvas');
modelInput.width = modelInput.height = 224;
function setup() {
  createCanvas(640,480); // A regular 4:3 webcam view, with no square display crop.
  createButton('Start camera').mousePressed(startModel);
  createButton('Stop camera').mousePressed(stopModel);
  message = createP('Paste MODEL_URL above, then start the camera.');
}
function loadLibrary(url) {
  return new Promise((resolve,reject) => {
    const script = document.createElement('script');script.src = url;
    script.onload = resolve;script.onerror = () => reject(new Error('Could not load '+url));
    document.head.append(script);
  });
}
async function startModel() {
  if (ready || starting) return;
  const token = ++generation;starting = true;
  try {
    message.html('Loading model libraries…');
    if (!window.tf) await loadLibrary('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js');
    if (!window.tmImage) await loadLibrary('https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.3/dist/teachablemachine-image.min.js');
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
