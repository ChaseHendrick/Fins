/* Water motion belongs to the same water the fish swim in. The engine already solves
   pressure and tank obstacles; this layer samples its currentAt field, adds brief fin
   and feeding wakes, and carries suspended motes through it. Nothing here is saved. */
(function () {
  "use strict";

  var WATER_STEP = 1 / 120;
  var WATER_WAKE_CAP = 48;

  function bounded(value, lo, hi) {
    return Number.isFinite(value) ? Math.max(lo, Math.min(hi, value)) : lo;
  }

  /* A reflecting spring chain for the small shop tanks. Fixed steps make a
     disturbance travel at the same speed at 30, 60 and 144 painted frames. */
  function createSurface(width, count) {
    var n = Math.round(bounded(count == null ? 64 : count, 16, 96));
    var h = new Float32Array(n), v = new Float32Array(n), a = new Float32Array(n);
    var acc = 0;
    var surface = {
      width: bounded(width, 64, 4096), height: h, velocity: v,
      kick: function (x, strength) {
        if (!Number.isFinite(x) || !Number.isFinite(strength)) return false;
        var center = bounded(x, 0, 1) * (n - 1);
        var impulse = bounded(strength, -3, 3) * 28;
        for (var i = 0; i < n; i++) {
          var d = (i - center) / 1.8;
          v[i] = bounded(v[i] - impulse * Math.exp(-d * d), -90, 90);
        }
        return true;
      },
      sample: function (x) {
        var u = bounded(x, 0, 1) * (n - 1), i = Math.floor(u);
        return h[i] + (h[Math.min(n - 1, i + 1)] - h[i]) * (u - i);
      },
      advance: function (dt) {
        if (!Number.isFinite(dt) || dt <= 0) return 0;
        acc += Math.min(dt, 0.1);
        var steps = 0;
        var dx = surface.width / (n - 1);
        var spread = Math.min(1500, Math.pow(130 / dx, 2));
        while (acc + 1e-10 >= WATER_STEP && steps < 12) {
          for (var i = 0; i < n; i++) {
            var left = h[i ? i - 1 : i], right = h[i < n - 1 ? i + 1 : i];
            a[i] = (left + right - 2 * h[i]) * spread - h[i] * 5 - v[i] * 2.8;
          }
          for (var j = 0; j < n; j++) {
            v[j] = bounded(v[j] + a[j] * WATER_STEP, -90, 90);
            h[j] = bounded(h[j] + v[j] * WATER_STEP, -9, 9);
          }
          acc -= WATER_STEP;
          steps++;
        }
        return steps;
      },
      energy: function () {
        var sum = 0;
        for (var i = 0; i < n; i++) sum += h[i] * h[i] + v[i] * v[i] * 0.2;
        return sum / n;
      },
    };
    return surface;
  }

  /* A fixed pool of local impulses complements the engine's pressure solver.
     Each wake spreads and decays, and cannot accelerate a fish without bound. */
  function createFlow() {
    var wakes = [], next = 0, scratch = { x: 0, y: 0 };
    for (var i = 0; i < WATER_WAKE_CAP; i++) wakes.push({ life: 0 });
    return {
      wakes: wakes,
      add: function (x, y, vx, vy, radius, swirl) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(vx) ||
          !Number.isFinite(vy) || !Number.isFinite(radius)) return false;
        var w = wakes[next];
        next = (next + 1) % WATER_WAKE_CAP;
        w.x = x; w.y = y;
        w.vx = bounded(vx, -100, 100); w.vy = bounded(vy, -100, 100);
        w.radius = bounded(radius, 8, 160);
        w.swirl = bounded(swirl == null ? 0 : swirl, -60, 60);
        w.age = 0; w.life = 1;
        return true;
      },
      advance: function (dt, sample) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        dt = Math.min(dt, 0.1);
        for (var i = 0; i < wakes.length; i++) {
          var w = wakes[i];
          if (!w.life) continue;
          w.age += dt;
          w.life = Math.exp(-w.age * 2.4);
          if (w.life < 0.006) { w.life = 0; continue; }
          if (sample) {
            sample(w.x, w.y, scratch);
            w.x += bounded(scratch.x, -120, 120) * dt * 0.45;
            w.y += bounded(scratch.y, -120, 120) * dt * 0.45;
          }
        }
      },
      at: function (x, y, out) {
        out = out || { x: 0, y: 0 };
        out.x = out.y = 0;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return out;
        for (var i = 0; i < wakes.length; i++) {
          var w = wakes[i];
          if (!w.life) continue;
          var r = w.radius + w.age * 12;
          var dx = (x - w.x) / r, dy = (y - w.y) / r;
          var d2 = dx * dx + dy * dy;
          if (d2 > 6) continue;
          var fall = Math.exp(-d2 * 2.5) * w.life;
          out.x += (w.vx - dy * w.swirl) * fall;
          out.y += (w.vy + dx * w.swirl) * fall;
        }
        out.x = bounded(out.x, -45, 45);
        out.y = bounded(out.y, -45, 45);
        return out;
      },
      count: function () {
        var live = 0;
        for (var i = 0; i < wakes.length; i++) if (wakes[i].life) live++;
        return live;
      },
      clear: function () {
        for (var i = 0; i < wakes.length; i++) wakes[i].life = 0;
      },
    };
  }

  var flow = createFlow(), surfaces = [];
  var motes = [], drops = [];
  var fishMemory = new WeakMap(), foodMemory = new WeakSet();
  var current = { x: 0, y: 0 }, residual = { x: 0, y: 0 };
  var lastState = null, lastView = -1, lastTime = null, pumpAcc = 0;
  var geometry = { width: 0, top: 0, bottom: 0, scale: 1 };
  var metrics = { frames: 0, coupled: 0, fed: 0, dt: 0 };

  function reducedMotion() {
    return !!(window.G && window.G.reduceMotion) ||
      !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function nativeAt(x, y, out) {
    out.x = out.y = 0;
    if (typeof window.currentAt === "function") window.currentAt(x, y, out);
    out.x = bounded(out.x, -200, 200);
    out.y = bounded(out.y, -200, 200);
    return out;
  }

  function waterGeometry() {
    geometry.width = bounded(window.W, 0, 16000);
    geometry.top = bounded(window.waterTop, 0, 16000);
    geometry.bottom = bounded(window.floorY, geometry.top, 16000);
    geometry.scale = bounded(window.S, 0.05, 8);
    return geometry;
  }

  function active() {
    return window.G && !window.G.title && window.__scene === "tank" &&
      !document.hidden && !window.paused;
  }

  function reset(g) {
    flow.clear();
    drops.length = 0;
    fishMemory = new WeakMap(); foodMemory = new WeakSet();
    lastState = g; lastView = g.view; lastTime = g.t;
    motes.length = 0;
    var geo = waterGeometry();
    for (var i = 0; i < 64; i++) {
      var u = ((i * 0.61803398875 + 0.17) % 1);
      var v = ((i * 0.41421356237 + 0.31) % 1);
      motes.push({ u: u, v: v, x: u * geo.width, y: geo.top + v * (geo.bottom - geo.top), px: 0, py: 0 });
    }
  }

  function disturb(x, y, strength) {
    var geo = waterGeometry();
    if (!active() || !Number.isFinite(x) || !Number.isFinite(y) ||
      x < 0 || x > geo.width || y < geo.top - 14 || y > geo.bottom) return false;
    strength = bounded(strength, 0, 2);
    flow.add(x, Math.max(geo.top + 8, y), 0, 15 * strength, 54 * geo.scale, strength * 12);
    var surface = surfaces[window.G.view];
    if (surface) surface.kick(x / Math.max(1, geo.width), strength * 0.5);
    if (y < geo.top + 65 * geo.scale) {
      drops.push({ x: x, y: geo.top + 4, radius: 4, life: 1, strength: strength });
      if (drops.length > 12) drops.shift();
    }
    return true;
  }

  function stepFish(list, dt, geo) {
    var emitted = 0;
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (!f || f.dead || !Number.isFinite(f.x) || !Number.isFinite(f.y) ||
        !Number.isFinite(f.vx) || !Number.isFinite(f.vy)) continue;
      var memory = fishMemory.get(f);
      if (!memory) { memory = { wakeT: 0.05 + (i % 7) * 0.06 }; fishMemory.set(f, memory); }
      var r = typeof window.fishRadius === "function" ? window.fishRadius(f) : 20 * geo.scale;
      if (!Number.isFinite(r) || r < 2 || r > geo.width * 0.25) continue;
      flow.at(f.x, f.y, residual);
      var response = bounded(16 * geo.scale / r, 0.18, 1.2) * dt * 0.32;
      f.vx += residual.x * response;
      f.vy += residual.y * response;
      if (Math.abs(residual.x) + Math.abs(residual.y) > 0.05) metrics.coupled++;
      memory.wakeT -= dt;
      var speed = Math.hypot(f.vx, f.vy);
      if (memory.wakeT > 0 || speed < 12 * geo.scale || emitted >= 6) continue;
      memory.wakeT = Math.max(memory.wakeT, -0.12) + 0.3 + (i % 5) * 0.035;
      var ux = f.vx / speed, uy = f.vy / speed;
      var tailX = f.x - ux * r * 1.25, tailY = f.y - uy * r * 1.25;
      var push = Math.min(18, speed * 0.08);
      flow.add(tailX - uy * r * 0.35, tailY + ux * r * 0.35, ux * push, uy * push, r * 0.9, 6);
      flow.add(tailX + uy * r * 0.35, tailY - ux * r * 0.35, ux * push, uy * push, r * 0.9, -6);
      emitted++;
    }
  }

  function stepFood(dt, geo) {
    var food = window.food;
    if (!Array.isArray(food)) return;
    for (var i = 0; i < food.length; i++) {
      var p = food[i];
      if (!p || p.floor || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      if (!foodMemory.has(p)) {
        foodMemory.add(p);
        disturb(p.x, p.y, p.auto ? 0.35 : 0.75);
        metrics.fed++;
      }
      flow.at(p.x, p.y, residual);
      p.x = bounded(p.x + residual.x * dt * 0.28, 6, Math.max(6, geo.width - 6));
      if (Number.isFinite(p.vy)) p.vy += residual.y * dt * 0.2;
    }
  }

  function frame(dt) {
    var g = window.G;
    if (!g || !Number.isFinite(g.t)) return;
    if (g !== lastState || g.view !== lastView) reset(g);
    var simDt = lastTime == null ? 0 : bounded(g.t - lastTime, 0, 0.1);
    lastTime = g.t;
    metrics.dt = simDt;
    metrics.frames++;
    var geo = waterGeometry();
    // Shop water keeps moving on the engine clock too, with no separate RAF.
    if (!document.hidden && !window.paused && simDt > 0) {
      var visualDt = bounded(dt, 0, 0.1);
      pumpAcc += visualDt;
      for (var s = 0; s < surfaces.length; s++) {
        if (!surfaces[s]) continue;
        surfaces[s].advance(visualDt);
        if (pumpAcc >= 0.15) surfaces[s].kick(0.86, Math.sin(g.t * 5 + s) * (window.clogged ? 0.012 : 0.04));
      }
      if (pumpAcc >= 0.15) pumpAcc = 0;
    }
    if (!active() || geo.width < 30 || geo.bottom - geo.top < 30) return;
    if (simDt <= 0) return;
    flow.advance(simDt, nativeAt);
    stepFish(Array.isArray(g.fish) ? g.fish : [], simDt, geo);
    stepFood(simDt, geo);
    for (var i = drops.length - 1; i >= 0; i--) {
      drops[i].life -= simDt * 0.85;
      drops[i].radius += simDt * 84 * geo.scale;
      if (drops[i].life <= 0) drops.splice(i, 1);
    }
    for (var m = 0; m < motes.length; m++) {
      var p = motes[m];
      p.px = p.x; p.py = p.y;
      nativeAt(p.x, p.y, current); flow.at(p.x, p.y, residual);
      p.x += (current.x + residual.x) * simDt;
      p.y += (current.y + residual.y + 0.6 * geo.scale) * simDt;
      if (p.x < 8 || p.x > geo.width - 8 || p.y < geo.top + 8 || p.y > geo.bottom - 8) {
        p.x = 8 + p.u * Math.max(1, geo.width - 16);
        p.y = geo.top + 8 + p.v * Math.max(1, geo.bottom - geo.top - 16);
        p.px = p.x; p.py = p.y;
      }
    }
  }

  function paint(ctx) {
    if (!active() || reducedMotion() || !ctx) return;
    var geo = waterGeometry();
    ctx.save();
    ctx.beginPath(); ctx.rect(0, geo.top + 8, geo.width, geo.bottom - geo.top - 8); ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(204,236,240,.15)";
    ctx.lineWidth = Math.max(0.6, geo.scale * 0.65);
    ctx.beginPath();
    for (var i = 0; i < motes.length; i++) {
      var p = motes[i];
      nativeAt(p.x, p.y, current);
      var lx = bounded(current.x * 0.055, -5, 5), ly = bounded(current.y * 0.055, -5, 5);
      ctx.moveTo(p.x - lx * 0.5, p.y - ly * 0.5);
      ctx.lineTo(p.x + lx * 0.5 + 0.5, p.y + ly * 0.5 + 0.5);
    }
    ctx.stroke();
    for (var d = 0; d < drops.length; d++) {
      var drop = drops[d];
      ctx.globalAlpha = drop.life * drop.strength * 0.25;
      ctx.strokeStyle = "#b9e3e5";
      ctx.beginPath();
      ctx.ellipse(drop.x, drop.y + 6, drop.radius, drop.radius * 0.07 + 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintSurface(ctx, tk, t, index) {
    if (!ctx || !tk || tk[2] < 8 || tk[3] < 8 || !Number.isInteger(index) || index < 0 || index >= 16) return;
    var surface = surfaces[index];
    if (!surface) surface = surfaces[index] = createSurface(tk[2], 48);
    surface.width = bounded(tk[2], 64, 4096);
    var x = tk[0], y = tk[1] + tk[3] * 0.105, w = tk[2];
    var amplitude = reducedMotion() ? 0 : Math.min(1, tk[3] / 160);
    ctx.save();
    ctx.strokeStyle = "rgba(211,239,238,.42)";
    ctx.lineWidth = Math.max(0.6, Math.min(1.2, tk[3] * 0.009));
    ctx.beginPath();
    for (var i = 0; i <= 48; i++) {
      var u = i / 48, yy = y + surface.sample(u) * amplitude;
      if (i) ctx.lineTo(x + w * u, yy); else ctx.moveTo(x, yy);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(99,181,193,.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var j = 0; j <= 48; j++) {
      var v = j / 48, yy2 = y + 3 + surface.sample(v) * amplitude * 0.5;
      if (j) ctx.lineTo(x + w * v, yy2); else ctx.moveTo(x, yy2);
    }
    ctx.stroke(); ctx.restore();
  }

  window.finsWater = {
    createSurface: createSurface, createFlow: createFlow,
    frame: frame, paint: paint, paintSurface: paintSurface, disturb: disturb,
    stats: function () {
      return { wakes: flow.count(), wakeCapacity: WATER_WAKE_CAP, motes: motes.length,
        surfaces: surfaces.length, coupled: metrics.coupled, fed: metrics.fed,
        frames: metrics.frames, dt: metrics.dt };
    },
  };
})();
