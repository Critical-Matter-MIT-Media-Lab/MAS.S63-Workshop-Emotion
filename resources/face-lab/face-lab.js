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
const frontCamera = new THREE.PerspectiveCamera(34,1,.1,20000); frontCamera.position.set(0,0,34); frontCamera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xffffff,0x999999,2));
const light = new THREE.DirectionalLight(0xffffff,2); light.position.set(1,2,5); scene.add(light);
const geometry = new THREE.BufferGeometry();
const material = new THREE.MeshBasicMaterial({color:0xe5e5e5,side:THREE.DoubleSide,vertexColors:true});
material.onBeforeCompile=shader=>{
  shader.uniforms.rigBlur={value:blurredTexture};shader.uniforms.rigSmooth={value:shapeExtras.albedoSmooth||0};shader.uniforms.rigLighting={value:shapeExtras.lighting||0};
  shader.vertexShader='attribute float skinBlend;varying float rigSmoothWeight;varying vec3 rigNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nrigSmoothWeight=skinBlend;rigNormal=normalize(normalMatrix*normal);');
  shader.fragmentShader='uniform sampler2D rigBlur;uniform float rigSmooth;uniform float rigLighting;varying float rigSmoothWeight;varying vec3 rigNormal;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n#ifdef USE_MAP\ndiffuseColor.rgb=mix(diffuseColor.rgb,texture2D(rigBlur,vMapUv).rgb,rigSmooth*rigSmoothWeight);\n#endif\ndiffuseColor.rgb*=mix(1.,.65+.35*max(0.,dot(normalize(rigNormal),normalize(vec3(-.45,.55,1.)))),rigLighting);');
  material.userData.rigUniforms=shader.uniforms;
};
const mesh = new THREE.Mesh(geometry,material); scene.add(mesh);
const cavity = new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0x241619,side:THREE.DoubleSide})); mesh.add(cavity);
const teeth = new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xeee8dc,side:THREE.DoubleSide}));mesh.add(teeth);
const wire = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x444444,wireframe:true,transparent:true,opacity:.45,depthWrite:false})); scene.add(wire);
let basePositions, capturedPositions, neutralPositions, photoTexture, blurredTexture, landmarker, landmarkPromise, stream, hasPhoto = false, cameraToken = 0, requestNumber = 0;
const pendingReads = new Map();
const calibratedPresets = new Map();
const extraRanges={innerBrow:[-1,1],cheek:[-1,1],mouthWide:[-1,1],lipPress:[0,1],chinRaise:[0,1],upperLip:[-1,1],lowerLip:[-1,1],lipRound:[0,1],teethReveal:[0,1],browAngle:[-1,1],noseWrinkle:[0,1],neutralize:[0,1],eyeRebuild:[0,1],sneer:[-1,1],projection:[0,1],albedoSmooth:[0,1],lighting:[0,1]};
function setExtras(extra={}){shapeExtras={...extra};for(const key of Object.keys(extraRanges)){const input=document.querySelector('#rig-'+key);if(input)input.value=extra[key]||0;}}
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
  geometry.setAttribute('position',new THREE.BufferAttribute(basePositions.slice(),3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(basePositions.length).fill(1),3));
  geometry.setAttribute('skinBlend',new THREE.Float32BufferAttribute(new Float32Array(positions.length),1));
  capturedPositions=basePositions.slice();neutralPositions=basePositions.slice(); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
}
const topology = await (await fetch('canonical-face.json')).json();
// Remove the triangles spanning the inner lips, leaving a real mouth aperture.
const innerLips = new Set([78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191]);
const eyeLoops=[[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],[263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466]];
const eyeSets=eyeLoops.map(loop=>new Set(loop));
const eyeMeshes=eyeLoops.map(()=>{
  const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{photo:{value:null},usePhoto:{value:0},rebuild:{value:0},eyeAspect:{value:1},irisColor:{value:new THREE.Color(.22,.13,.07)}},vertexShader:`varying vec2 eyeUV;varying vec2 photoUV;attribute vec2 photoUv;void main(){eyeUV=uv;photoUV=photoUv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D photo;uniform float usePhoto;uniform float rebuild;uniform float eyeAspect;uniform vec3 irisColor;varying vec2 eyeUV;varying vec2 photoUV;void main(){vec2 p=(eyeUV-.5)*vec2(1.,eyeAspect);float radius=length(p);float angle=atan(p.y,p.x);float fiber=.85+.15*sin(angle*62.+radius*190.);vec3 iris=irisColor*fiber;vec3 color=mix(vec3(.94,.92,.90),iris,1.-smoothstep(.155,.17,radius));color=mix(vec3(.025),color,smoothstep(.055,.07,radius));float glint=1.-smoothstep(.012,.025,length(p-vec2(-.035,.04)));color=mix(color,vec3(1.),glint*.85);vec3 original=texture2D(photo,photoUV).rgb;gl_FragColor=vec4(mix(original,color,rebuild*usePhoto),1.);
#include <colorspace_fragment>
}`});
  const eye=new THREE.Mesh(new THREE.BufferGeometry(),material);mesh.add(eye);return eye;
});
const openIndices = [];
for (let i=0;i<topology.indices.length;i+=3) { const triangle = topology.indices.slice(i,i+3); if (!triangle.every(v => innerLips.has(v)) && !eyeSets.some(set=>triangle.every(v=>set.has(v)))) openIndices.push(...triangle); }
geometry.setIndex(openIndices); geometry.setAttribute('uv',new THREE.Float32BufferAttribute(topology.uv.flat(),2));
setPositions(topology.positions); wire.visible = false; deform(); mesh.rotation.y = wire.rotation.y = -.18; resize();
status('468 landmarks / editable eyes, brows, lips and nose. Rotate the mesh, or take a picture to map your face onto it.');

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
    buildNeutralReference();
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(landmarks.slice(0,468).flatMap(p => [p.x,1-p.y]),2));
    photoTexture?.dispose(); photoTexture = new THREE.CanvasTexture(canvas); photoTexture.colorSpace = THREE.SRGBColorSpace;
    const small=document.createElement('canvas');small.width=32;small.height=Math.max(16,Math.round(32*canvas.height/canvas.width));small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);
    const soft=document.createElement('canvas');soft.width=canvas.width;soft.height=canvas.height;soft.getContext('2d').drawImage(small,0,0,soft.width,soft.height);
    blurredTexture?.dispose();blurredTexture=new THREE.CanvasTexture(soft);blurredTexture.colorSpace=THREE.SRGBColorSpace;
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
  setExtras({neutralize:1}); selectedTarget = 'neutral';
  $('#presets').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.textContent==='neutral')));
  ['#smile','#jaw','#brow','#eyes','#furrow','#nose'].forEach(id => $(id).value = 0);
  camera.position.set(0,0,34); controls.target.set(0,0,0); controls.update();
  mesh.rotation.set(0,0,0); wire.rotation.set(0,0,0); deform();
}
function buildNeutralReference(){
  const source=capturedPositions, canonical=topology.positions;
  const point3=i=>new THREE.Vector3(source[i*3],source[i*3+1],source[i*3+2]);
  const eyeL=point3(33),eyeR=point3(263),eyeMid=eyeL.clone().add(eyeR).multiplyScalar(.5);
  const canonicalEye=canonical[33].map((v,i)=>(v+canonical[263][i])/2);
  const sx=(eyeR.x-eyeL.x)/(canonical[263][0]-canonical[33][0]);
  const sy=(eyeMid.y-point3(152).y)/(canonicalEye[1]-canonical[152][1]);
  neutralPositions=source.slice();
  const mouthY=(point3(0).y+point3(17).y)/2;
  const canonicalMouthY=(canonical[0][1]+canonical[17][1])/2;
  const mouthCenterX=(point3(61).x+point3(291).x)/2;
  const mouthRadius=Math.max(1.5,(eyeR.x-eyeL.x)*.42);
  for(let i=0;i<468;i++){
    const x=source[i*3],y=source[i*3+1];
    const mouthWeight=Math.exp(-(((x-mouthCenterX)/(mouthRadius*1.25))**4+((y-mouthY)/(mouthRadius*.8))**4));
    let tx=canonical[i][0]*sx+eyeMid.x,ty=(canonical[i][1]-canonicalEye[1])*sy+eyeMid.y;
    // Retarget the source's mouth and eyebrows into a neutral reference while preserving the outer face.
    const browWeight=y>eyeMid.y+.2?Math.exp(-(((y-(eyeMid.y+1.1))/1.2)**4))*Math.exp(-(((x-eyeMid.x)/(mouthRadius*1.9))**8)):0;
    const eyeWeight=Math.max(...[eyeL,eyeR].map(eye=>Math.exp(-(((x-(eye.x+eyeMid.x)*.5)/(mouthRadius*.6))**4+((y-eyeMid.y)/(mouthRadius*.35))**4))));
    const weight=Math.max(mouthWeight,browWeight*.8,eyeWeight*.8);
    neutralPositions[i*3]=x+(tx-x)*weight;
    neutralPositions[i*3+1]=y+(ty-y)*weight;
  }
  // Close a photographed smile's aperture before applying the target pose.
  const upper=[13,82,81,80,191,312,311,310,415],lower=[14,87,178,88,95,317,402,318,324];
  const center=(neutralPositions[13*3+1]+neutralPositions[14*3+1])/2;
  for(const i of upper)neutralPositions[i*3+1]=center+.035;
  for(const i of lower)neutralPositions[i*3+1]=center-.035;
}
function eyeMidX(){return (basePositions[33*3]+basePositions[263*3])/2;}
function point(index) { return [basePositions[index*3],basePositions[index*3+1]]; }
function deform() {
  if (!basePositions) return;
  const smile = Number($('#smile').value), jaw = Number($('#jaw').value), brow = Number($('#brow').value), eyes = Number($('#eyes').value), furrow = Number($('#furrow').value), nose = Number($('#nose').value);
  for(const key of Object.keys(extraRanges)){const input=$('#rig-'+key);if(input)shapeExtras[key]=Number(input.value);}
  const {innerBrow=0,cheek=0,mouthWide=0,lipPress=0,chinRaise=0,upperLip:lipRaise=0,lowerLip=0,lipRound=0,teethReveal=0,browAngle=0,noseWrinkle=0,neutralize=0,eyeRebuild=0,sneer=0}=shapeExtras;
  if(hasPhoto && neutralPositions)for(let i=0;i<basePositions.length;i++)basePositions[i]=capturedPositions[i]+(neutralPositions[i]-capturedPositions[i])*neutralize;
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
    y += cheek*.75*(gaussian(x,y,cheekL,1)+gaussian(x,y,cheekR,1));
    if (eyeTop.has(i)) y += eyes*.45;
    if (eyeBottom.has(i)) y -= eyes*.3;
    if (upperLip.has(i)) y += (nose*.35+lipRaise*.8)*(.25+.65*gaussian(x,y,point(0),1.1));
    const mouthWeight=gaussian(x,y,mouth,2.1);
    x -= lipRound*.6*(x-mouth[0])*mouthWeight;
    z += lipRound*.7*mouthWeight;
    if(y<mouth[1])y-=lowerLip*.65*gaussian(x,y,point(17),1.3);
    const browPosition=(Math.abs(x-eyeMidX())-1.6)/2;
    y+=browAngle*.6*browPosition*(outerBrows+innerBrows);
    const noseRoot = gaussian(x,y,point(6),.75);
    y += nose*.3*noseRoot + chinRaise*.45*gaussian(x,y,point(17),1);
    x -= nose*.2*Math.sign(x)*gaussian(x,y,point(4),1.2);
    z += (nose*.3+noseWrinkle*.35)*noseRoot;
    if(upperLip.has(i))y+=sneer*.7*Math.sign(x-mouth[0])*gaussian(x,y,mouth,1.8);
    z += nose*.2*gaussian(x,y,point(4),1.1);
    if (innerLips.has(i)) {
      const upper = upperLip.has(i);
      y += upper ? jaw*.35 : -jaw*.6;
      const restCenter = (basePositions[13*3+1]+basePositions[14*3+1])/2;
      y += lipPress*(restCenter-basePositions[i*3+1])*.7;
    }
    z -= jaw*.2*jawWeight; attr.setXYZ(i,x,y,z);
    const crease=Math.max(0,furrow*.22*gaussian(x,y,point(168),.65)+noseWrinkle*.25*gaussian(x,y,point(6),.85)*(Math.sin(y*15)**2));
    const shade=Math.max(.65,1-crease);geometry.attributes.color.setXYZ(i,shade,shade,shade);
    const folds=Math.max(gaussian(x,y,[left[0]-.2,left[1]+1],1),gaussian(x,y,[right[0]+.2,right[1]+1],1),gaussian(x,y,cheekL,1.3),gaussian(x,y,cheekR,1.3));
    const lipExclusion=gaussian(x,y,mouth,1.1);geometry.attributes.skinBlend.setX(i,Math.max(0,folds*(1-lipExclusion)));
  }
  eyeLoops.forEach((loop,eyeIndex)=>{
    const points=loop.map(i=>new THREE.Vector3().fromBufferAttribute(attr,i));
    const center=points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/points.length);
    const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
    const w=Math.max(.1,maxX-minX),h=Math.max(.05,maxY-minY),vertices=[center.x,center.y,center.z-.035],uvs=[(center.x-minX)/w,(center.y-minY)/h];
    const sourceUV=geometry.attributes.uv,photoUV=[];
    let u=0,v=0;loop.forEach(i=>{u+=sourceUV.getX(i);v+=sourceUV.getY(i);});photoUV.push(u/loop.length,v/loop.length);
    points.forEach((p,j)=>{vertices.push(p.x,p.y,p.z-.035);uvs.push((p.x-minX)/w,(p.y-minY)/h);photoUV.push(sourceUV.getX(loop[j]),sourceUV.getY(loop[j]));});
    const indices=[];for(let i=0;i<loop.length;i++)indices.push(0,i+1,(i+1)%loop.length+1);
    const eye=eyeMeshes[eyeIndex];eye.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));eye.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));eye.geometry.setAttribute('photoUv',new THREE.Float32BufferAttribute(photoUV,2));eye.geometry.setIndex(indices);eye.geometry.computeBoundingSphere();
    eye.material.uniforms.photo.value=photoTexture;eye.material.uniforms.usePhoto.value=hasPhoto?1:0;eye.material.uniforms.rebuild.value=eyeRebuild;eye.material.uniforms.eyeAspect.value=h/w;
    eye.visible=hasPhoto;
  });
  // A recessed surface follows the actual aperture boundary; it never bulges through the lips.
  const lipLoop = [...innerLips]; const vertices = [], center = new THREE.Vector3();
  lipLoop.forEach(i => center.add(new THREE.Vector3().fromBufferAttribute(attr,i)));center.multiplyScalar(1/lipLoop.length);center.z -= .8;
  vertices.push(center.x,center.y,center.z);
  lipLoop.forEach(i => { const p = new THREE.Vector3().fromBufferAttribute(attr,i);vertices.push(p.x,p.y,p.z-.3); });
  const indices = [];for(let i=0;i<lipLoop.length;i++) indices.push(0,i+1,(i+1)%lipLoop.length+1);
  cavity.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));cavity.geometry.setIndex(indices);cavity.geometry.computeBoundingSphere();
  const uv = geometry.attributes.uv, centerUV = new THREE.Vector2();lipLoop.forEach(i=>centerUV.add(new THREE.Vector2().fromBufferAttribute(uv,i)));centerUV.multiplyScalar(1/lipLoop.length);
  cavity.geometry.setAttribute('uv',new THREE.Float32BufferAttribute([centerUV.x,centerUV.y,...lipLoop.flatMap(i=>[uv.getX(i),uv.getY(i)])],2));
  const interiorMap = hasPhoto && jaw < .08 && neutralize<.35 && lipPress<.4 && $('#texture').checked ? photoTexture : null;
  if(cavity.material.map!==interiorMap){cavity.material.map=interiorMap;cavity.material.needsUpdate=true;}
  cavity.material.color.set(interiorMap ? 0xffffff : 0x241619);
  const lipTop = new THREE.Vector3().fromBufferAttribute(attr,13), lipBottom = new THREE.Vector3().fromBufferAttribute(attr,14);
  const lipLeft = new THREE.Vector3().fromBufferAttribute(attr,78), lipRight = new THREE.Vector3().fromBufferAttribute(attr,308);
  const gap = Math.max(0,lipTop.y-lipBottom.y);
  geometry.attributes.color.needsUpdate=true;geometry.attributes.skinBlend.needsUpdate=true;
  const uniforms=material.userData.rigUniforms;if(uniforms){uniforms.rigBlur.value=blurredTexture;uniforms.rigSmooth.value=shapeExtras.albedoSmooth||0;uniforms.rigLighting.value=shapeExtras.lighting||0;}
  teeth.visible = (smile > .25 || teethReveal>.1) && gap > .08;
  if (teeth.visible) {
    const x0=lipLeft.x*.83+lipRight.x*.17,x1=lipRight.x*.83+lipLeft.x*.17;
    const top=lipTop.y-.04,bottom=top-Math.min(.55,gap*(.35+teethReveal*.5)),z=Math.min(lipTop.z,lipBottom.z)-.18;
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
    const perspective=shapeExtras.projection ?? 0;
    const distance=perspective>.99?34:34+Math.pow(1-perspective,3)*9966;
    frontCamera.position.set(0,0,distance);frontCamera.fov=2*Math.atan(10.4/distance)*180/Math.PI;frontCamera.updateProjectionMatrix();
    renderer.setPixelRatio(1); renderer.setSize(480,480,false); renderer.render(scene,frontCamera);
    const image = renderer.domElement.toDataURL('image/jpeg',.9);
    $('#model-view img').src=image;$('#model-view').hidden=false;
    renderer.setPixelRatio(oldRatio); renderer.setSize(oldSize.x,oldSize.y,false); mesh.rotation.copy(oldRotation); wire.visible = showWire; renderer.render(scene,camera);
    const target = await engineTarget();
    const reply = new Promise((resolve,reject) => { const timer = setTimeout(() => { pendingReads.delete(id); reject(new Error('The expression model is still loading. Please try again.')); },60000); pendingReads.set(id,{resolve,reject,timer}); });
    target.postMessage({type:parent === window ? 'affective-classify' : 'affective-expression-request',id,image},location.origin);
    const scores = await reply;
    if(version!==shapeVersion)return null;
    if(measuredShapes.size>=1200)measuredShapes.delete(measuredShapes.keys().next().value);
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
document.querySelectorAll('[data-rig-control]').forEach(input=>{input.addEventListener('input',()=>{selectionVersion++;deform();});input.addEventListener('change',()=>{if(hasPhoto&&!fitting)readExpression();});});
document.querySelectorAll('[data-control-tab]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-control-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('.fine-controls label').forEach(label=>label.hidden=label.dataset.group!==button.dataset.controlTab);});
$('#wire').addEventListener('change',() => wire.visible = $('#wire').checked);
$('#texture').addEventListener('change',() => { material.map = $('#texture').checked ? photoTexture : null; material.color.set(material.map ? 0xffffff : 0xe5e5e5); material.needsUpdate = true; deform(); });
window.addEventListener('pagehide',() => { stopCamera(); landmarker?.close(); renderer.dispose(); photoTexture?.dispose(); });
document.addEventListener('keydown',event => { if (parent !== window && !event.target.closest('input,button,select') && ['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); parent.postMessage({type:'affective-nav',direction:event.key === 'ArrowRight' ? 'next' : 'previous'},location.origin); } });

const shapes = {
 neutral:{values:[0,0,0,0,0,0],extra:{neutralize:1}},
 happy:{values:[1,.12,.05,-.6,0,0],extra:{cheek:1,mouthWide:.45,teethReveal:.8,neutralize:1}},
 sad:{values:[-.38,0,-.12,-.08,.12,0],extra:{innerBrow:.6,chinRaise:.25,browAngle:-.4,neutralize:1}},
 angry:{values:[-.15,0,-.35,-.28,.9,0],extra:{lipPress:.9,chinRaise:.35,mouthWide:-.2,browAngle:.4,noseWrinkle:.15,neutralize:1}},
 fearful:{values:[-.12,.25,.3,.5,.45,0],extra:{innerBrow:.6,mouthWide:1,teethReveal:.5,lowerLip:.3,neutralize:1}},
 disgusted:{values:[-.2,0,-.2,-.28,.4,.9],extra:{cheek:.3,lipPress:.15,chinRaise:.6,upperLip:.8,noseWrinkle:1,neutralize:1}},
 surprised:{values:[0,.9,.9,1,0,0],extra:{innerBrow:.5,mouthWide:-.3,lipRound:.4,neutralize:1}}
};
const controlIDs = ['#smile','#jaw','#brow','#eyes','#furrow','#nose'];
function applyPreset(label,scale=1) {const preset=scale===1 && calibratedPresets.has(label) ? calibratedPresets.get(label) : shapes[label];setExtras({...Object.fromEntries(Object.entries(preset.extra).map(([k,v])=>[k,v*scale])),neutralize:preset.extra.neutralize ?? 1});controlIDs.forEach((id,i)=>$(id).value=preset.values[i]*scale);deform();}
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
  if(!scores?.length || (!calibratedPresets.has(target) && actual<.85))await fitTarget(token);
  else {
    const top=scores.reduce((a,b)=>a.score>b.score?a:b);
    status(top.label===target && actual>=.8?'Target: '+target+'. The classifier’s measured result is shown below.':'No reliable '+target+' match for this photo. Best '+target+': '+Math.round(actual*100)+'%; model reads '+top.label+'. Try a neutral frontal photo.');
  }
}
async function fitTarget(token=selectionVersion) {
  if(!hasPhoto || token!==selectionVersion)return;
  fitting=true;$('#fit').disabled=true;
  const target=selectedTarget,controls=[...document.querySelectorAll('.fine-controls input')];controls.forEach(el=>el.disabled=true);
  let best=null,evaluations=0;
  const population=[];
  const snapshot=()=>({values:controlIDs.map(id=>Number($(id).value)),extra:{...shapeExtras}});
  const restore=state=>{setExtras(state.extra);controlIDs.forEach((id,i)=>$(id).value=state.values[i]);deform();};
  const measure=async()=>{
    if(token!==selectionVersion)throw new Error('Superseded by the next preset.');
    status('Fitting '+target+' / measuring shape '+(++evaluations)+'…');
    const scores=await readExpression();
    if(token!==selectionVersion)throw new Error('Superseded by the next preset.');
    if(!Array.isArray(scores))throw new Error('Reading changed. Select the preset again.');
    if(!scores.length)return;
    const score=scores.find(s=>s.label===target)?.score ?? 0;
    const state={...snapshot(),score,scores};population.push(state);
    if(!best || score>best.score)best=state;
    return state;
  };
  try {
    // Keep the selected rendering as a candidate. Never replace a recognized best shape with a failed detection.
    await measure();
    for(const scale of [0,.25,.5,.75,1]){
      if(best?.score>=.85)break;
      applyPreset(target,scale);await measure();
    }
    if(!best){
      // Source normalization can itself lose a face; recover using the original photo geometry.
      for(const neutralize of [0,.5])for(const projection of [0,1]){
        applyPreset(target,0);setExtras({...shapeExtras,neutralize,projection});deform();await measure();
      }
    }
    if(!best){applyPreset(target,0);await readExpression();status('No recognizable face in the tested shapes. Take a clear frontal photo, then try again.');return;}
    const priorities={neutral:['albedoSmooth','neutralize','smile','jaw','eyes','brow','lipPress'],happy:['smile','cheek','eyes','mouthWide','teethReveal','jaw'],sad:['smile','innerBrow','browAngle','brow','chinRaise','lipPress'],angry:['albedoSmooth','lighting','eyeRebuild','innerBrow','furrow','browAngle','brow','eyes','lipPress','chinRaise','mouthWide'],fearful:['innerBrow','browAngle','eyes','mouthWide','jaw','teethReveal'],disgusted:['sneer','upperLip','noseWrinkle','nose','chinRaise','smile','lowerLip'],surprised:['jaw','eyes','brow','innerBrow','mouthWide','lipRound']};
    const namedControls=['smile','jaw','brow','eyes','furrow','nose'];
    const parameters=[...controlIDs.map((id,i)=>({name:namedControls[i],i,min:Number($(id).min),max:Number($(id).max)})),...Object.entries(extraRanges).map(([key,[min,max]])=>({name:key,key,min,max}))];
    parameters.sort((a,b)=>{const rank=n=>(priorities[target].indexOf(n)+1)||100;return rank(a.name)-rank(b.name);});
    const strong={
      angry:[{values:[-.3,0,0,.7,1,0],extra:{innerBrow:-1,browAngle:1,lipPress:1,cheek:-.7,neutralize:1,eyeRebuild:1,projection:1}},{values:[-.4,.15,-.5,.1,1,.2],extra:{innerBrow:-.8,browAngle:.8,lipPress:.7,teethReveal:.7,cheek:-.5,neutralize:1,eyeRebuild:1,projection:0}}],
      neutral:[{values:[0,0,0,.1,0,0],extra:{lipPress:.8,cheek:-.8,neutralize:1,eyeRebuild:1,projection:1}}],
      disgusted:[{values:[-.3,.1,-.1,-.2,.5,1],extra:{upperLip:1,lowerLip:-.3,chinRaise:1,sneer:.8,teethReveal:.6,noseWrinkle:1,neutralize:1,eyeRebuild:.5,projection:1}}]
    };
    for(const candidate of strong[target]||[]){if(best.score>=.9)break;restore(candidate);await measure();}
    // Compare the neutralized and original source pose before the local search.
    for(const neutralize of [0,.5,1])for(const projection of [0,1]){if(best.score>=.9)break;restore(best);setExtras({...shapeExtras,neutralize,projection});deform();await measure();}
    for(const eyeRebuild of [1,.5]){if(best.score>=.9)break;restore(best);setExtras({...shapeExtras,eyeRebuild});deform();await measure();}
    for(const step of [.4,.22,.12]){
      if(best.score>=.9)break;
      for(const parameter of parameters){
        if(best.score>=.9 || evaluations>=160)break;
        const center=parameter.key?(best.extra[parameter.key]||0):best.values[parameter.i];
        for(const direction of [-1,1]){
          const value=Math.max(parameter.min,Math.min(parameter.max,center+direction*step));
          if(value===center)continue;
          restore(best);if(parameter.key)setExtras({...shapeExtras,[parameter.key]:value});else $(controlIDs[parameter.i]).value=value;deform();await measure();
        }
      }
    }
    // Coupled movements can escape a plateau that individual sliders cannot.
    const relevant=parameters.slice(0,7);
    for(let trial=0;trial<24 && best.score<.9 && evaluations<185;trial++){
      restore(best);
      for(let j=0;j<3;j++){
        const parameter=relevant[(trial*3+j)%relevant.length];
        const center=parameter.key?(shapeExtras[parameter.key]||0):Number($(controlIDs[parameter.i]).value);
        const delta=Math.sin((trial+1)*(j+2)*12.9898)*.45;
        const value=Math.max(parameter.min,Math.min(parameter.max,center+delta));
        if(parameter.key)setExtras({...shapeExtras,[parameter.key]:value});else $(controlIDs[parameter.i]).value=value;
      }
      deform();await measure();
    }
    // Maintain diverse detected poses, so fitting can cross a local score plateau.
    const random=n=>{const x=Math.sin(n*78.233+evaluations*12.9898)*43758.5453;return x-Math.floor(x);};
    const encode=state=>parameters.map(p=>p.key?(state.extra[p.key]||0):state.values[p.i]);
    const decode=vector=>{const state={values:[...best.values],extra:{...best.extra}};parameters.forEach((p,i)=>{const value=Math.max(p.min,Math.min(p.max,vector[i]));if(p.key)state.extra[p.key]=value;else state.values[p.i]=value;});return state;};
    let beam=population.slice().sort((a,b)=>b.score-a.score).filter((state,i,list)=>i===0||Math.abs(state.score-list[i-1].score)>.000000001).slice(0,12);
    for(let i=0;i<24 && best.score<.9;i++){
      const center=encode(i%3===0?best:(strong[target]?.[i%strong[target].length]||shapes[target]));
      const vector=center.map((value,j)=>value+(random(i*parameters.length+j)-.5)*(parameters[j].max-parameters[j].min)*1.2);
      restore(decode(vector));const candidate=await measure();if(candidate)beam.push(candidate);
    }
    for(let generation=0;generation<32 && best.score<.9 && evaluations<1800;generation++){
      beam=beam.sort((a,b)=>b.score-a.score).slice(0,40);
      for(let i=0;i<40 && best.score<.9;i++){
        const current=encode(beam[i%beam.length]),a=encode(beam[Math.floor(random(i+1)*beam.length)]),b=encode(beam[Math.floor(random(i+9)*beam.length)]),champion=encode(best);
        const restart=i%10===0;
        const vector=current.map((value,j)=>restart?parameters[j].min+random(i*157+j)*(parameters[j].max-parameters[j].min):random(generation*1000+i*31+j)<.8?(i%3===0?champion[j]:value)+.8*(a[j]-b[j])+(random(i*131+j)-.5)*.25*(parameters[j].max-parameters[j].min):value);
        restore(decode(vector));const candidate=await measure();if(candidate)beam.push(candidate);
      }
    }
    if(token!==selectionVersion)return;
    restore(best);await readExpression();calibratedPresets.set(target,{values:[...best.values],extra:{...best.extra}});
    const top=best.scores.reduce((a,b)=>a.score>b.score?a:b);
    status(top.label===target && best.score>=.8?'Fitted '+target+' / '+Math.round(best.score*100)+'% actual model score.':'No reliable '+target+' match for this photo. Best '+target+': '+Math.round(best.score*100)+'%; model reads '+top.label+'. Try another photo or fine adjustments.');
  } catch(error) {if(token===selectionVersion)status(error.message);}
  finally {fitting=false;$('#fit').disabled=false;controls.forEach(el=>el.disabled=false);}
}
$('#fit').onclick=()=>{const token=++selectionVersion;selectionWork=selectionWork.catch(()=>{}).then(()=>fitTarget(token));};
// Populate from the classifier's exported label list, including standalone mode.
const labelEngine = await engineTarget();labelEngine.postMessage({type:'affective-labels-request'},location.origin);
