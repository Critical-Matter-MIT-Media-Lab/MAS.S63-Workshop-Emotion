import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs';

const $ = selector => document.querySelector(selector);
const status = text => $('#status').textContent = text;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf5f5f5);
const renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
$('#stage').append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(34,1,0.1,200); camera.position.set(0,0,34);
const controls = new OrbitControls(camera,renderer.domElement); controls.enableDamping = true; controls.minDistance = 18; controls.maxDistance = 65;
const frontCamera = new THREE.PerspectiveCamera(34,1,0.1,200); frontCamera.position.set(0,0,34); frontCamera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xffffff,0x999999,2));
const light = new THREE.DirectionalLight(0xffffff,2); light.position.set(1,2,5); scene.add(light);
const geometry = new THREE.BufferGeometry();
const material = new THREE.MeshBasicMaterial({color:0xe5e5e5,side:THREE.DoubleSide});
const mesh = new THREE.Mesh(geometry,material); scene.add(mesh);
const cavity = new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0x241619,side:THREE.DoubleSide})); mesh.add(cavity);
const teeth = new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xeee8dc,side:THREE.DoubleSide}));mesh.add(teeth);
const wire = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x444444,wireframe:true,transparent:true,opacity:.45,depthWrite:false})); scene.add(wire);
let basePositions, photoTexture, landmarker, landmarkPromise, stream, hasPhoto = false, cameraToken = 0, requestNumber = 0;
const pendingReads = new Map();
const calibratedPresets = new Map();
let localEngine, selectedTarget = 'neutral', shapeExtras = {}, fitting = false;
let selectionVersion=0, selectionWork=Promise.resolve(), shapeVersion=0;
const measuredShapes=new Map();
function resize() { const {width,height} = $('#stage').getBoundingClientRect(); renderer.setSize(width,height); camera.aspect = width/height; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe($('#stage'));
let visible = true;
new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }).observe($('#stage'));
renderer.setAnimationLoop(() => { if (visible) { controls.update(); renderer.render(scene,camera); } });

function setPositions(positions) {
  const box = new THREE.Box3();
  positions.forEach(p => box.expandByPoint(new THREE.Vector3(...p)));
  const center = box.getCenter(new THREE.Vector3()); const scale = 16/(box.max.y-box.min.y);
  basePositions = Float32Array.from(positions.flatMap(p => [(p[0]-center.x)*scale,(p[1]-center.y)*scale,(p[2]-center.z)*scale]));
  geometry.setAttribute('position',new THREE.BufferAttribute(basePositions.slice(),3)); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
}
const topology = await (await fetch('canonical-face.json')).json();
// Remove the triangles spanning the inner lips, leaving a real mouth aperture.
const innerLips = new Set([78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191]);
const openIndices = [];
for (let i=0;i<topology.indices.length;i+=3) { const triangle = topology.indices.slice(i,i+3); if (!triangle.every(v => innerLips.has(v))) openIndices.push(...triangle); }
geometry.setIndex(openIndices); geometry.setAttribute('uv',new THREE.Float32BufferAttribute(topology.uv.flat(),2));
setPositions(topology.positions); wire.visible = false; deform(); mesh.rotation.y = wire.rotation.y = -.18; resize();
status('468 landmarks / 880 triangles / open inner lips. Rotate the mesh, or take a picture to map your face onto it.');

async function ensureLandmarker() {
  if (landmarker) return landmarker;
  if (!landmarkPromise) landmarkPromise = (async () => {
    status('Loading the face landmark model…');
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
    landmarker = await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('face_landmarker.task',import.meta.url).href,delegate:'CPU'},runningMode:'IMAGE',numFaces:1});
    return landmarker;
  })().catch(error => { landmarkPromise = null; throw error; });
  return landmarkPromise;
}
function publishCamera(running) { if (parent !== window) parent.postMessage({type:'affective-live-state',running},location.origin); }
async function startCamera() {
  const token = ++cameraToken; $('#camera-start').disabled = true; $('#camera-stop').disabled = false;
  try {
    const next = await navigator.mediaDevices.getUserMedia({video:{width:640,height:480},audio:false});
    if (token !== cameraToken) { next.getTracks().forEach(track => track.stop()); return; }
    stream = next; $('#video').srcObject = stream; $('#video').hidden = false; await $('#video').play();
    if (token !== cameraToken) return;
    publishCamera(true); $('#capture').disabled = false;
    status('Face the camera, then press Take picture. The image stays in this browser.');
    ensureLandmarker().catch(error => status('Landmark model unavailable: '+error.message));
  } catch(error) { stopCamera(); status('Camera unavailable: '+error.message); }
}
function stopCamera() {
  cameraToken++; stream?.getTracks().forEach(track => track.stop()); stream = null;
  $('#video').srcObject = null; $('#video').hidden = true;
  $('#camera-start').disabled = false; $('#camera-stop').disabled = true; $('#capture').disabled = true; publishCamera(false);
}
async function applyPhoto(source) {
  $('#capture').disabled = true; $('#upload').disabled = true;
  status('Finding face landmarks and mapping the photograph…');
  try {
    const detector = await ensureLandmarker(); const result = detector.detect(source);
    const landmarks = result.faceLandmarks?.[0];
    if (!landmarks?.length) { status('No face found. Use a clear front-facing picture and try again.'); return; }
    const canvas = document.createElement('canvas'); const sw = source.videoWidth || source.naturalWidth || source.width, sh = source.videoHeight || source.naturalHeight || source.height;
    const scale = Math.min(1,1024/Math.max(sw,sh)); canvas.width = Math.round(sw*scale); canvas.height = Math.round(sh*scale);
    canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
    setPositions(landmarks.slice(0,468).map(p => [(p.x-.5)*sw,-(p.y-.5)*sh,-p.z*sw]));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(landmarks.slice(0,468).flatMap(p => [p.x,1-p.y]),2));
    photoTexture?.dispose(); photoTexture = new THREE.CanvasTexture(canvas); photoTexture.colorSpace = THREE.SRGBColorSpace;
    material.map = photoTexture; material.color.set(0xffffff); material.needsUpdate = true;
    hasPhoto = true; $('#texture').checked = true; $('#read').disabled = false; $('#fit').disabled = false;
    resetShape(); stopCamera();
    status('Your photograph is now the UV texture. Change the geometry, then re-read the expression.');
    readExpression();
  } catch(error) { status('Could not map this image: '+error.message); }
  finally { $('#upload').disabled = false; $('#capture').disabled = !stream; }
}
function resetShape() {
  selectionVersion++;calibratedPresets.clear();measuredShapes.clear();
  shapeExtras = {}; selectedTarget = 'neutral';
  $('#presets').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.textContent==='neutral')));
  ['#smile','#jaw','#brow','#eyes','#furrow','#nose'].forEach(id => $(id).value = 0);
  camera.position.set(0,0,34); controls.target.set(0,0,0); controls.update();
  mesh.rotation.set(0,0,0); wire.rotation.set(0,0,0); deform();
}
function point(index) { return [basePositions[index*3],basePositions[index*3+1]]; }
function deform() {
  if (!basePositions) return;
  const smile = Number($('#smile').value), jaw = Number($('#jaw').value), brow = Number($('#brow').value), eyes = Number($('#eyes').value), furrow = Number($('#furrow').value), nose = Number($('#nose').value);
  const {innerBrow=0,cheek=0,mouthWide=0,lipPress=0,chinRaise=0} = shapeExtras;
  const left = point(61), right = point(291), mouth = point(14);
  const browL = point(105), browR = point(334), innerL=point(55), innerR=point(285), cheekL=point(50), cheekR=point(280);
  const gaussian = (x,y,p,s) => Math.exp(-((x-p[0])**2+(y-p[1])**2)/(2*s*s));
  const eyeTop = new Set([159,158,157,160,161,246,386,385,384,387,388,466]);
  const eyeBottom = new Set([145,144,153,154,155,163,374,373,380,381,382,390]);
  const upperLip = new Set([13,82,81,80,191,312,311,310,415,0,37,39,40,185,267,269,270,409]);
  const attr = geometry.attributes.position;
  for (let i=0;i<attr.count;i++) {
    let x = basePositions[i*3], y = basePositions[i*3+1], z = basePositions[i*3+2];
    const corners = gaussian(x,y,left,smile < 0 ? .8 : 1.05)+gaussian(x,y,right,smile < 0 ? .8 : 1.05);
    const outerBrows = gaussian(x,y,browL,.9)+gaussian(x,y,browR,.9);
    const innerBrows = gaussian(x,y,innerL,.65)+gaussian(x,y,innerR,.65);
    const jawWeight = THREE.MathUtils.clamp((mouth[1]-y+.4)/4,0,1)*Math.exp(-(((x-mouth[0])/4.5)**2));
    y += smile*1.25*corners + brow*.8*outerBrows + innerBrow*.95*innerBrows - furrow*.65*innerBrows - jaw*1.7*jawWeight;
    x += (smile*.25 + mouthWide*.55)*Math.sign(x-mouth[0])*corners;
    x -= furrow*.25*Math.sign(x)*innerBrows;
    y += cheek*.45*(gaussian(x,y,cheekL,1)+gaussian(x,y,cheekR,1));
    if (eyeTop.has(i)) y += eyes*.45;
    if (eyeBottom.has(i)) y -= eyes*.3;
    if (upperLip.has(i)) y += nose*(.25+.65*gaussian(x,y,point(0),1.1));
    const noseRoot = gaussian(x,y,point(6),.75);
    y += nose*.3*noseRoot + chinRaise*.45*gaussian(x,y,point(17),1);
    x -= nose*.2*Math.sign(x)*gaussian(x,y,point(4),1.2);
    z += nose*.3*noseRoot;
    z += nose*.2*gaussian(x,y,point(4),1.1);
    if (innerLips.has(i)) {
      const upper = upperLip.has(i);
      y += upper ? jaw*.35 : -jaw*.6;
      const restCenter = (basePositions[13*3+1]+basePositions[14*3+1])/2;
      y += lipPress*(restCenter-basePositions[i*3+1])*.7;
    }
    z -= jaw*.2*jawWeight; attr.setXYZ(i,x,y,z);
  }
  // A recessed surface follows the actual aperture boundary; it never bulges through the lips.
  const lipLoop = [...innerLips]; const vertices = [], center = new THREE.Vector3();
  lipLoop.forEach(i => center.add(new THREE.Vector3().fromBufferAttribute(attr,i)));center.multiplyScalar(1/lipLoop.length);center.z -= .8;
  vertices.push(center.x,center.y,center.z);
  lipLoop.forEach(i => { const p = new THREE.Vector3().fromBufferAttribute(attr,i);vertices.push(p.x,p.y,p.z-.3); });
  const indices = [];for(let i=0;i<lipLoop.length;i++) indices.push(0,i+1,(i+1)%lipLoop.length+1);
  cavity.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));cavity.geometry.setIndex(indices);cavity.geometry.computeBoundingSphere();
  const uv = geometry.attributes.uv, centerUV = new THREE.Vector2();lipLoop.forEach(i=>centerUV.add(new THREE.Vector2().fromBufferAttribute(uv,i)));centerUV.multiplyScalar(1/lipLoop.length);
  cavity.geometry.setAttribute('uv',new THREE.Float32BufferAttribute([centerUV.x,centerUV.y,...lipLoop.flatMap(i=>[uv.getX(i),uv.getY(i)])],2));
  const interiorMap = hasPhoto && jaw < .08 && $('#texture').checked ? photoTexture : null;
  if(cavity.material.map!==interiorMap){cavity.material.map=interiorMap;cavity.material.needsUpdate=true;}
  cavity.material.color.set(interiorMap ? 0xffffff : 0x241619);
  const lipTop = new THREE.Vector3().fromBufferAttribute(attr,13), lipBottom = new THREE.Vector3().fromBufferAttribute(attr,14);
  const lipLeft = new THREE.Vector3().fromBufferAttribute(attr,78), lipRight = new THREE.Vector3().fromBufferAttribute(attr,308);
  const gap = Math.max(0,lipTop.y-lipBottom.y);
  teeth.visible = smile > .25 && gap > .18;
  if (teeth.visible) {
    const x0=lipLeft.x*.83+lipRight.x*.17,x1=lipRight.x*.83+lipLeft.x*.17;
    const top=lipTop.y-.04,bottom=top-Math.min(.42,gap*.45),z=Math.min(lipTop.z,lipBottom.z)-.18;
    teeth.geometry.setAttribute('position',new THREE.Float32BufferAttribute([x0,top,z,x1,top,z,x1,bottom,z,x0,bottom,z],3));teeth.geometry.setIndex([0,1,2,0,2,3]);teeth.geometry.computeBoundingSphere();
  }
  shapeVersion++;$('#scores').replaceChildren();
  attr.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  $('#reading').textContent = hasPhoto ? 'Geometry changed. Press Re-read expression to measure it.' : 'Take a picture to compare model scores.';
}
function engineTarget() {
  if (parent !== window) return Promise.resolve(parent);
  if (!localEngine) {
    localEngine = document.createElement('iframe'); localEngine.hidden = true; localEngine.src = '../p5-expression/index.html?engine=1'; document.body.append(localEngine);
    localEngine.ready = new Promise(resolve => localEngine.addEventListener('load',resolve,{once:true}));
  }
  return localEngine.ready.then(() => localEngine.contentWindow);
}
async function readExpression() {
  if (!hasPhoto) return [];
  const version=shapeVersion;
  while(pendingReads.size){await new Promise(resolve=>setTimeout(resolve,20));if(version!==shapeVersion)return null;}
  const key=JSON.stringify([controlIDs.map(id=>Number($(id).value)),shapeExtras,$('#texture').checked]);
  if(measuredShapes.has(key)){const saved=measuredShapes.get(key);$('#model-view img').src=saved.image;$('#model-view').hidden=false;displayScores(saved.scores);return saved.scores;}
  const id = 'mesh-'+Date.now()+'-'+(++requestNumber); $('#read').disabled = true;
  $('#reading').textContent = 'Reading the rendered face with the expression classifier…';
  try {
    // Use a stable frontal view and hide the topology overlay during inference.
    const showWire = wire.visible, oldRotation = mesh.rotation.clone(); wire.visible = false; mesh.rotation.set(0,0,0);
    const oldSize = renderer.getSize(new THREE.Vector2()), oldRatio = renderer.getPixelRatio();
    renderer.setPixelRatio(1); renderer.setSize(480,480,false); renderer.render(scene,frontCamera);
    const image = renderer.domElement.toDataURL('image/jpeg',.9);
    $('#model-view img').src=image;$('#model-view').hidden=false;
    renderer.setPixelRatio(oldRatio); renderer.setSize(oldSize.x,oldSize.y,false); mesh.rotation.copy(oldRotation); wire.visible = showWire; renderer.render(scene,camera);
    const target = await engineTarget();
    const reply = new Promise((resolve,reject) => { const timer = setTimeout(() => { pendingReads.delete(id); reject(new Error('The expression model is still loading. Please try again.')); },60000); pendingReads.set(id,{resolve,reject,timer}); });
    target.postMessage({type:parent === window ? 'affective-classify' : 'affective-expression-request',id,image},location.origin);
    const scores = await reply;
    if(version!==shapeVersion)return null;
    measuredShapes.set(key,{scores,image});displayScores(scores);
    return scores;
  } catch(error) { $('#reading').textContent = error.message; }
  finally { $('#read').disabled = false; }
}
function displayScores(scores) {
  $('#scores').replaceChildren();
  scores.forEach(score=>{const row=document.createElement('div'),name=document.createElement('span'),value=document.createElement('span');name.textContent=score.label;value.textContent=Math.round(score.score*100)+'%';row.append(name,value);$('#scores').append(row);});
  const top=scores.reduce((a,b)=>b.score>(a?.score ?? -1)?b:a,null);
  $('#reading').textContent=top?'Target: '+selectedTarget+' / Read: '+top.label+' '+Math.round(top.score*100)+'%':'No face recognized in this rendering.';
}
function selectPreset(label) {
  selectedTarget=label;const token=++selectionVersion;
  $('#presets').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===label)));
  applyPreset(label);status('Reading '+label+' / waiting for the classifier…');
  selectionWork=selectionWork.catch(()=>{}).then(async()=>{if(token!==selectionVersion)return;await readPreset(token);}).catch(error=>{if(token===selectionVersion)status(error.message);});
}
window.addEventListener('message',event => {
  if (event.origin !== location.origin || (event.source !== parent && event.source !== localEngine?.contentWindow)) return;
  if (event.data?.type === 'affective-model-labels') renderPresets(event.data.labels);
  if (event.data?.type === 'affective-stop') stopCamera();
  if (event.data?.type === 'affective-expression-result') {
    const pending = pendingReads.get(event.data.id); if (!pending) return;
    clearTimeout(pending.timer); pendingReads.delete(event.data.id);
    if (event.data.error) pending.reject(new Error(event.data.error)); else pending.resolve(event.data.scores || []);
  }
});
$('#camera-start').addEventListener('click',startCamera); $('#camera-stop').addEventListener('click',stopCamera);
$('#capture').addEventListener('click',() => applyPhoto($('#video')));
$('#upload').addEventListener('change',async () => {
  const file = $('#upload').files[0]; if (!file) return;
  if (file.size > 20000000) { status('Choose an image smaller than 20 MB.'); return; }
  const url = URL.createObjectURL(file), img = new Image();
  try { img.src = url; await img.decode(); await applyPhoto(img); } catch(error) { status('Could not open this image: '+error.message); } finally { URL.revokeObjectURL(url); $('#upload').value = ''; }
});
$('#reset').addEventListener('click',resetShape);
$('#read').addEventListener('click',readExpression);
['#smile','#jaw','#brow','#eyes','#furrow','#nose'].forEach(id => $(id).addEventListener('input',()=>{selectionVersion++;deform();}));
['#smile','#jaw','#brow','#eyes','#furrow','#nose'].forEach(id => $(id).addEventListener('change',() => {if(hasPhoto && !fitting)readExpression();}));
$('#wire').addEventListener('change',() => wire.visible = $('#wire').checked);
$('#texture').addEventListener('change',() => { material.map = $('#texture').checked ? photoTexture : null; material.color.set(material.map ? 0xffffff : 0xe5e5e5); material.needsUpdate = true; deform(); });
window.addEventListener('pagehide',() => { stopCamera(); landmarker?.close(); renderer.dispose(); photoTexture?.dispose(); });
document.addEventListener('keydown',event => { if (parent !== window && !event.target.closest('input,button,select') && ['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); parent.postMessage({type:'affective-nav',direction:event.key === 'ArrowRight' ? 'next' : 'previous'},location.origin); } });

const shapes = {
 neutral:{values:[0,0,0,0,0,0],extra:{}},
 happy:{values:[1,.12,.05,-.6,0,0],extra:{cheek:1,mouthWide:.4}},
 sad:{values:[-.38,0,-.12,-.08,.12,0],extra:{innerBrow:.5,chinRaise:.2}},
 angry:{values:[-.15,0,-.35,-.28,.9,0],extra:{lipPress:.9,chinRaise:.35,mouthWide:-.15}},
 fearful:{values:[-.12,.25,.3,.5,.45,0],extra:{innerBrow:.55,mouthWide:.8}},
 disgusted:{values:[-.2,0,-.2,-.28,.4,.9],extra:{cheek:.25,lipPress:.15,chinRaise:.6}},
 surprised:{values:[0,.9,.9,1,0,0],extra:{innerBrow:.4,mouthWide:-.25}}
};
const controlIDs = ['#smile','#jaw','#brow','#eyes','#furrow','#nose'];
function applyPreset(label,scale=1) {const preset=scale===1 && calibratedPresets.has(label) ? calibratedPresets.get(label) : shapes[label];shapeExtras=Object.fromEntries(Object.entries(preset.extra).map(([k,v])=>[k,v*scale]));controlIDs.forEach((id,i)=>$(id).value=preset.values[i]*scale);deform();}
function renderPresets(labels) {
  $('#presets').replaceChildren();
  labels.filter(label=>shapes[label]).forEach(label=>{const button=document.createElement('button');button.textContent=label;button.type='button';button.setAttribute('aria-pressed',String(label===selectedTarget));button.onclick=()=>selectPreset(label);$('#presets').append(button);});
}
async function readPreset(token=selectionVersion) {
  if(token!==selectionVersion)return;
  const target=selectedTarget;let scores=await readExpression();
  if(token!==selectionVersion)return;
  const actual=scores?.find(s=>s.label===target)?.score ?? -1;
  // All labels, including surprised, recover from missing faces and weak matches.
  if(!scores?.length || (!calibratedPresets.has(target) && actual<.65))await fitTarget(token);
  else {
    const top=scores.reduce((a,b)=>a.score>b.score?a:b);
    status(top.label===target && actual>=.55?'Target: '+target+'. The classifier’s measured result is shown below.':'No reliable '+target+' match for this photo. Best '+target+': '+Math.round(actual*100)+'%; model reads '+top.label+'. Try a neutral frontal photo.');
  }
}
async function fitTarget(token=selectionVersion) {
  if(!hasPhoto || token!==selectionVersion)return;
  fitting=true;$('#fit').disabled=true;
  const target=selectedTarget,controls=[...document.querySelectorAll('.fine-controls input')];controls.forEach(el=>el.disabled=true);
  let best=null,evaluations=0;
  const snapshot=()=>({values:controlIDs.map(id=>Number($(id).value)),extra:{...shapeExtras}});
  const restore=state=>{shapeExtras={...state.extra};controlIDs.forEach((id,i)=>$(id).value=state.values[i]);deform();};
  const measure=async()=>{
    if(token!==selectionVersion)throw new Error('Superseded by the next preset.');
    status('Fitting '+target+' / measuring shape '+(++evaluations)+'…');
    const scores=await readExpression();
    if(token!==selectionVersion)throw new Error('Superseded by the next preset.');
    if(!Array.isArray(scores))throw new Error('Reading changed. Select the preset again.');
    if(!scores.length)return;
    const score=scores.find(s=>s.label===target)?.score ?? 0;
    if(!best || score>best.score)best={...snapshot(),score,scores};
  };
  try {
    // Keep the selected rendering as a candidate. Never replace a recognized best shape with a failed detection.
    await measure();
    for(const scale of [0,.25,.5,.75,1]){
      if(best?.score>=.85)break;
      applyPreset(target,scale);await measure();
    }
    if(!best){applyPreset(target,0);await readExpression();status('No recognizable face in the tested shapes. Take a clear frontal photo, then try again.');return;}
    // Search both the visible controls and the coordinated cheek, lip and inner-brow movements.
    const extraRanges={innerBrow:[-1,1],cheek:[0,1],mouthWide:[-1,1],lipPress:[0,1],chinRaise:[0,1]};
    const parameters=[...controlIDs.map((id,i)=>({i,min:Number($(id).min),max:Number($(id).max),step:.3})),...Object.entries(extraRanges).map(([key,[min,max]])=>({key,min,max,step:.3}))];
    for(const parameter of parameters){
      if(best.score>=.85)break;
      const center=parameter.key?(best.extra[parameter.key]||0):best.values[parameter.i];
      for(const direction of [-1,1]){
        const value=Math.max(parameter.min,Math.min(parameter.max,center+direction*parameter.step));
        if(value===center)continue;
        restore(best);if(parameter.key)shapeExtras[parameter.key]=value;else $(controlIDs[parameter.i]).value=value;deform();await measure();
      }
    }
    if(token!==selectionVersion)return;
    restore(best);await readExpression();calibratedPresets.set(target,{values:[...best.values],extra:{...best.extra}});
    const top=best.scores.reduce((a,b)=>a.score>b.score?a:b);
    status(top.label===target && best.score>=.55?'Fitted '+target+' / '+Math.round(best.score*100)+'% actual model score.':'No reliable '+target+' match for this photo. Best '+target+': '+Math.round(best.score*100)+'%; model reads '+top.label+'. Try another photo or fine adjustments.');
  } catch(error) {if(token===selectionVersion)status(error.message);}
  finally {fitting=false;$('#fit').disabled=false;controls.forEach(el=>el.disabled=false);}
}
$('#fit').onclick=()=>{const token=++selectionVersion;selectionWork=selectionWork.catch(()=>{}).then(()=>fitTarget(token));};
// Populate from the classifier's exported label list, including standalone mode.
const labelEngine = await engineTarget();labelEngine.postMessage({type:'affective-labels-request'},location.origin);
