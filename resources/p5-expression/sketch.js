// 1. Open a camera. 2. Load FaceAPI. 3. Display expression scores.
let video, faceapi, running = false, generation = 0;
const names = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'];
const statusText = text => document.querySelector('#status').textContent = text;
function setup() { noCanvas(); liveLabels = names; renderLog(); document.querySelector("#start").disabled = false; statusText("Camera off. Start when you are ready."); }
function emptyValues() { return Object.fromEntries([...names, 'confidence', 'hasFace'].map(name => [name, 0])); }
async function startCamera() {
  const token = ++generation;
  document.querySelector('#start').disabled = true;
  statusText('Requesting camera…');
  try {
    if (!window.ml5 || !window.p5) throw new Error('Libraries unavailable. Check your internet connection and reload.');
    const stream = await navigator.mediaDevices.getUserMedia({video: {width:480, height:360}, audio:false});
    if (token !== generation) { stream.getTracks().forEach(t => t.stop()); return; }
    video = createVideo([]); video.elt.srcObject = stream; video.elt.muted = true; video.elt.playsInline = true;
    video.size(480,360); video.parent('camera'); await video.elt.play();
    running = true; setLiveRunning(true); document.querySelector('#stop').disabled = false;
    statusText('Loading facial-expression model…');
    faceapi = ml5.faceApi(video, {withLandmarks:false, withDescriptors:false, withExpressions:true, minConfidence:0.5}, () => {
      if (running && token === generation) { statusText('Model ready. Try an expression.'); detect(token); }
    });
    faceapi.ready?.catch(error => {
      if (token === generation) { stopCamera(); statusText('Model download failed. Check your internet connection and try again.'); }
    });
  } catch (error) { stopCamera(); statusText('Could not start: ' + error.message + ' Use localhost or HTTPS and allow camera access.'); }
}
function detect(token) {
  if (!running || token !== generation) return;
  faceapi.detect((error, faces) => {
    if (!running || token !== generation) return;
    if (error) { stopCamera(); statusText('Detection failed. Check the network and restart the camera.'); return; }
    const values = emptyValues();
    let label = '';
    if (faces?.length) {
      names.forEach(name => values[name] = faces[0].expressions[name] || 0);
      label = names.reduce((a,b) => values[a] > values[b] ? a : b);
      values.confidence = values[label]; values.hasFace = 1;
      document.querySelector('#result').textContent = `${label} / ${(values[label]*100).toFixed(0)}% model score`;
      document.querySelector('#scores').textContent = names.map(name => `${name.padEnd(10)} ${(values[name]*100).toFixed(1)}%`).join('\n');
    } else {
      document.querySelector('#result').textContent = 'No face detected';
      document.querySelector('#scores').textContent = '';
    }
    logPredictions(values.hasFace ? names.map(name => ({label:name, score:values[name]})) : []);
    sendToTouchDesigner(values, label);
    setTimeout(() => detect(token), 100);
  });
}
function stopCamera() {
  running = false; generation++; setLiveRunning(false);
  video?.elt.srcObject?.getTracks().forEach(track => track.stop()); video?.remove(); video = null;
  document.querySelector('#start').disabled = false; document.querySelector('#stop').disabled = true;
  document.querySelector('#result').textContent = 'No prediction'; document.querySelector('#scores').textContent = '';
  statusText('Camera off. Your log is preserved.'); sendToTouchDesigner(emptyValues());
}
document.querySelector('#start').addEventListener('click', startCamera);
document.querySelector('#stop').addEventListener('click', stopCamera);
window.addEventListener('pagehide', stopCamera);

