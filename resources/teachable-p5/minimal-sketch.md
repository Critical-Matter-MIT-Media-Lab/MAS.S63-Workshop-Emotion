# ML5 Model Loader Sketch

## Load your own Teachable Machine model

This custom model loader uses TensorFlow.js and the Teachable Machine image API. The separate [p5.js + ml5.js expression example](https://editor.p5js.org/jxke/sketches/AM8KwbKvK) uses a fixed pretrained FaceAPI expression model and has no custom model URL field.

1. Create a new sketch at https://editor.p5js.org/.
2. Replace all of sketch.js with the complete code below.
3. Near the top, replace the quoted value of **const MODEL_URL** with your image model URL from Export Model → Tensorflow.js → Upload my model.
4. Press Play, then Start camera. The model libraries load automatically; no index.html edits are needed.

The canvas begins at **640 × 480** and adjusts to your camera's actual aspect ratio, preserving the full webcam view. A separate off-screen square crop is used only for inference, matching Teachable Machine image training. The model label sits below the canvas. Stop camera releases the webcam.

The preview, controls and result label sit inside a compact light card with explicit text/background colors, so the class and percentage remain readable in dark editor themes. The card scales to the available width.

The webcam preview also caps its height to keep the result and controls visible in a smaller editor preview.

```javascript
// ML5 Model Loader Sketch / custom Teachable Machine image models.
// In the p5 editor, replace all of sketch.js with this file.
// Paste your exported URL on the next line. No extra script tags are needed.
const MODEL_URL = 'PASTE_YOUR_TEACHABLE_MACHINE_MODEL_URL_HERE/';
let model, video, ready = false, starting = false, generation = 0, message;
const modelInput = document.createElement('canvas');
modelInput.width = modelInput.height = 224;
function setup() {
  const style = document.createElement('style');
  style.textContent = `#affective-loader{font:14px/1.4 Arial,sans-serif;color:#171717;background:#fff;border:1px solid #d6d6d6;border-radius:10px;overflow:hidden;width:min(640px,calc(100% - 32px));margin:16px;box-sizing:border-box}#affective-loader canvas{display:block;width:100%!important;height:auto!important;max-height:calc(100dvh - 210px);object-fit:contain;background:#eee}#affective-loader .loader-toolbar{padding:12px 14px;display:flex;gap:8px;align-items:center;background:#f6f6f6}#affective-loader button{font:12px Arial,sans-serif;color:#171717;background:#fff;border:1px solid #bbb;border-radius:5px;padding:7px 10px;cursor:pointer}#affective-loader .loader-readout{color:#171717!important;background:#fff!important;font-size:16px;font-weight:600;padding:14px 16px;margin:0;min-height:48px;overflow-wrap:anywhere;box-sizing:border-box}#affective-loader .loader-heading{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#555;padding:12px 16px;margin:0;border-bottom:1px solid #ddd}`;
  document.head.append(style);
  const shell = createDiv().id('affective-loader');
  createP('Your image model / live webcam').class('loader-heading').parent(shell);
  createCanvas(640,480).parent(shell);
  message = createP('Paste MODEL_URL above, then start the camera.').class('loader-readout').parent(shell);
  message.elt.setAttribute('role','status');
  const toolbar = createDiv().class('loader-toolbar').parent(shell);
  createButton('Start camera').parent(toolbar).mousePressed(startModel);
  createButton('Stop camera').parent(toolbar).mousePressed(stopModel);
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
```
