# Train + test in p5.js

Open [the training sketch](https://editor.p5js.org/jxke/sketches/_APDBCYwRn), or serve this folder over localhost/HTTPS. Use the three matching files in a p5.js 1.x project: index.html defines the interface and imports libraries, style.css handles appearance, and sketch.js handles the camera, training and predictions. No shared workshop files are required. [Copy the project files](copy.html).

1. Start the camera and wait for MobileNet.
2. Define two labels. Add at least ten varied examples per class, keeping class sizes similar.
3. Train, then test on new poses and backgrounds.
4. Pause to collect more and retrain. Stopping and restarting the camera preserves examples. Reset or reload clears the experiment.

The full camera frame contributes, including background and clothing. MobileNet supplies pretrained features; your examples train a classifier. Labels do not establish internal feelings. Images stay in browser memory. This example is for training and testing in p5.js; it has no TouchDesigner connection.
