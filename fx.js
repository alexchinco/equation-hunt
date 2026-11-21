// Tile actions for Equation Hunt, shared by the game (index.html) and the viewer (fx.html).
// The tiles are the only objects. When an equation is correct, its tiles perform a short
// action and then fly home to the tray. This file also scatters number tiles in the tray.
(function () {
  var style = document.createElement("style");
  style.textContent = ".actor { position: fixed; left: 0; top: 0; margin: 0; z-index: 50; pointer-events: none; will-change: transform; }";
  document.head.appendChild(style);

  var RAINBOW = ["#ff4f7b", "#ff9a3c", "#f5c400", "#3dbb6a", "#3fa9f5", "#8e6cf0"];
  var FX = { keep: false, actions: ["Wave", "Rainbow", "Explosion", "Flip"], RAINBOW: RAINBOW };
  var last = -1;

  // ---- Scattering number tiles in the tray ----
  // A spot is free if no other tile's center is within 1.15 tile widths across or down,
  // so tiles never touch even when tilted.
  FX.freeSpot = function (pos, skip, W, H, t) {
    var m = t * 0.62, gap = t * 1.15;
    for (var a = 0; a < 400; a++) {
      var p = { x: m + Math.random() * (W - 2 * m), y: m + Math.random() * (H - 2 * m), r: (Math.random() - 0.5) * 24 };
      var clash = false;
      for (var j = 0; j < pos.length && !clash; j++) {
        var q = pos[j];
        if (j !== skip && q && Math.abs(q.x - p.x) < gap && Math.abs(q.y - p.y) < gap) clash = true;
      }
      if (!clash) return p;
    }
    return null;
  };
  FX.scatter = function (count, W, H, t) {
    for (var tries = 0; tries < 80; tries++) {
      var pos = [], ok = true;
      for (var i = 0; i < count && ok; i++) {
        var p = FX.freeSpot(pos, -1, W, H, t);
        if (p) pos.push(p); else ok = false;
      }
      if (ok) return pos;
    }
    // Not enough room for a random spill: fall back to loose rows with a little tilt.
    var cols = Math.max(1, Math.floor(W / (t * 1.2))), out = [];
    for (var k = 0; k < count; k++) {
      var c = k % cols, rw = Math.floor(k / cols);
      out.push({ x: (c + 0.5) * W / cols, y: t * 0.62 + rw * t * 1.2, r: (Math.random() - 0.5) * 10 });
    }
    return out;
  };

  // ---- Tile actions ----
  // Every keyframe uses the same list of transform functions so steps blend smoothly.
  function T(x, y, o) {
    o = o || {};
    return "translate(" + x + "px," + y + "px) translate(-50%,-50%) perspective(600px) rotate(" + (o.r || 0) + "deg) rotateY(" +
      (o.f || 0) + "deg) scale(" + (o.sx == null ? 1 : o.sx) + "," + (o.sy == null ? 1 : o.sy) + ")";
  }
  var UP = "cubic-bezier(.2,.8,.4,1)", DOWN = "cubic-bezier(.6,0,.8,.4)", POP = "cubic-bezier(.34,1.56,.64,1)";

  function run(it, frames, duration, delay) {
    var a = it.el.animate(frames, { duration: duration, delay: delay || 0, easing: "linear", fill: FX.keep ? "both" : "backwards" });
    if (!FX.keep) a.onfinish = function () { it.el.remove(); if (it.done) it.done(); };
  }

  // The trip home: an arc up and over, then a little squash on landing. Starts at offset a.
  function home(frames, a, fx, fy, it, o) {
    o = o || {};
    var h = it.el.offsetHeight || 60, mx = (fx + it.ex) / 2, my = Math.min(fy, it.ey) - h * 1.4;
    var endR = it.er + (o.spin || 0);
    frames.push({ offset: a + (1 - a) * 0.5, transform: T(mx, my, { r: (o.fromR || 0) + (endR - (o.fromR || 0)) / 2, f: o.f }), easing: DOWN });
    frames.push({ offset: a + (1 - a) * 0.88, transform: T(it.ex, it.ey, { r: endR, f: o.f, sx: 1.14, sy: 0.86 }), easing: POP });
    frames.push({ offset: 1, transform: T(it.ex, it.ey, { r: endR, f: o.f }) });
    return frames;
  }

  var actions = [
    function wave(items) { // tiles hop one after another, then hop home
      items.forEach(function (it, k) {
        var h = it.el.offsetHeight || 60, x = it.sx, y = it.sy;
        var f = [
          { offset: 0, transform: T(x, y), easing: "ease-out" },
          { offset: 0.08, transform: T(x, y, { sx: 1.15, sy: 0.85 }), easing: UP },
          { offset: 0.26, transform: T(x, y - h * 1.3, { sx: 0.92, sy: 1.1 }), easing: DOWN },
          { offset: 0.42, transform: T(x, y, { sx: 1.15, sy: 0.85 }), easing: POP },
          { offset: 0.5, transform: T(x, y), easing: UP }
        ];
        run(it, home(f, 0.5, x, y, it), 1300, k * 90);
      });
    },
    function rainbow(items) { // each tile turns a rainbow color with a wiggle, then slides home
      items.forEach(function (it, k) {
        var x = it.sx, y = it.sy, cs = getComputedStyle(it.el), bg = cs.backgroundColor, fg = cs.color, c = RAINBOW[k % RAINBOW.length];
        var f = [
          { offset: 0, transform: T(x, y), backgroundColor: bg, color: fg, easing: POP },
          { offset: 0.12, transform: T(x, y, { r: -12, sx: 1.18, sy: 1.18 }), backgroundColor: c, color: "#fff" },
          { offset: 0.24, transform: T(x, y, { r: 10, sx: 1.18, sy: 1.18 }) },
          { offset: 0.36, transform: T(x, y, { r: -6, sx: 1.12, sy: 1.12 }) },
          { offset: 0.46, transform: T(x, y, { r: 0, sx: 1.1, sy: 1.1 }), backgroundColor: c, color: "#fff", easing: UP }
        ];
        f.push({ offset: 0.5, transform: T(x, y, { sx: 1.1, sy: 1.1 }), backgroundColor: c, color: "#fff", easing: UP });
        home(f, 0.5, x, y, it);
        var n = f.length; // fade back to the tile's own colors during the trip home
        f[n - 3].backgroundColor = c; f[n - 3].color = "#fff";
        f[n - 2].backgroundColor = bg; f[n - 2].color = fg;
        f[n - 1].backgroundColor = bg; f[n - 1].color = fg;
        run(it, f, 1500, k * 110);
      });
    },
    function explosion(items) { // tiles blast apart, spinning, then fall back into the tray
      var gx = 0, gy = 0, small = Math.min(window.innerWidth, window.innerHeight);
      items.forEach(function (it) { gx += it.sx / items.length; gy += it.sy / items.length; });
      items.forEach(function (it) {
        var dx = it.sx - gx + (Math.random() - 0.5) * 40, dy = it.sy - gy - 60 + (Math.random() - 0.5) * 40;
        var len = Math.hypot(dx, dy) || 1, d = small * (0.2 + Math.random() * 0.12);
        var ox = it.sx + dx / len * d, oy = it.sy + dy / len * d * 0.8 - small * 0.06;
        var spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 270);
        var f = [
          { offset: 0, transform: T(it.sx, it.sy), easing: POP },
          { offset: 0.08, transform: T(it.sx, it.sy, { sx: 1.25, sy: 1.25 }), easing: "cubic-bezier(.1,.9,.3,1)" },
          { offset: 0.42, transform: T(ox, oy, { r: spin }), easing: UP }
        ];
        run(it, home(f, 0.42, ox, oy, it, { fromR: spin, spin: spin > 0 ? 720 : -720 }), 1600, 0);
      });
    },
    function flip(items) { // tiles flip over one by one, then tumble home
      items.forEach(function (it, k) {
        var h = it.el.offsetHeight || 60, x = it.sx, y = it.sy;
        var f = [
          { offset: 0, transform: T(x, y), easing: UP },
          { offset: 0.1, transform: T(x, y - h * 0.35, { sx: 1.1, sy: 1.1 }), easing: "ease-in-out" },
          { offset: 0.42, transform: T(x, y - h * 0.35, { f: 360, sx: 1.1, sy: 1.1 }), easing: POP },
          { offset: 0.52, transform: T(x, y, { f: 360 }), easing: UP }
        ];
        run(it, home(f, 0.52, x, y, it, { f: 360, spin: 360 }), 1500, k * 120);
      });
    }
  ];

  // items: [{ el, sx, sy, ex, ey, er, done }]. el is a tile already in the page with class "actor";
  // (sx, sy) is where its center starts, (ex, ey) where it lands in the tray, er its tilt there.
  FX.perform = function (items, force) {
    if (!items.length) return;
    items.sort(function (a, b) { return a.sx - b.sx; });
    items.forEach(function (it) { it.el.style.transform = T(it.sx, it.sy); });
    var n = Math.floor(Math.random() * (actions.length - 1));
    if (last >= 0 && n >= last) n++;
    if (typeof force === "number") n = force;
    last = n;
    actions[n](items);
  };

  window.FX = FX;
})();
