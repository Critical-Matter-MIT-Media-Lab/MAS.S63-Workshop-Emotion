// Pretrained facial-expression example. Paste into sketch.js in p5.js 1.x.
// This is the original expression-enabled ml5 build; no training or serial connection.
let cameraVideo, expressionModel, modelReady, cameraOn=false, starting=false, version=0, faceBox=null;
let scores=[];
const LABELS=['neutral','happy','sad','angry','fearful','disgusted','surprised'];
const el=s=>document.querySelector('#expression-app '+s);
function setup(){
  pixelDensity(1);frameRate(24);
  const style=document.createElement('style');style.textContent=EXPRESSION_STYLE;document.head.append(style);
  createDiv().id('expression-app').html(`<header><small>AFFECTIVE SENSING / P5.JS + ML5.JS</small><h1>Reading expressions</h1><p>Watch a pretrained model assign labels to visible facial patterns.</p></header><div class="expression-layout"><section><div id="camera"></div><div class="actions"><button id="start">Start camera</button><button id="stop" disabled>Stop camera</button></div><p id="status" role="status">Camera off. Start when you are ready.</p></section><aside><small>MODEL PREDICTION</small><h2 id="result">No prediction yet</h2><div id="scores"></div><p class="note">These scores describe the model's categories. A smiling face does not necessarily mean a happy person.</p></aside></div><footer>Images stay in this browser. This model was trained previously; your camera does not retrain it.</footer>`);
  createCanvas(640,480).parent('camera');cameraVideo=createVideo([]);cameraVideo.hide();
  el('#start').onclick=startExpressionCamera;el('#stop').onclick=stopExpressionCamera;
  window.addEventListener('pagehide',stopExpressionCamera);
}
async function getExpressionModel(){
  if(expressionModel)return expressionModel;
  if(!modelReady)modelReady=(async()=>{
    if(!window.ml5?.faceApi)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/ml5js/Intro-ML-Arts-IMA@ml5-build-10-7-19/ml5_build/ml5.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Could not load ml5. Check your connection.'));document.head.append(s);});
    const base='https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models@face-api/models/faceapi/';
    expressionModel=await ml5.faceApi({withLandmarks:false,withDescriptors:false,withExpressions:true,minConfidence:.5,
      Mobilenetv1Model:base+'ssd_mobilenetv1_model-weights_manifest.json',FaceLandmarkModel:base+'face_landmark_68_model-weights_manifest.json',
      FaceRecognitionModel:base+'face_recognition_model-weights_manifest.json',FaceExpressionModel:base+'face_expression_model-weights_manifest.json'});return expressionModel;
  })().catch(e=>{modelReady=null;throw e;});
  return modelReady;
}
async function startExpressionCamera(){
  if(starting||cameraOn)return;starting=true;el('#start').disabled=true;const token=++version;
  try{
    el('#status').textContent='Loading pretrained expression model...';await getExpressionModel();if(token!==version)return;
    const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false});
    if(token!==version){stream.getTracks().forEach(t=>t.stop());return;}
    cameraVideo.elt.srcObject=stream;cameraVideo.elt.muted=true;cameraVideo.elt.playsInline=true;await cameraVideo.elt.play();
    const w=cameraVideo.elt.videoWidth||640,h=cameraVideo.elt.videoHeight||480;cameraVideo.size(w,h);resizeCanvas(w,h);cameraOn=true;
    el('#stop').disabled=false;el('#status').textContent='Model ready. Try an expression, then relax.';readExpression(token);
  }catch(e){stopExpressionCamera();el('#status').textContent=e.message;}finally{starting=false;el('#start').disabled=cameraOn;}
}
async function readExpression(token){
  if(!cameraOn||token!==version)return;
  try{
    // Read a stable frame so stopping the stream cannot invalidate an in-flight read.
    const input=document.createElement('canvas');input.width=cameraVideo.elt.videoWidth;input.height=cameraVideo.elt.videoHeight;
    input.getContext('2d').drawImage(cameraVideo.elt,0,0,input.width,input.height);
    const faces=await expressionModel.detect(input);if(!cameraOn||token!==version)return;
    scores=faces?.length?LABELS.map(label=>({label,score:Number(faces[0].expressions[label])||0})):[];
    faceBox=faces?.[0]?.detection?.box||faces?.[0]?.detection?._box||null;
    const top=scores.reduce((a,b)=>b.score>(a?.score??-1)?b:a,null);
    el('#result').textContent=top?top.label+' / '+Math.round(top.score*100)+'%':'No face detected';el('#scores').replaceChildren();
    scores.forEach(item=>{const row=document.createElement('div'),label=document.createElement('span'),value=document.createElement('b'),track=document.createElement('div'),bar=document.createElement('i');row.className='score-row';label.textContent=item.label;value.textContent=Math.round(item.score*100)+'%';track.className='track';bar.style.width=item.score*100+'%';track.append(bar);row.append(label,value,track);el('#scores').append(row);});
    setTimeout(()=>readExpression(token),180);
  }catch(e){stopExpressionCamera();el('#status').textContent='Reading stopped: '+e.message;}
}
function draw(){
  background('#efefec');
  if(cameraOn&&cameraVideo.elt.readyState>=2){
    push();translate(width,0);scale(-1,1);image(cameraVideo,0,0,width,height);pop();
    if(faceBox){const x=faceBox.x??faceBox._x,y=faceBox.y??faceBox._y,w=faceBox.width??faceBox._width,h=faceBox.height??faceBox._height;noFill();stroke('#fff');strokeWeight(3);rect(width-x-w,y,w,h);stroke('#171717');strokeWeight(1);rect(width-x-w,y,w,h);}
  }else{fill('#777');noStroke();textSize(18);textAlign(CENTER,CENTER);text('Your camera preview',width/2,height/2);}
}
function stopExpressionCamera(){cameraOn=false;version++;faceBox=null;scores=[];cameraVideo?.elt.srcObject?.getTracks().forEach(t=>t.stop());if(cameraVideo)cameraVideo.elt.srcObject=null;if(el('#status')){el('#start').disabled=false;el('#stop').disabled=true;el('#status').textContent='Camera off.';el('#result').textContent='No prediction yet';el('#scores').replaceChildren();}}
const EXPRESSION_STYLE=`
html,body{margin:0;padding:0;background:#f4f4f0;color:#171717;font:14px/1.5 Arial,sans-serif;color-scheme:light}#expression-app,#expression-app *{box-sizing:border-box}#expression-app{max-width:1100px;margin:auto;padding:28px clamp(16px,4vw,44px)}#expression-app header{border-bottom:1px solid #ccc;padding-bottom:20px;margin-bottom:24px}#expression-app small{font-size:10px;font-weight:bold;letter-spacing:.1em;color:#666}#expression-app h1{font-size:clamp(30px,5vw,54px);line-height:1;letter-spacing:-.055em;margin:15px 0}#expression-app h2{font-size:30px;line-height:1.1;letter-spacing:-.04em;overflow-wrap:anywhere}#expression-app p{margin:10px 0}.expression-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(220px,.8fr);gap:24px;align-items:start}#expression-app #camera{background:#efefec;border:1px solid #ddd}#expression-app canvas{display:block;width:100%!important;height:auto!important}#expression-app video{display:none!important}.actions{display:flex;gap:8px;margin:12px 0}#expression-app button{font:inherit;color:#171717;background:white;border:1px solid #bbb;border-radius:5px;padding:9px 12px;cursor:pointer}#expression-app button:disabled{opacity:.4;cursor:default}#expression-app button:hover:enabled{background:#eee}#expression-app :focus-visible{outline:2px solid #3159e6;outline-offset:3px}#expression-app #status{font-size:12px;color:#555}#expression-app aside{background:white;border:1px solid #ddd;border-radius:8px;padding:20px}.score-row{display:grid;grid-template-columns:1fr auto;gap:5px;font-size:12px;margin:14px 0}.track{background:#eee;height:4px;grid-column:1/-1;overflow:hidden;border-radius:5px}.track i{display:block;background:#3159e6;height:100%}.note{font-size:11px;color:#666}#expression-app footer{border-top:1px solid #ccc;padding-top:16px;margin-top:20px;font-size:11px;color:#666}@media(max-width:650px){.expression-layout{grid-template-columns:1fr}#expression-app{padding:20px 14px}}`;
