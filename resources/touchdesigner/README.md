# Minimal TouchDesigner receiver

This is a small source-based replacement for the multi-mode project at `C:\Users\Jake\Documents\GitHub\ml5-touchdesigner`. It receives only expression scores or your two trained labels. No FaceMesh, eye tracking, Arduino, build tools, embedded browser, or additional Python packages.

## Setup (once)

1. Open a blank TouchDesigner project with `/project1`.
2. Open `setup_receiver.py` in a text editor. Change `RESOURCE_DIR` to your downloaded `resources/touchdesigner` folder. Use forward slashes on Windows.
3. In TouchDesigner's Textport (Alt+T), run `exec(open('C:/your-path/resources/touchdesigner/setup_receiver.py', encoding='utf-8').read())`.
4. Enter `/project1/affective_sensing`. The Web Server DAT `receiver` listens on port **9981** and uses `receiver_callbacks`. Keep one browser connected at a time.
5. Serve the downloaded workshop directory with `python -m http.server 8000 --bind 127.0.0.1`. Open either p5 example at `http://localhost:8000/resources/p5-train/` or `http://localhost:8000/resources/p5-expression/`. Start the camera, open “Send values to TouchDesigner,” and press **Connect to TouchDesigner**.
6. Watch the `values` table and `label` Text DAT update. For the training example, collect samples, train, and start testing first.

Setup creates a new Base COMP and refuses to replace an existing one. Save your project after setup. Close the receiver's Active toggle if port 9981 is already used by the full ml5-touchdesigner project. This minimal receiver is intended for a local workshop machine.

## Turn the table into channels

Create a **DAT to CHOP** inside the Base COMP. Set its **DAT** parameter to `values`, **Output** to **Channel per Row**, **First Row** to **Names**, and **First Column** to **Names**. Connect a Null CHOP named `OUT` to keep a stable output.

For a simple visual, create a Constant TOP. Drag `happy` (expression example) or `classA` (your trained model) from the CHOP onto its red color parameter and choose **CHOP Reference**. The image responds to the score.

`classA` and `classB` always correspond to the first and second labels in the training page. `confidence` is the largest model score, `hasFace` is only used by the expression example, and `active` is only used by the custom classifier. Missing channels and stopped predictions reset to zero. Disconnecting clears the table. The label remains text in `label`.

If the browser disconnects, reconnect manually. Use the downloaded page on **localhost**: a hosted HTTPS page cannot open an insecure local WebSocket. The camera and ML run in your browser, while only labels and numeric scores reach TouchDesigner.

## Test without a camera

Open the browser's developer console on either local example after connecting and run:

```js
sendToTouchDesigner({classA: 0.8, classB: 0.2, confidence: 0.8, active: 1}, 'test A');
```

The `values` table should show `classA = 0.8`, `classB = 0.2`, `confidence = 0.8`, and `active = 1`. Disconnect and confirm the values return to zero.

The setup and callbacks are editable Python source. A packaged `.tox` is not included. The full original project remains available in the separate ml5-touchdesigner repository.
