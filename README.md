# Affective Sensing

MAS.S63 / Fall 2026 / Critical Matter: Body, Emotion and Material Intelligence  
Workshop by Jake Tan

A workshop about defining emotion, training a model, and questioning what it learns.

## Presentation

The workshop presentation is available at https://app.jxke.co/affective-sensing/. Its editable web source lives in the JXKE applications repository.

1. Affective Sensing
2. Workshop overview: train your own model, then test it
3. Emotion as a suitcase term, and the thinking, memory, pleasure and pain it contains
4. Understanding these ideas through how machines understand emotions
5. Live p5.js / ml5.js expression viewer and session counter
6. Define classes in Teachable Machine
7. Collect examples, train, and test
8. Export a TensorFlow.js model and copy its URL
9. Integrate the model into p5.js
10. Run your own model live in p5.js, with a session log
11. Workshop resources and GitHub QR code

Use Left/Right arrows, Home/End, or the on-screen controls. Press F for fullscreen. The resource panel contains live examples and a download of this kit. Printing produces the full presentation.

## Start here

Install Python 3 if needed. From this repository folder run:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open:

- **Observe:** http://localhost:8000/resources/p5-expression/
- **Teachable Machine in p5.js:** http://localhost:8000/resources/teachable-p5/
- **Optional ml5 training exercise:** http://localhost:8000/resources/p5-train/

Use Chrome or Edge and explicitly allow the camera. Model downloads need internet access. Both examples pin p5.js **1.11.3**. The trainable example pins ml5.js **0.12.2**. The expression example uses the same expression-enabled ml5 teaching build (`ml5js/Intro-ML-Arts-IMA@ml5-build-10-7-19`) as Jake’s original sketch. The standard ml5 0.12.2 FaceAPI wrapper omits expression support, so these two examples intentionally use different builds. Libraries load from jsDelivr. Do not replace it with latest without migrating both sketches. No npm installation is required.

Camera images and training examples stay in browser memory. Refreshing clears the optional ml5 training exercise. The live event log keeps only labels, timestamps and scores in sessionStorage for the current tab. It survives refreshes and slide changes until reset or the browser session ends. Download CSV to keep a copy. Only numeric scores and a label are sent if you explicitly connect to the local TouchDesigner receiver. Stop the camera when done.

## 1. Observe a pretrained model

Start the camera in `p5-expression`. FaceAPI returns seven expression scores. Try changing your pose, lighting, or expression. Move out of frame and observe the scores clear. This is inference with an already-trained model.

Simplified from [Jake’s original p5.js sketch](https://editor.p5js.org/jxke/sketches/AM8KwbKvK): removes serial/Arduino, face descriptors, landmarks, and overlay drawing, retaining the camera, expression scores, and optional TouchDesigner connection.

To edit in the p5 editor, create a new sketch and upload `sketch.js`, `index.html`, and the shared `style.css`, `bridge.js`, `expression-log.js` and `live-ui.js`. Put them in the sketch root and change all `../shared/` references in the HTML to `./`. The sketches use p5 global mode and are also editable directly here.

## 2. Teachable Machine to p5.js

Follow [the Teachable Machine guide](resources/teachable-p5/README.md). It walks through naming image classes, collecting examples, training, testing and exporting a model, then loading that model into p5.js. `starter-sketch.js` is the minimal editable integration. The full example at `resources/teachable-p5/index.html` also includes logging.

The pretrained expression demo and your model demo both run inside the slides. Start the camera explicitly. The active camera and session counter continue across slides, and a Stop control remains in the deck footer. Starting the other demo stops the first camera. Each model has a separate session log.

A label must reach a score of at least 75% for 0.8 seconds to count. It counts once while held. Leave it for 0.6 seconds before repeating. Neutral does not count in the pretrained demo. Choose the background/neutral class in your custom model's selector to exclude it. These are counted model detections, not verified internal emotions. A model can misclassify you or another visible person.

The GitHub QR code appears on the final slide and below the workshop resource links. Its target is https://github.com/Critical-Matter-MIT-Media-Lab/MAS.S63-Workshop-Emotion.

## Optional: train inside ml5.js

1. Open `p5-train` and start the camera.
2. Define two different labels. The defaults are `calm` and `energized`. Decide together what visible evidence should support each label.
3. Click **Add example A** at least 10 times, varying your pose. Do the same for B. Keep examples balanced. Each click captures one frame. Labels lock after the first capture.
4. Press **Train model** and wait for completion.
5. Press **Start testing**. Try new poses and backgrounds, or ask a consenting partner to test.
6. Pause, add examples, and train again. Use **Reset experiment** to clear examples or change labels. After stopping the camera, reset before starting a fresh experiment.

MobileNet supplies pretrained image features. You train a new classifier on top of those features, a process called transfer learning. The full camera frame contributes to the prediction, including background and clothing. The model is learning your visual examples, not directly measuring internal feelings.

Discussion: What exactly did you label? Which examples failed? Did your background become a shortcut? Would you trust this model with someone else? What would it mean to label a biological state or an unconscious mental model?

## 3. TouchDesigner

Follow [the minimal receiver guide](resources/touchdesigner/README.md). It creates an isolated receiver from a short Python setup script and callbacks. Both p5 examples can send labels and scores to it. Add a DAT to CHOP and use a score to control a color.

This follows the browser-to-WebSocket-to-DAT approach in Jake’s `ml5-touchdesigner` project, with one mode and a small numeric table. It does not modify or require that larger project. Source scripts are included instead of an unverified `.tox` export.

## Reading and source references

- Marvin Minsky, *The Emotion Machine* (2006). The suitcase-term framing on slide 3 is a workshop paraphrase, not a direct quotation. [Publisher](https://www.simonandschuster.com/books/The-Emotion-Machine/Marvin-Minsky/9780743276641).
- [Original p5 sketch](https://editor.p5js.org/jxke/sketches/AM8KwbKvK).
- [Official Teachable Machine image API](https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image).
- [Official ml5 feature-extractor example](https://github.com/ml5js/ml5-examples/tree/release/p5js/FeatureExtractor/FeatureExtractor_Image_Classification).
- [ml5.js](https://github.com/ml5js/ml5-library) and [p5.js](https://p5js.org/).
- [TouchDesigner Web Server DAT](https://docs.derivative.ca/Web_Server_DAT) and [DAT to CHOP](https://docs.derivative.ca/DAT_to_CHOP).

The slides use IDEP Phase 0's monochrome presentation vocabulary. All workshop files are editable HTML, JavaScript, CSS, and Python. They contain no recordings, example faces, or saved participant data.
