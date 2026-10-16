# ML5 Model Loader Sketch

Copy the three files into the matching tabs in a p5.js 1.x project. Set MODEL_URL near the top of sketch.js. The HTML loads p5.js, TensorFlow.js and the Teachable Machine image library; CSS handles the interface.

## index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your image model / p5.js</title>
  <link rel="stylesheet" href="style.css">
  <script defer src="https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.3/dist/teachablemachine-image.min.js"></script>
  <script defer src="sketch.js"></script>
</head>
<body>
<main id="affective-loader">
  <p class="loader-heading">Your image model / live webcam</p>
  <div id="loader-camera"></div>
  <p id="loader-message" class="loader-readout" role="status">Paste MODEL_URL in sketch.js, then start the camera.</p>
  <div class="loader-toolbar"><button id="loader-start">Start camera</button><button id="loader-stop">Stop camera</button></div>
</main>
</body>
</html>

```

## style.css

```css
html,body{margin:0;padding:0;background:#f4f4f0;color:#171717;color-scheme:light}
#affective-loader{font:14px/1.4 Arial,sans-serif;color:#171717;background:#fff;border:1px solid #d6d6d6;border-radius:10px;overflow:hidden;width:min(640px,calc(100% - 32px));margin:16px;box-sizing:border-box}#affective-loader canvas{display:block;width:100%!important;height:auto!important;max-height:calc(100dvh - 210px);object-fit:contain;background:#eee}#affective-loader .loader-toolbar{padding:12px 14px;display:flex;gap:8px;align-items:center;background:#f6f6f6}#affective-loader button{font:12px Arial,sans-serif;color:#171717;background:#fff;border:1px solid #bbb;border-radius:5px;padding:7px 10px;cursor:pointer}#affective-loader .loader-readout{color:#171717!important;background:#fff!important;font-size:16px;font-weight:600;padding:14px 16px;margin:0;min-height:48px;overflow-wrap:anywhere;box-sizing:border-box}#affective-loader .loader-heading{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#555;padding:12px 16px;margin:0;border-bottom:1px solid #ddd}

```

## sketch.js

```js
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

```
