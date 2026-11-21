// Tile actions for Equation Hunt, shared by the game (index.html) and the viewer (fx.html).
// The tiles are the main objects. When an equation is correct, its tiles perform a short
// action and then fly home to the tray. Anything else that appears (a unicorn's horn, a
// burst, a rainbow) grows out of a tile or rides with it. This file also scatters the tiles in the tray.
(function () {
  var style = document.createElement("style");
  style.textContent =
    ".actor { position: fixed; left: 0; top: 0; margin: 0; z-index: 50; pointer-events: none; will-change: transform; }" +
    ".fxextra { position: fixed; left: 0; top: 0; pointer-events: none; z-index: 49; overflow: visible; }" +
    ".fxrainbow { z-index: -1; }" +
    ".drip { border-radius: 0 0 999px 999px; transform-origin: 50% 0; }" +
    ".lid { clip-path: polygon(0 0, 100% 0, 100% 55%, 85% 45%, 70% 58%, 55% 44%, 40% 58%, 25% 44%, 10% 56%, 0 46%); transform-origin: 15% 50%; }" +
    ".cup { clip-path: polygon(0 46%, 10% 56%, 25% 44%, 40% 58%, 55% 44%, 70% 58%, 85% 45%, 100% 55%, 100% 100%, 0 100%); }" +
    ".baby { padding: 0 !important; }" + // rainbows pass behind the tiles
    ".spark { border-radius: 25%; box-shadow: 0 2px 3px rgba(30,43,74,0.18); }" +
    ".deco { position: absolute; inset: 0; pointer-events: none; }" +
    ".card3d { background: none !important; box-shadow: none !important; transform-style: preserve-3d; }" +
    ".face { position: absolute !important; left: 0; top: 0; width: 100%; height: 100%; min-width: 0 !important; margin: 0;" +
    " backface-visibility: hidden; -webkit-backface-visibility: hidden; }" +
    ".face.back { transform: rotateY(180deg); overflow: hidden; padding: 0; background: #fff; }" +
    ".face.back svg { display: block; }";
  document.head.appendChild(style);

  var RAINBOW = ["#ff4f7b", "#ff9a3c", "#f5c400", "#3dbb6a", "#3fa9f5", "#8e6cf0"];
  var FX = { keep: false, actions: ["Leapfrog", "Disco", "Shatter", "Unicorn backs", "Unicorn tile", "Boom", "Rainbow slide",
    "Rainbow melt", "Unicorn egg", "Rocket tower", "Balloon", "Googly stampede", "Rainbow sneeze", "Rainbow poop", "Atomic rainbow bomb"], RAINBOW: RAINBOW };
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

  // ---- Pieces that belong to tiles ----
  // Drawn to match the tiles: rounded, flat colors, the tiles' soft shadow, no dark outlines.
  var SHADOW = "drop-shadow(0 2px 2px rgba(30,43,74,0.18))";
  var SVGNS = "http://www.w3.org/2000/svg";
  function extra(tag, cls) { // a piece placed on the page next to a tile (burst, spark, rainbow)
    var e = tag === "svg" ? document.createElementNS(SVGNS, "svg") : document.createElement(tag);
    e.setAttribute("class", "fxextra" + (cls ? " " + cls : ""));
    document.body.appendChild(e);
    return e;
  }
  function anim(el, frames, duration, delay, removeEl, iterations) {
    frames.forEach(function (f) { if (!f.easing) f.easing = "linear"; });
    var a = el.animate(frames, { duration: duration, delay: delay || 0, easing: "linear", iterations: iterations || 1,
                                 fill: FX.keep ? "both" : "backwards" });
    if (!FX.keep && removeEl) a.onfinish = function () { removeEl.remove(); };
    return a;
  }
  function at(x, y) { return "translate(" + x + "px," + y + "px) translate(-50%,-50%) "; }

  // Points along a curve, and a six-band rainbow that follows them.
  function cubicPts(p0, p1, p2, p3, n) {
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, a = (1 - t) * (1 - t) * (1 - t), b = 3 * t * (1 - t) * (1 - t), c = 3 * t * t * (1 - t), d = t * t * t;
      out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
    }
    return out;
  }
  function normals(pts) { // unit normals, kept on the same side all the way along (starting on the upper side)
    var ns = [], prev = null;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[Math.max(0, i - 1)], q = pts[Math.min(pts.length - 1, i + 1)];
      var tx = q[0] - p[0], ty = q[1] - p[1], L = Math.hypot(tx, ty) || 1, n = [ty / L, -tx / L];
      if (prev ? n[0] * prev[0] + n[1] * prev[1] < 0 : n[1] > 0) n = [-n[0], -n[1]];
      ns.push(n); prev = n;
    }
    return ns;
  }
  function rainbowAlong(pts, bw) {
    var svg = extra("svg", "fxrainbow"), ns = normals(pts);
    svg.setAttribute("width", window.innerWidth); svg.setAttribute("height", window.innerHeight);
    svg.style.filter = SHADOW;
    var lines = RAINBOW.map(function (c, k) {
      var off = (2.5 - k) * bw, d = pts.map(function (p, i) { return (p[0] + ns[i][0] * off).toFixed(1) + "," + (p[1] + ns[i][1] * off).toFixed(1); }).join(" ");
      var pl = document.createElementNS(SVGNS, "polyline");
      pl.setAttribute("points", d); pl.setAttribute("fill", "none"); pl.setAttribute("stroke", c);
      pl.setAttribute("stroke-width", bw + 0.8); pl.setAttribute("stroke-linejoin", "round");
      svg.appendChild(pl);
      return pl;
    });
    return { svg: svg, lines: lines };
  }
  function reveal(rb, duration, delay) {
    rb.lines.forEach(function (pl) {
      var L = pl.getTotalLength();
      pl.style.strokeDasharray = L + " " + L;
      anim(pl, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], duration, delay);
    });
  }

  // Unicorn parts that grow out of a tile (w by h), facing right.
  function unicornParts(w, h, opt) {
    opt = opt || {};
    var d = document.createElement("div");
    d.className = "deco";
    var horn = '<svg viewBox="0 0 30 60" style="position:absolute;left:' + (w * 0.6) + 'px;top:' + (-h * 0.5) + 'px;width:' + (h * 0.3) + 'px;height:' + (h * 0.6) +
      'px;transform:rotate(22deg);transform-origin:50% 100%;filter:' + SHADOW + '"><path d="M15 0 L29 60 L1 60 Z" fill="#ffd23f"/>' +
      '<path d="M7 34 L23 28 M5 46 L25 40 M10 20 L20 16" stroke="#f0a400" stroke-width="4" stroke-linecap="round"/></svg>';
    var ear = '<svg viewBox="0 0 30 34" style="position:absolute;left:' + (w * 0.4) + 'px;top:' + (-h * 0.28) + 'px;width:' + (h * 0.24) + 'px;height:' + (h * 0.3) +
      'px;filter:' + SHADOW + '"><path d="M15 0 L30 34 L0 34 Z" fill="#fff"/><path d="M15 10 L23 30 L7 30 Z" fill="#ffb3cf"/></svg>';
    var mane = "";
    for (var i = 0; i < 5; i++) {
      var r = h * 0.17;
      mane += '<div style="position:absolute;width:' + 2 * r + 'px;height:' + 2 * r + 'px;border-radius:50%;background:' + RAINBOW[i] +
        ';left:' + (w * 0.42 - i * w * 0.13 - r) + 'px;top:' + (-r * 0.75 + i * h * 0.1) + 'px;filter:' + SHADOW + '"></div>';
    }
    var tail = '<svg class="tail" viewBox="0 0 60 50" style="position:absolute;left:' + (-h * 0.66) + 'px;top:' + (h * 0.18) + 'px;width:' + (h * 0.7) + 'px;height:' + (h * 0.6) +
      'px;filter:' + SHADOW + '">' + [0, 2, 4].map(function (k, j) {
        return '<path d="M60 ' + (14 + j * 10) + ' C40 ' + (4 + j * 12) + ' 25 ' + (30 + j * 8) + ' 6 ' + (12 + j * 14) + '" stroke="' + RAINBOW[k] +
          '" stroke-width="9" fill="none" stroke-linecap="round"/>';
      }).join("") + "</svg>";
    var eye = '<div style="position:absolute;left:' + (w * 0.74) + 'px;top:' + (h * 0.12) + 'px;width:' + (h * 0.11) + 'px;height:' + (h * 0.14) +
      'px;border-radius:50%;background:#1E2B4A"></div>';
    var legs = "";
    [0.14, 0.32, 0.6, 0.78].forEach(function (x, j) {
      legs += '<div class="leg" style="position:absolute;left:' + (w * x) + 'px;top:' + (h * 0.93) + 'px;width:' + (h * 0.14) + 'px;height:' + (h * 0.34) +
        'px;border-radius:' + (h * 0.07) + 'px;background:#fff;box-shadow:0 2px 3px rgba(30,43,74,0.18);transform-origin:50% 0;border-bottom:' + (h * 0.08) + 'px solid #c9b8ff;box-sizing:border-box"></div>';
    });
    var nose = '<div style="position:absolute;left:' + (w * 0.8) + 'px;top:' + (h * 0.34) + 'px;width:' + (h * 0.42) + 'px;height:' + (h * 0.34) +
      'px;border-radius:50%;background:#ffc2d9;box-shadow:0 2px 3px rgba(30,43,74,0.18)"><div style="position:absolute;right:' + (h * 0.08) + 'px;top:' + (h * 0.1) +
      'px;width:' + (h * 0.06) + 'px;height:' + (h * 0.09) + 'px;border-radius:50%;background:#1E2B4A"></div></div>';
    d.innerHTML = (opt.legs === false ? "" : legs) + (opt.tail === false ? "" : tail) + mane + ear + horn + eye + (opt.nose ? nose : "");
    return d;
  }

  // A cartoon burst drawn like a tile: flat colors, soft shadow.
  function burstSVG(word) {
    function star(n, R, r) {
      var p = [];
      for (var i = 0; i < n * 2; i++) {
        var a = Math.PI * i / n - Math.PI / 2, rad = (i % 2 ? r : R) * (1 + (Math.random() - 0.5) * 0.12);
        p.push((50 + Math.cos(a) * rad).toFixed(1) + "," + (50 + Math.sin(a) * rad).toFixed(1));
      }
      return p.join(" ");
    }
    return '<svg viewBox="0 0 100 100" width="100%" height="100%" style="overflow:visible;filter:' + SHADOW + '">' +
      '<polygon points="' + star(12, 50, 34) + '" fill="#ff9a3c"/><polygon points="' + star(12, 40, 28) + '" fill="#ffd23f"/>' +
      (word ? '<text x="50" y="52" text-anchor="middle" dominant-baseline="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="17" fill="#1E2B4A" transform="rotate(-8 50 50)">' + word + "</text>" : "") +
      "</svg>";
  }

  // Pictures painted on the backs of tiles.
  var BACKS = [
    // unicorn
    '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="#ffe3ee"/>' +
      '<path d="M30 55 L52 60 L48 100 L18 100 Z" fill="#fff"/><ellipse cx="46" cy="48" rx="22" ry="19" fill="#fff"/>' +
      '<ellipse cx="67" cy="58" rx="16" ry="12" fill="#ffd6e7"/><path d="M36 33 L40 15 L49 31 Z" fill="#fff"/>' +
      '<path d="M52 31 L64 6 L60 34 Z" fill="#ffd23f"/>' +
      '<circle cx="31" cy="37" r="8" fill="#ff4f7b"/><circle cx="26" cy="49" r="8" fill="#ff9a3c"/><circle cx="23" cy="61" r="8" fill="#f5c400"/>' +
      '<circle cx="21" cy="73" r="8" fill="#3dbb6a"/><circle cx="20" cy="86" r="8" fill="#3fa9f5"/><circle cx="43" cy="30" r="6" fill="#8e6cf0"/>' +
      '<circle cx="53" cy="45" r="3.5" fill="#1E2B4A"/><circle cx="57" cy="57" r="4" fill="#ff9cc2"/><circle cx="76" cy="55" r="1.8" fill="#1E2B4A"/>' +
      '<path d="M64 64 Q70 70 77 64" stroke="#1E2B4A" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
    // rainbow
    '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="#e6f4ff"/>' +
      RAINBOW.map(function (c, k) { var r = 38 - k * 4.6; return '<path d="M' + (50 - r) + ' 72 A' + r + " " + r + " 0 0 1 " + (50 + r) + ' 72" stroke="' + c + '" stroke-width="4.8" fill="none"/>'; }).join("") +
      '<g fill="#fff"><circle cx="12" cy="72" r="8"/><circle cx="21" cy="68" r="9"/><circle cx="29" cy="73" r="7"/>' +
      '<circle cx="71" cy="73" r="7"/><circle cx="79" cy="68" r="9"/><circle cx="88" cy="72" r="8"/></g></svg>',
    // star
    '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="#8e6cf0"/>' +
      '<polygon points="50,14 60,38 86,40 66,57 72,83 50,69 28,83 34,57 14,40 40,38" fill="#ffd23f" stroke="#ffd23f" stroke-width="6" stroke-linejoin="round"/>' +
      '<g fill="#fff"><circle cx="18" cy="18" r="3"/><circle cx="82" cy="20" r="2.5"/><circle cx="84" cy="80" r="3"/><circle cx="16" cy="78" r="2.5"/></g></svg>'
  ];

  var actions = [
    function leapfrog(items) { // tiles leapfrog down the line leaving rainbow arcs; the front one does a giant triple flip and they all bounce home
      var n = items.length, h = items[0].el.offsetHeight || 60, W = window.innerWidth, gy = 0;
      items.forEach(function (it) { gy += it.sy / n; });
      var s = (items[n - 1].sx - items[0].sx) / Math.max(1, n - 1), d = (W - items[n - 1].sx) >= items[0].sx ? 1 : -1;
      var order = d > 0 ? items.slice() : items.slice().reverse(), front = order[n - 1].sx; // order[0] is the back of the line
      var room = d > 0 ? W - h * 0.6 - front : front - h * 0.6, sp = Math.max(h * 0.3, Math.min(s, room / Math.max(1, n - 2)));
      var STEP = 300, CR = 90, LD = 430, GL = 760, g = n - 2;
      var A = g * STEP + CR + LD + 100, T1 = A + 120, T2 = T1 + 120 + GL, D = T2 + 650;
      order.forEach(function (it, i) {
        var cx = it.sx, cy = it.sy, cr = 0, f = [{ offset: 0, transform: T(cx, cy) }];
        function push(t, X, Y, o, e) { o = o || {}; if (o.r == null) o.r = cr; f.push({ offset: t / D, transform: T(X, Y, o), easing: e || "linear" }); }
        for (var j = 0; j <= g; j++) {
          if (j === i) { // my leap, over everyone in front of me
            var t0 = i * STEP, Lx = front + d * (i + 1) * sp, Ly = gy, H = h * (1.2 + 0.5 * i), pts = [[cx, cy]];
            push(t0, cx, cy); push(t0 + CR, cx, cy, { sx: 1.15, sy: 0.85 });
            for (var q = 1; q <= 12; q++) {
              var t = q / 12, X = cx + (Lx - cx) * t, Y = cy + (Ly - cy) * t - 4 * H * t * (1 - t);
              pts.push([X, Y]);
              push(t0 + CR + LD * t, X, Y, q === 12 ? { r: d * 360, sx: 1.15, sy: 0.85 } : { r: d * 360 * t }, q === 12 ? POP : null);
            }
            cx = Lx; cy = Ly; cr = d * 360;
            push(t0 + CR + LD + 100, cx, cy);
            var rb = rainbowAlong(pts, h * 0.055);
            reveal(rb, LD, t0 + CR);
            anim(rb.svg, [{ offset: 0, opacity: 1 }, { offset: (t0 + CR + LD + 250) / D, opacity: 1 }, { offset: (t0 + CR + LD + 650) / D, opacity: 0 }, { offset: 1, opacity: 0 }], D, 0, rb.svg);
          } else if (!(i <= g && Math.abs(j - i) === 1)) { // duck while someone leaps over me
            var m = j * STEP + CR + LD / 2;
            push(m - 70, cx, cy); push(m, cx, cy, { sx: 1.12, sy: 0.84 }, POP); push(m + 90, cx, cy);
          }
        }
        if (i === g) { // the giant triple flip
          var up = Math.min(h * 3.5, cy - h * 0.6);
          push(T1, cx, cy); push(T1 + 120, cx, cy, { sx: 1.2, sy: 0.75 }, UP);
          push(T1 + 120 + GL / 2, cx, cy - up, { r: cr + d * 540, sx: 0.9, sy: 1.1 }, DOWN);
          push(T2, cx, cy, { r: cr + d * 1080, sx: 1.2, sy: 0.8 }, UP);
          cr += d * 1080;
          for (var k = 0; k < 8; k++) { // sparks fly from the landing
            var sk = extra("div", "spark"), a = Math.PI * (1 + k / 7), sz = h * 0.15;
            sk.style.width = sk.style.height = sz + "px"; sk.style.background = RAINBOW[k % 6];
            var x1 = cx + Math.cos(a) * h * 0.5, y1 = cy + h * 0.4, x2 = cx + Math.cos(a) * h * 1.6, y2 = cy + h * 0.4 + Math.sin(a) * h * 0.9;
            anim(sk, [{ offset: 0, transform: at(x1, y1) + "scale(0) rotate(0deg)" }, { offset: T2 / D, transform: at(x1, y1) + "scale(0) rotate(0deg)", easing: UP },
                      { offset: (T2 + 300) / D, transform: at(x2, y2) + "scale(1) rotate(180deg)", easing: "ease-in" },
                      { offset: (T2 + 520) / D, transform: at(x2, y2 + h * 0.3) + "scale(0) rotate(270deg)" }, { offset: 1, transform: at(x2, y2 + h * 0.3) + "scale(0) rotate(270deg)" }], D, 0, sk);
          }
        } else {
          push(T2 - 90, cx, cy); push(T2, cx, cy, { sx: 1.15, sy: 0.85 }, UP);
        }
        run(it, home(f, T2 / D, cx, cy, it, { fromR: cr, spin: cr }), D, 0);
      });
      return { delay: T2, px: 10 };
    },
    function disco(items) { // tiles spin faster and faster flashing rainbow colors, throw off sparkles, and pop into confetti
      var D = 1900, PT = 0.55;
      items.forEach(function (it, k) {
        var h = it.el.offsetHeight || 60, x = it.sx, y = it.sy, cs = getComputedStyle(it.el), bg = cs.backgroundColor, fg = cs.color, c = RAINBOW[k % 6], dl = k * 90;
        var py = y - h * 0.25, f = [];
        for (var q = 0; q <= 12; q++) { var t = q / 12; f.push({ offset: PT * t, transform: T(x, y - h * 0.25 * t, { r: 1440 * t * t, sx: 1 + 0.35 * t, sy: 1 + 0.35 * t }) }); }
        f.push({ offset: PT + 0.03, transform: T(x, py, { r: 1440, sx: 1.6, sy: 1.6 }), easing: "ease-in" });
        f.push({ offset: PT + 0.07, transform: T(x, py, { r: 1440, sx: 0.85, sy: 0.85 }), easing: POP });
        f.push({ offset: PT + 0.11, transform: T(x, py, { r: 1440 }), easing: UP });
        run(it, home(f, PT + 0.11, x, py, it, { fromR: 1440, spin: 1440 }), D, dl);
        // the colors: flashing faster and faster, a white flash at the pop, then back to its own
        var cf = [{ offset: 0, backgroundColor: bg, color: fg, easing: "steps(1,end)" }];
        for (q = 1; q <= 11; q++) cf.push({ offset: PT * Math.sqrt(q / 12), backgroundColor: RAINBOW[(q + k) % 6], color: "#fff", easing: "steps(1,end)" });
        cf.push({ offset: PT, backgroundColor: "#fff", color: c, easing: "steps(1,end)" });
        cf.push({ offset: PT + 0.07, backgroundColor: c, color: "#fff" });
        cf.push({ offset: 0.88, backgroundColor: bg, color: fg }); cf.push({ offset: 1, backgroundColor: bg, color: fg });
        anim(it.el, cf, D, dl);
        // sparkles thrown off the spinning corners
        for (var s = 0; s < 10; s++) {
          var ts = 0.15 + 0.038 * s, u = ts / PT, ang = (1440 * u * u + 45 + 90 * (s % 4)) * Math.PI / 180, r0 = h * 0.7 * (1 + 0.35 * u);
          var x0 = x + Math.cos(ang) * r0, y0 = y - h * 0.25 * u + Math.sin(ang) * r0, x1 = x0 + Math.cos(ang + 0.6) * h * 1.4, y1 = y0 + Math.sin(ang + 0.6) * h * 1.4;
          var sp = extra("div", "spark");
          sp.style.width = sp.style.height = h * 0.14 + "px"; sp.style.background = RAINBOW[(s + k) % 6];
          anim(sp, [{ offset: 0, transform: at(x0, y0) + "scale(0) rotate(0deg)" }, { offset: ts, transform: at(x0, y0) + "scale(0) rotate(0deg)", easing: UP },
                    { offset: ts + 0.03, transform: at(x0, y0) + "scale(1) rotate(45deg)" }, { offset: ts + 0.18, transform: at(x1, y1) + "scale(0) rotate(270deg)" },
                    { offset: 1, transform: at(x1, y1) + "scale(0) rotate(270deg)" }], D, dl, sp);
        }
        // confetti when it pops
        for (s = 0; s < 14; s++) {
          var a = Math.PI * 2 * s / 14 + Math.random() * 0.3, dist = h * (1.3 + Math.random() * 0.9), cc = extra("div", "spark"), r1 = Math.random() * 360;
          cc.style.width = cc.style.height = h * 0.13 + "px"; cc.style.background = RAINBOW[s % 6];
          var mx = x + Math.cos(a) * dist * 0.75, my = py + Math.sin(a) * dist * 0.75 - h * 0.3, ex = x + Math.cos(a) * dist, ey = py + Math.sin(a) * dist + h * 0.9;
          anim(cc, [{ offset: 0, transform: at(x, py) + "scale(0) rotate(0deg)", opacity: 1 }, { offset: PT, transform: at(x, py) + "scale(0) rotate(0deg)", opacity: 1, easing: UP },
                    { offset: PT + 0.12, transform: at(mx, my) + "scale(1) rotate(" + r1 + "deg)", opacity: 1, easing: "ease-in" },
                    { offset: PT + 0.32, transform: at(ex, ey) + "scale(0.4) rotate(" + (r1 + 300) + "deg)", opacity: 0 },
                    { offset: 1, transform: at(ex, ey) + "scale(0.4) rotate(" + (r1 + 300) + "deg)", opacity: 0 }], D, dl, cc);
        }
      });
      return { delay: 1900 * PT, px: 8 };
    },
    function shatter(items) { // tiles shake, crack into four pieces that fly apart, then snap back together and fly home
      var D = 2200, CRACK = 0.2, OUT = 0.36, HANG = 0.46, SNAP = 0.6, gx = 0;
      items.forEach(function (it) { gx += it.sx / items.length; });
      function rnd(a) { return (Math.random() - 0.5) * a; }
      items.forEach(function (it) {
        var h = it.el.offsetHeight || 60, x = it.sx, y = it.sy, Rx = x, Ry = y - h * 0.4;
        var f = [{ offset: 0, transform: T(x, y), opacity: 1 }];
        for (var q = 1; q <= 8; q++) { var t = q / 9, amp = 5 * t; f.push({ offset: CRACK * t, transform: T(x + (q % 2 ? amp : -amp), y + (q % 3 ? -amp : amp) * 0.5, { r: (q % 2 ? 4 : -4) * t }), opacity: 1 }); }
        f.push({ offset: CRACK - 0.001, transform: T(x, y), opacity: 1 }, { offset: CRACK, transform: T(x, y), opacity: 0 }, { offset: SNAP, transform: T(Rx, Ry), opacity: 0 },
               { offset: SNAP + 0.001, transform: T(Rx, Ry, { sx: 1.15, sy: 0.87 }), opacity: 1, easing: POP }, { offset: SNAP + 0.05, transform: T(Rx, Ry), opacity: 1, easing: UP });
        home(f, SNAP + 0.05, Rx, Ry, it);
        f.forEach(function (fr) { if (fr.opacity == null) fr.opacity = 1; });
        run(it, f, D, 0);
        // four jagged pieces
        var C = [50 + rnd(16), 50 + rnd(16)], Mt = [50 + rnd(20), 0], Mb = [50 + rnd(20), 100], Ml = [0, 50 + rnd(20)], Mr = [100, 50 + rnd(20)];
        function mid(p, k) { return [(p[0] + C[0]) / 2 + (k ? rnd(14) : 0), (p[1] + C[1]) / 2 + (k ? 0 : rnd(14))]; }
        var Kt = mid(Mt, 1), Kb = mid(Mb, 1), Kl = mid(Ml, 0), Kr = mid(Mr, 0);
        [[[[0, 0], Mt, Kt, C, Kl, Ml], [-1, -1], "25% 25%"], [[Mt, [100, 0], Mr, Kr, C, Kt], [1, -1], "75% 25%"],
         [[C, Kr, Mr, [100, 100], Mb, Kb], [1, 1], "75% 75%"], [[Ml, Kl, C, Kb, Mb, [0, 100]], [-1, 1], "25% 75%"]].forEach(function (pc) {
          var p = it.el.cloneNode(true), poly = "polygon(" + pc[0].map(function (a) { return a[0].toFixed(1) + "% " + a[1].toFixed(1) + "%"; }).join(",") + ")";
          p.style.transform = ""; p.style.clipPath = p.style.webkitClipPath = poly; p.style.transformOrigin = pc[2];
          document.body.appendChild(p);
          var vx = pc[1][0] + (x - gx) / (h * 2), vy = pc[1][1] - 0.6, L = Math.hypot(vx, vy) || 1, dist = h * (1.3 + Math.random() * 0.7);
          vx /= L; vy /= L;
          var spin = (Math.random() < 0.5 ? -1 : 1) * (200 + Math.random() * 250);
          anim(p, [{ offset: 0, transform: T(x, y), opacity: 0 }, { offset: CRACK - 0.001, transform: T(x, y), opacity: 0 },
                   { offset: CRACK, transform: T(x, y), opacity: 1, easing: "cubic-bezier(.1,.9,.3,1)" },
                   { offset: OUT, transform: T(x + vx * dist, y + vy * dist, { r: spin }), opacity: 1 },
                   { offset: HANG, transform: T(x + vx * dist * 1.12, y + vy * dist * 1.12, { r: spin * 1.15 }), opacity: 1, easing: "cubic-bezier(.7,0,.9,.6)" },
                   { offset: SNAP, transform: T(Rx, Ry), opacity: 1 }, { offset: SNAP + 0.001, transform: T(Rx, Ry), opacity: 0 }, { offset: 1, transform: T(Rx, Ry), opacity: 0 }], D, 0, p);
        });
        for (var s = 0; s < 6; s++) { // a ring of sparks when it snaps back together
          var sk = extra("div", "spark"), a = Math.PI * 2 * s / 6 + 0.3, sz = h * 0.14;
          sk.style.width = sk.style.height = sz + "px"; sk.style.background = RAINBOW[s];
          var x1 = Rx + Math.cos(a) * h * 0.5, y1 = Ry + Math.sin(a) * h * 0.5, x2 = Rx + Math.cos(a) * h * 1.3, y2 = Ry + Math.sin(a) * h * 1.3;
          anim(sk, [{ offset: 0, transform: at(x1, y1) + "scale(0)" }, { offset: SNAP, transform: at(x1, y1) + "scale(0)", easing: UP },
                    { offset: SNAP + 0.1, transform: at(x2, y2) + "scale(1)", easing: "ease-in" }, { offset: SNAP + 0.18, transform: at(x2, y2) + "scale(0)" },
                    { offset: 1, transform: at(x2, y2) + "scale(0)" }], D, 0, sk);
        }
      });
      return { delay: D * CRACK, px: 12 };
    },
    function unicornBacks(items) { // tiles flip like dominoes; the pictures on their backs pop out, then they flip back and spin home
      var D = 2600;
      items.forEach(function (it, k) {
        var h = it.el.offsetHeight || 60, x = it.sx, y = it.sy, el = it.el, kind = k % BACKS.length;
        // Turn the tile into a two-sided card: its own face in front, a picture behind,
        // and a copy of the picture (without its background) that can pop out past the edges.
        var front = el.cloneNode(true);
        front.classList.remove("actor");
        front.classList.add("face");
        front.removeAttribute("style");
        var back = document.createElement("div");
        back.className = "ttile face back";
        back.innerHTML = BACKS[kind];
        var pop = document.createElement("div"), inner = document.createElement("div");
        pop.className = "face back";
        pop.style.cssText = "overflow:visible;background:none;box-shadow:none;transform:rotateY(180deg) translateZ(1px)";
        inner.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%";
        inner.innerHTML = BACKS[kind].replace(/<rect[^>]*\/>/, "");
        pop.appendChild(inner);
        el.textContent = "";
        el.classList.add("card3d");
        el.appendChild(front); el.appendChild(back); el.appendChild(pop);
        var f = [
          { offset: 0, transform: T(x, y), easing: UP },
          { offset: 0.06, transform: T(x, y - h * 0.3, { sx: 1.1, sy: 1.1 }), easing: "ease-in-out" },
          { offset: 0.2, transform: T(x, y - h * 0.3, { f: 180, sx: 1.15, sy: 1.15 }) },
          { offset: 0.52, transform: T(x, y - h * 0.3, { f: 180, sx: 1.15, sy: 1.15 }), easing: "ease-in-out" },
          { offset: 0.62, transform: T(x, y - h * 0.3, { f: 360, sx: 1.1, sy: 1.1 }), easing: UP }
        ];
        run(it, home(f, 0.62, x, y - h * 0.3, it, { f: 720, spin: 360 }), D, k * 120);
        function P(ty, r, sx, sy, e) { return { transform: "translate(0px," + ty + "px) rotate(" + r + "deg) scale(" + sx + "," + (sy == null ? sx : sy) + ")", easing: e }; }
        var pf;
        if (kind === 0) { // the unicorn's head pokes out of the top and nods
          inner.style.transformOrigin = "50% 100%";
          pf = [[0, P(0, 0, 1)], [0.22, P(0, 0, 1, 1, POP)], [0.3, P(-h * 0.45, 0, 1.35, 1.35, "ease-in-out")], [0.34, P(-h * 0.45, -12, 1.35, 1.35, "ease-in-out")],
                [0.38, P(-h * 0.45, 12, 1.35, 1.35, "ease-in-out")], [0.42, P(-h * 0.45, -12, 1.35, 1.35, "ease-in-out")], [0.46, P(-h * 0.45, 0, 1.35, 1.35, "ease-in")],
                [0.52, P(0, 0, 1)], [1, P(0, 0, 1)]];
        } else if (kind === 1) { // the rainbow stretches out past the edges
          inner.style.transformOrigin = "50% 72%";
          pf = [[0, P(0, 0, 1)], [0.22, P(0, 0, 1, 1, POP)], [0.32, P(0, 0, 1.9, 1.6, "ease-in-out")], [0.37, P(0, 0, 1.7, 1.45, "ease-in-out")],
                [0.42, P(0, 0, 1.9, 1.6, "ease-in")], [0.5, P(0, 0, 1)], [1, P(0, 0, 1)]];
        } else { // the star spins up out of the tile and back
          inner.style.transformOrigin = "50% 50%";
          pf = [[0, P(0, 0, 1)], [0.22, P(0, 0, 1, 1, UP)], [0.32, P(-h * 0.7, 360, 1.5, 1.5, "ease-in-out")], [0.42, P(-h * 0.7, 720, 1.5, 1.5, "ease-in")],
                [0.52, P(0, 1080, 1)], [1, P(0, 1080, 1)]];
        }
        anim(inner, pf.map(function (p) { p[1].offset = p[0]; return p[1]; }), D, k * 120);
      });
    },
    function unicornTile(items) { // the left tile grows into a unicorn and gallops home on a rainbow; the rest follow it
      var u = items[0], rest = items.slice(1), h = u.el.offsetHeight || 60, w = u.el.offsetWidth || h;
      var D = 1900, SP = 0.14, END = 0.92, dir = u.ex >= u.sx ? 1 : -1, hops = 4, hopH = h * 0.4;
      var mx = (u.sx + u.ex) / 2, my = Math.min(u.sy, u.ey) - h * 0.9;
      function base(t) { var a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t; return [a * u.sx + b * mx + c * u.ex, a * u.sy + b * my + c * u.ey]; }
      function bob(t) { return -hopH * Math.abs(Math.sin(Math.PI * hops * t)); }
      // The unicorn
      var deco = unicornParts(w, h), flip = dir < 0 ? "scaleX(-1) " : "";
      u.el.appendChild(deco);
      anim(deco, [{ offset: 0, transform: flip + "scale(0)" }, { offset: SP * 0.7, transform: flip + "scale(1.15)", easing: POP },
                  { offset: SP, transform: flip + "scale(1)" }, { offset: END - 0.04, transform: flip + "scale(1)", easing: "ease-in" },
                  { offset: END + 0.03, transform: flip + "scale(0)" }, { offset: 1, transform: flip + "scale(0)" }], D);
      Array.prototype.forEach.call(deco.querySelectorAll(".leg"), function (leg, j) {
        var s = j % 2 ? 1 : -1;
        anim(leg, [{ transform: "rotate(0deg)" }, { transform: "rotate(" + 28 * s + "deg)" }, { transform: "rotate(0deg)" },
                   { transform: "rotate(" + -28 * s + "deg)" }, { transform: "rotate(0deg)" }], 300, D * SP, null, Math.ceil(D * (END - SP) / 300));
      });
      var f = [{ offset: 0, transform: T(u.sx, u.sy) }, { offset: SP, transform: T(u.sx, u.sy, { sx: 1.08, sy: 0.92 }) }];
      for (var i = 1; i <= 30; i++) {
        var t = i / 30, p = base(t), tilt = dir * -10 * Math.cos(2 * Math.PI * hops * t);
        f.push({ offset: SP + (END - SP) * t, transform: T(p[0], p[1] + bob(t), { r: tilt * (1 - t) + u.er * t }) });
      }
      f.push({ offset: END + 0.04, transform: T(u.ex, u.ey, { r: u.er, sx: 1.12, sy: 0.88 }), easing: POP });
      f.push({ offset: 1, transform: T(u.ex, u.ey, { r: u.er }) });
      run(u, f, D, 0);
      // Its rainbow trail, drawn out behind it as it goes
      var pts = [];
      for (i = 0; i <= 40; i++) pts.push(base(i / 40));
      var rb = rainbowAlong(pts, h * 0.1);
      reveal(rb, D * (END - SP), D * SP);
      anim(rb.svg, [{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], D + 500, 0, rb.svg);
      // The other tiles jump onto its path and follow in a line, then hop off to their own spots
      var plen = 0;
      for (i = 1; i < pts.length; i++) plen += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      var lag = Math.min(Math.max(0.12, h * 1.7 / plen), 0.7 / Math.max(1, rest.length)), Df = D + 500, sc = D / Df; // leave room for the unicorn's tail
      rest.forEach(function (it, j) {
        var k = j + 1, join = SP + k * lag * (END - SP), start = Math.max(SP * 0.5, join - 0.16), p0 = base(0);
        var g = [{ offset: 0, transform: T(it.sx, it.sy) }, { offset: start * sc, transform: T(it.sx, it.sy), easing: UP },
                 { offset: (start + join) / 2 * sc, transform: T((it.sx + p0[0]) / 2, Math.min(it.sy, p0[1]) - h * 0.9), easing: DOWN },
                 { offset: join * sc, transform: T(p0[0], p0[1]) }];
        for (var s = 1; s <= 24; s++) {
          var tf = (1 - k * lag) * s / 24, q = base(tf);
          g.push({ offset: (join + (END - join) * s / 24) * sc, transform: T(q[0], q[1] + bob(tf), { r: it.er * tf * 0.5 }) });
        }
        var last = base(1 - k * lag);
        run(it, home(g, END * sc, last[0], last[1], it, { fromR: it.er * (1 - k * lag) * 0.5 }), Df, 0);
      });
    },
    function boom(items) { // a burst goes off behind each tile and the tile shoots out of it, then lands home
      var mid = items[Math.floor(items.length / 2)], small = Math.min(window.innerWidth, window.innerHeight), D = 1700, B = 0.16;
      items.forEach(function (it) {
        var h = it.el.offsetHeight || 60, size = h * (it === mid ? 2.6 : 2);
        var b = extra("div");
        b.style.width = b.style.height = size + "px";
        b.innerHTML = burstSVG(it === mid ? "BOOM!" : "");
        b.style.zIndex = it === mid ? 49 : 48; // the BOOM! word stays on top
        anim(b, [{ offset: 0, transform: at(it.sx, it.sy) + "scale(0) rotate(0deg)", opacity: 1 },
                 { offset: B, transform: at(it.sx, it.sy) + "scale(0) rotate(0deg)", opacity: 1, easing: POP },
                 { offset: B + 0.08, transform: at(it.sx, it.sy) + "scale(1.15) rotate(12deg)", opacity: 1 },
                 { offset: B + 0.18, transform: at(it.sx, it.sy) + "scale(1) rotate(6deg)", opacity: 1 },
                 { offset: 0.58, transform: at(it.sx, it.sy) + "scale(1.04) rotate(4deg)", opacity: 1, easing: "ease-in" },
                 { offset: 0.72, transform: at(it.sx, it.sy) + "scale(0.5) rotate(0deg)", opacity: 0 },
                 { offset: 1, transform: at(it.sx, it.sy) + "scale(0.5) rotate(0deg)", opacity: 0 }], D, 0, b);
        for (var s = 0; s < 6; s++) { // sparks fly off the tile's edges
          var sp = extra("div", "spark"), a = Math.PI * 2 * s / 6 + Math.random() * 0.5, sz = h * 0.16;
          sp.style.width = sp.style.height = sz + "px";
          sp.style.background = RAINBOW[s];
          var x1 = it.sx + Math.cos(a) * h * 0.5, y1 = it.sy + Math.sin(a) * h * 0.5, x2 = it.sx + Math.cos(a) * h * 1.6, y2 = it.sy + Math.sin(a) * h * 1.6;
          anim(sp, [{ offset: 0, transform: at(x1, y1) + "scale(0) rotate(0deg)" }, { offset: B, transform: at(x1, y1) + "scale(0) rotate(0deg)", easing: UP },
                    { offset: B + 0.22, transform: at(x2, y2) + "scale(1) rotate(180deg)", easing: "ease-in" },
                    { offset: B + 0.36, transform: at(x2, y2 + h * 0.4) + "scale(0) rotate(270deg)" },
                    { offset: 1, transform: at(x2, y2 + h * 0.4) + "scale(0) rotate(270deg)" }], D, 0, sp);
        }
        var dx = it.sx - mid.sx + (Math.random() - 0.5) * 30, dy = -h * 0.8, len = Math.hypot(dx, dy) || 1, d = small * (0.14 + Math.random() * 0.06);
        var ox = it.sx + dx / len * d, oy = Math.max(h * 0.7, it.sy + dy / len * d), spin = (dx >= 0 ? 1 : -1) * (360 + Math.random() * 180);
        var f = [{ offset: 0, transform: T(it.sx, it.sy) }];
        for (var j = 1; j <= 5; j++) f.push({ offset: B * j / 6, transform: T(it.sx + (j % 2 ? 3 : -3), it.sy + (j % 3 ? -2 : 2), { r: j % 2 ? 3 : -3 }) });
        f.push({ offset: B, transform: T(it.sx, it.sy, { sx: 1.2, sy: 0.8 }), easing: "cubic-bezier(.1,.9,.3,1)" });
        f.push({ offset: 0.5, transform: T(ox, oy, { r: spin }), easing: UP });
        run(it, home(f, 0.5, ox, oy, it, { fromR: spin, spin: spin > 0 ? 360 : -360 }), D, 0);
      });
      return { delay: D * B, px: 12 };
    },
    function rainbowSlide(items) { // a rainbow grows out from under the equation and the tiles slide down it to the tray
      var h = items[0].el.offsetHeight || 60, W = window.innerWidth;
      var left = items[0], right = items[items.length - 1], gy = 0, ty = Infinity;
      items.forEach(function (it) { gy += it.sy / items.length; ty = Math.min(ty, it.ey); });
      var d = (W - right.sx) >= left.sx ? 1 : -1, end = d > 0 ? right : left;
      var S = [end.sx, gy + h * 0.62];
      var E = [Math.max(h, Math.min(W - h, S[0] + d * Math.max(h * 2.5, W * 0.16))), ty - h * 0.2];
      var pts = cubicPts(S, [S[0] + d * h * 1.6, S[1] - h * 1.4], [E[0] + d * h * 0.6, E[1] - h * 2.2], E, 44);
      var bw = h * 0.12, rb = rainbowAlong(pts, bw), ns = normals(pts), lift = h * 0.5 + bw * 3;
      reveal(rb, 420, 0);
      var order = items.slice().sort(function (a, b) { return d * (b.sx - a.sx); });
      var lastEnd = 0;
      order.forEach(function (it, k) {
        var t0 = 380 + k * 170, HOP = 280, SL = 650, HOME = 460, Dk = t0 + HOP + SL + HOME;
        var on = function (i) { return [pts[i][0] + ns[i][0] * lift, pts[i][1] + ns[i][1] * lift]; };
        var tilt = function (i) {
          var p = pts[Math.max(0, i - 1)], q = pts[Math.min(pts.length - 1, i + 1)], a = Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI;
          if (a > 90) a -= 180; if (a < -90) a += 180;
          return a * 0.6;
        };
        var p0 = on(0);
        var f = [{ offset: 0, transform: T(it.sx, it.sy) }, { offset: t0 / Dk, transform: T(it.sx, it.sy), easing: UP },
                 { offset: (t0 + HOP / 2) / Dk, transform: T((it.sx + p0[0]) / 2, Math.min(it.sy, p0[1]) - h * 0.8), easing: DOWN },
                 { offset: (t0 + HOP) / Dk, transform: T(p0[0], p0[1], { r: tilt(0) }), easing: "linear" }];
        for (var s = 1; s <= 16; s++) {
          var u = Math.pow(s / 16, 1.6), i = Math.round(u * (pts.length - 1)), q = on(i);
          f.push({ offset: (t0 + HOP + SL * s / 16) / Dk, transform: T(q[0], q[1], { r: tilt(i) }) });
        }
        var qe = on(pts.length - 1);
        run(it, home(f, (t0 + HOP + SL) / Dk, qe[0], qe[1], it, { fromR: tilt(pts.length - 1) }), Dk, 0);
        lastEnd = Math.max(lastEnd, t0 + HOP + SL);
      });
      anim(rb.svg, [{ opacity: 1 }, { opacity: 1, offset: lastEnd / (lastEnd + 350) }, { opacity: 0 }], lastEnd + 350, 0, rb.svg);
    },
    function rainbowMelt(items) { // tiles melt into rainbow goo, drip, slither to the tray, and pop back up
      var D = 2200;
      items.forEach(function (it, k) {
        var h = it.el.offsetHeight || 60, w = it.el.offsetWidth || h, cs = getComputedStyle(it.el), bg = cs.backgroundColor, fg = cs.color;
        var c = RAINBOW[k % RAINBOW.length], gy = h * 0.36, x0 = it.sx, y0 = it.sy + gy, x1 = it.ex, y1 = it.ey + gy, rad = cs.borderRadius;
        var f = [
          { offset: 0, transform: T(it.sx, it.sy), backgroundColor: bg, color: fg, borderRadius: rad, easing: "ease-in" },
          { offset: 0.1, transform: T(it.sx, it.sy + h * 0.08, { sx: 1.04, sy: 0.88 }), backgroundColor: c, color: "#fff", borderRadius: rad, easing: "ease-in" },
          { offset: 0.26, transform: T(x0, y0, { sx: 1.55, sy: 0.26 }), backgroundColor: c, color: c, borderRadius: "50%" }
        ];
        for (var s = 0; s <= 10; s++) { // slither: the puddle stretches and bunches like a slug
          var t = s / 10, wob = Math.sin(t * Math.PI * 4);
          f.push({ offset: 0.4 + 0.42 * t, transform: T(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, { sx: 1.55 + 0.3 * wob, sy: 0.26 - 0.05 * wob, r: it.er * t }), backgroundColor: c, color: c, borderRadius: "50%" });
        }
        f.push({ offset: 0.9, transform: T(it.ex, it.ey - h * 0.18, { sx: 0.8, sy: 1.3, r: it.er }), backgroundColor: bg, color: fg, borderRadius: rad, easing: POP });
        f.push({ offset: 1, transform: T(it.ex, it.ey, { r: it.er }), backgroundColor: bg, color: fg, borderRadius: rad });
        run(it, f, D, k * 80);
        for (var d = 0; d < 3; d++) { // goo drips running down from the melting tile
          var dr = extra("div", "drip"), dw = h * (0.12 + Math.random() * 0.06), dh = h * (0.5 + Math.random() * 0.6);
          var dx = it.sx + (d - 1) * w * 0.38 + (Math.random() - 0.5) * 6;
          dr.style.width = dw + "px"; dr.style.height = dh + "px"; dr.style.background = c;
          dr.style.left = (dx - dw / 2) + "px"; dr.style.top = (y0 - 2) + "px";
          anim(dr, [{ offset: 0, transform: "scaleY(0)", opacity: 1 }, { offset: 0.22, transform: "scaleY(0)", opacity: 1, easing: "ease-out" },
                    { offset: 0.38, transform: "scaleY(1)", opacity: 1 }, { offset: 0.5, transform: "scaleY(1)", opacity: 1, easing: "ease-in" },
                    { offset: 0.6, transform: "scaleY(0.6) translateY(" + dh * 0.4 + "px)", opacity: 0 }, { offset: 1, transform: "scaleY(0)", opacity: 0 }], D, k * 80, dr);
        }
      });
    },
    function unicornEgg(items) { // the left tile hatches a tiny unicorn that bounces across the other tiles
      var u = items[0], rest = items.slice(1), h = u.el.offsetHeight || 60, w = u.el.offsetWidth || h, W = window.innerWidth, D = 3200;
      var n = rest.length, dir = u.sx + (n + 1) * h * 1.35 < W - h ? 1 : -1;
      var stones = rest.map(function (it, j) { return [u.sx + dir * (j + 1) * h * 1.35, u.sy + (j + 1) * h * 0.28]; });
      // The egg: the tile splits into a lid and a cup along a zigzag crack.
      var el = u.el, top = el.cloneNode(true), cup = el.cloneNode(true);
      [top, cup].forEach(function (e) { e.classList.remove("actor"); e.classList.add("face"); e.removeAttribute("style"); el.appendChild(e); });
      top.classList.add("lid"); cup.classList.add("cup");
      el.childNodes[0].nodeValue = "";
      el.classList.add("card3d");
      anim(top, [{ offset: 0, transform: "translate(0,0) rotate(0deg)" }, { offset: 0.12, transform: "translate(0,0) rotate(0deg)", easing: POP },
                 { offset: 0.19, transform: "translate(" + -h * 0.25 + "px," + -h * 0.55 + "px) rotate(-35deg)" },
                 { offset: 0.78, transform: "translate(" + -h * 0.25 + "px," + -h * 0.55 + "px) rotate(-35deg)", easing: "ease-in" },
                 { offset: 0.84, transform: "translate(0,0) rotate(0deg)" }, { offset: 1, transform: "translate(0,0) rotate(0deg)" }], D);
      var f = [{ offset: 0, transform: T(u.sx, u.sy) }];
      [-10, 10, -12, 12, -6].forEach(function (r, j) { f.push({ offset: 0.02 * (j + 1), transform: T(u.sx, u.sy, { r: r }) }); });
      f.push({ offset: 0.12, transform: T(u.sx, u.sy, { sx: 1.1, sy: 0.9 }) });
      f.push({ offset: 0.16, transform: T(u.sx, u.sy) });
      f.push({ offset: 0.82, transform: T(u.sx, u.sy), easing: POP });
      f.push({ offset: 0.85, transform: T(u.sx, u.sy, { sx: 1.15, sy: 0.85 }) });
      f.push({ offset: 0.88, transform: T(u.sx, u.sy), easing: UP });
      run(u, home(f, 0.88, u.sx, u.sy, u), D, 0);
      // The tiny unicorn: a little tile of its own with unicorn parts.
      var m = h * 0.55, baby = extra("div", "ttile baby");
      baby.style.width = baby.style.height = m + "px"; baby.style.minWidth = m + "px"; baby.style.zIndex = 51;
      var parts = unicornParts(m, m);
      if (dir < 0) parts.style.transform = "scaleX(-1)";
      baby.appendChild(parts);
      var bf = [{ offset: 0, transform: at(u.sx, u.sy) + "scale(0)" }, { offset: 0.17, transform: at(u.sx, u.sy) + "scale(0)", easing: UP },
                { offset: 0.24, transform: at(u.sx, u.sy - h * 0.9) + "scale(1.1)", easing: "ease-in-out" },
                { offset: 0.27, transform: at(u.sx, u.sy - h * 0.8) + "scale(1)" }];
      var hopT = 0.38 / Math.max(1, n), prev = [u.sx, u.sy - h * 0.8], landTimes = [];
      stones.forEach(function (p, j) {
        var t0 = 0.27 + hopT * j, land = [p[0], p[1] - h * 0.5 - m * 0.45];
        bf.push({ offset: t0 + hopT * 0.5, transform: at((prev[0] + land[0]) / 2, Math.min(prev[1], land[1]) - h * 0.9) + "scale(1)", easing: DOWN });
        bf.push({ offset: t0 + hopT * 0.9, transform: at(land[0], land[1]) + "scale(1.15,0.85)", easing: UP });
        bf.push({ offset: t0 + hopT, transform: at(land[0], land[1] - 4) + "scale(1)" });
        landTimes.push(t0 + hopT * 0.9);
        prev = land;
      });
      bf[bf.length - 1].easing = UP;
      bf.push({ offset: 0.71, transform: at((prev[0] + u.sx) / 2, Math.min(prev[1], u.sy) - h * 1.6) + "scale(1) rotate(" + -360 * dir + "deg)", easing: DOWN });
      bf.push({ offset: 0.77, transform: at(u.sx, u.sy - h * 0.2) + "scale(0.8) rotate(" + -720 * dir + "deg)", easing: "ease-in" });
      bf.push({ offset: 0.8, transform: at(u.sx, u.sy) + "scale(0) rotate(" + -720 * dir + "deg)" });
      bf.push({ offset: 1, transform: at(u.sx, u.sy) + "scale(0) rotate(" + -720 * dir + "deg)" });
      anim(baby, bf, D, 0, baby);
      Array.prototype.forEach.call(parts.querySelectorAll(".leg"), function (leg, j) {
        var s = j % 2 ? 1 : -1;
        anim(leg, [{ transform: "rotate(0deg)" }, { transform: "rotate(" + 30 * s + "deg)" }, { transform: "rotate(0deg)" }, { transform: "rotate(" + -30 * s + "deg)" },
                   { transform: "rotate(0deg)" }], 260, D * 0.24, null, Math.ceil(D * 0.53 / 260));
      });
      // The other tiles step out to be stepping stones, dip when the unicorn lands, then go home.
      rest.forEach(function (it, j) {
        var p = stones[j], lt = landTimes[j];
        var g = [{ offset: 0, transform: T(it.sx, it.sy) }, { offset: 0.04 + j * 0.03, transform: T(it.sx, it.sy), easing: UP },
                 { offset: 0.11 + j * 0.03, transform: T((it.sx + p[0]) / 2, Math.min(it.sy, p[1]) - h * 0.7), easing: DOWN },
                 { offset: 0.18 + j * 0.03, transform: T(p[0], p[1], { sx: 1.1, sy: 0.9 }), easing: POP },
                 { offset: 0.22 + j * 0.03, transform: T(p[0], p[1]) },
                 { offset: lt, transform: T(p[0], p[1]), easing: "ease-out" },
                 { offset: lt + 0.025, transform: T(p[0], p[1] + h * 0.12, { sx: 1.12, sy: 0.85 }), easing: POP },
                 { offset: lt + 0.06, transform: T(p[0], p[1]) },
                 { offset: 0.86, transform: T(p[0], p[1]), easing: UP }];
        run(it, home(g, 0.86, p[0], p[1], it), D, 0);
      });
      return { delay: D * 0.12, px: 6 };
    },
    function rocketTower(items) { // tiles stack into a tower that sprouts a horn and blasts off on a rainbow
      var h = items[0].el.offsetHeight || 60, n = items.length, D = 2800, gx = 0, gy = 0, W = window.innerWidth;
      items.forEach(function (it) { gx += it.sx / n; gy += it.sy / n; });
      var baseY = Math.max(gy + h * 0.5, (n - 1) * h + h * 2.75), topTile = items[0], order = items.slice(1).concat([topTile]); // the base sits low enough to leave room for blast-off; the left tile ends up on top
      var lift = (baseY - (n - 1) * h) - h * 0.75, LAUNCH = 0.34, PEAK = 0.6;
      // horn and face on the top tile
      var parts = unicornParts(topTile.el.offsetWidth || h, h, { legs: false, tail: false });
      topTile.el.appendChild(parts);
      anim(parts, [{ offset: 0, transform: "scale(0)" }, { offset: 0.26, transform: "scale(0)", easing: POP }, { offset: 0.32, transform: "scale(1)" },
                   { offset: PEAK - 0.01, transform: "scale(1)" }, { offset: PEAK + 0.03, transform: "scale(0)" }, { offset: 1, transform: "scale(0)" }], D);
      // exhaust: a rainbow drawn out below the tower as it rises
      var pts = [];
      for (var i = 0; i <= 20; i++) pts.push([gx + Math.sin(i / 3) * 4, baseY + h * 0.55 - lift * i / 20]);
      var rb = rainbowAlong(pts, h * 0.13);
      reveal(rb, D * (PEAK - LAUNCH), D * LAUNCH);
      anim(rb.svg, [{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0, offset: 0.85 }, { opacity: 0 }], D, 0, rb.svg);
      // the blast at the top
      var b = extra("div");
      var bs = h * 3;
      b.style.width = b.style.height = bs + "px";
      b.innerHTML = burstSVG("WHEE!");
      var cy = baseY - lift - (n - 1) * h / 2;
      anim(b, [{ offset: 0, transform: at(gx, cy) + "scale(0)", opacity: 1 }, { offset: PEAK, transform: at(gx, cy) + "scale(0)", opacity: 1, easing: POP },
               { offset: PEAK + 0.06, transform: at(gx, cy) + "scale(1.2) rotate(10deg)", opacity: 1 },
               { offset: PEAK + 0.2, transform: at(gx, cy) + "scale(1) rotate(5deg)", opacity: 1, easing: "ease-in" },
               { offset: PEAK + 0.28, transform: at(gx, cy) + "scale(0.4)", opacity: 0 }, { offset: 1, transform: at(gx, cy) + "scale(0.4)", opacity: 0 }], D, 0, b);
      order.forEach(function (it, j) {
        var x = gx, y = baseY - j * h, t0 = 0.03 + j * (0.15 / n), t1 = t0 + 0.08; // stacked by 0.29, before the pre-launch shudder at 0.30
        var f = [{ offset: 0, transform: T(it.sx, it.sy) }, { offset: t0, transform: T(it.sx, it.sy), easing: UP },
                 { offset: (t0 + t1) / 2, transform: T((it.sx + x) / 2, Math.min(it.sy, y) - h * 1.2), easing: DOWN },
                 { offset: t1, transform: T(x, y, { sx: 1.1, sy: 0.9 }), easing: POP }, { offset: t1 + 0.03, transform: T(x, y) }];
        [3, -3, 3, -3].forEach(function (dx, q) { f.push({ offset: LAUNCH - 0.06 + q * 0.015, transform: T(x + dx, y) }); });
        f.push({ offset: LAUNCH, transform: T(x, y), easing: "cubic-bezier(.5,0,.9,.6)" });
        f.push({ offset: PEAK, transform: T(x, y - lift) });
        var a = Math.random() * Math.PI * 2, d = h * (1.6 + Math.random() * 1.2), fx = x + Math.cos(a) * d, fy = Math.max(h * 0.6, y - lift + Math.sin(a) * d * 0.6);
        var spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360);
        f[f.length - 1].easing = UP;
        f.push({ offset: PEAK + 0.1, transform: T(fx, fy, { r: spin * 0.4 }), easing: "cubic-bezier(.5,0,.9,.5)" });
        f.push({ offset: 0.94, transform: T(it.ex, it.ey, { r: it.er + spin, sx: 1.14, sy: 0.86 }), easing: POP });
        f.push({ offset: 1, transform: T(it.ex, it.ey, { r: it.er + spin }) });
        run(it, f, D, 0);
      });
      return { delay: D * PEAK, px: 12 };
    },
    function balloon(items) { // one tile blows up like a balloon and pops in a rainbow blast, flinging the others home
      var D = 2400, POPT = 0.46, b = items[Math.floor(items.length / 2)], h = b.el.offsetHeight || 60;
      var small = Math.min(window.innerWidth, window.innerHeight), big = Math.min(4.2, small * 0.55 / h);
      var bf = [{ offset: 0, transform: T(b.sx, b.sy), borderRadius: getComputedStyle(b.el).borderRadius }];
      var steps = [[0.08, 1.5, 1.35, -4], [0.14, 1.35, 1.5, 4], [0.22, 2.3, 2.1, -5], [0.28, 2.1, 2.35, 5], [0.36, big, big * 0.92, -3], [0.42, big * 0.94, big * 1.04, 3]];
      steps.forEach(function (s) { bf.push({ offset: s[0], transform: T(b.sx, b.sy - h * (s[1] - 1) * 0.3, { sx: s[1], sy: s[2], r: s[3] }), borderRadius: "50%", easing: "ease-in-out" }); });
      bf.push({ offset: POPT, transform: T(b.sx, b.sy - h * (big - 1) * 0.3, { sx: big * 1.08, sy: big * 1.08 }), borderRadius: "50%", opacity: 1 });
      bf.push({ offset: POPT + 0.01, transform: T(b.sx, b.sy - h * (big - 1) * 0.3, { sx: 0.3, sy: 0.3 }), borderRadius: "50%", opacity: 1, easing: UP });
      var spinB = 540;
      bf.push({ offset: POPT + 0.14, transform: T(b.sx, b.sy - h * 2.4, { r: spinB * 0.5 }), borderRadius: getComputedStyle(b.el).borderRadius, easing: DOWN });
      bf.push({ offset: 0.94, transform: T(b.ex, b.ey, { r: b.er + spinB, sx: 1.14, sy: 0.86 }), easing: POP });
      bf.push({ offset: 1, transform: T(b.ex, b.ey, { r: b.er + spinB }) });
      bf.forEach(function (fr) { if (!fr.borderRadius) fr.borderRadius = getComputedStyle(b.el).borderRadius; });
      run(b, bf, D, 0);
      // the rainbow blast: rings of color racing outward from the balloon
      var ringSize = h * big * 1.6, ring = extra("svg");
      ring.setAttribute("viewBox", "0 0 100 100"); ring.style.width = ring.style.height = ringSize + "px"; ring.style.filter = SHADOW;
      ring.innerHTML = RAINBOW.map(function (c, k) { return '<circle cx="50" cy="50" r="' + (46 - k * 4) + '" fill="none" stroke="' + c + '" stroke-width="4.4"/>'; }).join("");
      var cyB = b.sy - h * (big - 1) * 0.3;
      anim(ring, [{ offset: 0, transform: at(b.sx, cyB) + "scale(0)", opacity: 1 }, { offset: POPT, transform: at(b.sx, cyB) + "scale(0.3)", opacity: 1, easing: "cubic-bezier(.1,.8,.3,1)" },
                  { offset: POPT + 0.2, transform: at(b.sx, cyB) + "scale(1.6)", opacity: 0 }, { offset: 1, transform: at(b.sx, cyB) + "scale(1.6)", opacity: 0 }], D, 0, ring);
      items.forEach(function (it) {
        if (it === b) return;
        var dx = it.sx - b.sx || 1, push = (h * big * 0.5) * (dx > 0 ? 1 : -1), pr = dx > 0 ? 8 : -8;
        var fx = it.sx + push * 2.2 + (dx > 0 ? 1 : -1) * h, fy = it.sy - h * (1.2 + Math.random()), spin = (dx > 0 ? 1 : -1) * (400 + Math.random() * 300);
        var f = [{ offset: 0, transform: T(it.sx, it.sy) }, { offset: 0.08, transform: T(it.sx, it.sy), easing: "ease-in-out" },
                 { offset: 0.42, transform: T(it.sx + push * 0.6, it.sy, { r: pr }), easing: "ease-in" },
                 { offset: POPT, transform: T(it.sx + push * 0.7, it.sy, { r: pr }), easing: UP },
                 { offset: POPT + 0.14, transform: T(fx, fy, { r: spin * 0.5 }), easing: DOWN },
                 { offset: 0.94, transform: T(it.ex, it.ey, { r: it.er + spin, sx: 1.14, sy: 0.86 }), easing: POP },
                 { offset: 1, transform: T(it.ex, it.ey, { r: it.er + spin }) }];
        run(it, f, D, 0);
      });
      return { delay: D * POPT, px: 14 };
    },
    function googlyStampede(items) { // tiles grow googly eyes and legs, panic, and stampede home; one trips and cartwheels
      var D = 2300, trip = Math.floor(Math.random() * items.length);
      items.forEach(function (it, k) {
        var h = it.el.offsetHeight || 60, w = it.el.offsetWidth || h, legColor = getComputedStyle(it.el).backgroundColor;
        var dir = it.ex >= it.sx ? 1 : -1;
        var d = document.createElement("div");
        d.className = "deco";
        var eyes = "";
        [0.2, 0.52].forEach(function (x) {
          eyes += '<div class="eye" style="position:absolute;left:' + w * x + 'px;top:' + (-h * 0.16) + 'px;width:' + h * 0.3 + 'px;height:' + h * 0.3 +
            'px;border-radius:50%;background:#fff;box-shadow:0 2px 3px rgba(30,43,74,0.22)"><div class="pupil" style="position:absolute;left:' + h * 0.08 +
            'px;top:' + h * 0.08 + 'px;width:' + h * 0.14 + 'px;height:' + h * 0.14 + 'px;border-radius:50%;background:#1E2B4A"></div></div>';
        });
        var legs = "";
        [0.24, 0.6].forEach(function (x) {
          legs += '<div class="leg" style="position:absolute;left:' + w * x + 'px;top:' + h * 0.92 + 'px;width:' + h * 0.14 + 'px;height:' + h * 0.34 +
            'px;border-radius:' + h * 0.07 + 'px;background:' + legColor + ';box-shadow:0 2px 3px rgba(30,43,74,0.18);transform-origin:50% 0"></div>';
        });
        d.innerHTML = legs + eyes;
        it.el.appendChild(d);
        anim(d, [{ offset: 0, transform: "scale(0)" }, { offset: 0.08, transform: "scale(1.15)", easing: POP }, { offset: 0.12, transform: "scale(1)" },
                 { offset: 0.86, transform: "scale(1)" }, { offset: 0.92, transform: "scale(0)" }, { offset: 1, transform: "scale(0)" }], D, k * 60);
        Array.prototype.forEach.call(d.querySelectorAll(".pupil"), function (p) { // look around in a panic, then look where they're running
          var a = h * 0.07;
          anim(p, [{ offset: 0, transform: "translate(0,0)" }, { offset: 0.14, transform: "translate(" + -a + "px,0)" }, { offset: 0.2, transform: "translate(" + a + "px," + -a * 0.5 + "px)" },
                   { offset: 0.26, transform: "translate(" + -a + "px," + a * 0.5 + "px)" }, { offset: 0.32, transform: "translate(" + a + "px,0)" },
                   { offset: 0.38, transform: "translate(" + dir * a + "px," + a * 0.6 + "px)" }, { offset: 1, transform: "translate(" + dir * a + "px," + a * 0.6 + "px)" }], D, k * 60);
        });
        Array.prototype.forEach.call(d.querySelectorAll(".leg"), function (leg, j) {
          var s = j ? 1 : -1;
          anim(leg, [{ transform: "rotate(0deg)" }, { transform: "rotate(" + 35 * s + "deg)" }, { transform: "rotate(0deg)" }, { transform: "rotate(" + -35 * s + "deg)" },
                     { transform: "rotate(0deg)" }], 180, D * 0.38 + k * 60, null, Math.ceil(D * 0.5 / 180));
        });
        var f = [{ offset: 0, transform: T(it.sx, it.sy) }];
        for (var q = 1; q <= 6; q++) f.push({ offset: 0.12 + q * 0.04, transform: T(it.sx + (q % 2 ? 2 : -2), it.sy - (q % 2 ? h * 0.12 : 0), { r: q % 2 ? 5 : -5 }) });
        f.push({ offset: 0.38, transform: T(it.sx, it.sy, { sx: 1.1, sy: 0.9 }) });
        var tripping = k === trip;
        for (var s = 1; s <= 24; s++) {
          var t = s / 24, x = it.sx + (it.ex - it.sx) * t, y = it.sy + (it.ey - it.sy) * t - h * 0.5 * Math.sin(Math.PI * t), bob = -h * 0.14 * Math.abs(Math.sin(Math.PI * 9 * t));
          var r = it.er * t + dir * 6;
          if (tripping && t > 0.45) { var c = (t - 0.45) / 0.55; r = it.er * t + dir * 720 * c; bob = -h * 0.6 * Math.sin(Math.PI * c); }
          f.push({ offset: 0.38 + 0.52 * t, transform: T(x, y + bob, { r: r }) });
        }
        var endR = it.er + (tripping ? dir * 720 : 0);
        f[f.length - 1].transform = T(it.ex, it.ey, { r: endR });
        f.push({ offset: 0.95, transform: T(it.ex, it.ey, { r: endR, sx: 1.12, sy: 0.88 }), easing: POP });
        f.push({ offset: 1, transform: T(it.ex, it.ey, { r: endR }) });
        run(it, f, D, k * 60);
      });
    },
    function rainbowSneeze(items) { // the left tile grows a horn and a nose and sneezes a rainbow that blows the others home
      var u = items[0], rest = items.slice(1), h = u.el.offsetHeight || 60, w = u.el.offsetWidth || h, W = window.innerWidth, D = 2400, CHOO = 0.42;
      var parts = unicornParts(w, h, { legs: false, tail: false, nose: true });
      u.el.appendChild(parts);
      anim(parts, [{ offset: 0, transform: "scale(0)" }, { offset: 0.08, transform: "scale(1.15)", easing: POP }, { offset: 0.12, transform: "scale(1)" },
                   { offset: 0.8, transform: "scale(1)" }, { offset: 0.86, transform: "scale(0)" }, { offset: 1, transform: "scale(0)" }], D);
      var f = [{ offset: 0, transform: T(u.sx, u.sy) }, { offset: 0.12, transform: T(u.sx, u.sy), easing: "ease-in-out" },
               { offset: 0.2, transform: T(u.sx - 4, u.sy - h * 0.05, { r: -10, sx: 1.05, sy: 1.08 }), easing: "ease-in-out" },
               { offset: 0.26, transform: T(u.sx, u.sy, { r: -4 }), easing: "ease-in-out" },
               { offset: 0.38, transform: T(u.sx - 8, u.sy - h * 0.12, { r: -20, sx: 1.1, sy: 1.15 }), easing: "cubic-bezier(.6,0,1,.6)" },
               { offset: CHOO, transform: T(u.sx + 10, u.sy + 4, { r: 14, sx: 1.15, sy: 0.85 }), easing: UP },
               { offset: CHOO + 0.08, transform: T(u.sx - h * 0.8, u.sy - h * 0.1, { r: -8 }), easing: "ease-out" },
               { offset: 0.74, transform: T(u.sx - h * 0.8, u.sy - h * 0.1), easing: UP }];
      run(u, home(f, 0.74, u.sx - h * 0.8, u.sy - h * 0.1, u), D, 0);
      // the sneeze: a fat rainbow blasting out of the nose
      var nx = u.sx + w * 0.5 + h * 0.3, ny = u.sy + h * 0.05, far = Math.min(W + h, nx + Math.max(W * 0.5, rest.length * h * 1.6 + h * 2));
      var pts = [];
      for (var i = 0; i <= 24; i++) { var t = i / 24; pts.push([nx + (far - nx) * t, ny - Math.sin(t * Math.PI) * h * 0.4 + Math.sin(t * 9) * h * 0.08 * t]); }
      var rb = rainbowAlong(pts, h * 0.17);
      reveal(rb, 220, D * CHOO);
      anim(rb.svg, [{ opacity: 1 }, { opacity: 1, offset: CHOO + 0.18 }, { opacity: 0, offset: CHOO + 0.3 }, { opacity: 0 }], D, 0, rb.svg);
      var b = extra("div");
      b.style.width = b.style.height = h * 1.9 + "px";
      b.innerHTML = burstSVG("ACHOO!");
      b.style.zIndex = 51;
      anim(b, [{ offset: 0, transform: at(nx, u.sy - h * 0.9) + "scale(0)", opacity: 1 }, { offset: CHOO, transform: at(nx, u.sy - h * 0.9) + "scale(0)", opacity: 1, easing: POP },
               { offset: CHOO + 0.05, transform: at(nx, u.sy - h * 0.9) + "scale(1.1) rotate(-8deg)", opacity: 1 },
               { offset: CHOO + 0.2, transform: at(nx, u.sy - h * 0.9) + "scale(1) rotate(-4deg)", opacity: 1 },
               { offset: CHOO + 0.28, transform: at(nx, u.sy - h * 0.9) + "scale(0.5)", opacity: 0 }, { offset: 1, transform: at(nx, u.sy - h * 0.9) + "scale(0.5)", opacity: 0 }], D, 0, b);
      rest.forEach(function (it, j) { // blown away, tumbling, then down into the tray
        var hit = CHOO + 0.02 + j * 0.015, bx = Math.min(W - h * 0.6, it.sx + W * 0.22 + j * h * 0.4), by = it.sy - h * (0.6 + Math.random() * 0.8);
        var spin = 540 + Math.random() * 360;
        var g = [{ offset: 0, transform: T(it.sx, it.sy) }, { offset: 0.3, transform: T(it.sx, it.sy), easing: "ease-in-out" },
                 { offset: 0.36, transform: T(it.sx + 4, it.sy, { r: 6 }), easing: "ease-in-out" }, { offset: hit, transform: T(it.sx, it.sy), easing: UP },
                 { offset: hit + 0.14, transform: T(bx, by, { r: spin * 0.5 }), easing: DOWN },
                 { offset: 0.94, transform: T(it.ex, it.ey, { r: it.er + spin, sx: 1.14, sy: 0.86 }), easing: POP },
                 { offset: 1, transform: T(it.ex, it.ey, { r: it.er + spin }) }];
        run(it, g, D, 0);
      });
      return { delay: D * CHOO, px: 12 };
    },
    function rainbowPoop(items) { // the left tile turns into a unicorn and poops a rainbow swirl; the others bounce on it, then it gets kicked
      var u = items[0], rest = items.slice(1), h = u.el.offsetHeight || 60, w = u.el.offsetWidth || h, W = window.innerWidth;
      var D = 4000, Du = D + 500, sc = D / Du, PLOP = 0.48, KICK = 0.9;
      var ux = Math.min(W - h * 3, u.sx + h * 2), uy = u.sy - h * 0.27, floorY = u.sy + h * 0.5, P = h * 1.05;
      var pxc = ux - w * 0.5 - P * 0.62, pyc = floorY - P / 2;
      function o(x) { return x * sc; }
      // The unicorn
      var deco = unicornParts(w, h), tail = deco.querySelector(".tail");
      u.el.appendChild(deco);
      anim(deco, [{ offset: 0, transform: "scale(0,0)" }, { offset: o(0.04), transform: "scale(1.15,1.15)", easing: POP }, { offset: o(0.06), transform: "scale(1,1)" },
                  { offset: o(0.56), transform: "scale(1,1)", easing: "ease-in-out" }, { offset: o(0.59), transform: "scale(-1,1)" },
                  { offset: o(0.66), transform: "scale(-1,1)", easing: "ease-in-out" }, { offset: o(0.69), transform: "scale(1,1)" },
                  { offset: o(0.92), transform: "scale(1,1)", easing: "ease-in" }, { offset: o(0.97), transform: "scale(0,0)" }, { offset: 1, transform: "scale(0,0)" }], Du);
      tail.style.transformOrigin = "100% 40%";
      anim(tail, [{ offset: 0, transform: "rotate(0deg)" }, { offset: 0.2, transform: "rotate(0deg)", easing: UP }, { offset: 0.24, transform: "rotate(60deg)" },
                  { offset: 0.45, transform: "rotate(60deg)", easing: "ease-in-out" }, { offset: 0.5, transform: "rotate(0deg)" }, { offset: 1, transform: "rotate(0deg)" }], D);
      Array.prototype.forEach.call(deco.querySelectorAll(".leg"), function (leg, j) {
        var s = j % 2 ? 1 : -1;
        anim(leg, [{ transform: "rotate(0deg)" }, { transform: "rotate(" + 28 * s + "deg)" }, { transform: "rotate(0deg)" },
                   { transform: "rotate(" + -28 * s + "deg)" }, { transform: "rotate(0deg)" }], 240, D * 0.06, null, 2);
      });
      var f = [{ offset: 0, transform: T(u.sx, u.sy) }, { offset: o(0.06), transform: T(u.sx, u.sy - h * 0.1, { sx: 1.08, sy: 0.92 }) }];
      for (var i = 1; i <= 8; i++) {
        var t = i / 8;
        f.push({ offset: o(0.06 + 0.12 * t), transform: T(u.sx + (ux - u.sx) * t, u.sy + (uy - u.sy) * t - h * 0.25 * Math.abs(Math.sin(Math.PI * 2 * t)), { r: -8 * Math.cos(Math.PI * 4 * t) * (1 - t) }) });
      }
      [[0.2, 0, 1, 1, 0, "ease-in-out"], [0.24, 0.1, 1.06, 0.9, 0], [0.27, 0.14, 1.1, 0.84, -4], [0.3, 0.1, 1.04, 0.92, 0], [0.34, 0.15, 1.12, 0.82, 4],
       [0.37, 0.1, 1.04, 0.92, 0], [0.41, 0.16, 1.14, 0.8, -5], [0.44, 0.1, 1.06, 0.9, 0, UP], [0.48, -0.4, 0.95, 1.08, 0, DOWN], [0.52, 0, 1.08, 0.92, 0, POP],
       [0.55, 0, 1, 1, 0], [0.6, 0, 1, 1, -6], [0.65, 0, 1, 1, 6], [0.7, 0, 1, 1, 0], [0.86, 0, 1, 1, 0, "ease-in"], [0.89, -0.08, 1, 1, 24, UP], [0.92, 0, 1, 1, 0]
      ].forEach(function (k) { f.push({ offset: o(k[0]), transform: T(ux, uy + h * k[1], { sx: k[2], sy: k[3], r: k[4] }), easing: k[5] }); });
      run(u, home(f, o(0.92), ux, uy, u), Du, 0);
      // The rainbow swirl, squeezed out from behind the tile
      var poop = extra("div");
      poop.style.width = poop.style.height = P + "px";
      poop.style.transformOrigin = "60% 100%";
      poop.innerHTML = '<svg viewBox="0 0 100 100" width="100%" height="100%" style="overflow:visible;filter:' + SHADOW + '">' +
        [[86, 46, 13], [72, 39, 12], [59, 31, 11], [47, 23, 10], [36, 15, 9]].map(function (c, k) {
          return '<ellipse cx="50" cy="' + c[0] + '" rx="' + c[1] + '" ry="' + c[2] + '" fill="' + RAINBOW[k] + '"/>' +
            '<ellipse cx="' + (50 - c[1] * 0.5) + '" cy="' + (c[0] - c[2] * 0.35) + '" rx="' + c[1] * 0.22 + '" ry="' + c[2] * 0.28 + '" fill="#fff" opacity="0.45"/>';
        }).join("") +
        '<path d="M40 36 C40 22 52 16 62 4 C64 16 62 28 60 36 Z" fill="' + RAINBOW[5] + '"/>' +
        '<ellipse cx="41" cy="70" rx="3.2" ry="4.2" fill="#1E2B4A"/><ellipse cx="59" cy="70" rx="3.2" ry="4.2" fill="#1E2B4A"/>' +
        '<path d="M43 77 Q50 83 57 77" stroke="#1E2B4A" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>';
      var gap = Math.min(0.045, 0.15 / Math.max(1, rest.length)), first = 0.69;
      function ps(sx, sy, dy, op, easing) { return { transform: at(pxc, pyc + h * (dy || 0)) + "scale(" + sx + "," + sy + ")", opacity: op == null ? 1 : op, easing: easing }; }
      var pf = [[0, ps(0, 0)], [0.24, ps(0, 0, 0, 1, POP)], [0.28, ps(0.5, 0.35)], [0.31, ps(0.55, 0.4, 0, 1, POP)], [0.35, ps(0.8, 0.65)],
                [0.38, ps(0.82, 0.68, 0, 1, POP)], [0.42, ps(1, 1, 0, 1, UP)], [0.45, ps(0.92, 1.1, -0.2, 1, DOWN)], [PLOP, ps(1.18, 0.82, 0, 1, POP)],
                [0.52, ps(1, 1)], [first - 0.02, ps(1, 1)]];
      rest.forEach(function (it, j) { var l = first + j * gap; pf.push([l, ps(1.25, 0.7, 0, 1, POP)]); pf.push([l + gap * 0.8, ps(1, 1)]); });
      pf.push([0.885, ps(1, 1, 0, 1, "ease-in")], [KICK, ps(1.4, 0.35)], [0.92, ps(1.6, 0.1, 0, 0)], [1, ps(1.6, 0.1, 0, 0)]);
      anim(poop, pf.map(function (p) { p[1].offset = p[0]; return p[1]; }), D, 0, poop);
      // Stink lines, in rainbow colors
      [3, 4, 5].forEach(function (c, k) {
        var s = extra("svg"), x = pxc + (k - 1) * h * 0.32, y = floorY - P - h * 0.3, d = k * 0.03;
        s.setAttribute("viewBox", "0 0 20 60"); s.style.width = h * 0.2 + "px"; s.style.height = h * 0.6 + "px"; s.style.filter = SHADOW;
        s.innerHTML = '<path d="M10 57 C2 47 18 39 10 29 C2 19 18 11 10 3" stroke="' + RAINBOW[c] + '" stroke-width="5" fill="none" stroke-linecap="round"/>';
        anim(s, [{ offset: 0, transform: at(x, y) + "scale(0.6)", opacity: 0 }, { offset: 0.5 + d, transform: at(x, y) + "scale(0.6)", opacity: 0 },
                 { offset: 0.56 + d, transform: at(x, y - h * 0.15) + "scale(1)", opacity: 1 }, { offset: 0.74 + d, transform: at(x + h * 0.1, y - h * 0.5) + "scale(1)", opacity: 1 },
                 { offset: 0.82 + d, transform: at(x, y - h * 0.75) + "scale(0.8)", opacity: 0 }, { offset: 1, transform: at(x, y - h * 0.75) + "scale(0.8)", opacity: 0 }], D, 0, s);
      });
      // The kick: the swirl splats into rainbow drops
      for (i = 0; i < 10; i++) {
        var a = Math.PI * (-0.92 + 0.84 * i / 9), dist = h * (1.2 + Math.random() * 0.9), dr = extra("div"), sx0 = pxc, sy0 = floorY - P * 0.3;
        dr.style.width = dr.style.height = h * 0.2 + "px"; dr.style.borderRadius = "50%"; dr.style.background = RAINBOW[i % 6]; dr.style.boxShadow = "0 2px 3px rgba(30,43,74,0.18)";
        anim(dr, [{ offset: 0, transform: at(sx0, sy0) + "scale(0)", opacity: 1 }, { offset: KICK, transform: at(sx0, sy0) + "scale(0)", opacity: 1, easing: UP },
                  { offset: 0.95, transform: at(sx0 + Math.cos(a) * dist * 0.7, sy0 + Math.sin(a) * dist * 0.7) + "scale(1.1)", opacity: 1, easing: DOWN },
                  { offset: 1, transform: at(sx0 + Math.cos(a) * dist, sy0 + Math.sin(a) * dist * 0.6 + h * 0.6) + "scale(0.5)", opacity: 0 }], D, 0, dr);
      }
      // The others: step aside, lean away in disgust, then bounce off the swirl like a trampoline and home
      var start = ux + w * 0.5 + h * 1.0, step = Math.min(h * 1.25, (W - h * 0.7 - start) / Math.max(1, rest.length - 1));
      var topY = floorY - P - h * 0.45;
      rest.forEach(function (it, j) {
        var rx = start + j * step, ry = it.sy, l = first + j * gap, s0 = l - 0.07;
        var g = [{ offset: 0, transform: T(it.sx, it.sy) }, { offset: 0.03 + j * 0.01, transform: T(it.sx, it.sy), easing: UP },
                 { offset: 0.09 + j * 0.01, transform: T((it.sx + rx) / 2, Math.min(it.sy, ry) - h * 0.8), easing: DOWN },
                 { offset: 0.15 + j * 0.01, transform: T(rx, ry, { sx: 1.1, sy: 0.9 }), easing: POP }, { offset: 0.2 + j * 0.01, transform: T(rx, ry) },
                 { offset: 0.5, transform: T(rx, ry), easing: "ease-out" }, { offset: 0.54, transform: T(rx + h * 0.15, ry, { r: 18 }), easing: "ease-in-out" },
                 { offset: 0.57, transform: T(rx + h * 0.15, ry, { r: 10 }), easing: "ease-in-out" }, { offset: 0.6, transform: T(rx + h * 0.15, ry, { r: 18 }) },
                 { offset: s0, transform: T(rx + h * 0.15, ry, { r: 18 }), easing: UP },
                 { offset: (s0 + l) / 2, transform: T((rx + pxc) / 2, Math.min(ry, topY) - h * 2, { r: -170 }), easing: DOWN },
                 { offset: l, transform: T(pxc, topY + h * 0.12, { r: -360, sx: 1.12, sy: 0.85 }), easing: UP }];
        run(it, home(g, l, pxc, topY, it, { fromR: -360, spin: -360 }), D, 0);
      });
      return { delay: D * PLOP, px: 10 };
    },
    function atomicBomb(items) { // an operator tile grows fins, drops, and goes off: a white flash and a rainbow mushroom cloud that carries the tiles up
      var D = 4400, n = items.length, h = items[0].el.offsetHeight || 60, W = window.innerWidth, Hs = window.innerHeight, gy = 0;
      items.forEach(function (it) { gy += it.sy / n; });
      var b = items.filter(function (it) { return /\b(add|mul)\b/.test(it.el.className); })[0] || items[Math.floor(n / 2)];
      var r = h * 0.42, gap = h * 0.6, capW = Math.max(h * 4.2, n * h * 1.15 + h * 0.6);
      var ix = capW + h > W ? W / 2 : Math.min(W - capW / 2 - h * 0.5, Math.max(capW / 2 + h * 0.5, b.sx));
      var capY = Math.max(h * 2.7, gy - h * 0.3), floorY = Math.min(Hs - h * 0.6, capY + h * 3.8), topY = Math.max(h * 1.2, gy - h * 1.8);
      var LIFT = 0.1, TOP = 0.24, DROP = 0.32, HIT = 0.4, RISE = 0.54, PUFF = 0.8;
      // fins and a lit fuse grow out of the bomb tile
      var w = b.el.offsetWidth || h, deco = document.createElement("div"), sz = h * 0.2;
      deco.className = "deco";
      deco.innerHTML = '<svg viewBox="0 0 100 50" preserveAspectRatio="none" style="position:absolute;left:0;top:' + (-h * 0.45) + 'px;width:' + w + 'px;height:' + (h * 0.5) +
        'px;overflow:visible;filter:' + SHADOW + '"><path d="M50 50 C38 36 62 26 50 12" stroke="#b08a5a" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<path d="M6 52 L2 4 L36 52 Z" fill="' + RAINBOW[5] + '"/><path d="M94 52 L98 4 L64 52 Z" fill="' + RAINBOW[5] + '"/></svg>' +
        '<div class="spark" style="position:absolute;left:' + (w * 0.5 - sz / 2) + 'px;top:' + (-h * 0.39 - sz / 2) + 'px;width:' + sz + 'px;height:' + sz + 'px;background:' + RAINBOW[2] + '"></div>';
      b.el.appendChild(deco);
      anim(deco, [{ offset: 0, transform: "scale(0)" }, { offset: 0.06, transform: "scale(1.15)", easing: POP }, { offset: 0.09, transform: "scale(1)" },
                  { offset: HIT - 0.003, transform: "scale(1)" }, { offset: HIT, transform: "scale(0)" }, { offset: 1, transform: "scale(0)" }], D);
      anim(deco.querySelector(".spark"), [{ transform: "scale(0.6) rotate(0deg)" }, { transform: "scale(1.3) rotate(45deg)" }, { transform: "scale(0.6) rotate(90deg)" }], 160, 0, null, Math.ceil(D * HIT / 160));
      // where each tile rides on top of the cloud
      var order = items.slice().sort(function (p, q) { return p.sx - q.sx; });
      function seat(j) { var x = ix + (j - (n - 1) / 2) * h * 1.15, e = (x - ix) / (capW / 2); return [x, capY - h * 1.25 - r - h * 0.35 + e * e * h * 0.9]; }
      order.forEach(function (it, j) {
        var st = seat(j), spin = (j % 2 ? -1 : 1) * (it === b ? 720 : 360), f;
        if (it === b) {
          f = [{ offset: 0, transform: T(b.sx, b.sy) }, { offset: LIFT, transform: T(b.sx, b.sy, { sx: 1.1, sy: 0.9 }), easing: UP },
               { offset: TOP, transform: T(ix, topY), easing: "ease-in-out" }, { offset: 0.27, transform: T(ix, topY, { r: -10 }), easing: "ease-in-out" },
               { offset: 0.3, transform: T(ix, topY, { r: 10 }), easing: "ease-in-out" }, { offset: DROP, transform: T(ix, topY - h * 0.15), easing: "cubic-bezier(.5,0,1,.5)" },
               { offset: HIT, transform: T(ix, floorY - h * 0.5, { sx: 1.3, sy: 0.6 }) },
               { offset: HIT + 0.02, transform: T(ix, floorY - h * 0.5, { sx: 0.9, sy: 1.15 }), easing: "cubic-bezier(.1,.9,.3,1)" }];
        } else {
          f = [{ offset: 0, transform: T(it.sx, it.sy) }, { offset: 0.24, transform: T(it.sx, it.sy), easing: "ease-in-out" }];
          for (var q = 0; q < 6; q++) f.push({ offset: 0.26 + q * 0.024, transform: T(it.sx + (q % 2 ? 2 : -2), it.sy, { r: q % 2 ? 4 : -4 }), easing: "ease-in-out" });
          f.push({ offset: HIT, transform: T(it.sx, it.sy), easing: "cubic-bezier(.1,.9,.3,1)" });
        }
        f.push({ offset: RISE, transform: T(st[0], st[1], { r: spin }), easing: "ease-in-out" },
               { offset: 0.62, transform: T(st[0], st[1] - h * 0.12, { r: spin }), easing: "ease-in-out" },
               { offset: 0.7, transform: T(st[0], st[1], { r: spin }), easing: "ease-in-out" },
               { offset: 0.76, transform: T(st[0], st[1] - h * 0.12, { r: spin }), easing: "ease-in-out" },
               { offset: PUFF, transform: T(st[0], st[1], { r: spin }), easing: UP });
        run(it, home(f, PUFF, st[0], st[1], it, { fromR: spin, spin: spin }), D, 0);
      });
      // the mushroom cloud, built from flat rainbow puffs
      function puff(rad, color, frames) {
        var p = extra("div");
        p.style.width = p.style.height = 2 * rad + "px";
        p.style.borderRadius = "50%"; p.style.background = color; p.style.boxShadow = "0 2px 4px rgba(30,43,74,0.18)";
        anim(p, frames, D, 0, p);
      }
      var base = [ix, floorY - r * 0.8], cnt = Math.max(4, Math.ceil((floorY - capY) / (h * 0.5)));
      for (var i = 0; i < cnt; i++) { // the stem
        var sx0 = ix + (i % 2 ? 0.12 : -0.12) * h, sy0 = floorY - r * 0.8 - i * (floorY - capY - r * 0.8) / cnt, ta = HIT + 0.012 * i;
        puff(r * (1.3 - 0.35 * i / cnt), RAINBOW[4 + (i % 2)], [{ offset: 0, transform: at(base[0], base[1]) + "scale(0)", opacity: 1 },
          { offset: ta, transform: at(base[0], base[1]) + "scale(0)", opacity: 1, easing: POP }, { offset: ta + 0.06, transform: at(sx0, sy0) + "scale(1)", opacity: 1 },
          { offset: PUFF, transform: at(sx0, sy0) + "scale(1.05)", opacity: 1, easing: "ease-in" },
          { offset: PUFF + 0.12, transform: at(sx0 + (i % 2 ? 1 : -1) * h * 0.3, sy0 - h * 0.4) + "scale(1.3)", opacity: 0 },
          { offset: 1, transform: at(sx0, sy0 - h * 0.4) + "scale(1.3)", opacity: 0 }]);
      }
      for (i = 0; i < 8; i++) { // the ground surge
        var side = i % 2 ? 1 : -1, k = Math.floor(i / 2), gx = ix + side * (k + 1) * h * 0.55, gyy = floorY - r * 0.6;
        puff(r * (0.9 - k * 0.1), RAINBOW[k + 1], [{ offset: 0, transform: at(ix, gyy) + "scale(0)", opacity: 1 }, { offset: HIT, transform: at(ix, gyy) + "scale(0)", opacity: 1, easing: "cubic-bezier(.1,.9,.3,1)" },
          { offset: HIT + 0.1, transform: at(gx, gyy) + "scale(1)", opacity: 1 }, { offset: 0.72, transform: at(gx + side * h * 0.6, gyy - h * 0.2) + "scale(1.15)", opacity: 0 },
          { offset: 1, transform: at(gx + side * h * 0.6, gyy - h * 0.2) + "scale(1.15)", opacity: 0 }]);
      }
      [[0.4, 0.9, 3], [-0.15, 1, 2], [-0.7, 0.85, 1], [-1.25, 0.55, 0]].forEach(function (row) { // the cap, bottom row first so the top sits in front
        var rw = capW * row[1], m = Math.max(2, Math.round(rw / gap));
        for (var p = 0; p < m; p++) {
          var x = ix - rw / 2 + p * rw / (m - 1), y = capY + row[0] * h + (p % 2 ? 0.06 : -0.06) * h, dx = (x - ix) * 0.5;
          puff(r * 1.05, RAINBOW[row[2]], [{ offset: 0, transform: at(ix, floorY - r) + "scale(0)", opacity: 1 },
            { offset: HIT, transform: at(ix, floorY - r) + "scale(0)", opacity: 1 },
            { offset: HIT + 0.02, transform: at(ix, floorY - r) + "scale(0.3)", opacity: 1, easing: "cubic-bezier(.1,.9,.3,1)" },
            { offset: RISE, transform: at(x, y) + "scale(1)", opacity: 1, easing: "ease-in-out" }, { offset: 0.64, transform: at(x, y) + "scale(1.1)", opacity: 1, easing: "ease-in-out" },
            { offset: 0.72, transform: at(x, y) + "scale(1)", opacity: 1, easing: "ease-in-out" }, { offset: PUFF, transform: at(x, y) + "scale(1.08)", opacity: 1, easing: "ease-in" },
            { offset: PUFF + 0.14, transform: at(x + dx, y - h * 0.6) + "scale(1.4)", opacity: 0 }, { offset: 1, transform: at(x + dx, y - h * 0.6) + "scale(1.4)", opacity: 0 }]);
        }
      });
      // the flash
      var fl = extra("div");
      fl.style.width = "100vw"; fl.style.height = "100vh"; fl.style.background = "#fffdf2"; fl.style.zIndex = 60;
      anim(fl, [{ offset: 0, opacity: 0 }, { offset: HIT - 0.002, opacity: 0 }, { offset: HIT, opacity: 1 }, { offset: HIT + 0.03, opacity: 0.92, easing: "ease-out" },
                { offset: HIT + 0.11, opacity: 0 }, { offset: 1, opacity: 0 }], D, 0, fl);
      if (!FX.keep && navigator.vibrate) setTimeout(function () { try { navigator.vibrate([300, 80, 160]); } catch (e) {} }, D * HIT); // Android phones only; iPads can't vibrate
      return { rumbles: [{ delay: D * HIT, px: 18, dur: 1500 }, { delay: D * PUFF, px: 8, dur: 600 }] };
    }
  ];

  // The rumble: the whole screen shakes, hard at first and then settling.
  function rumble(delay, px, dur) {
    var page = document.getElementById("app") || document.getElementById("page");
    if (!page) return;
    var n = Math.max(5, Math.round(dur / 70)), f = [{ transform: "translate(0px,0px) rotate(0deg)" }];
    for (var i = 1; i < n; i++) {
      var a = px * Math.pow(1 - i / n, 1.2), sg = i % 2 ? -1 : 1;
      f.push({ transform: "translate(" + (sg * a * (0.7 + Math.random() * 0.3)).toFixed(1) + "px," + (-sg * a * (0.4 + Math.random() * 0.4)).toFixed(1) + "px) rotate(" + (sg * a * 0.05).toFixed(2) + "deg)" });
    }
    f.push({ transform: "translate(0px,0px) rotate(0deg)" });
    page.animate(f, { duration: dur, delay: delay, easing: "linear" });
  }

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
    var res = actions[n](items) || {}; // an action can time its rumble (or several) to its big moments
    (res.rumbles || [res]).forEach(function (r) { rumble(r.delay || 0, r.px || 8, r.dur || 420); });
  };

  window.FX = FX;
})();
