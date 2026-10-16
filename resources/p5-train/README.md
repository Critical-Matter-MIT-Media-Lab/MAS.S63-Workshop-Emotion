# Train + test in p5.js

Open [the training sketch](https://editor.p5js.org/jxke/sketches/_APDBCYwRn), or serve this folder over localhost/HTTPS. Paste the complete sketch.js into a p5.js 1.x project. It includes its interface, styles and ml5 0.12.2 loader; no shared workshop files are required.

1. Start the camera and wait for MobileNet.
2. Define two labels. Add at least ten varied examples per class, keeping class sizes similar.
3. Train, then test on new poses and backgrounds.
4. Pause to collect more and retrain. Stopping and restarting the camera preserves examples. Reset or reload clears the experiment.

The full camera frame contributes, including background and clothing. MobileNet supplies pretrained features; your examples train a classifier. Labels do not establish internal feelings. Images stay in browser memory. This example is for training and testing in p5.js; it has no TouchDesigner connection.
