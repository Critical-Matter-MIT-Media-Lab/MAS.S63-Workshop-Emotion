// Train and test two image labels in p5.js 1.x. No other workshop files needed.
let video, features, classifier, loading;
let counts=[0,0], running=false, starting=false, busy=false, training=false, testing=false, trained=false, generation=0;
const $=s=>document.querySelector('#train-app '+s);
const say=t=>$('#status').textContent=t;
const labels=()=>[$('#label-a').value.trim(),$('#label-b').value.trim()];
function setup(){
  pixelDensity(1);frameRate(24);
  const style=document.createElement('style');style.textContent=TRAIN_STYLE;document.head.append(style);
  createDiv().id('train-app').html(`<header><small>AFFECTIVE SENSING / P5.JS + ML5.JS</small><h1>Train. Test. Question.</h1><p>Name two visible patterns. Collect examples, train a model, then test something new.</p></header>
  <div class="workspace"><section><div id="camera"></div><div class="actions"><button id="start">Start camera</button><button id="stop" disabled>Stop camera</button></div><p id="status" role="status">Start the camera when you are ready.</p><div class="card"><small>MODEL PREDICTION</small><strong id="result">No prediction yet</strong><div id="scores"></div></div></section>
  <aside><section class="card"><small>01 / COLLECT</small><h2>Define your labels</h2><p>Start with a neutral state and one expression, gesture or object.</p>
  <div class="class-card"><label for="label-a">Label A</label><input id="label-a" value="neutral" maxlength="40"><button id="add-a" disabled>Add example A <b id="count-a">0</b></button></div>
  <div class="class-card"><label for="label-b">Label B</label><input id="label-b" value="smiling" maxlength="40"><button id="add-b" disabled>Add example B <b id="count-b">0</b></button></div>
  <p class="note">One click = one example. Add at least 10 per label. Vary pose and distance; keep class sizes similar. Labels lock after the first capture.</p></section>
  <section class="card"><small>02 / TRAIN + TEST</small><h2>Try new examples</h2><div class="actions"><button id="train" disabled>Train model</button><button id="test" disabled>Start testing</button></div><button id="reset">Reset experiment</button></section></aside></div>
  <footer><h2>What did the model actually learn?</h2><p>Change the background. Try another person. Is it learning your pattern, or something else in the image?</p><p class="note">MobileNet supplies pretrained features; your examples train a classifier. The whole image contributes. Labels do not establish internal feelings. Images stay in this browser. Reset or reload clears the experiment.</p></footer>`);
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
    if(!window.ml5?.featureExtractor)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/ml5@0.12.2/dist/ml5.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Could not load ml5. Check your connection.'));document.head.append(s);});
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
const TRAIN_STYLE=`
html,body{margin:0;padding:0;background:#f4f4f0;color:#171717;font:14px/1.5 Arial,sans-serif;color-scheme:light}#train-app,#train-app *{box-sizing:border-box}#train-app{max-width:1100px;margin:auto;padding:28px clamp(16px,4vw,44px)}
#train-app header{border-bottom:1px solid #ccc;padding-bottom:20px;margin-bottom:24px}#train-app small{font-size:10px;font-weight:700;letter-spacing:.1em;color:#666}#train-app h1{font-size:clamp(30px,5vw,54px);line-height:1;letter-spacing:-.055em;margin:15px 0}#train-app h2{font-size:21px;line-height:1.15;letter-spacing:-.035em;margin:10px 0}#train-app p{margin:10px 0}
.workspace{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.85fr);gap:24px;align-items:start}#train-app #camera{background:#efefec;border:1px solid #ddd}#train-app canvas{display:block;width:100%!important;height:auto!important}#train-app video{display:none!important}
#train-app button,#train-app input{font:inherit;color:#171717;background:white;border:1px solid #bbb;border-radius:5px;padding:9px 12px}#train-app button{cursor:pointer}#train-app button:hover:enabled{background:#eee;border-color:#171717}#train-app button:disabled{opacity:.4;cursor:default}#train-app :focus-visible{outline:2px solid #3159e6;outline-offset:3px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}#train-app #status{font-size:12px;min-height:36px;color:#555}.card{background:white;border:1px solid #ddd;border-radius:8px;padding:18px;margin-bottom:16px}.card>p{font-size:12px;color:#555}
.class-card{border-top:1px solid #eee;padding-top:12px;margin-top:14px;display:grid;grid-template-columns:1fr auto;gap:8px}.class-card label{grid-column:1/-1;font-size:11px;font-weight:bold}.class-card input{min-width:0;width:100%}.class-card button{font-size:12px!important}.class-card b{margin-left:5px;font-variant-numeric:tabular-nums}
.track{background:#eee;height:4px;grid-column:1/-1;overflow:hidden;border-radius:5px}.track i{display:block;background:#3159e6;height:100%;width:0;transition:width .2s}#train-app #result{display:block;font-size:clamp(23px,3vw,36px);letter-spacing:-.04em;overflow-wrap:anywhere;margin:8px 0 14px}.score-row{display:grid;grid-template-columns:1fr auto;gap:5px;font-size:12px;margin:12px 0}#train-app #reset{font-size:11px;padding:0;background:none;border:0;text-decoration:underline}.note{font-size:11px!important;color:#666;line-height:1.5}#train-app footer{border-top:1px solid #ccc;padding-top:16px;margin-top:20px;max-width:760px}#train-app footer h2{font-size:18px}@media(max-width:650px){.workspace{grid-template-columns:1fr}#train-app{padding:20px 14px}}@media(prefers-reduced-motion:reduce){.track i{transition:none}}`;
