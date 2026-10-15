# Face mesh and photo UV exercise

Open the face-mesh slide, or serve the workshop on localhost and open this folder’s `index.html`. Drag to rotate and scroll to zoom. Take a frontal picture or select a photo. Images remain in browser memory; taking a picture stops the camera.

MediaPipe detects 468 facial landmarks. These become mesh vertices, and their image coordinates map the photograph onto the face. The eye appearance comes from that photograph. Inner-lip triangles are removed for an open mouth aperture, with no added mouth backing, generated teeth or procedural eyeballs.

## Controls and emotion buttons

Twenty-one controls are grouped into Mouth, Brows, Eyes, Nose and Reference tabs. They adjust mouth corners, jaw, width, lip pressure, pucker, brows, eyelids, cheeks, nose, lips, wrinkles, sneer, chin, source-pose normalization, perspective, skin detail and lighting. Source normalization blends the captured landmarks toward an aligned neutral reference. Skin normalization locally blends a blurred version of the same photo.

An emotion button first applies a fixed geometric preset. The unchanged pretrained classifier then reads a frontal rendering. If the target score is weak, automatic fitting adjusts the controls, tests combinations including deterministic pseudo-random variations, and keeps the face-detected candidate with the highest actual target score. This is a guided search over slider values. The classifier reads images; it does not generate the mesh or convert emotion names into facial movements.

The search aims for 90%; results below 80% or with a different winning label are reported as unsuccessful. Difficult fits may take tens of seconds. Select another label to cancel. Fitted poses are reused for the current photo and cleared on reset or a new photo. Manual controls and **Read model** remain available.

The **Model input** thumbnail shows the frontal image sent to the classifier. Scores and model weights are unchanged. Fitting optimizes agreement with that classifier and does not establish someone’s emotional state. Photo texture, lighting and synthetic deformations can affect recognition. Historical validation results from the earlier rig used artificial surfaces and do not describe this revision.

## Dependencies

The original expression-enabled ml5 teaching build, p5.js and FaceAPI weights are bundled locally. Model provenance is in `../p5-expression/models/SOURCE.md`; runtime licenses are in `../shared/vendor/`. The deck preloads and shares the model; standalone mode loads a hidden expression page.

Three.js 0.180.0 and MediaPipe Tasks Vision 0.10.21 with its WebAssembly runtime load from jsDelivr. A network connection is required. The Face Landmarker model is bundled.

- [MediaPipe geometry](https://github.com/google-ai-edge/mediapipe/tree/master/mediapipe/modules/face_geometry/data)
- [Face Landmarker guide](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)
- [Three.js MIT license](https://github.com/mrdoob/three.js/blob/dev/LICENSE)

MediaPipe data and model use Apache 2.0; see `MEDIAPIPE-LICENSE`.
