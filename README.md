# Affective Sensing

MAS.S63 / Fall 2026 / Critical Matter: Body, Emotion and Material Intelligence  
Workshop by Jake Tan

A workshop about defining emotion, training a model, and questioning what it learns.

## Presentation

The workshop presentation is available at https://app.jxke.co/affective-sensing/. Its editable web source lives in the JXKE applications repository.

1. Affective Sensing
2. How Do Machines see Emotion?
3. Emotion as a suitcase term
4. How training works
5. Interactive face mesh and photo UV exercise
6. Understanding emotion through machines
7. P5JS + ML5.js Integration, with live face tracking
8. Define classes in Teachable Machine
9. Collect examples, train and test
10. Export the model
11. Integrate it into p5.js
12. Run your own model live
13. Workshop resources

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

Camera images, photo textures, and captured comparison examples stay in browser memory. Refreshing clears them. No expression entries are recorded. Stop the camera when done. The expression demo can optionally send numeric scores and labels to the local TouchDesigner receiver.

## 1. Observe a pretrained model

Start the camera in `p5-expression`. FaceAPI returns seven expression scores. Try changing your pose, lighting, or expression. Move out of frame and observe the scores clear. This is inference with an already-trained model.

Simplified from [Jake’s original p5.js sketch](https://editor.p5js.org/jxke/sketches/AM8KwbKvK): removes serial/Arduino, face descriptors and landmark drawing. The workshop version adds a tracked face square with a live expression label.

To edit in the p5 editor, create a new sketch and upload `sketch.js`, `index.html`, its `presenter.css`, and the shared `bridge.js` and `live-ui.js`. Put them in the sketch root and change all `../shared/` references in the HTML to `./`. The sketches use p5 global mode and are also editable directly here.

## 2. Teachable Machine to p5.js

Follow [the Teachable Machine guide](resources/teachable-p5/README.md). The [complete minimal sketch](resources/teachable-p5/minimal-sketch.md) loads its model libraries automatically and can be copied directly into sketch.js in the p5 editor.

The presentation keeps one camera feed alive. It is large on slides 7 and 12, and moves to the bottom-left corner on other slides while running. Loading your Teachable Machine model replaces the predictions on that same feed. The face square continues to track geometry while your model supplies the labels. Select the pretrained model button to switch back.

Slide 9 offers three comparison captures: empty room, person at rest, and person performing an expression. Each capture has a three-second countdown. Images remain in memory on the page.

The GitHub QR code appears beside the discussion slide resources, on the final slide and in the resource panel. Its target is https://github.com/Critical-Matter-MIT-Media-Lab/MAS.S63-Workshop-Emotion.

## Face mesh exercise

Open the face-mesh slide or `resources/face-lab/index.html`. Drag to rotate the canonical 468-vertex face, or start the camera and take a picture. You can also select an image file. MediaPipe finds the landmarks, and the photograph becomes the UV texture of the resulting 3D mesh. Images stay in browser memory.

Choose one of the expression classifier’s own labels to apply an approximate shape preset, or fine-tune the mouth, jaw, brow, eyelid, furrow and nose / upper-lip controls. The inner-lip triangles are removed to form an actual mouth opening with a recessed interior. The Model input thumbnail shows the image passed to the classifier. Fit target tests shape variations against actual scores, without replacing the classifier output with the selected label. Press **Re-read expression** to pass a stable front view of the textured mesh through the expression classifier. The displayed scores are actual model outputs. A large deformation can result in no detected face. The sliders illustrate changes in appearance and do not retrain the model or establish someone's internal feelings.

The mesh is a separate geometric representation. The expression classifier reads the rendered pixels. The slide deck shares a preloaded ml5 expression runtime with this exercise. The standalone lab loads its own hidden expression runtime.

Canonical geometry and the landmark model are from Google's MediaPipe project. See the included `MEDIAPIPE-LICENSE` and [face lab guide](resources/face-lab/README.md).

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

Follow [the minimal receiver guide](resources/touchdesigner/README.md). It creates an isolated receiver from a short Python setup script and callbacks. The pretrained expression demo and optional ml5 training sketch can send labels and scores to it. Add a DAT to CHOP and use a score to control a color.

This follows the browser-to-WebSocket-to-DAT approach in Jake’s `ml5-touchdesigner` project, with one mode and a small numeric table. It does not modify or require that larger project. Source scripts are included instead of an unverified `.tox` export.

## Reading and source references

- Marvin Minsky, *The Emotion Machine* (2006). The suitcase-term framing on slide 3 is a workshop paraphrase, not a direct quotation. [Publisher](https://www.simonandschuster.com/books/The-Emotion-Machine/Marvin-Minsky/9780743276641).
- [Original p5 sketch](https://editor.p5js.org/jxke/sketches/AM8KwbKvK).
- [Official Teachable Machine image API](https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image).
- [Official ml5 feature-extractor example](https://github.com/ml5js/ml5-examples/tree/release/p5js/FeatureExtractor/FeatureExtractor_Image_Classification).
- [ml5.js](https://github.com/ml5js/ml5-library) and [p5.js](https://p5js.org/).
- [TouchDesigner Web Server DAT](https://docs.derivative.ca/Web_Server_DAT) and [DAT to CHOP](https://docs.derivative.ca/DAT_to_CHOP).

The slides use IDEP Phase 0's monochrome presentation vocabulary. All workshop files are editable HTML, JavaScript, CSS, and Python. They contain no recordings, example faces, or saved participant data.
