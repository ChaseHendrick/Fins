/* Rendering effects for Fin's. Water motion is shared with water.js.
   People follow the engine's positions; drawing must not push a person away
   from their own previous frame. Every hook is guarded. */
(function () {
  "use strict";

  var origs = window.__techOrigs || (window.__techOrigs = {});
  var T = { v: 3, ok: 1, kelp: 0, folk: 0, fish: 0, lastErr: "" };
  window.__tech = T;

  var reduced = false;
  try {
    reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch (e) {}

  var PI2 = Math.PI * 2;
  var STEP = 1 / 60;
  var acc = 0;
  var simT = 0;
  var frameDt = 0.016;
  var lastPtr = { x: 0.5, y: 0.5 };
  var lastTanks = [];
  var lastFloorY = 0;
  var lastWx = {};
  var fishDrawn = 0;
  var folkDrawn = 0;

  function clamp(x, a, b) {
    return x < a ? a : x > b ? b : x === x ? x : a;
  }
  function frac(x) {
    return x - Math.floor(x);
  }
  function halton(i, b) {
    var f = 1, r = 0;
    while (i > 0) {
      f /= b;
      r += f * (i % b);
      i = (i / b) | 0;
    }
    return r;
  }
  function o2q() {
    try {
      if (typeof o2Tank === "function") {
        var v = o2Tank();
        if (v && typeof v === "object") v = v.mean != null ? v.mean : v.worst;
        v = +v;
        if (v === v) return clamp(v, 0.15, 1);
      }
      if (window.G && typeof window.G.o2 === "number") return clamp(window.G.o2, 0.15, 1);
    } catch (e) {}
    return 0.7;
  }
  function sceneName() {
    try {
      if (document.body.classList.contains("titling")) return "title";
      if (document.body.classList.contains("work")) return "work";
      if (window.__scene) return String(window.__scene);
      if (window.G && window.G.scene) return String(window.G.scene);
      if (typeof rr === "function") return String(rr() || "tank");
    } catch (e) {}
    return "tank";
  }
  function isQuiet() {
    var s = sceneName();
    return s === "title" || s === "work";
  }

  /* ── simplex 2D (Stefan Gustavson) + fBm + curl ── */
  var perm = new Uint8Array(512);
  (function seedPerm() {
    var p = new Uint8Array(256);
    for (var i = 0; i < 256; i++) p[i] = i;
    var s = 1337;
    for (var j = 255; j > 0; j--) {
      s = (s * 16807 + 11) >>> 0;
      var k = s % (j + 1);
      var tmp = p[j];
      p[j] = p[k];
      p[k] = tmp;
    }
    for (var n = 0; n < 512; n++) perm[n] = p[n & 255];
  })();
  function grad2(h, x, y) {
    var g = h & 3;
    return ((g === 0 || g === 2) ? x : -x) + ((g === 1 || g === 2) ? y : -y);
  }
  function simplex2(xin, yin) {
    var F2 = 0.36602540378, G2 = 0.2113248654;
    var s = (xin + yin) * F2;
    var i = Math.floor(xin + s);
    var j = Math.floor(yin + s);
    var t = (i + j) * G2;
    var x0 = xin - (i - t);
    var y0 = yin - (j - t);
    var i1 = x0 > y0 ? 1 : 0;
    var j1 = x0 > y0 ? 0 : 1;
    var x1 = x0 - i1 + G2;
    var y1 = y0 - j1 + G2;
    var x2 = x0 - 1 + 2 * G2;
    var y2 = y0 - 1 + 2 * G2;
    var ii = i & 255, jj = j & 255;
    var n0 = 0, n1 = 0, n2 = 0;
    var t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * grad2(perm[ii + perm[jj]], x0, y0);
    }
    var t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * grad2(perm[ii + i1 + perm[jj + j1]], x1, y1);
    }
    var t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * grad2(perm[ii + 1 + perm[jj + 1]], x2, y2);
    }
    return 70 * (n0 + n1 + n2);
  }
  function fbm(x, y) {
    return simplex2(x, y) * 0.55 + simplex2(x * 2.03, y * 2.03) * 0.3 + simplex2(x * 4.07, y * 4.07) * 0.15;
  }
  var _cx = 0, _cy = 0;
  function curl(x, y, t) {
    var e = 1.7;
    var n1 = fbm(x * 0.008, (y + e) * 0.008 + t * 0.07);
    var n2 = fbm(x * 0.008, (y - e) * 0.008 + t * 0.07);
    var n3 = fbm((x + e) * 0.008 + t * 0.05, y * 0.008);
    var n4 = fbm((x - e) * 0.008 + t * 0.05, y * 0.008);
    _cx = (n1 - n2) * 18;
    _cy = (n4 - n3) * 18;
    return _cx;
  }

  function ign(x, y) {
    return frac(52.9829189 * frac(x * 0.06711056 + y * 0.00583715));
  }

  function worley(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    var d = 9;
    for (var oy = -1; oy <= 1; oy++) {
      for (var ox = -1; ox <= 1; ox++) {
        var hx = ix + ox, hy = iy + oy;
        var n = perm[(hx + perm[hy & 255]) & 255];
        var px = ox + (n / 255) * 0.85;
        var py = oy + (perm[(n + 37) & 255] / 255) * 0.85;
        var dx = fx - px, dy = fy - py;
        var q = dx * dx + dy * dy;
        if (q < d) d = q;
      }
    }
    return Math.sqrt(d);
  }

  var waves = [];
  function addWave(x, y, amp) {
    waves.push({ x: x, y: y, r: 6, amp: amp || 1, life: 1 });
    if (waves.length > 14) waves.shift();
  }
  function stepWaves(dt) {
    for (var i = waves.length - 1; i >= 0; i--) {
      var w = waves[i];
      w.r += 70 * dt;
      w.life -= dt * 0.7;
      w.amp *= Math.pow(0.55, dt);
      if (w.life <= 0) waves.splice(i, 1);
    }
  }
  function drawWaves(ctx, clip) {
    if (!waves.length) return;
    ctx.save();
    if (clip) {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(clip[0], clip[1], clip[2], clip[3], 3);
      else ctx.rect(clip[0], clip[1], clip[2], clip[3]);
      ctx.clip();
    }
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < waves.length; i++) {
      var w = waves[i];
      ctx.globalAlpha = 0.22 * w.life * w.amp;
      ctx.strokeStyle = "rgba(190,230,255,1)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, PI2);
      ctx.stroke();
      ctx.globalAlpha = 0.1 * w.life * w.amp;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r * 0.55, 0, PI2);
      ctx.stroke();
    }
    ctx.restore();
  }

  var vortices = [];
  function addVortex(x, y, s) {
    vortices.push({ x: x, y: y, s: s || 1, life: 1 });
    if (vortices.length > 8) vortices.shift();
  }
  function vortexAt(x, y) {
    var vx = 0, vy = 0;
    for (var i = 0; i < vortices.length; i++) {
      var v = vortices[i];
      var dx = x - v.x, dy = y - v.y;
      var d2 = dx * dx + dy * dy + 400;
      var mag = (v.s * v.life * 140) / d2;
      vx += -dy * mag;
      vy += dx * mag;
    }
    return { x: vx, y: vy };
  }

  function wrap(name, around) {
    if (!origs[name]) {
      if (typeof window[name] !== "function") return false;
      origs[name] = window[name];
    }
    var orig = origs[name];
    window[name] = function () {
      return around(orig, this, arguments);
    };
    return true;
  }

  var causticTile = null;
  (function bakeCaustic() {
    var W = 128, H = 128;
    var cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    var g = cv.getContext("2d");
    var img = g.createImageData(W, H);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var u = x / W, v = y / H;
        var wx = u + 0.14 * Math.sin(v * PI2 * 3) + 0.07 * Math.sin(v * PI2 * 7);
        var wy = v + 0.14 * Math.sin(u * PI2 * 3) + 0.07 * Math.sin(u * PI2 * 5);
        var n = Math.abs(Math.sin(wx * PI2 * 4) * Math.sin(wy * PI2 * 4));
        n = 1 - Math.abs(n * 2 - 1);
        n = Math.pow(n, 3.4);
        var i = (y * W + x) * 4;
        img.data[i] = 186;
        img.data[i + 1] = 228;
        img.data[i + 2] = 255;
        img.data[i + 3] = (n * 150) | 0;
      }
    }
    g.putImageData(img, 0, 0);
    causticTile = cv;
  })();
  function fillCaustics(ctx, x, y, w, h, t, a) {
    if (!causticTile || w < 4 || h < 4) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = a == null ? 0.22 : a;
    var ox = frac(t * 0.07) * 128;
    var oy = frac(t * 0.045) * 128;
    var pat = ctx.createPattern(causticTile, "repeat");
    if (pat) {
      ctx.translate(x - ox, y - oy);
      ctx.fillStyle = pat;
      ctx.fillRect(ox, oy, w, h);
    }
    ctx.restore();
  }

  var kelp = [];
  var kelpKey = "";
  function makeStrand(x, y, h, seed) {
    var n = reduced ? 5 : 8;
    var pts = [];
    for (var i = 0; i < n; i++) {
      pts.push({
        x: x + ((seed % 7) - 3) * 0.4,
        y: y - (i / (n - 1)) * h,
        px: x,
        py: y - (i / (n - 1)) * h,
        pin: i === 0,
        bx: x,
        by: y
      });
    }
    pts[0].bx = x;
    pts[0].by = y;
    return { pts: pts, rest: h / (n - 1), hue: 110 + (seed % 40), thick: 2.6 + (seed % 5) * 0.4 };
  }
  function ensureKelp(tanks) {
    var key = tanks.length + ":" + (tanks[0] && tanks[0][0] | 0) + ":" + (tanks[0] && tanks[0][2] | 0);
    if (key === kelpKey && kelp.length) return;
    kelpKey = key;
    kelp = [];
    for (var i = 0; i < tanks.length; i++) {
      var tk = tanks[i];
      var n = reduced ? 2 : 3;
      for (var s = 0; s < n; s++) {
        var x = tk[0] + tk[2] * (0.18 + (s + 0.4) * 0.22 + ((i * 3 + s) % 5) * 0.04);
        var y = tk[1] + tk[3] * 0.82;
        var h = tk[3] * (0.34 + (s % 3) * 0.08);
        kelp.push({ tank: i, strand: makeStrand(x, y, h, i * 17 + s * 9) });
      }
    }
  }
  function stepKelp(dt, t) {
    var drag = Math.pow(0.96, dt * 60);
    for (var k = 0; k < kelp.length; k++) {
      var pts = kelp[k].strand.pts;
      var rest = kelp[k].strand.rest;
      for (var i = 1; i < pts.length; i++) {
        var p = pts[i];
        var vx = (p.x - p.px) * drag;
        var vy = (p.y - p.py) * drag;
        p.px = p.x;
        p.py = p.y;
        curl(p.x, p.y, t);
        var vo = vortexAt(p.x, p.y);
        p.x += vx + _cx * dt * 2.4 + vo.x * dt;
        p.y += vy + _cy * dt * 2.4 + vo.y * dt - 6 * dt;
      }
      for (var it = 0; it < 3; it++) {
        for (var j = 1; j < pts.length; j++) {
          var a = pts[j - 1], b = pts[j];
          var dx = b.x - a.x, dy = b.y - a.y;
          var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
          var corr = ((d - rest) / d) * 0.5;
          if (!a.pin) {
            a.x += dx * corr;
            a.y += dy * corr;
          }
          b.x -= dx * corr;
          b.y -= dy * corr;
        }
        if (pts[0].pin) {
          pts[0].x = pts[0].bx;
          pts[0].y = pts[0].by;
        }
      }
    }
    T.kelp = kelp.length;
  }
  function crPoint(p0, p1, p2, p3, t, out) {
    var t2 = t * t, t3 = t2 * t;
    out.x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    out.y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  }
  var _cr = { x: 0, y: 0 };
  function drawKelp(ctx, tanks) {
    if (!kelp.length) return;
    // Over the painted plates in the shop the strands are drawn as fronds in the water: darker,
    // desaturated, and half-transparent, so they sit among the painted plants instead of reading
    // as crayon on top of them. The tank room keeps the full-strength strand.
    var painted = !!(window.shopBg && window.shopBg.complete && window.shopBg.naturalWidth) && sceneName() === "shop";
    for (var k = 0; k < kelp.length; k++) {
      var item = kelp[k];
      var tk = tanks[item.tank];
      if (!tk) continue;
      var pts = item.strand.pts;
      var n = pts.length;
      ctx.save();
      clipTank(ctx, tk, item.tank);
      ctx.strokeStyle = painted
        ? "rgba(26," + (72 + (item.strand.hue % 30)) + ",40,.5)"
        : "rgba(36," + (110 + (item.strand.hue % 40)) + ",58,.92)";
      ctx.lineWidth = painted ? item.strand.thick + 0.2 : item.strand.thick + 0.8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 0; i < n - 1; i++) {
        var p0 = pts[i === 0 ? 0 : i - 1];
        var p1 = pts[i];
        var p2 = pts[i + 1];
        var p3 = pts[i + 2] || p2;
        for (var s = 1; s <= 4; s++) {
          crPoint(p0, p1, p2, p3, s / 4, _cr);
          ctx.lineTo(_cr.x, _cr.y);
        }
      }
      ctx.stroke();
      ctx.strokeStyle = painted ? "rgba(120,190,120,.14)" : "rgba(110,200,130,.38)";
      ctx.lineWidth = Math.max(1, item.strand.thick * 0.45);
      ctx.stroke();
      ctx.restore();
    }
  }

  var sph = [];
  var sphKey = "";
  function ensureSph(tanks) {
    var key = tanks.length + ":" + (tanks[0] && tanks[0][2] | 0);
    if (key === sphKey && sph.length) return;
    sphKey = key;
    sph = [];
    var per = reduced ? 5 : 8;
    for (var i = 0; i < tanks.length; i++) {
      for (var b = 0; b < per; b++) {
        var id = i * per + b;
        sph.push({
          tank: i,
          u: 0.1 + halton(id + 3, 2) * 0.8,
          v: halton(id + 5, 3),
          r: 0.9 + halton(id, 5) * 1.7,
          vx: 0,
          vy: 0
        });
      }
    }
  }
  function stepSph(dt, t) {
    var n = sph.length;
    for (var i = 0; i < n; i++) {
      var a = sph[i];
      var tk = lastTanks[a.tank];
      if (!tk) continue;
      var x = tk[0] + 6 + a.u * (tk[2] - 12);
      var y = tk[1] + tk[3] * 0.14 + a.v * tk[3] * 0.66;
      curl(x, y, t);
      a.vx = a.vx * 0.92 + _cx * dt * 4;
      a.vy = a.vy * 0.92 - 0.22 * dt + _cy * dt * 2;
      for (var j = i + 1; j < n; j++) {
        var b = sph[j];
        if (b.tank !== a.tank) continue;
        var du = a.u - b.u, dv = a.v - b.v;
        var d2 = du * du + dv * dv;
        var min = 0.045;
        if (d2 > 0.00001 && d2 < min * min) {
          var d = Math.sqrt(d2);
          var push = (min - d) * 0.5;
          a.u += (du / d) * push;
          a.v += (dv / d) * push;
          b.u -= (du / d) * push;
          b.v -= (dv / d) * push;
        }
      }
      a.u += a.vx * dt * 0.15;
      a.v += a.vy * dt * 0.55;
      if (a.u < 0.06) { a.u = 0.06; a.vx *= -0.4; }
      if (a.u > 0.94) { a.u = 0.94; a.vx *= -0.4; }
      if (a.v < 0) {
        a.v = 1;
        a.u = 0.1 + halton((i + (t * 10) | 0) & 255, 2) * 0.8;
        a.vx = 0;
        a.vy = 0;
      }
      if (a.v > 1) a.v = 1;
    }
  }
  function drawSph(ctx, tk, tankI) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    for (var i = 0; i < sph.length; i++) {
      var a = sph[i];
      if (a.tank !== tankI) continue;
      var bx = tk[0] + 6 + a.u * (tk[2] - 12);
      var by = tk[1] + tk[3] * 0.14 + a.v * tk[3] * 0.66;
      var r = a.r;
      ctx.globalAlpha = 0.28 + 0.4 * (1 - a.v);
      ctx.strokeStyle = "rgba(210,240,255,.85)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, PI2);
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.beginPath();
      ctx.arc(bx - r * 0.3, by - r * 0.35, Math.max(0.5, r * 0.28), 0, PI2);
      ctx.fill();
    }
    ctx.restore();
  }

  var markCache = new Map();
  function bakeMark(seed) {
    seed = seed | 0;
    if (markCache.has(seed)) return markCache.get(seed);
    var W = 32, H = 24, N = W * H;
    var A = new Float32Array(N), B = new Float32Array(N);
    var i, x, y;
    for (i = 0; i < N; i++) {
      A[i] = 1;
      B[i] = 0;
    }
    var rng = seed || 1;
    function rnd() {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 4294967296;
    }
    for (i = 0; i < 18; i++) {
      var cx = (2 + rnd() * (W - 4)) | 0;
      var cy = (2 + rnd() * (H - 4)) | 0;
      B[cy * W + cx] = 1;
    }
    var F = 0.037 + (Math.abs(seed) % 9) * 0.002;
    var K = 0.06 + (Math.abs(seed) % 7) * 0.0015;
    var ru = 0.16, rv = 0.08;
    var steps = reduced ? 12 : 28;
    for (var s = 0; s < steps; s++) {
      var nA = new Float32Array(N), nB = new Float32Array(N);
      for (y = 1; y < H - 1; y++) {
        for (x = 1; x < W - 1; x++) {
          var idx = y * W + x;
          var lapA = A[idx - 1] + A[idx + 1] + A[idx - W] + A[idx + W] - 4 * A[idx];
          var lapB = B[idx - 1] + B[idx + 1] + B[idx - W] + B[idx + W] - 4 * B[idx];
          var a = A[idx], b = B[idx], abb = a * b * b;
          nA[idx] = a + ru * lapA - abb + F * (1 - a);
          nB[idx] = b + rv * lapB + abb - (K + F) * b;
        }
      }
      A = nA;
      B = nB;
    }
    var cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    var g = cv.getContext("2d");
    var img = g.createImageData(W, H);
    for (i = 0; i < N; i++) {
      var v = Math.max(0, Math.min(1, B[i] * 1.8));
      img.data[i * 4] = 255;
      img.data[i * 4 + 1] = 255;
      img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = (v * 90) | 0;
    }
    g.putImageData(img, 0, 0);
    if (markCache.size > 48) markCache.clear();
    markCache.set(seed, cv);
    return cv;
  }

  var tails = Object.create(null);
  function fishId(f) {
    return f && (f.fid || f.id || f.nick || 0);
  }
  function stepTail(id, x, y, dir, size, dt) {
    var t = tails[id];
    var segs = 6;
    var rest = size * 0.15;
    if (!t) {
      t = tails[id] = { p: [] };
      for (var i = 0; i < segs; i++) t.p.push({ x: x - dir * i * rest, y: y });
    }
    var k = 1 - Math.exp(-16 * dt);
    t.p[0].x += (x - dir * size * 0.18 - t.p[0].x) * k;
    t.p[0].y += (y - t.p[0].y) * k;
    for (var j = 1; j < t.p.length; j++) {
      var prev = t.p[j - 1];
      var cur = t.p[j];
      var dx = cur.x - prev.x, dy = cur.y - prev.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      var want = rest;
      cur.x = prev.x + (dx / d) * want;
      cur.y = prev.y + (dy / d) * want;
      var ang = Math.atan2(cur.y - prev.y, cur.x - prev.x);
      var restAng = dir < 0 ? 0 : Math.PI;
      var diff = ang - restAng;
      while (diff > Math.PI) diff -= PI2;
      while (diff < -Math.PI) diff += PI2;
      var maxA = 0.55;
      if (diff > maxA || diff < -maxA) {
        var a2 = restAng + clamp(diff, -maxA, maxA);
        cur.x = prev.x + Math.cos(a2) * want;
        cur.y = prev.y + Math.sin(a2) * want;
      }
    }
    return t.p;
  }


  var overlay = null, octx = null, grain = null, grainT = 0;
  var bloomA = null, bloomB = null, bloomTick = 0;
  // Last size the overlay bitmap was built at. ensureOverlay clears it when it
  // builds a new context, because a new context starts on identity.
  var ovW = 0, ovH = 0, ovDpr = 0;
  function ensureOverlay() {
    if (overlay && overlay.parentNode) return;
    overlay = document.getElementById("techfx");
    if (!overlay) {
      overlay = document.createElement("canvas");
      overlay.id = "techfx";
      overlay.setAttribute("aria-hidden", "true");
      document.body.appendChild(overlay);
    }
    octx = overlay.getContext("2d");
    ovW = ovH = ovDpr = 0;
    grain = document.createElement("canvas");
    grain.width = 96;
    grain.height = 96;
    var g = grain.getContext("2d");
    var img = g.createImageData(96, 96);
    for (var y = 0; y < 96; y++) {
      for (var x = 0; x < 96; x++) {
        var n = (ign(x, y) * 255) | 0;
        var i = (y * 96 + x) * 4;
        img.data[i] = n;
        img.data[i + 1] = n;
        img.data[i + 2] = n;
        img.data[i + 3] = 20;
      }
    }
    g.putImageData(img, 0, 0);
    bloomA = document.createElement("canvas");
    bloomB = document.createElement("canvas");
  }
  // `!==` binds tighter than `|`, so the old guard here read
  // `(overlay.width !== w * dpr) | 0` and came out 1 whenever the device ratio
  // was fractional. drawOverlay calls this every frame, and assigning a canvas
  // width tears the bitmap down and builds it again, so the bloom layer was
  // being reallocated sixty times a second on a scaled display. Compare the
  // rounded sizes, and only touch the canvas when one of them moved.
  function resizeOverlay() {
    ensureOverlay();
    var dpr = Math.min((window.__finsGlass && window.__finsGlass.dpr) || 1.5, window.devicePixelRatio || 1);
    var w = window.innerWidth, h = window.innerHeight;
    if (w === ovW && h === ovH && dpr === ovDpr) return;
    ovW = w; ovH = h; ovDpr = dpr;
    overlay.width = Math.round(w * dpr);
    overlay.height = Math.round(h * dpr);
    overlay.style.width = w + "px";
    overlay.style.height = h + "px";
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // Bloom reads the tank canvas back into a small buffer. When that read follows the game's own
  // draw in the same frame, the browser has to finish rasterising everything the frame queued
  // before it can hand the pixels over, and the main thread waits for it: measured at 34 to 43 ms
  // per call under software GL, and a pipeline stall on a real GPU. The same copy taken at the top
  // of the frame, before the game touches the canvas, waits on nothing (0.0 ms median) because the
  // previous frame's raster is long done. So the sample is taken in a pre-frame hook and the glow
  // lags the picture by one frame, which no eye can see on a lamp halo.
  var preFrame = [];
  (function installPreFrame() {
    if (window.__finsPreFrame) {
      preFrame = window.__finsPreFrame;
      return;
    }
    window.__finsPreFrame = preFrame;
    var orig = window.requestAnimationFrame;
    if (typeof orig !== "function") return;
    var lastT = -1;
    window.requestAnimationFrame = function (cb) {
      return orig.call(window, function (t) {
        if (t !== lastT) {
          lastT = t;
          for (var i = 0; i < preFrame.length; i++) {
            try { preFrame[i](t); } catch (e) {}
          }
        }
        return cb(t);
      });
    };
  })();

  var bloomReady = false;
  function sampleBloom(t) {
    if (reduced || !bloomA) return;
    // Reading back a tank frame that will not be painted is wasted work under a frame rate cap.
    if (window.finsPace && t != null && !finsPace.shouldPaint(t)) return;
    var tank = document.getElementById("tank");
    if (!tank || !tank.width) return;
    bloomTick++;
    if (bloomTick % 2) return;
    var sc = sceneName();
    if (sc === "work") return;
    var bw = Math.max(96, (tank.width / 5) | 0);
    var bh = Math.max(54, (tank.height / 5) | 0);
    if (bloomA.width !== bw || bloomA.height !== bh) {
      bloomA.width = bw;
      bloomA.height = bh;
      bloomB.width = bw;
      bloomB.height = bh;
    }
    var a = bloomA.getContext("2d");
    var b = bloomB.getContext("2d");
    // Downscale first with no filter on the draw. A context filter is applied at the source's
    // resolution before the scale, so filtering on this draw grades the whole tank canvas
    // (1.3 Mpx at 1440x900) to make a 288x180 buffer. Chaining the grade onto the blur pass runs
    // every filter over the 52 kpx buffer instead. Same picture.
    a.drawImage(tank, 0, 0, bw, bh);
    b.filter = "brightness(1.55) contrast(1.7) saturate(1.15) blur(7px)";
    b.clearRect(0, 0, bw, bh);
    b.drawImage(bloomA, 0, 0);
    b.filter = "none";
    bloomReady = true;
  }
  preFrame.push(sampleBloom);

  function runBloom(w, h) {
    if (!bloomReady || !octx) return;
    octx.save();
    octx.globalCompositeOperation = "lighter";
    octx.globalAlpha = 0.1;
    octx.drawImage(bloomB, 0, 0, w, h);
    octx.globalAlpha = 0.035;
    octx.filter = "blur(18px)";
    octx.drawImage(bloomB, -w * 0.04, 0, w * 1.08, h);
    octx.filter = "none";
    octx.restore();
  }
  function drawOverlay(now) {
    if (reduced) return;
    resizeOverlay();
    var w = window.innerWidth, h = window.innerHeight;
    octx.clearRect(0, 0, w, h);
    if (sceneName() === "work") return;
    var quiet = sceneName() === "title";
    try { runBloom(w, h); } catch (e) {}
    grainT += 1;
    octx.save();
    octx.globalCompositeOperation = "overlay";
    octx.globalAlpha = quiet ? 0.018 : 0.025;
    var ox = (grainT * 1.7) % 96, oy = (grainT * 1.1) % 96;
    var pat = octx.createPattern(grain, "repeat");
    octx.translate(-ox, -oy);
    octx.fillStyle = pat;
    octx.fillRect(ox, oy, w, h);
    octx.restore();

    octx.save();
    var vig = octx.createRadialGradient(w * 0.5, h * 0.42, h * 0.18, w * 0.5, h * 0.5, h * 0.82);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(4,10,18," + (quiet ? "0.14" : "0.22") + ")");
    octx.fillStyle = vig;
    octx.fillRect(0, 0, w, h);
    octx.restore();

    // The engine paints its own caustics and spring waterline at waterTop.
    // A second tiled pass and a line at 9% of the screen washed out the water
    // and drew a second surface above the tank. Particulate follows that field.
    if (sceneName() === "tank" && !quiet && window.finsWater) window.finsWater.paint(octx);
  }

  var drone = null;
  function audioCtx() {
    try {
      if (window.oe && typeof oe.init === "function") oe.init();
      return (window.oe && oe.ctx) || null;
    } catch (e) {
      return null;
    }
  }
  function ensureDrone() {
    if (drone || reduced) return;
    var ctx = audioCtx();
    if (!ctx) return;
    try {
      var buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      var bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 180;
      bp.Q.value = 0.8;
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      var g = ctx.createGain();
      g.gain.value = 0;
      var pan = null;
      try {
        pan = ctx.createStereoPanner();
        pan.pan.value = 0;
      } catch (e2) {}
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.knee.value = 18;
      comp.ratio.value = 3;
      comp.attack.value = 0.01;
      comp.release.value = 0.18;

      var fdnIn = ctx.createGain();
      fdnIn.gain.value = 0.22;
      var fdnOut = ctx.createGain();
      fdnOut.gain.value = 0.16;
      var times = [0.0297, 0.0371, 0.0411, 0.0437];
      var delays = [], fbg = [];
      for (var d = 0; d < 4; d++) {
        var del = ctx.createDelay(0.08);
        del.delayTime.value = times[d];
        var fg = ctx.createGain();
        fg.gain.value = 0.12;
        delays.push(del);
        fbg.push(fg);
        fdnIn.connect(del);
        del.connect(fg);
        fg.connect(fdnOut);
      }
      for (var a = 0; a < 4; a++) {
        fbg[a].connect(delays[(a + 1) & 3]);
        fbg[a].connect(delays[(a + 2) & 3]);
      }

      src.connect(bp);
      bp.connect(lp);
      lp.connect(g);
      g.connect(fdnIn);
      g.connect(comp);
      fdnOut.connect(comp);
      if (pan) {
        comp.connect(pan);
      }
      var dest = (window.oe && oe.sfxBus) || (window.ge && ge.bus) || ctx.destination;
      (pan || comp).connect(dest);
      src.start();
      drone = { src: src, g: g, bp: bp, ctx: ctx, pan: pan };
    } catch (e) {
      T.lastErr = String(e && e.message || e);
    }
  }
  function tickDrone() {
    if (!drone) return;
    var q = o2q();
    var target = 0.01 + (1 - q) * 0.028;
    var clog = false;
    try {
      clog = !!(window.G && window.G.filter && window.G.filter.clog);
    } catch (e) {}
    if (clog) target += 0.01;
    if (isQuiet()) target *= 0.35;
    var g = drone.g.gain;
    var now = drone.ctx.currentTime;
    g.setTargetAtTime(target, now, 0.4);
    drone.bp.frequency.setTargetAtTime(140 + q * 120, now, 0.5);
    if (drone.pan) {
      try {
        drone.pan.pan.setTargetAtTime(clamp(lastPtr.x * 2 - 1, -0.7, 0.7) * 0.35, now, 0.25);
      } catch (e) {}
    }
  }

  function clipTank(ctx, tk, i) {
    var pts = window.__shopTankPts;
    var q = pts && pts[i] && pts[i].q;
    ctx.beginPath();
    if (q && q.length >= 8) {
      ctx.moveTo(q[0], q[1]);
      ctx.lineTo(q[2], q[3]);
      ctx.lineTo(q[4], q[5]);
      ctx.lineTo(q[6], q[7]);
      ctx.closePath();
    } else if (ctx.roundRect) ctx.roundRect(tk[0] + 2, tk[1] + tk[3] * 0.08, tk[2] - 4, tk[3] * 0.78, 3);
    else ctx.rect(tk[0] + 2, tk[1] + tk[3] * 0.08, tk[2] - 4, tk[3] * 0.78);
    ctx.clip();
  }

  function paintTankTech(ctx, t, tanks, wx, floorY, live) {
    wx = wx || {};
    var o2 = o2q();
    var mu = 0.1 + (wx.clog ? 0.14 : 0) + (1 - o2) * 0.12;
    if (!(mu === mu)) mu = 0.12;
    if (live) mu *= 0.35;
    var aMid = (mu * 0.45).toFixed(3);
    var aBot = (mu * 0.85).toFixed(3);
    for (var i = 0; i < tanks.length; i++) {
      try {
        var tk = tanks[i];
        var tx = tk[0], ty = tk[1], tw = tk[2], th = tk[3];
        if (tw < 8 || th < 8) continue;
        ctx.save();
        clipTank(ctx, tk, i);

        if (mu > 0.02) {
          var depth = ctx.createLinearGradient(tx, ty + th * 0.1, tx, ty + th * 0.86);
          depth.addColorStop(0, "rgba(0,0,0,0)");
          depth.addColorStop(0.45, "rgba(0,28,46," + aMid + ")");
          depth.addColorStop(1, "rgba(0,18,32," + aBot + ")");
          ctx.fillStyle = depth;
          ctx.fillRect(tx, ty, tw, th);
        }

        fillCaustics(ctx, tx, ty + th * 0.18, tw, th * 0.64, t + i, wx.clog ? 0.1 : (live ? 0.16 : 0.24));

        var sy = ty + th * 0.105;
        if (window.finsWater) window.finsWater.paintSurface(ctx, tk, t, i);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        var snell = ctx.createRadialGradient(tx + tw * 0.5, sy + 4, 2, tx + tw * 0.5, sy + 8, tw * 0.38);
        snell.addColorStop(0, "rgba(220,245,255,.22)");
        snell.addColorStop(1, "rgba(220,245,255,0)");
        ctx.fillStyle = snell;
        ctx.beginPath();
        ctx.ellipse(tx + tw * 0.5, sy + 6, tw * 0.36, 7, 0, 0, PI2);
        ctx.fill();
        ctx.restore();

        if (!reduced) {
          ctx.fillStyle = "rgba(40,70,50,.16)";
          for (var s = 0; s < 6; s++) {
            var ux = 0.12 + ((i * 13 + s * 7) % 17) / 22;
            var uy = 0.55 + ((i * 5 + s * 3) % 9) / 28;
            var wr = worley(ux * 6 + i, uy * 6 + t * 0.02);
            if (wr < 0.45) {
              ctx.globalAlpha = (0.45 - wr) * 0.5;
              ctx.beginPath();
              ctx.ellipse(tx + ux * tw, ty + uy * th, 3 + (1 - wr) * 4, 2, 0, 0, PI2);
              ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
        }

        drawSph(ctx, tk, i);
        drawWaves(ctx, [tx + 2, ty + th * 0.08, tw - 4, th * 0.78]);
        ctx.restore();

        glassOnTank(ctx, tk, t, i);

        if (floorY && !live) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          var cx = tx + tw * 0.5 + Math.sin(t * 0.8 + i) * 6;
          var cy = floorY + 8;
          var glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, tw * 0.45);
          glow.addColorStop(0, "rgba(90,180,220," + (0.12 + 0.06 * Math.sin(t * 1.4 + i)).toFixed(3) + ")");
          glow.addColorStop(1, "rgba(90,180,220,0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.ellipse(cx, cy, tw * 0.42, 10, 0, 0, PI2);
          ctx.fill();
          ctx.globalCompositeOperation = "multiply";
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = "rgba(8,16,24,1)";
          ctx.beginPath();
          ctx.ellipse(tx + tw * 0.5, floorY + 14, tw * 0.48, 9, 0, 0, PI2);
          ctx.fill();
          ctx.restore();
        }
      } catch (err) {
        T.lastErr = String(err && err.message || err);
        try { ctx.restore(); } catch (e2) {}
      }
    }
  }

  function glassOnTank(ctx, tk, t, i) {
    var tx = tk[0], ty = tk[1], tw = tk[2], th = tk[3];
    ctx.save();
    clipTank(ctx, tk, i);
    var gL = ctx.createLinearGradient(tx, ty, tx + tw * 0.28, ty);
    gL.addColorStop(0, "rgba(255,255,255,.12)");
    gL.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gL;
    ctx.fillRect(tx, ty, tw * 0.28, th);
    var gR = ctx.createLinearGradient(tx + tw, ty, tx + tw * 0.72, ty);
    gR.addColorStop(0, "rgba(10,30,50,.18)");
    gR.addColorStop(1, "rgba(10,30,50,0)");
    ctx.fillStyle = gR;
    ctx.fillRect(tx + tw * 0.72, ty, tw * 0.28, th);
    var top = ctx.createLinearGradient(tx, ty + th * 0.08, tx, ty + th * 0.22);
    top.addColorStop(0, "rgba(230,248,255,.09)");
    top.addColorStop(1, "rgba(230,248,255,0)");
    ctx.fillStyle = top;
    ctx.fillRect(tx, ty, tw, th * 0.22);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(255,252,245,.24)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tx + tw * 0.12, ty + th * 0.12);
    ctx.quadraticCurveTo(tx + tw * 0.38, ty + th * 0.06, tx + tw * 0.62, ty + th * 0.13);
    ctx.stroke();
    if (!reduced) {
      ctx.globalCompositeOperation = "source-over";
      for (var d = 0; d < 7; d++) {
        var dx = tx + tw * (0.12 + ((i * 11 + d * 5) % 17) / 22);
        var dy = ty + th * (0.14 + ((i * 3 + d) % 5) * 0.018);
        var rr = 1.1 + (d % 3) * 0.5;
        ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 0.7 + d);
        ctx.strokeStyle = "rgba(220,240,255,.7)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(dx, dy, rr, rr * 1.4, 0.2, 0, PI2);
        ctx.stroke();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "rgba(255,255,255,.8)";
        ctx.beginPath();
        ctx.ellipse(dx - rr * 0.3, dy - rr * 0.4, rr * 0.35, rr * 0.45, 0, 0, PI2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.save();
    // One soft edge catch per side. The red and blue fringe lines that sat beside it read as a
    // display glitch on a photographed room rather than as glass.
    ctx.strokeStyle = "rgba(210,235,255,.2)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(tx + 3, ty + th * 0.1);
    ctx.lineTo(tx + 3, ty + th * 0.84);
    ctx.moveTo(tx + tw - 3, ty + th * 0.1);
    ctx.lineTo(tx + tw - 3, ty + th * 0.84);
    ctx.stroke();
    ctx.restore();
  }

  var fishPrev = new WeakMap();
  wrap("drawFishSprite", function (orig, self, args) {
    var a = args[0] || {};
    if (a.x != null && a.y != null && a.fish) {
      var pr = fishPrev.get(a.fish);
      if (pr && Math.hypot(a.x - pr.x, a.y - pr.y) < 160) {
        var blend = 1 - Math.exp(-29 * frameDt);
        a.x = pr.x + (a.x - pr.x) * blend;
        a.y = pr.y + (a.y - pr.y) * blend;
        args[0] = a;
      }
      if (!pr) pr = {};
      pr.x = a.x; pr.y = a.y;
      fishPrev.set(a.fish, pr);
    }
    a = args[0] || {};
    var r = orig.apply(self, args);
    if (!r || !a.ctx || reduced) return r;
    try {
      fishDrawn++;
      var ctx = a.ctx, f = a.fish || {}, size = a.size || 12;
      var dir = f.dir < 0 ? -1 : 1;
      var seed = ((f.fid || f.sp || 1) * 17 + (f.gen || 0)) | 0;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.scale(dir, 1);
      var mark = bakeMark(seed);
      ctx.globalAlpha = 0.08;
      ctx.globalCompositeOperation = "overlay";
      ctx.drawImage(mark, -size * 0.7, -size * 0.4, size * 1.3, size * 0.8);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.14;
      var rim = ctx.createRadialGradient(-size * 0.15, -size * 0.2, 0, 0, 0, size * 0.7);
      rim.addColorStop(0, "rgba(180,230,255,.7)");
      rim.addColorStop(1, "rgba(180,230,255,0)");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.7, size * 0.38, 0, 0, 7);
      ctx.fill();
      var tDotL = 0.55;
      var spec = Math.pow(Math.sqrt(Math.max(0, 1 - tDotL * tDotL)), 12);
      ctx.globalAlpha = 0.28 + spec * 0.45;
      ctx.strokeStyle = "rgba(255,252,240,1)";
      ctx.lineWidth = Math.max(0.8, size * 0.06);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-size * 0.15, -size * 0.18);
      ctx.quadraticCurveTo(size * 0.1, -size * 0.28, size * 0.42, -size * 0.08);
      ctx.stroke();
      ctx.restore();
      var pts = stepTail(fishId(f) || seed, a.x, a.y, dir, size, frameDt);
      ctx.save();
      ctx.strokeStyle = "rgba(20,40,60,.28)";
      ctx.lineWidth = Math.max(1.2, size * 0.12);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
    } catch (e) {}
    return r;
  });

  wrap("shopInteriorFx", function (orig, self, args) {
    var r = orig.apply(self, args);
    try {
      var ctx = args[0], t = args[1] || 0, tanks = args[3], floorY = args[4];
      if (!ctx || !tanks || !tanks.length) return r;
      lastTanks = tanks;
      lastFloorY = floorY || 0;
      lastWx = args[2] || {};
      ensureKelp(tanks);
      ensureSph(tanks);
      var liveShop = !!(window.shopBg && window.shopBg.complete && window.shopBg.naturalWidth);
      paintTankTech(ctx, t, tanks, lastWx, lastFloorY, liveShop);
      drawKelp(ctx, tanks);
    } catch (e) {
      T.lastErr = String(e && e.message || e);
    }
    return r;
  });

  wrap("folkDraw", function (orig, self, args) {
    folkDrawn++;
    return orig.apply(self, args);
  });

  wrap("drawShopBackdrop", function (orig, self, args) {
    var r = orig.apply(self, args);
    try {
      if (reduced || !args[0]) return r;
      var ctx = args[0], x = args[1], y = args[2], w = args[3], h = args[4], t = args[5] || 0;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      var pulse = 0.5 + 0.5 * Math.sin(t * 1.7);
      var bloom = ctx.createRadialGradient(x + w * 0.5, y + h * 0.16, 4, x + w * 0.5, y + h * 0.16, w * 0.38);
      bloom.addColorStop(0, "rgba(255,200,120," + (0.08 + pulse * 0.04).toFixed(3) + ")");
      bloom.addColorStop(1, "rgba(255,180,80,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(x, y, w, h * 0.55);
      ctx.restore();
    } catch (e) {}
    return r;
  });

  // The glass pass used to run here too, a second time per tank, under the interior's
  // perspective transform while clipping to a quad given in canvas space. Two stacked coats of
  // white gradient and rim line per tank is what made the play tanks read as frosted plastic
  // pasted on the photo. paintTankTech draws it once, in canvas space, after the water.

  wrap("paintTownMap", function (orig, self, args) {
    var r = orig.apply(self, args);
    try {
      if (reduced || !args[0]) return r;
      var ctx = args[0], w = args[1], h = args[2];
      var fog = ctx.createLinearGradient(0, 0, 0, h);
      fog.addColorStop(0, "rgba(140,175,210,.08)");
      fog.addColorStop(0.45, "rgba(80,120,160,.04)");
      fog.addColorStop(1, "rgba(20,40,60,.16)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, w, h);
      var t = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = "#0a1824";
      var cx = w * (0.35 + 0.2 * fbm(t * 0.04, 0.2));
      ctx.beginPath();
      ctx.ellipse(cx, h * 0.3, w * 0.34, h * 0.12, 0, 0, PI2);
      ctx.fill();
      ctx.restore();
    } catch (e) {}
    return r;
  });

  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    frameDt = dt;
    acc += dt;
    if (acc > 0.2) acc = 0.2;
    while (acc >= STEP) {
      simT += STEP;
      for (var i = vortices.length - 1; i >= 0; i--) {
        vortices[i].life -= STEP * 0.55;
        if (vortices[i].life <= 0) vortices.splice(i, 1);
      }
      try { stepKelp(STEP, simT); } catch (e) {}
      try { stepSph(STEP, simT); } catch (e) {}
      try { stepWaves(STEP); } catch (e) {}
      acc -= STEP;
    }
    T.fish = fishDrawn;
    fishDrawn = 0;
    T.folk = folkDrawn;
    folkDrawn = 0;
    try {
      if (window.finsWater) window.finsWater.frame(dt);
    } catch (e) { T.lastErr = String(e && e.message || e); }
    try { tickDrone(); } catch (e) {}
    /* The overlay paints on the frames the tank paints on when a frame rate cap is set
       (pace.js). The steps above still run every frame, on elapsed time. */
    try {
      if (!window.finsPace || finsPace.shouldPaint(now)) drawOverlay(now);
    } catch (e) {}
  }
  requestAnimationFrame(frame);

  function onPtr(e) {
    if (reduced) return;
    var tank = document.getElementById("tank");
    if (!tank || e.target !== tank || sceneName() !== "tank") return;
    var r = tank.getBoundingClientRect();
    var x = (e.clientX - r.left) * ((window.W || r.width) / r.width);
    var y = (e.clientY - r.top) * ((window.H || r.height) / r.height);
    if (y < (window.waterTop || 0) - 14 || y > (window.floorY || r.height)) return;
    lastPtr.x = window.W ? x / window.W : 0.5;
    lastPtr.y = window.H ? y / window.H : 0.5;
    addVortex(x, y, e.type === "pointerdown" ? 2.2 : 0.7);
    if (window.finsWater) window.finsWater.disturb(x, y, e.type === "pointerdown" ? 0.5 : 0.1);
  }
  document.addEventListener("pointerdown", function (e) {
    onPtr(e);
    ensureDrone();
  }, { passive: true });
  document.addEventListener("pointermove", function (e) {
    if (e.buttons) onPtr(e);
    else {
      var tank = document.getElementById("tank");
      if (!tank) return;
      var r = tank.getBoundingClientRect();
      lastPtr.x = r.width ? (e.clientX - r.left) / r.width : 0.5;
      lastPtr.y = r.height ? (e.clientY - r.top) / r.height : 0.5;
    }
  }, { passive: true });

  T.curl = curl;
  T.vortex = addVortex;
  T.wave = addWave;
  T.stats = function () {
    return {
      v: T.v,
      kelp: T.kelp,
      folk: T.folk,
      fish: T.fish,
      bubbles: sph.length,
      waves: waves.length,
      vortices: vortices.length,
      wraps: Object.keys(origs),
      scene: sceneName(),
      ok: T.ok,
      err: T.lastErr
    };
  };
  window.__techTest = T.stats;
})();
