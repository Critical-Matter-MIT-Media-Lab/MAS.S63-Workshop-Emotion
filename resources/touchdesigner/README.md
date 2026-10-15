# ML5 + TouchDesigner workshop project

Open **[ML5 TouchDesigner.toe](ML5%20TouchDesigner.toe)** in TouchDesigner. This is Jake’s complete original project from [Jxke/ml5-touchdesigner](https://github.com/Jxke/ml5-touchdesigner), including browser source, bundled libraries, local model weights, and TouchDesigner support scripts.

Download and extract the complete workshop ZIP before opening the project. Keep the folder structure together; do not download only the Python scripts.

## Included

- ML5 TouchDesigner.toe — the original working file, preserved byte for byte.
- src/ — browser webcam, expression, face mesh and eye-tracking source, bundled JavaScript libraries and model weights.
- td_scripts/ml5_emotion/ — original TouchDesigner callbacks, parsing and setup scripts.
- index.html, package files and vite.config.js — browser application and build setup.
- LICENSE and [original README](UPSTREAM-README.md).

Follow the [original setup guide](td_scripts/ml5_emotion/README_TouchDesigner_Setup.md) and [upstream README](UPSTREAM-README.md). The project uses browser ML with a local WebSocket connection to TouchDesigner. This workshop copy has not been rebuilt or modified.

The root setup_minimal.py and callbacks.py files are an optional smaller receiver exercise from the earlier kit. They are not the main project. Start with the .toe above.
