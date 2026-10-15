# Face mesh and photo UV exercise

Serve the workshop folder on localhost and open this folder's index.html, or use the face-mesh slide. Rotate the canonical face by dragging and zoom with the mouse wheel. Start the camera and take a front-facing picture, or select an image file. Photos remain in browser memory. A captured photo stops the camera automatically.

MediaPipe Face Landmarker detects facial landmarks in the image. The first 468 landmarks become vertices of a triangle mesh. Their image coordinates become UV coordinates, so the captured photograph maps onto that geometry. The canonical topology has 898 triangles.

Use smile, jaw and brow controls to deform the mesh. They are illustrative geometric edits, not trained emotional states. Re-read expression sends a front-facing render, without wireframe lines, through the workshop's expression classifier. Results are actual model scores. A large edit can cause face detection to fail, which the interface reports. The classifier reads pixels, while the landmark model supplies a separate geometric representation.

The deck preloads and shares the expression model. The standalone lab creates its own hidden expression page. Only one webcam runs at a time in the deck. Start controls always require a deliberate click.

Dependencies: Three.js 0.180.0, MediaPipe Tasks Vision 0.10.21, the bundled Face Landmarker model, and the original expression-enabled ml5 build. The first two libraries and the MediaPipe WebAssembly runtime load from jsDelivr. A network connection is required.

MediaPipe canonical geometry: https://github.com/google-ai-edge/mediapipe/tree/master/mediapipe/modules/face_geometry/data

Face Landmarker guide: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js

MediaPipe data and model are Apache 2.0 licensed. See MEDIAPIPE-LICENSE. Three.js is MIT licensed: https://github.com/mrdoob/three.js/blob/dev/LICENSE
