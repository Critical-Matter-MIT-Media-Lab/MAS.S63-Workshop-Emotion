# Mesh fitting validation

15 October 2026. Headless Microsoft Edge, 1299 × 1012 presentation viewport. Five external QA portraits; fixtures are not distributed in this workshop. Each label button was selected after mapping each photo. Results below are rounded, actual classifier outputs after automatic fitting, using the unchanged pretrained model. All 35 cases retained face detection, placed the requested label first, and exceeded 80%.

| Photo | neutral | happy | sad | angry | fearful | disgusted | surprised |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Frontal portrait A | 96% | 100% | 97% | 95% | 100% | 91% | 97% |
| Smiling portrait A | 90% | 100% | 99% | 94% | 95% | 100% | 98% |
| Portrait with glasses | 96% | 100% | 99% | 100% | 100% | 94% | 97% |
| Frontal portrait B | 98% | 100% | 100% | 91% | 100% | 95% | 99% |
| Smiling portrait B | 86% | 100% | 100% | 91% | 96% | 98% | 96% |

The six non-neutral labels scored 91–100%; neutral scored 86–98%. Difficult fits took up to approximately 50 seconds on the test machine. The interface retains fitted poses for the current photo.

These are optimization checks on synthetic renderings, not an independent estimate of emotion-recognition accuracy. The search directly uses these classifier scores to select shapes. This small test set does not guarantee performance on another photo or establish anyone’s emotional state. No scores or model weights were modified.

Additional checks: rapid label changes with delayed readings and initially missing detections recover to the latest target. All five control tabs, with seven score rows populated, fit at desktop presentation sizes 1299 × 1012, 1280 × 720 and 1440 × 650.
