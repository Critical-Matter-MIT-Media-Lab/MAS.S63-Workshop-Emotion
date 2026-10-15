# Minimal Teachable Machine + p5.js sketch

1. Create a sketch at https://editor.p5js.org/.
2. Replace all of sketch.js with the complete code below.
3. Replace MODEL_URL with the image model URL from Export Model → Tensorflow.js → Upload my model.
4. Press Play, then Start camera, and allow the camera.

Keep the editor's existing p5.js script. This sketch loads TensorFlow.js and the Teachable Machine image library automatically, in order. No additional script tags are needed. The earlier tmImage error occurred because the image library was missing.

Predictions use the webcam image only, with the text label outside the image. Run on HTTPS or localhost.

```javascript
// Paste this complete sketch into the p5 editor and replace MODEL_URL.
// Model libraries load automatically. Keep the editor's existing p5 script.
const MODEL_URL = 'PASTE_YOUR_TEACHABLE_MACHINE_MODEL_URL_HERE/';
let model, webcam, ready = false, starting = false, label = 'Click to start';
function setup() {
  createCanvas(400,450);
  createButton('Start camera').mousePressed(startModel);
  createButton('Stop camera').mousePressed(stopModel);
}
function loadLibrary(url) {
  return new Promise((resolve,reject) => {
    const script = document.createElement('script'); script.src = url;
    script.onload = resolve; script.onerror = () => reject(new Error('Could not load '+url));
    document.head.append(script);
  });
}
async function startModel() {
  if (ready || starting) return;
  starting = true;
  try {
    label = 'Loading model libraries…';
    if (!window.tf) await loadLibrary('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js');
    if (!window.tmImage) await loadLibrary('https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.3/dist/teachablemachine-image.min.js');
    if (MODEL_URL.includes('PASTE_')) throw new Error('Replace MODEL_URL with your exported image model URL.');
    const base = MODEL_URL.replace(/\/+$/,'')+'/';
    if (!model) model = await window.tmImage.load(base+'model.json',base+'metadata.json');
    webcam = new window.tmImage.Webcam(400,400,true);
    await webcam.setup(); await webcam.play(); ready = true;
    predict();
  } catch(error) { label = error.message; webcam?.stop(); }
  finally { starting = false; }
}
function stopModel() { ready = false; webcam?.stop(); label = 'Camera off'; }
function draw() {
  background(255);
  if (ready) { webcam.update(); drawingContext.drawImage(webcam.canvas,0,0,400,400); }
  fill(0); noStroke(); textSize(18); text(label,12,430);
}
async function predict() {
  if (!ready) return;
  try {
    // Predict only the webcam canvas, so the label text is not part of the input.
    webcam.update();
    const predictions = await model.predict(webcam.canvas);
    if (!ready) return;
    const best = predictions.reduce((a,b) => a.probability > b.probability ? a : b);
    label = best.className+' / '+Math.round(best.probability*100)+'%';
    setTimeout(predict,100);
  } catch(error) { label = error.message; ready = false; webcam.stop(); }
}
window.addEventListener('pagehide', () => { ready = false; webcam?.stop(); });
```
