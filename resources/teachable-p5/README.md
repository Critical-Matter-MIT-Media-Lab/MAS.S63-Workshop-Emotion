# Teachable Machine to p5.js

## Train an image model

1. Open https://teachablemachine.withgoogle.com/train/image on a desktop browser and select **Standard image model** if prompted.
2. Name your classes. Start with **neutral** and one expression you want to perform. Add another class when the first pair works.
3. Record webcam examples for each class. Vary your position, pose, and lighting. Keep sample counts similar. Do not include your later test examples in training.
4. Press **Train Model**. Keep the tab open while training.
5. In **Preview**, test new examples. Try relaxing between expressions, turning sideways, or changing the background. Add varied examples and retrain if needed.
6. Choose **Export Model**, then **Tensorflow.js**. Choose **Upload my model** to get a shareable model URL. Uploading publishes model files at that URL, so choose this deliberately. For private local files, choose Download my model instead and use the official `tmImage.loadFromFiles` API.
7. Copy the URL, for example `https://teachablemachine.withgoogle.com/models/YOUR_ID/`.

## Run it on the slides

On the **Your model, live in p5.js** slide, paste the URL and press **Load model**. Press **Start camera + log** when ready. Choose your neutral/background label in the re-arm selector. Labels and counts come from your model, not a hardcoded list. There is no supplied trained participant model or fake live result.

The p5 canvas mirrors and crops the camera to a square to match Teachable Machine. The model reads only that image; prediction labels and the counter sit outside the image. The log counts a label after a score of at least 60% for 0.5 seconds. Leave it for 0.4 seconds before repeating. A sustained label counts once. Neutral/background can re-arm the counter without adding a count.

Camera and log continue across slide changes until you press Stop. Use the Stop button inside the active example to end camera access. Logs survive a refresh in the same browser tab. **Download CSV** exports timestamps, labels and model scores. **Reset log** clears the current model's log. Images are never recorded by this sketch. Models have separate logs.

## Put it in your own p5.js project

For the shortest editable version, use `starter-sketch.js` as your p5 editor sketch. In `index.html`, load these libraries in this order before the sketch:

```html
<script src="https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.3/dist/teachablemachine-image.min.js"></script>
<script src="sketch.js"></script>
```

Replace `MODEL_URL` with your exported URL. The three exported model files are `model.json`, `metadata.json`, and the `.bin` weights file referenced by model.json. Keep them together when hosting downloaded models. The sample's `best.className` gives the winning label and `best.probability` its model score. Use either to control a p5 drawing, sound, or interaction. Keep training, test data, and your interpretation of a label distinct.

For the full editable live demo with logging, open `index.html` from the workshop server or copy this folder together with `../shared`. Run from HTTPS or localhost so camera access is available. It loads the official Teachable Machine image library and TensorFlow.js, rather than mixing that runtime with the older ml5 expression build. These runtimes stay in separate iframe pages in the deck.

The optional TouchDesigner bridge remains available when running the downloaded page on localhost. The first two model classes map to `classA` and `classB`. This workshop sequence teaches p5.js first.

Official API reference: https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image
