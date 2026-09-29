/* Painted walk-cycle people for Fin's. Replaces the oval-and-line dR drawings. */
(function () {
  "use strict";

  var KEYS = [
    "fin",
    "woman_coat",
    "woman_casual",
    "woman_dress",
    "man_coat",
    "man_casual",
    "man_suit",
    "man_work",
    "staff",
    "elder",
    "kid",
  ];

  /* These are painted sheets, not an aspect-ratio convention. A guessed grid
     used to turn one customer into four tiny people in the same frame. */
  var GRIDS = {
    fin: { cols: 2, rows: 2 },
    staff: { cols: 2, rows: 2 },
    woman_coat: { cols: 8, rows: 1 },
    woman_casual: { cols: 4, rows: 2 },
    woman_dress: { cols: 4, rows: 2 },
    man_coat: { cols: 16, rows: 2 },
    man_casual: { cols: 16, rows: 2 },
    man_suit: { cols: 4, rows: 2 },
    man_work: { cols: 4, rows: 2 },
    elder: { cols: 4, rows: 2 },
    kid: { cols: 4, rows: 2 },
  };
  var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var shadowSprite = null;

  var sheets = Object.create(null);
  var ready = 0;
  var tintCache = new Map();
  var TINT_MAX = 96;
  var stepAt = Object.create(null);
  var lastPos = Object.create(null);

  function load() {
    KEYS.forEach(function (key) {
      var img = new Image();
      img.onload = function () {
        try {
          sheets[key] = sliceSheet(img, key);
          ready++;
        } catch (err) {
          console.warn("folk: slice failed", key, err);
        }
      };
      img.onerror = function () {
        console.warn("folk: missing sheet", key);
      };
      img.src = "folk/" + key + ".png?v=23";
    });
  }

  function inferGrid(img) {
    var ratio = img.width / img.height;
    if (Math.abs(ratio - 1) < 0.08) return { cols: 1, rows: 1 };
    if (ratio >= 7.2) return { cols: 8, rows: 1 };
    if (ratio >= 3.4) return { cols: 4, rows: 1 };
    if (ratio >= 1.55) return { cols: 2, rows: 1 };
    if (ratio <= 0.55) return { cols: 1, rows: 2 };
    return { cols: 1, rows: 1 };
  }

  function sliceSheet(img, key) {
    var g = GRIDS[key] || inferGrid(img);
    var cols = g.cols,
      rows = g.rows;
    var fw = img.width / cols,
      fh = img.height / rows;
    var frames = [];
    var boxes = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cv = document.createElement("canvas");
        cv.width = fw;
        cv.height = fh;
        var gx = cv.getContext("2d");
        gx.drawImage(img, c * fw, r * fh, fw, fh, 0, 0, fw, fh);
        frames.push(cv);
        boxes.push(measure(gx, fw, fh));
      }
    }
    return { frames: frames, boxes: boxes, box: unionBoxes(boxes), n: frames.length };
  }

  function measure(g, w, h) {
    var data = g.getImageData(0, 0, w, h).data;
    var minX = w,
      minY = h,
      maxX = 0,
      maxY = 0,
      found = false;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 24) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) return { x: 0, y: 0, w: w, h: h };
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  function unionBoxes(list) {
    var minX = 1e9,
      minY = 1e9,
      maxX = 0,
      maxY = 0;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function pickKey(id, look) {
    id = String((look && look.id) || id || "");
    if (id.indexOf("fin:") === 0 || id === "#3b5b78") return "fin";
    if (id.indexOf("staff:") === 0) return "staff";
    var fem = !!(look && look.fem);
    if (!look) fem = false;
    if (look && look.kit === "kid") return "kid";
    if (look && look.kit === "work") return fem ? "woman_casual" : "man_work";
    if (look && look.kit === "suit") return fem ? "woman_coat" : "man_suit";
    if (look && look.kit === "elder") return fem ? "woman_coat" : "elder";
    if (look && look.stoop) return fem ? "woman_coat" : "elder";
    var seed = look && look.seed ? look.seed >>> 0 : 0;
    if ((seed % 11) === 0) return "kid";
    if (fem) {
      if (look.lapels) return seed % 2 === 0 ? "woman_coat" : "woman_dress";
      var w = seed % 5;
      if (w === 0) return "woman_dress";
      if (w === 1) return "woman_coat";
      return "woman_casual";
    }
    if (look && look.lapels) {
      var m = seed % 3;
      if (m === 0) return "man_suit";
      if (m === 1) return "man_coat";
      return "man_work";
    }
    return seed & 1 ? "man_casual" : "man_work";
  }

  function ease(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t);
  }
  function frameBlend(walk, n, moving, look) {
    n = Math.max(1, n || 1);
    if (n === 1) return { i0: 0, i1: 0, t: 0 };
    if (motionQuery && motionQuery.matches) return { i0: 0, i1: 0, t: 0 };
    if (!moving) {
      if (n >= 6) return { i0: 0, i1: 0, t: 0 };
      if (look && look.greet && n > 3) return { i0: n - 1, i1: n - 1, t: 0 };
      if (look && look.work && n > 2) return { i0: Math.min(2, n - 1), i1: Math.min(2, n - 1), t: 0 };
      return { i0: 0, i1: 0, t: 0 };
    }
    /* The keeper's four frames are standing, hand on hip, work and greeting.
       They are poses, so walking must not cycle through work and greeting. */
    if (n === 4) return { i0: 0, i1: 0, t: 0 };
    var p = (((Number(walk) || 0) % 2) + 2) % 2 / 2;
    var f = p * n;
    var i0 = f | 0;
    if (i0 >= n) i0 = 0;
    var i1 = (i0 + 1) % n;
    return { i0: i0, i1: i1, t: ease(f - i0) };
  }

  function parseHex(hex) {
    if (!hex) return null;
    hex = String(hex).trim();
    if (hex[0] === "#") hex = hex.slice(1);
    if (hex.length === 3)
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length !== 6) return null;
    var n = parseInt(hex, 16);
    if (isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function lum(c) {
    return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    var max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    var h,
      s,
      l = (max + min) / 2;
    if (max === min) h = s = 0;
    else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: h, s: s, l: l };
  }

  function clamp(n) {
    return n < 0 ? 0 : n > 255 ? 255 : n | 0;
  }

  function tinted(sheetKey, frame, look, clothHex) {
    if (!look || sheetKey === "fin" || sheetKey === "staff") return null;
    var skin = look.skin || "";
    var hair = look.hair || "";
    var trous = look.trous || "";
    var sig =
      sheetKey +
      "|" +
      frame +
      "|" +
      skin +
      "|" +
      hair +
      "|" +
      trous +
      "|" +
      (clothHex || "");
    var hit = tintCache.get(sig);
    if (hit) {
      tintCache.delete(sig);
      tintCache.set(sig, hit);
      return hit;
    }
    var src = sheets[sheetKey].frames[frame];
    var cv = document.createElement("canvas");
    cv.width = src.width;
    cv.height = src.height;
    var g = cv.getContext("2d");
    g.drawImage(src, 0, 0);
    var skinT = parseHex(skin);
    var hairT = parseHex(hair);
    var clothT = parseHex(trous) || parseHex(clothHex);
    if (!skinT && !hairT && !clothT) return src;
    var img = g.getImageData(0, 0, cv.width, cv.height);
    var d = img.data;
    var box = sheets[sheetKey].box;
    var hairY = box.y + box.h * 0.38;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 16) continue;
      var r = d[i],
        gv = d[i + 1],
        b = d[i + 2];
      var hsl = rgbToHsl(r, gv, b);
      var y = ((i / 4) / cv.width) | 0;
      var isSkin =
        hsl.h > 0.015 &&
        hsl.h < 0.14 &&
        hsl.s > 0.12 &&
        hsl.s < 0.72 &&
        hsl.l > 0.22 &&
        hsl.l < 0.88;
      if (isSkin && skinT) {
        var L = lum({ r: r, g: gv, b: b });
        var sl = lum(skinT) || 0.5;
        var sh = L / sl;
        d[i] = clamp(r * 0.45 + skinT.r * sh * 0.55);
        d[i + 1] = clamp(gv * 0.45 + skinT.g * sh * 0.55);
        d[i + 2] = clamp(b * 0.45 + skinT.b * sh * 0.55);
        continue;
      }
      var isHair =
        hairT &&
        y < hairY &&
        hsl.l < 0.42 &&
        (hsl.s < 0.45 || hsl.h < 0.12 || hsl.h > 0.85);
      if (isHair) {
        var Lh = lum({ r: r, g: gv, b: b });
        var hl = lum(hairT) || 0.2;
        var hh = Lh / (hl || 0.2);
        d[i] = clamp(r * 0.35 + hairT.r * hh * 0.65);
        d[i + 1] = clamp(gv * 0.35 + hairT.g * hh * 0.65);
        d[i + 2] = clamp(b * 0.35 + hairT.b * hh * 0.65);
        continue;
      }
      if (clothT && hsl.l > 0.08 && hsl.l < 0.86 && !isSkin) {
        var Lc = lum({ r: r, g: gv, b: b });
        var cl = lum(clothT) || 0.4;
        var ch = Lc / cl;
        var amt = 0.22;
        d[i] = clamp(r * (1 - amt) + clothT.r * ch * amt);
        d[i + 1] = clamp(gv * (1 - amt) + clothT.g * ch * amt);
        d[i + 2] = clamp(b * (1 - amt) + clothT.b * ch * amt);
      }
    }
    g.putImageData(img, 0, 0);
    if (tintCache.size >= TINT_MAX) {
      tintCache.delete(tintCache.keys().next().value);
    }
    tintCache.set(sig, cv);
    return cv;
  }

  function drawFrame(ctx, src, frameBox, unionBox, destH) {
    var scale = destH / unionBox.h;
    var w = frameBox.w * scale;
    var h = frameBox.h * scale;
    var dx = (frameBox.x - unionBox.x - unionBox.w / 2) * scale;
    var dy = (frameBox.y - unionBox.y - unionBox.h) * scale;
    ctx.drawImage(src, frameBox.x, frameBox.y, frameBox.w, frameBox.h, dx, dy, w, h);
  }

  function contactShadow(ctx, x, y, destW, size, moving, walk) {
    var plant = moving ? 0.55 + 0.45 * Math.cos(((walk % 1) + 1) % 1 * Math.PI * 2) : 0.82;
    plant = Math.max(0.4, Math.min(1, plant));
    var rx = Math.max(8, destW * (0.24 + plant * 0.1));
    var ry = Math.max(2.6, size * (0.04 + plant * 0.02));
    if (!shadowSprite) {
      shadowSprite = document.createElement("canvas");
      shadowSprite.width = shadowSprite.height = 64;
      var sg = shadowSprite.getContext("2d");
      var gradient = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(8,4,0,0.56)");
      gradient.addColorStop(0.38, "rgba(8,4,0,0.24)");
      gradient.addColorStop(1, "rgba(8,4,0,0)");
      sg.fillStyle = gradient;
      sg.fillRect(0, 0, 64, 64);
    }
    ctx.save();
    ctx.globalAlpha *= (0.38 + plant * 0.18) / 0.56;
    ctx.drawImage(shadowSprite, x + size * 0.018 - rx, y + 1.5 - ry, rx * 2, ry * 2);
    ctx.restore();
  }

  window.folkDraw = function (ctx, x, y, size, colorHex, walk, showFace, face, moving, look) {
    if (!ctx || !size || size < 4) return false;
    var key = pickKey(colorHex, look);
    if (!sheets[key]) key = sheets.man_casual ? "man_casual" : "fin";
    var sheet = sheets[key];
    if (!sheet) return false;
    var n = sheet.n || sheet.frames.length;
    var fb = frameBlend(walk, n, moving, look);
    var src0 = tinted(key, fb.i0, look, colorHex) || sheet.frames[fb.i0];
    var src1 = fb.t > 0.02 ? tinted(key, fb.i1, look, colorHex) || sheet.frames[fb.i1] : null;
    var union = sheet.box;
    var box0 = (sheet.boxes && sheet.boxes[fb.i0]) || union;
    var box1 = (sheet.boxes && sheet.boxes[fb.i1]) || union;
    if (!union || union.h < 4) return false;
    var destH = size * (key === "kid" ? 0.72 : 1.02);
    var destW = destH * (union.w / union.h);
    var behind = !!(look && look.behind);
    // The painted room has an open floor at the old counter position.
    // Its engine flag must not crop a standing keeper in half there.
    if (window.__scene === "shop" && window.shopBg && window.shopBg.complete &&
      window.shopBg.naturalWidth && (key === "fin" || key === "staff")) behind = false;
    var quiet = !!(motionQuery && motionQuery.matches);
    var id = look && look.id != null ? String(look.id) : "";
    if (id) {
      var now = typeof performance !== "undefined" ? performance.now() : Date.now();
      var lp = lastPos[id];
      if (lp && lp.ctx === ctx && !quiet && Math.hypot(x - lp.x, y - lp.y) < size * 2) {
        var follow = 1 - Math.exp(-Math.min(0.1, Math.max(0, (now - lp.t) / 1000)) * 32.7);
        x = lp.x + (x - lp.x) * follow;
        y = lp.y + (y - lp.y) * follow;
      }
      lastPos[id] = { x: x, y: y, t: now, ctx: ctx };
      var keys = Object.keys(lastPos);
      if (keys.length > 80) delete lastPos[keys[0]];
    }
    ctx.save();
    if (!behind) contactShadow(ctx, x, y, destW, size, moving, walk);
    ctx.translate(x, y);
    if ((face || 1) < 0) ctx.scale(-1, 1);
    if (!moving && !quiet) {
      var t = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
      var seed = (look && look.seed) || 0;
      ctx.translate(Math.sin(t * 0.7 + seed) * destW * 0.01, Math.sin(t * 1.15 + seed) * destH * 0.008);
      ctx.scale(1 + Math.sin(t * 1.4 + seed) * 0.01, 1 + Math.sin(t * 1.4 + seed) * 0.018);
    } else if (!quiet) {
      var phase = (((Number(walk) || 0) % 1) + 1) % 1;
      var bob = Math.abs(Math.sin(phase * Math.PI * 2)) * destH * 0.028;
      var contact = Math.pow(Math.abs(Math.cos(phase * Math.PI * 2)), 4);
      ctx.translate(0, -bob);
      ctx.rotate(Math.sin(phase * Math.PI * 2) * 0.03);
      ctx.scale(1 + contact * 0.02, 1 - contact * 0.03);
    }
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";
    if (behind) {
      var cut = key === "fin" || key === "staff" ? 0.52 : 0.62;
      ctx.beginPath();
      ctx.rect(-destW, -destH, destW * 2, destH * cut);
      ctx.clip();
    }
    if (src1 && fb.t > 0.02) {
      ctx.globalAlpha = 1;
      drawFrame(ctx, src0, box0, union, destH);
      ctx.globalAlpha = fb.t;
      drawFrame(ctx, src1, box1, union, destH);
      ctx.globalAlpha = 1;
    } else {
      drawFrame(ctx, src0, box0, union, destH);
    }
    ctx.restore();

    if (moving && look && look.id && typeof window.folkStep === "function") {
      var planted = (((walk % 1) + 1) % 1) < 0.14;
      var tick = (walk * 2) | 0;
      var last = stepAt[look.id];
      if (planted && tick !== last) {
        stepAt[look.id] = tick;
        try {
          window.folkStep(x, y);
        } catch (e) {}
      }
    }
    return true;
  };

  load();
})();
