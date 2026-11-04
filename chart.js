/* Tiny line chart (no deps). drawLine(canvas, [[ts, value], ...], opts) */
(function () {
  function drawLine(canvas, pts, opts) {
    opts = opts || {};
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight || 180;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var c = canvas.getContext("2d");
    c.scale(dpr, dpr);
    c.clearRect(0, 0, w, h);
    if (!pts || pts.length < 2) {
      c.fillStyle = "#8e8e93"; c.font = "13px -apple-system"; c.textAlign = "center";
      c.fillText("Waiting for data…", w / 2, h / 2); return;
    }
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (opts.base != null) { y0 = Math.min(y0, opts.base); y1 = Math.max(y1, opts.base); }
    var pad = (y1 - y0) * 0.1 || 1; y0 -= pad; y1 += pad;
    var X = function (v) { return 4 + (w - 8) * (v - x0) / ((x1 - x0) || 1); };
    var Y = function (v) { return 8 + (h - 16) * (1 - (v - y0) / ((y1 - y0) || 1)); };
    var up = ys[ys.length - 1] >= (opts.base != null ? opts.base : ys[0]);
    var col = up ? "#30d158" : "#ff453a";
    if (opts.base != null) {
      c.strokeStyle = "#38383a"; c.setLineDash([3, 4]); c.beginPath();
      c.moveTo(0, Y(opts.base)); c.lineTo(w, Y(opts.base)); c.stroke(); c.setLineDash([]);
    }
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, up ? "rgba(48,209,88,.35)" : "rgba(255,69,58,.35)"); g.addColorStop(1, "rgba(0,0,0,0)");
    c.beginPath(); c.moveTo(X(xs[0]), Y(ys[0]));
    for (var i = 1; i < pts.length; i++) c.lineTo(X(xs[i]), Y(ys[i]));
    c.lineWidth = 2; c.strokeStyle = col; c.lineJoin = "round"; c.stroke();
    c.lineTo(X(xs[xs.length - 1]), h); c.lineTo(X(xs[0]), h); c.closePath(); c.fillStyle = g; c.fill();
  }
  window.DeskChart = { drawLine: drawLine };
})();
