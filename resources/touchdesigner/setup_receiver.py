# Run this file in TouchDesigner with exec(open(...).read()).
# Creates a new isolated receiver. Existing operators are never replaced.
from pathlib import Path
import json

# Set this to the downloaded workshop resources/touchdesigner directory.
RESOURCE_DIR = Path(r"C:/Users/Jake/Documents/GitHub/MAS.S63-Workshop-Emotion/resources/touchdesigner")
callbacks_source = (RESOURCE_DIR / 'receiver_callbacks.py').read_text(encoding='utf-8')
root = op('/project1')
if root is None:
    raise RuntimeError('Open a project containing /project1 first.')
if root.op('affective_sensing') is not None:
    raise RuntimeError('affective_sensing already exists. Rename it before running setup again.')

base = root.create(baseCOMP, 'affective_sensing')
callbacks = base.create(textDAT, 'receiver_callbacks')
callbacks.text = callbacks_source
callbacks.nodeX, callbacks.nodeY = 0, 150
values = base.create(tableDAT, 'values')
values.appendRow(['name', 'value'])
for name in ('neutral','happy','sad','angry','fearful','disgusted','surprised',
             'classA','classB','confidence','hasFace','active'):
    values.appendRow([name, 0])
values.nodeX, values.nodeY = 240, 0
label = base.create(textDAT, 'label')
label.text = 'Waiting for browser'
label.nodeX, label.nodeY = 240, 150
server = base.create(webserverDAT, 'receiver')
server.par.active = False
server.par.port = 9981
server.par.callbacks = callbacks.path
server.nodeX, server.nodeY = 0, 0
server.par.active = True
print('Receiver created at ' + base.path + '. Connect ONE browser on localhost:9981.')
print('The values table is ready. Add a DAT to CHOP: DAT=values, Output=Channel per Row, First Row=Names, First Column=Names.')
