# Adapted from Jake Tan's ml5-touchdesigner Web Server DAT bridge (MIT).
import json
import math
CHANNELS = ('neutral','happy','sad','angry','fearful','disgusted','surprised',
            'classA','classB','confidence','hasFace','active')

def write_values(values):
    table = me.parent().op('values')
    table.clear()
    table.appendRow(['name', 'value'])
    for name in CHANNELS:
        try:
            value = float(values.get(name, 0))
            if not math.isfinite(value):
                value = 0
        except (ValueError, TypeError):
            value = 0
        table.appendRow([name, min(1, max(0, value))])

def onHTTPRequest(webServerDAT, request, response):
    response['statusCode'] = 200
    response['statusReason'] = 'OK'
    response['data'] = 'Affective Sensing receiver is running.'
    return response

def onWebSocketOpen(webServerDAT, client, uri):
    write_values({})
    me.parent().op('label').text = 'Connected / waiting for predictions'

def onWebSocketReceiveText(webServerDAT, client, data):
    try:
        message = json.loads(data)
        if not isinstance(message, dict) or message.get('type') != 'affective_sensing':
            return
        values = message.get('values', {})
        if not isinstance(values, dict):
            return
        write_values(values)
        me.parent().op('label').text = str(message.get('label', ''))[:80]
    except (ValueError, TypeError):
        return

def onWebSocketClose(webServerDAT, client):
    write_values({})
    me.parent().op('label').text = 'Disconnected'

def onWebSocketReceivePing(webServerDAT, client, data):
    webServerDAT.webSocketSendPong(client, data=data)
