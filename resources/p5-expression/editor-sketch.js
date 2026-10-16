// Pretrained facial-expression example. Use with editor.html and editor-style.css in p5.js 1.x.
// This is the original expression-enabled ml5 build; no training or serial connection.
let cameraVideo, expressionModel, modelReady, cameraOn=false, starting=false, version=0, faceBox=null;
let scores=[];
const LABELS=['neutral','happy','sad','angry','fearful','disgusted','surprised'];
const el=s=>document.querySelector('#expression-app '+s);
function setup(){
  pixelDensity(1);frameRate(24);

  createCanvas(640,480).parent('camera');cameraVideo=createVideo([]);cameraVideo.hide();
  el('#start').onclick=startExpressionCamera;el('#stop').onclick=stopExpressionCamera;
  window.addEventListener('pagehide',stopExpressionCamera);
}
async function getExpressionModel(){
  if(expressionModel)return expressionModel;
  if(!modelReady)modelReady=(async()=>{
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
