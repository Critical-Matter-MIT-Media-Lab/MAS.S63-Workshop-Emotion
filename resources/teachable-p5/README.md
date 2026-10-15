# Teachable Machine → p5.js

1. Open [Teachable Machine](https://teachablemachine.withgoogle.com/train/image). Choose Image Project → Standard image model.
2. Name your classes. Include examples of the empty room, a neutral person, and the expression you want to distinguish. Collect varied, balanced examples.
3. Train the model. Test new examples and change backgrounds. Add examples and retrain when needed.
4. Choose Export Model → Tensorflow.js → Upload my model. Copy its model URL.
5. Paste the URL into the workshop demo and press Load model. In the presentation this replaces predictions on the existing camera feed. In the standalone demo, press Start camera.

## Build your own sketch

[Read and copy the complete starter](starter.html), or follow the [ML5 Model Loader Sketch guide](minimal-sketch.md). The full JavaScript is also in [starter-sketch.js](starter-sketch.js). Paste it into a new p5 editor sketch.js and replace the quoted value of const MODEL_URL near the top. The canvas shows the full webcam at 640 × 480, adapting to the actual camera aspect ratio. Only model inference uses a separate square crop. It loads the TensorFlow.js and Teachable Machine libraries automatically; no additional script tags are required. For local use, open minimal-index.html through a localhost server.

The live demo uses p5.js 1.11.3, TensorFlow.js 1.3.1 and @teachablemachine/image 0.8.3. The model provides its own class names. Camera frames stay in memory; there are no expression counters or recordings. Only the model URL is remembered for the current browser session.

The pretrained expression example is based on [Jake's p5.js sketch](https://editor.p5js.org/jxke/sketches/AM8KwbKvK). That sketch uses ml5.js; the Teachable Machine starter above uses the image model API directly.
