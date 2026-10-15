// Add the p5.js, TensorFlow.js and Teachable Machine image scripts to index.html.
// Paste your model's exported HTTPS URL. See README.md for the exact script tags.
const MODEL_URL = 'PASTE_YOUR_TEACHABLE_MACHINE_MODEL_URL_HERE/';
let model, webcam, ready = false, starting = false, label = 'Click to start';
function setup() {
  createCanvas(400,450);
  createButton('Start camera').mousePressed(startModel);
}
async function startModel() {
  if (ready || starting) return;
  starting = true;
  try {
    const base = MODEL_URL.replace(/\/+$/,'')+'/';
    model = await tmImage.load(base+'model.json',base+'metadata.json');
    webcam = new tmImage.Webcam(400,400,true);
    await webcam.setup(); await webcam.play(); ready = true;
    predict();
  } catch(error) { label = error.message; webcam?.stop(); }
  finally { starting = false; }
}
function draw() {
  background(255);
  if (ready) { webcam.update(); image(webcam.canvas,0,0,400,400); }
  fill(0); noStroke(); textSize(18); text(label,12,430);
}
async function predict() {
  if (!ready) return;
  try {
    // Predict only the webcam canvas, so the label text is not part of the input.
    const predictions = await model.predict(webcam.canvas);
    const best = predictions.reduce((a,b) => a.probability > b.probability ? a : b);
    label = best.className+' / '+Math.round(best.probability*100)+'%';
    setTimeout(predict,100);
  } catch(error) { label = error.message; ready = false; webcam.stop(); }
}
window.addEventListener('pagehide', () => { ready = false; webcam?.stop(); });
