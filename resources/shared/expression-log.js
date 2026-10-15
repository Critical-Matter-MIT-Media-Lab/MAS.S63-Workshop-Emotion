// Count sustained label entries, rather than every prediction frame.
// Pure update logic is shared by the pretrained and Teachable Machine demos.
class ExpressionLog {
  constructor({key = 'affective-expression-log', ignored = [], threshold = 0.6, holdMs = 500, releaseMs = 400} = {}) {
    Object.assign(this, {key, ignored, threshold, holdMs, releaseMs});
    this.events = [];
    try { const saved = JSON.parse(sessionStorage.getItem(key)); if (Array.isArray(saved)) this.events = saved.filter(e => typeof e.label === 'string' && typeof e.time === 'string' && Number.isFinite(e.score)); } catch {}
    this.resetTracking();
  }
  resetTracking() { this.candidate = ''; this.since = 0; this.active = ''; this.releaseSince = null; this.lastUpdate = null; }
  update(predictions, now = Date.now()) {
    // Inference can be slow. Consecutive observations still establish a label.
    // Camera stop and sustained missing/low-confidence results reset tracking.
    this.lastUpdate = now;
    const top = predictions.reduce((best, p) => p.score > (best?.score ?? -1) ? p : best, null);
    const label = top && top.score >= this.threshold && !this.ignored.includes(top.label) ? top.label : '';
    if (!label) {
      this.candidate = ''; this.since = 0;
      if (this.releaseSince === null) this.releaseSince = now;
      if (now - this.releaseSince >= this.releaseMs) this.active = '';
      return null;
    }
    this.releaseSince = null;
    if (label !== this.candidate) { this.candidate = label; this.since = now; }
    if (now - this.since < this.holdMs || label === this.active) return null;
    this.active = label;
    const event = {time: new Date(now).toISOString(), label, score: Number(top.score.toFixed(4))};
    this.events.push(event);
    try { sessionStorage.setItem(this.key, JSON.stringify(this.events)); } catch {}
    return event;
  }
  counts() { return this.events.reduce((counts, event) => { counts[event.label] = (counts[event.label] || 0) + 1; return counts; }, Object.create(null)); }
  reset() { this.events = []; this.resetTracking(); try { sessionStorage.removeItem(this.key); } catch {} }
  download() {
    const cell = value => '"' + String(value).replace(/^[=+@-]/, "'$&").replaceAll('"','""') + '"';
    const csv = ['time,label,model_score', ...this.events.map(e => [e.time,e.label,e.score].map(cell).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'affective-sensing-events.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
globalThis.ExpressionLog = ExpressionLog;
