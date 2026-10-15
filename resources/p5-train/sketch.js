// Minimal transfer learning: camera -> MobileNet features -> your two labels.
let video, features, classifier;
let counts = [0,0], running = false, testing = false, training = false, ready = false, busy = false;
const $ = selector => document.querySelector(selector);
const statusText = text => $('#status').textContent = text;
const labels = () => [$('#label-a').value.trim(), $('#label-b').value.trim()];
function setup() { noCanvas(); }
function updateButtons() {
  $('#start').disabled = running;
  $('#stop').disabled = !running;
  $('#add-a').disabled = $('#add-b').disabled = !ready || !running || training || testing || busy;
  $('#train').disabled = !ready || !running || training || testing || busy || counts.some(n => n < 10);
  $('#test').disabled = !classifier?.workshopTrained || !running || training;
  $('#test').textContent = testing ? 'Pause testing' : 'Start testing';
}
async function startCamera() {
  $('#start').disabled = true;
  statusText('Requesting camera…');
  try {
    if (!window.ml5 || !window.p5) throw new Error('Libraries unavailable. Check your internet connection and reload.');
    const stream = await navigator.mediaDevices.getUserMedia({video:{width:480,height:360},audio:false});
    video = createVideo([]); video.elt.srcObject = stream; video.elt.muted = true; video.elt.playsInline = true;
    video.size(480,360); video.parent('camera'); await video.elt.play(); running = true;
    if (!features) {
      statusText('Loading MobileNet…');
      features = ml5.featureExtractor('MobileNet', () => { ready = true; statusText('Ready. Add at least 10 examples to each label.'); updateButtons(); });
      classifier = features.classification(video, {numLabels:2});
      features.ready?.catch(() => { stopCamera(); statusText('Model download failed. Check your internet connection, then reset and retry.'); });
    } else {
      // The classifier retains its reference to this p5 video element after stopping.
      statusText('Camera ready. Continue collecting or testing.');
    }
    updateButtons();
  } catch (error) { stopCamera(); statusText('Could not start: ' + error.message + ' Use localhost or HTTPS and allow camera access.'); }
}
async function addExample(index) {
  const [a,b] = labels();
  if (!a || !b || a.toLowerCase() === b.toLowerCase()) { statusText('Choose two different, nonempty labels.'); return; }
  busy = true; updateButtons();
  try {
    await classifier.addImage(labels()[index]);
    counts[index]++; $('#count-a').textContent = counts[0]; $('#count-b').textContent = counts[1];
    $('#label-a').disabled = $('#label-b').disabled = true;
    classifier.workshopTrained = false;
    statusText(`Examples: ${a} ${counts[0]}, ${b} ${counts[1]}. Add varied examples, then train.`);
  } catch (error) { statusText('Could not add example: ' + error.message); }
  busy = false; updateButtons();
}
function trainModel() {
  training = true; updateButtons(); statusText('Training your classifier…');
  try {
    classifier.train(loss => {
      if (loss !== null && loss !== undefined) statusText('Training / loss ' + Number(loss).toFixed(4));
      else { training = false; classifier.workshopTrained = true; statusText('Training complete. Start testing with new examples.'); updateButtons(); }
    });
  } catch (error) { training = false; statusText('Training failed: ' + error.message); updateButtons(); }
}
function predict() {
  if (!testing || !running) return;
  classifier.classify((error, results) => {
    if (!testing || !running) return;
    if (error || !results?.length) { testing = false; statusText('Prediction failed. Try training again.'); updateButtons(); return; }
    const top = results[0];
    $('#result').textContent = `${top.label} / ${(top.confidence*100).toFixed(0)}% model score`;
    const score = label => results.find(result => result.label === label)?.confidence || 0;
    sendToTouchDesigner({classA:score(labels()[0]), classB:score(labels()[1]), confidence:top.confidence, hasFace:0, active:1}, top.label);
    setTimeout(predict, 150);
  });
}
function clearPrediction() { $('#result').textContent = 'No prediction'; sendToTouchDesigner({classA:0,classB:0,confidence:0,active:0}); }
function stopCamera() {
  running = false; testing = false;
  video?.elt.srcObject?.getTracks().forEach(track => track.stop());
  // Keep the video element: MobileNet's classifier holds this reference.
  if (video) video.elt.srcObject = null;
  statusText('Camera off. Restart by resetting the experiment.');
  clearPrediction(); updateButtons();
  $('#start').disabled = !!features;
}
$('#start').addEventListener('click', startCamera);
$('#stop').addEventListener('click', stopCamera);
$('#reset').addEventListener('click', () => { stopCamera(); location.reload(); });
$('#add-a').addEventListener('click', () => addExample(0));
$('#add-b').addEventListener('click', () => addExample(1));
$('#train').addEventListener('click', trainModel);
$('#test').addEventListener('click', () => { testing = !testing; updateButtons(); if (testing) predict(); else clearPrediction(); });
window.addEventListener('pagehide', stopCamera);
