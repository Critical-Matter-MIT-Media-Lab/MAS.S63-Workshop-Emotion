let faceapi;
let detections = [];

let video;
let canvas;

let serial;

function setup() {
  // sets up canvas
  canvas = createCanvas(480, 360);
  canvas.id("canvas");
  
  // sets up video display
  video = createCapture(VIDEO);
  video.id("video");
  video.size(width, height);
  
  // sets up face-api settings/options
  // landmarks: points on face, expressions: facial expression, descriptors: detailed facial characteristics
  // only accept expressions that are above the 95% threshold
  const faceOptions = {
    withLandmarks: true,
    withExpressions: true,
    withDescriptors: true,
    minConfidence: 0.5
  }
  
  faceapi = ml5.faceApi(video, faceOptions, faceReady);
  
  // outputs Serial data that will be sent to the Arduino
  serial = new p5.SerialPort(); // create the serial port object
  serial.open("/dev/cu.usbmodem1301"); // open the serial port
  serial.on('connected', serverConnected); // callback for when the connection is open
  serial.on('error', gotError); // callback for errors
}

function serverConnected() {
  console.log('connected to server.');
}

function gotError(theerror) {
  console.log(theerror);
}

// sends emotion as Serial data to the Arduino Serial Monitor
function sendEmotion(emotion) {
  serial.write(emotion + '\n'); 
}

// once ml5.js is finished setting up / connecting to the api, start detecting faces
function faceReady() {
  faceapi.detect(gotFaces);
}

// continuously detects faces 
function gotFaces(error, result) {
  if (error) {
    console.log(error);
    return;
  }
  
  detections = result;
  faceapi.detect(gotFaces);
}

// draws a box around each detected face, to show which person's emotion is being detected
function drawBoxes(detections){
  // if detections arr has at least 1 detected face, draws a box around each detected face
  if (detections.length > 0) {
    for (i=0; i < detections.length; i++){
      let {_x, _y, _width, _height} = detections[i].alignedRect._box;
      stroke(255);
      strokeWeight(1);
      noFill();
      rect(_x, _y, _width, _height);
    }
  }
}

// draws landmarks (major facial feature points) onto the detected faces
function drawLandmarks(detections){
  // if detections arr has at least 1 detected face, draws landmarks on each detected face
  if (detections.length > 0) {
    for (i=0; i < detections.length; i++){
      let points = detections[i].landmarks.positions;
      for (let j = 0; j < points.length; j++) {
        stroke(44, 169, 225);
        strokeWeight(3);
        point(points[j]._x, points[j]._y);
      }
    }
  }
}

// draws text that displays the percentage likelihood / measured of each emotion (happy, sad, surprised)
function drawExpressions(detections, x, y, textYSpace) {
  if (detections.length > 0) {
    let {happy, sad, surprised, neutral, angry, fearful, disgusted} = detections[0].expressions;
    textFont('Helvetica Neue');
    textSize(14);
    strokeWeight(1);
    stroke(255);
    
    text("neutral:       "+ nf(neutral*100,2,2)+"%", x, y+textYSpace);
    text("happy:       "+ nf(happy*100,2,2)+"%", x, y+textYSpace*3);
    text("sad:           "+ nf(sad*100, 2, 2)+"%", x, y+textYSpace*5);
    text("surprised:  " + nf(surprised*100, 2, 2)+"%", x, y+textYSpace*7);
    text("angry:  " + nf(angry*100, 2, 2)+"%", x, y+textYSpace*9);
    text("fearful:  " + nf(fearful*100, 2, 2)+"%", x, y+textYSpace*11);
    text("disgusted:  " + nf(disgusted*100, 2, 2)+"%", x, y+textYSpace*13);

  }
  
  else{
    text("neutral: ", x, y + textYSpace);
    text("happy: ", x, y + textYSpace*3);
    text("sad: ", x, y + textYSpace*5);
    text("surprised: ", x, y + textYSpace*7);
    text("angry:  ", x, y + textYSpace*9);
    text("fearful:  ", x, y + textYSpace*11);
    text("disgusted:  ", x, y + textYSpace*13);
  }
  
}

// draws everything on the page
function draw() {
  image(video, 0, 0, width, height);
  drawBoxes(detections);
  drawLandmarks(detections);
  drawExpressions(detections, 20, 250, 5)
  
  
  if (detections.length > 0) {
    // finds the most prominent emotion in the detections arr list
    let detectedEmotion = detections[0].expressions.asSortedArray()[0].expression; 
    // sends the most prominent emotion to Arduino as Serial output data
    sendEmotion(detectedEmotion);
  }
}
