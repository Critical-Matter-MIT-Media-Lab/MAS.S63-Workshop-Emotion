# Face mesh and photo UV exercise

Serve the workshop folder on localhost and open this folder's index.html, or use the face-mesh slide. Rotate the canonical face by dragging and zoom with the mouse wheel. Start the camera and take a front-facing picture, or select an image file. Photos remain in browser memory. A captured photo stops the camera automatically.

MediaPipe Face Landmarker detects facial landmarks in the image. The first 468 landmarks become vertices of a triangle mesh. Their image coordinates become UV coordinates, so the captured photograph maps onto that geometry. The canonical topology has 898 triangles.

Use mouth corners, jaw, brow lift, eyelid aperture, brow furrow, and nose / upper-lip controls to deform the mesh. Presets also coordinate cheek lift, lip tension, inner-brow motion, and mouth width. They are illustrative geometric edits, not trained emotional states. Re-read expression sends a front-facing render, without wireframe lines, through the workshop's expression classifier. Results are actual model scores. A large edit can cause face detection to fail, which the interface reports. The classifier reads pixels, while the landmark model supplies a separate geometric representation.

The deck preloads and shares the expression model. The standalone lab creates its own hidden expression page. Only one webcam runs at a time in the deck. Start controls always require a deliberate click.

Dependencies: Three.js 0.180.0, MediaPipe Tasks Vision 0.10.21, the bundled Face Landmarker model, and the original expression-enabled ml5 build. The first two libraries and the MediaPipe WebAssembly runtime load from jsDelivr. A network connection is required.

MediaPipe canonical geometry: https://github.com/google-ai-edge/mediapipe/tree/master/mediapipe/modules/face_geometry/data

Face Landmarker guide: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js

MediaPipe data and model are Apache 2.0 licensed. See MEDIAPIPE-LICENSE. Three.js is MIT licensed: https://github.com/mrdoob/three.js/blob/dev/LICENSE

## Expression presets and mouth geometry

The buttons use labels exported by the preloaded expression classifier. They apply approximate geometric presets, not inversions learned from the classifier. With a photo mapped, a preset requests an actual classifier reading of the frontal rendering. Fine adjustments remain available. The 18 triangles covering the inner lips are removed, leaving a mouth aperture with a recessed interior following its boundary. A small upper-teeth surface appears for open smiles; the former protruding sphere is removed.

## Compare a target with the measured prediction

The label buttons choose approximate shapes. They do not assign the classifier result. The model-input thumbnail shows the exact frontal image sent to the classifier, with the wire overlay removed. Scores are unmodified model outputs.

Fit target tests preset strengths and small changes to each of the six controls. It retains changes only when they increase the selected label's actual score for this photograph. This optimizes agreement with this classifier, not emotional truth. It may still classify a target as neutral or another label.

A photograph retains its original mouth appearance, eye texture, and lighting as the geometry moves. Consequently a smiling photograph can still read as happy after an angry preset, and a neutral photograph can remain neutral after a small edit. Start from a clear, evenly lit frontal photo. The classifier reads the rendered pixels; it does not know which preset was selected and was not trained specifically on these synthetic mesh edits.

The lab fits inside its slide, with compact controls and no internal page scrolling at the supported desktop presentation sizes.
