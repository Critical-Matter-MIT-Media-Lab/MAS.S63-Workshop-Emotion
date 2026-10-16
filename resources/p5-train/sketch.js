// Train and test two image labels in p5.js 1.x. Interface: index.html. Styles: style.css.
let video, features, classifier, loading;
let counts=[0,0], running=false, starting=false, busy=false, training=false, testing=false, trained=false, generation=0;
const $=s=>document.querySelector('#train-app '+s);
const say=t=>$('#status').textContent=t;
const labels=()=>[$('#label-a').value.trim(),$('#label-b').value.trim()];
function setup(){
  pixelDensity(1);frameRate(24);

  createCanvas(640,480).parent('camera');video=createVideo([]);video.hide();
  $('#start').onclick=startCamera;$('#stop').onclick=stopCamera;
  $('#add-a').onclick=()=>addExample(0);$('#add-b').onclick=()=>addExample(1);
  $('#train').onclick=trainModel;$('#test').onclick=()=>{testing=!testing;generation++;buttons();if(testing)predict(generation);};
  $('#reset').onclick=()=>{stopCamera();location.reload();};window.addEventListener('pagehide',stopCamera);
}
function draw(){
  background('#efefec');
  if(running&&video.elt.readyState>=2){push();translate(width,0);scale(-1,1);image(video,0,0,width,height);pop();}
  else{fill('#777');noStroke();textSize(18);textAlign(CENTER,CENTER);text('Your camera preview',width/2,height/2);}
}
async function loadFeatures(){
  if(classifier)return;
  if(!loading)loading=(async()=>{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('MobileNet download timed out. Reset and retry.')),120000);features=ml5.featureExtractor('MobileNet',()=>{clearTimeout(timer);resolve();});features.ready?.catch(e=>{clearTimeout(timer);reject(e);});});
    classifier=features.classification(video,{numLabels:2});
  })().catch(e=>{loading=null;throw e;});await loading;
}
async function startCamera(){
  if(starting||running)return;starting=true;buttons();say('Requesting camera...');
  try{const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false});video.elt.srcObject=stream;video.elt.muted=true;video.elt.playsInline=true;await video.elt.play();running=true;
    const w=video.elt.videoWidth||640,h=video.elt.videoHeight||480;video.size(w,h);resizeCanvas(w,h);say('Loading MobileNet image features...');await loadFeatures();say('Ready. Add at least 10 varied examples to each label.');
  }catch(e){stopCamera();say(e.message+' Use HTTPS and allow camera access.');}finally{starting=false;buttons();}
}
function buttons(){
  $('#start').disabled=running||starting;$('#stop').disabled=!running||starting||training||busy;
  $('#add-a').disabled=$('#add-b').disabled=!classifier||!running||starting||busy||training||testing;
  $('#train').disabled=!running||starting||busy||training||testing||counts.some(n=>n<10);
  $('#test').disabled=!trained||!running||training||busy;$('#test').textContent=testing?'Pause testing':'Start testing';
  $('#label-a').disabled=$('#label-b').disabled=counts.some(n=>n>0);$('#reset').disabled=training||busy||starting;
}
async function addExample(index){
  const names=labels();if(!names[0]||!names[1]||names[0].toLowerCase()===names[1].toLowerCase()){say('Choose two different, nonempty labels.');return;}
  if(!running||busy||training||testing)return;busy=true;buttons();
  try{await classifier.addImage(names[index]);counts[index]++;trained=false;$('#count-a').textContent=counts[0];$('#count-b').textContent=counts[1];say('Examples: '+names[0]+' '+counts[0]+' / '+names[1]+' '+counts[1]+'.');$('#result').textContent='Train with your latest examples';$('#scores').replaceChildren();}
  catch(e){say('Capture failed: '+e.message);}finally{busy=false;buttons();}
}
function trainModel(){
  training=true;buttons();say('Training your classifier...');
  const fail=e=>{training=false;trained=false;say('Training failed: '+e.message);buttons();};
  try{const task=classifier.train(loss=>{if(loss!=null)say('Training / loss '+Number(loss).toFixed(4));else{training=false;trained=true;say('Training complete. Test examples it has not seen.');buttons();}});task?.catch(fail);}catch(e){fail(e);}
}
function predict(token){
  if(!testing||!running||token!==generation)return;
  classifier.classify((error,results)=>{
    if(!testing||!running||token!==generation)return;
    if(error||!results?.length){testing=false;say('Prediction failed. Try training again.');buttons();return;}
    const best=results.reduce((a,b)=>a.confidence>b.confidence?a:b);$('#result').textContent=best.label+' / '+Math.round(best.confidence*100)+'%';$('#scores').replaceChildren();
    labels().forEach(name=>{const score=results.find(r=>r.label===name)?.confidence||0,row=document.createElement('div'),label=document.createElement('span'),value=document.createElement('b'),track=document.createElement('div'),bar=document.createElement('i');row.className='score-row';label.textContent=name;value.textContent=Math.round(score*100)+'%';track.className='track';bar.style.width=score*100+'%';track.append(bar);row.append(label,value,track);$('#scores').append(row);});setTimeout(()=>predict(token),180);
  });
}
function stopCamera(){running=false;testing=false;generation++;video?.elt.srcObject?.getTracks().forEach(t=>t.stop());if(video)video.elt.srcObject=null;if($('#status')){say('Camera off. Examples remain until reset or reload.');buttons();}}
