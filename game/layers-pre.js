/* Built by tools/build.mjs from src/pre.mjs. Do not edit: change src/ and run npm run build. */
(() => {
  // src/layers/sound.js
  try {
    (function() {
      "use strict";
      var ctx = null;
      var built = false;
      var dry = null;
      var send = null;
      var lim = null;
      var bufs = /* @__PURE__ */ Object.create(null);
      var pan = 0;
      var voices = 0;
      (function capture() {
        try {
          var Native = window.AudioContext || window.webkitAudioContext;
          if (!Native) return;
          var Wrapped = function() {
            var made = new (Function.prototype.bind.apply(
              Native,
              [null].concat(Array.prototype.slice.call(arguments))
            ))();
            if (!ctx) ctx = made;
            return made;
          };
          Wrapped.prototype = Native.prototype;
          try {
            Object.defineProperty(Wrapped, "name", { value: "AudioContext" });
          } catch (e) {
          }
          window.AudioContext = Wrapped;
          if (window.webkitAudioContext) window.webkitAudioContext = Wrapped;
        } catch (e) {
        }
      })();
      function roomIR(c) {
        var len = Math.max(1, Math.round(c.sampleRate * 0.42));
        var buf = c.createBuffer(2, len, c.sampleRate);
        var taps = [
          [61e-4, 0.6],
          [98e-4, 0.5],
          [0.0143, 0.42],
          [0.0207, 0.34],
          [0.0291, 0.26]
        ];
        for (var ch = 0; ch < 2; ch++) {
          var d = buf.getChannelData(ch);
          for (var i = 0; i < len; i++) {
            var t = i / c.sampleRate;
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * 0.5;
            for (var k = 0; k < taps.length; k++) {
              var at = Math.round(taps[k][0] * c.sampleRate * (ch ? 1.07 : 1));
              if (i === at) d[i] += taps[k][1] * (Math.random() < 0.5 ? -1 : 1);
            }
            if (t < 4e-3) d[i] *= t / 4e-3;
          }
        }
        return buf;
      }
      function build() {
        if (built || !ctx) return built;
        try {
          lim = ctx.createDynamicsCompressor();
          lim.threshold.value = -6;
          lim.knee.value = 2;
          lim.ratio.value = 12;
          lim.attack.value = 2e-3;
          lim.release.value = 0.12;
          lim.connect(ctx.destination);
          dry = ctx.createGain();
          dry.gain.value = 1;
          dry.connect(lim);
          var conv = ctx.createConvolver();
          conv.buffer = roomIR(ctx);
          send = ctx.createGain();
          send.gain.value = 0.16;
          send.connect(conv);
          conv.connect(lim);
          built = true;
        } catch (e) {
          built = false;
        }
        return built;
      }
      function save() {
        try {
          return window.gameState || null;
        } catch (e) {
          return null;
        }
      }
      function ok() {
        try {
          var I = window.sfx || window.I;
          if (I && typeof I.ok === "function" && !I.ok()) return false;
          if (!I) {
            var s = save();
            if (s && s.sfx === false) return false;
          }
        } catch (e) {
        }
        if (!ctx) return false;
        if (ctx.state === "suspended") {
          try {
            ctx.resume();
          } catch (e) {
          }
        }
        if (ctx.state !== "running") return false;
        return build();
      }
      var TRIM = 0.55;
      function vol() {
        var v = 0.8;
        var s = save();
        if (s && s.vol && isFinite(s.vol.sfx)) v = s.vol.sfx;
        return Math.max(0, Math.min(1, v)) * TRIM;
      }
      function noiseBuf(kind, seconds) {
        if (!ctx) return null;
        var key = kind + "|" + seconds;
        if (bufs[key]) return bufs[key];
        var n = Math.max(64, Math.round(ctx.sampleRate * seconds));
        var buf = ctx.createBuffer(1, n, ctx.sampleRate);
        var d = buf.getChannelData(0);
        var acc = 0;
        for (var i = 0; i < n; i++) {
          var w = Math.random() * 2 - 1;
          if (kind === "brown") {
            acc = acc * 0.97 + w * 0.03;
            d[i] = acc * 3.2;
          } else if (kind === "pink") {
            acc = acc * 0.92 + w * 0.08;
            d[i] = acc * 6;
          } else d[i] = w;
        }
        bufs[key] = buf;
        return buf;
      }
      function hold(node, at) {
        voices++;
        node.onended = function() {
          voices--;
          try {
            node.disconnect();
          } catch (e) {
          }
        };
        try {
          node.stop(at);
        } catch (e) {
        }
      }
      function connect(node, wet) {
        if (!build()) return node;
        var out = node;
        if (Math.abs(pan) > 0.04 && ctx.createStereoPanner) {
          try {
            var p = ctx.createStereoPanner();
            p.pan.value = Math.max(-1, Math.min(1, pan));
            node.connect(p);
            out = p;
          } catch (e) {
          }
        }
        out.connect(dry);
        if (wet !== false && send) out.connect(send);
        return node;
      }
      window.finsAudio = {
        ctx: function() {
          return ctx;
        },
        ready: function() {
          return !!ctx && build();
        },
        ok,
        vol,
        bus: function() {
          return build() ? dry : null;
        },
        send: function() {
          return build() ? send : null;
        },
        noise: noiseBuf,
        hold,
        connect,
        voices: function() {
          return voices;
        },
        pan: function(v) {
          if (isFinite(v)) pan = Math.max(-0.7, Math.min(0.7, v));
          return pan;
        },
        /* Screen x to a pan position, using the tank canvas as the room's width. */
        panAt: function(x) {
          if (!isFinite(x)) return pan = 0;
          var w = 0;
          try {
            var cv = document.getElementById("tank");
            w = cv && cv.clientWidth || window.innerWidth || 1;
          } catch (e) {
            w = window.innerWidth || 1;
          }
          return window.finsAudio.pan(x / w * 2 - 1);
        }
      };
    })();
  } catch (e) {
    console.error("Layer sound.js failed to start:", e);
  }

  // src/layers/glass.js
  try {
    (function() {
      "use strict";
      var desk = false;
      try {
        desk = !!(window.finsDesktop && window.finsDesktop.shell === "electron");
      } catch (e) {
      }
      if (desk) {
        document.documentElement.classList.add("desk");
        document.body && document.body.classList.add("desk");
      }
      var dpr = window.devicePixelRatio || 1;
      window.__finsGlass = {
        desk,
        dpr: Math.min(desk ? 2.5 : 2, Math.max(1, dpr)),
        aaa: true
      };
    })();
  } catch (e) {
    console.error("Layer glass.js failed to start:", e);
  }

  // src/layers/world.js
  try {
    (function() {
      "use strict";
      function loadImg(src) {
        var im = new Image();
        im.decoding = "async";
        im.src = src;
        return im;
      }
      var shopBg = loadImg("art/shop-interior.jpg?v=5");
      var backBg = loadImg("art/back-room.jpg?v=2");
      var cityMap = loadImg("art/city-map.jpg?v=2");
      var fishAtlas = loadImg("art/fish-atlas.png?v=4");
      window.shopBg = shopBg;
      window.backBg = backBg;
      window.cityMap = cityMap;
      var TANK_KEYS = ["planted", "goldfish", "reef", "betta", "cichlid", "shrimp", "discus", "quarantine"];
      var tankPlates = {};
      for (var ti = 0; ti < TANK_KEYS.length; ti++) {
        tankPlates[TANK_KEYS[ti]] = loadImg("art/tanks/" + TANK_KEYS[ti] + ".jpg?v=3");
      }
      var tankLooks = {
        ocean: loadImg("art/looks/ocean.jpg?v=1"),
        black: loadImg("art/looks/black.jpg?v=1"),
        sunset: loadImg("art/looks/sunset.jpg?v=1"),
        planted: loadImg("art/looks/planted.jpg?v=1"),
        lagoon: loadImg("art/looks/lagoon.jpg?v=1")
      };
      var gravelImg = loadImg("art/gravel.jpg?v=1");
      window.paintTankLook = function(ctx, w, h, id, light) {
        if (!ctx || w < 8 || h < 8) return false;
        var img = tankLooks[id] || tankLooks.planted;
        if (!img || !img.complete || !img.naturalWidth) return false;
        var iw = img.naturalWidth, ih = img.naturalHeight;
        var scale = Math.max(w / iw, h / ih);
        var dw = iw * scale, dh = ih * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        light = light == null ? 0.7 : light;
        if (light < 0.85) {
          ctx.fillStyle = "rgba(6,12,22," + ((0.85 - light) * 0.72).toFixed(3) + ")";
          ctx.fillRect(0, 0, w, h);
        }
        return true;
      };
      window.paintTankGravel = function(ctx, w, h) {
        if (!ctx || !gravelImg.complete || !gravelImg.naturalWidth || w < 8 || h < 8) return false;
        ctx.save();
        ctx.globalAlpha = 0.82;
        ctx.drawImage(gravelImg, 0, 0, w, h);
        ctx.restore();
        return true;
      };
      var SHOP_WALL = [
        {
          id: "L-top",
          key: "reef",
          kind: "side",
          tint: "rgba(20,70,150,.22)",
          rim: "rgba(90,180,255,.7)",
          fill: "#12324a",
          q: [0.1925, 0.1667, 0.3265, 0.2034, 0.3265, 0.3423, 0.1925, 0.3323]
        },
        {
          id: "L-bot",
          key: "betta",
          kind: "side",
          tint: "rgba(90,20,30,.28)",
          rim: "rgba(220,80,90,.7)",
          fill: "#2a1210",
          q: [0.1925, 0.4018, 0.3265, 0.4067, 0.3265, 0.5506, 0.1925, 0.5456]
        },
        {
          id: "island",
          key: "planted",
          kind: "island",
          tint: "rgba(40,110,80,.22)",
          rim: "rgba(140,210,160,.7)",
          fill: "#16382c",
          q: [0.3376, 0.4762, 0.4869, 0.4762, 0.4869, 0.6647, 0.3376, 0.6647]
        },
        {
          id: "B-t0",
          key: "goldfish",
          kind: "back",
          tint: "rgba(180,120,40,.2)",
          rim: "rgba(240,190,90,.7)",
          fill: "#4a3214",
          q: [0.3348, 0.2758, 0.4743, 0.2758, 0.4743, 0.4167, 0.3348, 0.4167]
        },
        {
          id: "B-t1",
          key: "cichlid",
          kind: "back",
          tint: "rgba(80,90,100,.18)",
          rim: "rgba(190,200,210,.7)",
          fill: "#3a3a32",
          q: [0.4743, 0.2758, 0.5999, 0.2758, 0.5999, 0.4167, 0.4743, 0.4167]
        },
        {
          id: "B-t2",
          key: "discus",
          kind: "back",
          tint: "rgba(40,90,70,.2)",
          rim: "rgba(120,190,150,.7)",
          fill: "#1c3328",
          q: [0.6166, 0.25, 0.71985, 0.25, 0.71985, 0.4315, 0.6166, 0.4315]
        },
        {
          id: "B-b0",
          key: "shrimp",
          kind: "back",
          tint: "rgba(50,120,70,.2)",
          rim: "rgba(110,200,130,.7)",
          fill: "#1e3a24",
          q: [0.4869, 0.4762, 0.6362, 0.4762, 0.6362, 0.6647, 0.4869, 0.6647]
        },
        {
          id: "B-b1",
          key: "quarantine",
          kind: "back",
          tint: "rgba(90,110,120,.16)",
          rim: "rgba(180,200,210,.65)",
          fill: "#2a3438",
          q: [0.71985, 0.25, 0.8231, 0.25, 0.8231, 0.4315, 0.71985, 0.4315]
        }
      ];
      var SHOP_PLAY = [0, 1, 2, 3, 4, 5, 6, 7];
      function wallOf(i) {
        return SHOP_WALL[SHOP_PLAY[(i % SHOP_PLAY.length + SHOP_PLAY.length) % SHOP_PLAY.length]];
      }
      function insetNorm(q, t) {
        var cx = (q[0] + q[2] + q[4] + q[6]) / 4;
        var cy = (q[1] + q[3] + q[5] + q[7]) / 4;
        var o = [];
        for (var i = 0; i < 8; i += 2) {
          o.push(q[i] + (cx - q[i]) * t);
          o.push(q[i + 1] + (cy - q[i + 1]) * t);
        }
        return o;
      }
      function quadToCanvas(q, W, top, ph) {
        return [
          q[0] * W,
          top + q[1] * ph,
          q[2] * W,
          top + q[3] * ph,
          q[4] * W,
          top + q[5] * ph,
          q[6] * W,
          top + q[7] * ph
        ];
      }
      function aabbOf(q) {
        var minx = Math.min(q[0], q[2], q[4], q[6]);
        var maxx = Math.max(q[0], q[2], q[4], q[6]);
        var miny = Math.min(q[1], q[3], q[5], q[7]);
        var maxy = Math.max(q[1], q[3], q[5], q[7]);
        return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
      }
      window.__shopWall = SHOP_WALL;
      window.__shopPlay = SHOP_PLAY;
      function nameOfFish(f, species) {
        if (!f) return "";
        if (f.name) return String(f.name);
        var T = species && species[f.sp];
        if (T && (T.name || T.n)) return String(T.name || T.n);
        if (f.sp && typeof f.sp === "object") return String(f.sp.name || f.sp.n || "");
        return String(f.sp || "");
      }
      function wallKeyForFish(f, species) {
        if (f && (f.sick || f.cond)) return "quarantine";
        var n = nameOfFish(f, species).toLowerCase();
        if (/shrimp|snail|crab|nerite|amano|cherry shrimp/.test(n)) return "shrimp";
        if (/betta|siamese/.test(n)) return "betta";
        if (/clown|damsel|tang|wrasse|marine|anthias|chromis|blenny/.test(n)) return "reef";
        if (/goldfish|comet|oranda|koi|\bcarp\b/.test(n)) return "goldfish";
        if (/cichlid|oscar|ram|krib|frontosa|mbuna/.test(n)) return "cichlid";
        if (/discus|angel|gourami/.test(n)) return "discus";
        return "planted";
      }
      window.shopSlotCount = function(nTanks) {
        if (window.shopBg && shopBg.complete && shopBg.naturalWidth) return SHOP_PLAY.length;
        return Math.max(1, nTanks || 1);
      };
      window.shopFishForSlot = function(slot, allFish, species) {
        var wall = wallOf(slot);
        var key = wall && wall.key;
        allFish = allFish || [];
        var out = [];
        for (var i = 0; i < allFish.length; i++) {
          var f = allFish[i];
          if (f && wallKeyForFish(f, species) === key) out.push(f);
        }
        return out;
      };
      window.shopGoTank = function(slot, view, tanks, fish, species) {
        var wall = wallOf(slot);
        var key = wall && wall.key;
        view = view || 0;
        function has(list) {
          if (!list) return false;
          for (var i = 0; i < list.length; i++) if (wallKeyForFish(list[i], species) === key) return true;
          return false;
        }
        if (has(fish)) return view;
        tanks = tanks || [];
        for (var t = 0; t < tanks.length; t++) {
          if (t === view) continue;
          if (has(tanks[t])) return t;
        }
        return view;
      };
      window.shopPlayTank = function(i, W, top, canvasH) {
        var wall = wallOf(i);
        var ph = Math.max(24, (canvasH || 1) - top);
        var nq = insetNorm(wall.q, 0);
        var q = quadToCanvas(nq, W, top, ph);
        var box = aabbOf(q);
        return {
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          q,
          key: wall.key,
          kind: wall.kind,
          rim: wall.rim,
          tint: wall.tint,
          fill: wall.fill,
          id: wall.id
        };
      };
      window.shopTankBegin = function(ctx, i, W, top, canvasH) {
        var pt = window.shopPlayTank(i, W, top, canvasH);
        if (!ctx || !pt || !pt.q || pt.w < 4 || pt.h < 4) return pt;
        var q = pt.q;
        var x = pt.x, y = pt.y, w = pt.w, h = pt.h;
        var a = (q[2] - q[0]) / w;
        var b = (q[3] - q[1]) / w;
        var c = (q[6] - q[0]) / h;
        var d = (q[7] - q[1]) / h;
        ctx.save();
        ctx.transform(a, b, c, d, q[0] - a * x - c * y, q[1] - b * x - d * y);
        return pt;
      };
      window.shopTankEnd = function(ctx) {
        if (ctx) ctx.restore();
      };
      var plateCrops = {};
      function plateCrop(key, w, h) {
        var img = tankPlates[key] || tankPlates.planted;
        if (!img || !img.complete || !img.naturalWidth) img = tankPlates.planted;
        if (!img || !img.complete || !img.naturalWidth) return null;
        var dpr = window.__finsGlass && window.__finsGlass.dpr || window.devicePixelRatio || 1;
        var need = Math.min(1024, Math.ceil(w * dpr / 128) * 128);
        var c = plateCrops[key];
        if (c && c.width >= need) return c;
        var iw = img.naturalWidth, ih = img.naturalHeight;
        var sw = iw * 0.8, sh = ih * 0.78;
        c = c || document.createElement("canvas");
        c.width = need;
        c.height = Math.max(1, Math.round(need * sh / sw));
        var g = c.getContext("2d");
        g.filter = "contrast(1.2) saturate(1.18) brightness(0.9)";
        g.drawImage(img, iw * 0.1, ih * 0.1, sw, sh, 0, 0, c.width, c.height);
        g.filter = "none";
        plateCrops[key] = c;
        return c;
      }
      window.drawShopTankInterior = function(ctx, x, y, w, h, idx) {
        if (!ctx || w < 8 || h < 8) return;
        if (shopBg.complete && shopBg.naturalWidth) return;
        var wall = wallOf(idx);
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x + 2, y + h * 0.08, w - 4, h * 0.78, 4);
        else ctx.rect(x + 2, y + h * 0.08, w - 4, h * 0.78);
        ctx.clip();
        var crop = plateCrop(wall.key, w, h);
        if (crop) {
          ctx.drawImage(crop, x, y + h * 0.06, w, h * 0.82);
        } else {
          ctx.fillStyle = wall.fill;
          ctx.fillRect(x, y, w, h);
        }
        ctx.fillStyle = wall.tint;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = wall.rim;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x + 6, y + h * 0.14);
        ctx.lineTo(x + w - 6, y + h * 0.14);
        ctx.stroke();
        ctx.restore();
      };
      var FISH_CELLS = 3;
      var FISH_CELL = 256;
      var fishCrops = null;
      function fishIndex(sp) {
        var n = String(sp && (sp.name || sp.n) || "").toLowerCase();
        if (/goldfish|comet|oranda/.test(n)) return 0;
        if (/betta|siamese/.test(n)) return 1;
        if (/tetra|neon|cardinal|rasbora|danio|minnow|white cloud/.test(n)) return 2;
        if (/guppy|endler|platy|molly|sword/.test(n)) return 3;
        if (/angel/.test(n)) return 4;
        if (/cichlid|oscar|ram|krib/.test(n)) return 5;
        if (/\bkoi\b|carp/.test(n)) return 6;
        if (/clown|damsel|tang|wrasse|marine/.test(n)) return 7;
        if (/gourami|discus|barb|cory|loach/.test(n)) return 8;
        var h = 0;
        for (var i = 0; i < n.length; i++) h = h * 33 + n.charCodeAt(i) >>> 0;
        return h % 9;
      }
      function ensureFishCrops() {
        if (fishCrops || !fishAtlas.complete || !fishAtlas.naturalWidth) return;
        try {
          var c = document.createElement("canvas");
          c.width = fishAtlas.naturalWidth;
          c.height = fishAtlas.naturalHeight;
          var g = c.getContext("2d", { willReadFrequently: true });
          g.drawImage(fishAtlas, 0, 0);
          var img = g.getImageData(0, 0, c.width, c.height);
          var data = img.data;
          var W = c.width;
          fishCrops = [];
          for (var idx = 0; idx < 9; idx++) {
            var col = idx % FISH_CELLS, row = idx / FISH_CELLS | 0;
            var x0 = col * FISH_CELL, y0 = row * FISH_CELL;
            var minx = FISH_CELL, miny = FISH_CELL, maxx = 0, maxy = 0;
            for (var y = 0; y < FISH_CELL; y++) {
              for (var x = 0; x < FISH_CELL; x++) {
                if (data[((y0 + y) * W + (x0 + x)) * 4 + 3] > 18) {
                  if (x < minx) minx = x;
                  if (y < miny) miny = y;
                  if (x > maxx) maxx = x;
                  if (y > maxy) maxy = y;
                }
              }
            }
            if (maxx <= minx) {
              minx = 24;
              miny = 24;
              maxx = 232;
              maxy = 232;
            }
            var pad = 8;
            fishCrops[idx] = {
              sx: x0 + Math.max(0, minx - pad),
              sy: y0 + Math.max(0, miny - pad),
              sw: Math.min(FISH_CELL - Math.max(0, minx - pad), maxx - minx + pad * 2),
              sh: Math.min(FISH_CELL - Math.max(0, miny - pad), maxy - miny + pad * 2)
            };
          }
        } catch (e) {
          fishCrops = null;
        }
      }
      window.drawFishSprite = function(args) {
        if (!args || !args.ctx || !fishAtlas.complete || !fishAtlas.naturalWidth) return false;
        var sp = args.sp;
        if (!sp || sp.shape === "shrimp" || sp.shape === "snail" || sp.shape === "crab") return false;
        ensureFishCrops();
        var ctx = args.ctx;
        var f = args.fish || {};
        var hunger = f.hunger == null ? 1 : Math.max(0, Math.min(1.2, f.hunger));
        var sick = f.sick || f.cond || 0;
        var gulp = f.gulp || 0;
        var uniq = ((f.fid || f.id || 0) * 13 + (f.gen || 0)) % 9;
        var size = Math.max(7, args.size || 12) * (0.88 + 0.18 * Math.min(1, hunger)) * (0.94 + uniq * 0.012);
        var idx = fishIndex(sp);
        var crop = fishCrops && fishCrops[idx];
        var dir = f.dir < 0 ? -1 : 1;
        var phase = f.phase || 0;
        var bob = Math.sin(phase) * size * 0.045;
        var bank = Math.max(-0.22, Math.min(0.22, (f.vy || 0) / 420)) * dir;
        var aspect = crop ? crop.sw / Math.max(1, crop.sh) : 1.55;
        var w = size * 2.2;
        var h = w / Math.max(0.6, Math.min(3.2, aspect));
        if (gulp > 0) {
          var gulpN = Math.sin(Math.min(1, gulp / 0.22) * Math.PI);
          w *= 1 + gulpN * 0.06;
        }
        ctx.save();
        ctx.translate(args.x, args.y + size * 0.38);
        ctx.scale(1, 0.28);
        ctx.fillStyle = "rgba(6,16,28," + (0.16 + 0.1 * Math.min(1, hunger)).toFixed(3) + ")";
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.42, w * 0.42, 0, 0, 7);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(args.x, args.y + bob);
        ctx.rotate(bank + Math.sin(phase * 2.1) * 0.045 * dir);
        ctx.scale(dir, 1);
        ctx.imageSmoothingEnabled = true;
        if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";
        if (sick) ctx.filter = "sepia(0.4) saturate(0.75)";
        else if (hunger < 0.35) ctx.globalAlpha = 0.78 + hunger * 0.45;
        if (crop) {
          ctx.drawImage(fishAtlas, crop.sx, crop.sy, crop.sw, crop.sh, -w * 0.48, -h * 0.52, w, h);
        } else {
          var col = idx % FISH_CELLS, row = idx / FISH_CELLS | 0;
          ctx.drawImage(fishAtlas, col * FISH_CELL, row * FISH_CELL, FISH_CELL, FISH_CELL, -w * 0.48, -h * 0.52, w, h);
        }
        ctx.filter = "none";
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.18 + 0.1 * Math.sin(phase * 1.7 + uniq);
        var spec = ctx.createRadialGradient(-w * 0.12, -h * 0.22, 0, 0, 0, w * 0.55);
        spec.addColorStop(0, "rgba(230,250,255,.7)");
        spec.addColorStop(1, "rgba(230,250,255,0)");
        ctx.fillStyle = spec;
        ctx.beginPath();
        ctx.ellipse(-w * 0.06, -h * 0.16, w * 0.28, h * 0.18, -0.4, 0, 7);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        if (f.shiny) {
          ctx.fillStyle = "rgba(255,255,240,.75)";
          ctx.beginPath();
          ctx.arc(w * 0.1, -h * 0.14, Math.max(1.2, size * 0.07), 0, 7);
          ctx.fill();
        }
        if (sick) {
          ctx.fillStyle = "rgba(170,220,90,.18)";
          ctx.beginPath();
          ctx.ellipse(0, 0, w * 0.34, h * 0.24, 0, 0, 7);
          ctx.fill();
        }
        ctx.restore();
        return true;
      };
      window.drawShopBackdrop = function(ctx, x, y, w, h, t, wx) {
        if (!ctx || !shopBg.complete || !shopBg.naturalWidth || w < 8 || h < 8) return false;
        t = t || 0;
        wx = wx || {};
        ctx.save();
        ctx.drawImage(shopBg, x, y, w, h);
        var day = wx.day == null ? 0.65 : wx.day;
        if (day < 0.5) {
          ctx.fillStyle = "rgba(6,12,24," + ((0.5 - day) * 0.85).toFixed(3) + ")";
          ctx.fillRect(x, y, w, h);
        }
        var g = ctx.createLinearGradient(0, y, 0, y + h * 0.14);
        g.addColorStop(0, "rgba(6,10,16,.38)");
        g.addColorStop(1, "rgba(6,10,16,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h * 0.14);
        drawShopRoomFx(ctx, x, y, w, h, t, wx);
        if (window.__gunFlash > 0.04) {
          ctx.fillStyle = "rgba(255,244,210," + (window.__gunFlash * 0.42).toFixed(3) + ")";
          ctx.fillRect(x, y, w, h);
          var doorGlow = ctx.createRadialGradient(x + w * 0.12, y + h * 0.5, 4, x + w * 0.12, y + h * 0.5, w * 0.4);
          doorGlow.addColorStop(0, "rgba(255,250,230," + (window.__gunFlash * 0.55).toFixed(3) + ")");
          doorGlow.addColorStop(1, "rgba(255,220,160,0)");
          ctx.fillStyle = doorGlow;
          ctx.fillRect(x, y, w, h);
        }
        ctx.restore();
        return true;
      };
      window.drawBackBackdrop = function(ctx, x, y, w, h, t) {
        if (!ctx || !backBg.complete || !backBg.naturalWidth || w < 8 || h < 8) return false;
        t = t || 0;
        ctx.save();
        var iw = backBg.naturalWidth, ih = backBg.naturalHeight;
        var scale = Math.max(w / iw, h / ih);
        var dw = iw * scale, dh = ih * scale;
        var ox = dw > w ? (w - dw) * 0.18 : (w - dw) / 2;
        var oy = dh > h ? (h - dh) * 0.35 : (h - dh) / 2;
        ctx.drawImage(backBg, x + ox, y + oy, dw, dh);
        var top = ctx.createLinearGradient(0, y, 0, y + h * 0.12);
        top.addColorStop(0, "rgba(6,10,16,.34)");
        top.addColorStop(1, "rgba(6,10,16,0)");
        ctx.fillStyle = top;
        ctx.fillRect(x, y, w, h * 0.12);
        var bot = ctx.createLinearGradient(0, y + h * 0.82, 0, y + h);
        bot.addColorStop(0, "rgba(8,6,4,0)");
        bot.addColorStop(1, "rgba(8,6,4,.28)");
        ctx.fillStyle = bot;
        ctx.fillRect(x, y + h * 0.72, w, h * 0.28);
        var pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
        var bulb = ctx.createRadialGradient(x + w * 0.5, y + h * 0.08, 4, x + w * 0.5, y + h * 0.22, w * 0.42);
        bulb.addColorStop(0, "rgba(255,220,150," + (0.05 + pulse * 0.03).toFixed(3) + ")");
        bulb.addColorStop(1, "rgba(255,200,120,0)");
        ctx.fillStyle = bulb;
        ctx.fillRect(x, y, w, h * 0.55);
        ctx.restore();
        return true;
      };
      var dust = [];
      var steam = [];
      var rain = [];
      var snow = [];
      var gustBits = [];
      var beads = [];
      var flashT = 0;
      var reduced = false;
      try {
        reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      } catch (e) {
      }
      var stepAt = /* @__PURE__ */ Object.create(null);
      function frameStep(key, t) {
        var last = stepAt[key];
        stepAt[key] = t;
        if (last == null) return 1;
        if (!(t > last)) return 0;
        return Math.min(3, (t - last) * 60);
      }
      function seedPool(pool, n, make) {
        while (pool.length < n) pool.push(make(pool.length));
        if (pool.length > n) pool.length = n;
      }
      var SHOP_WIN = { x: 0.018, y: 0.082, w: 0.138, h: 0.58 };
      function mixRgb(a, b, t) {
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        return [
          a[0] + (b[0] - a[0]) * t | 0,
          a[1] + (b[1] - a[1]) * t | 0,
          a[2] + (b[2] - a[2]) * t | 0
        ];
      }
      function airC(wx) {
        try {
          if (typeof wxWord === "function") {
            var s = wxWord();
            var f = s.match(/(-?\d+)\s*°F/);
            if (f) return (parseInt(f[1], 10) - 32) * 5 / 9;
            var c = s.match(/(-?\d+)\s*°C/);
            if (c) return parseInt(c[1], 10);
          }
        } catch (e) {
        }
        return wx && wx.seaT != null ? wx.seaT : 12;
      }
      function skyRgb(day, cloud, rainAmt, fogAmt) {
        var night = [8, 12, 22];
        var dawn = [196, 118, 72];
        var noon = [118, 168, 210];
        var dusk = [210, 96, 58];
        var over = [92, 104, 118];
        var storm = [48, 58, 72];
        var base;
        if (day < 0.22) base = mixRgb(night, dawn, day / 0.22);
        else if (day < 0.45) base = mixRgb(dawn, noon, (day - 0.22) / 0.23);
        else if (day > 0.82) base = mixRgb(dusk, night, (day - 0.82) / 0.18);
        else if (day > 0.68) base = mixRgb(noon, dusk, (day - 0.68) / 0.14);
        else base = noon;
        base = mixRgb(base, over, Math.max(0, cloud - 0.28) * 1.15);
        if (rainAmt > 0.08) base = mixRgb(base, storm, Math.min(1, rainAmt * 1.1));
        if (fogAmt > 0.15) base = mixRgb(base, [170, 176, 182], fogAmt * 0.55);
        return base;
      }
      function drawWindowWeather(ctx, x, y, w, h, t, wx) {
        var rainAmt = Math.max(0, wx.rain || 0);
        var fogAmt = Math.max(0, wx.fog || 0);
        var cloud = wx.cloud == null ? 0.3 : wx.cloud;
        var wind = wx.wind || 8;
        var gust = wx.gust || 0;
        var day = wx.day == null ? 0.65 : wx.day;
        var seaT = airC(wx);
        var front = wx.front || 0;
        var snowing = rainAmt > 0.05 && seaT <= 1.5;
        var sleeting = rainAmt > 0.1 && seaT > 1.5 && seaT < 4.5;
        var storming = rainAmt > 0.55 || wind >= 28 || front > 0.4 && rainAmt > 0.25;
        var night = day < 0.28;
        var px = x + SHOP_WIN.x * w;
        var py = y + SHOP_WIN.y * h;
        var pw = SHOP_WIN.w * w;
        var ph = SHOP_WIN.h * h;
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, Math.min(6, pw * 0.03));
        else ctx.rect(px, py, pw, ph);
        ctx.clip();
        var rgb = skyRgb(day, cloud, rainAmt, fogAmt);
        var veil = 0.07 + cloud * 0.1 + rainAmt * 0.09 + (night ? 0.14 : 0) + fogAmt * 0.1;
        veil = Math.min(0.38, veil);
        ctx.globalCompositeOperation = "multiply";
        var wash = ctx.createLinearGradient(px, py, px, py + ph);
        wash.addColorStop(0, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + veil.toFixed(3) + ")");
        wash.addColorStop(0.5, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + (veil * 0.42).toFixed(3) + ")");
        wash.addColorStop(1, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0.03)");
        ctx.fillStyle = wash;
        ctx.fillRect(px, py, pw, ph);
        ctx.globalCompositeOperation = night ? "screen" : "overlay";
        var sky = ctx.createLinearGradient(px, py, px, py + ph);
        var topA = (night ? 0.22 : 0.14) + cloud * 0.08;
        sky.addColorStop(0, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + topA.toFixed(3) + ")");
        sky.addColorStop(0.45, "rgba(" + rgb[0] + "," + rgb[1] + "," + Math.min(255, rgb[2] + 8) + "," + (topA * 0.35).toFixed(3) + ")");
        sky.addColorStop(1, "rgba(20,24,28," + (night ? 0.18 : 0.04).toFixed(3) + ")");
        ctx.fillStyle = sky;
        ctx.fillRect(px, py, pw, ph);
        if (night) {
          ctx.globalCompositeOperation = "screen";
          var lamp = ctx.createRadialGradient(px + pw * 0.72, py + ph * 0.7, 2, px + pw * 0.55, py + ph * 0.62, pw * 0.9);
          lamp.addColorStop(0, "rgba(255,170,70," + (0.2 + (1 - cloud) * 0.08).toFixed(3) + ")");
          lamp.addColorStop(0.45, "rgba(255,140,40,.06)");
          lamp.addColorStop(1, "rgba(255,120,30,0)");
          ctx.fillStyle = lamp;
          ctx.fillRect(px, py, pw, ph);
        }
        ctx.globalCompositeOperation = "source-over";
        if (fogAmt > 0.04) {
          ctx.fillStyle = "rgba(210,216,222," + (fogAmt * 0.32).toFixed(3) + ")";
          ctx.fillRect(px, py, pw, ph);
          var fogBand = ctx.createLinearGradient(px, py + ph * 0.45, px, py + ph);
          fogBand.addColorStop(0, "rgba(200,208,214,0)");
          fogBand.addColorStop(1, "rgba(188,196,204," + (fogAmt * 0.4).toFixed(3) + ")");
          ctx.fillStyle = fogBand;
          ctx.fillRect(px, py, pw, ph);
        }
        var slant = ((wx.dir || 240) > 180 ? 1 : -1) * (0.12 + wind * 0.012 + gust * 0.02);
        var fs = frameStep("window", t);
        var dt = (reduced ? 0.45 : 1) * fs;
        if (!snowing && rainAmt > 0.03) {
          var nRain = reduced ? 10 : Math.floor(16 + rainAmt * 40 + wind * 0.4);
          seedPool(rain, nRain, function() {
            return {
              x: Math.random(),
              y: Math.random(),
              l: 0.05 + Math.random() * 0.14,
              v: 0.22 + Math.random() * 0.45 + rainAmt * 0.25,
              w: 0.55 + Math.random()
            };
          });
          ctx.strokeStyle = "rgba(214,230,242," + (0.16 + rainAmt * 0.42).toFixed(3) + ")";
          ctx.lineWidth = rainAmt > 0.6 ? 1.35 : 1;
          ctx.beginPath();
          for (var i = 0; i < rain.length; i++) {
            var d = rain[i];
            d.y += d.v * 0.018 * dt * (0.85 + rainAmt);
            d.x += slant * 0.01 * dt;
            if (d.y > 1.15) {
              d.y = -0.12;
              d.x = Math.random();
            }
            if (d.x < -0.1) d.x += 1.2;
            if (d.x > 1.1) d.x -= 1.2;
            var rx = px + d.x * pw;
            var ry = py + d.y * ph;
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + slant * d.l * pw * 0.35, ry + d.l * ph);
          }
          ctx.stroke();
        }
        if (snowing || sleeting) {
          var nSnow = reduced ? 10 : Math.floor(18 + rainAmt * 40);
          seedPool(snow, nSnow, function() {
            return {
              x: Math.random(),
              y: Math.random(),
              r: 1.1 + Math.random() * 2.4,
              v: 0.035 + Math.random() * 0.07,
              p: Math.random() * 6.28
            };
          });
          ctx.fillStyle = "rgba(242,248,255,.88)";
          for (var s = 0; s < snow.length; s++) {
            var fl = snow[s];
            fl.y += fl.v * dt * (sleeting ? 1.6 : 1);
            fl.x += Math.sin(t * 0.9 + fl.p) * 3e-3 * dt + slant * 4e-3 * fs;
            if (fl.y > 1.08) {
              fl.y = -0.05;
              fl.x = Math.random();
            }
            ctx.globalAlpha = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t + fl.p));
            ctx.beginPath();
            ctx.arc(px + fl.x * pw, py + fl.y * ph, fl.r, 0, 7);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        if (wind > 16 && rainAmt < 0.35 && !reduced) {
          seedPool(gustBits, Math.min(14, 4 + wind / 6 | 0), function() {
            return { x: Math.random(), y: 0.3 + Math.random() * 0.6, v: 0.012 + Math.random() * 0.03, l: 0.04 + Math.random() * 0.08, p: Math.random() * 6 };
          });
          ctx.strokeStyle = "rgba(40,36,28,.22)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (var g = 0; g < gustBits.length; g++) {
            var bit = gustBits[g];
            bit.x += bit.v * dt * (wind / 18) * (slant >= 0 ? 1 : -1);
            bit.y += Math.sin(t * 2 + bit.p) * 2e-3 * fs;
            if (bit.x > 1.2) bit.x = -0.1;
            if (bit.x < -0.2) bit.x = 1.1;
            var bx = px + bit.x * pw;
            var by = py + bit.y * ph;
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + bit.l * pw * (slant >= 0 ? 1 : -1), by + 1.5);
          }
          ctx.stroke();
        }
        if (storming) {
          if (flashT <= 0 && Math.random() < 0.012 * dt) flashT = 0.18 + Math.random() * 0.16;
          if (flashT > 0) {
            flashT -= 0.016 * dt;
            ctx.globalCompositeOperation = "screen";
            ctx.fillStyle = "rgba(210,230,255," + (flashT * 1.6).toFixed(3) + ")";
            ctx.fillRect(px, py, pw, ph);
            ctx.globalCompositeOperation = "source-over";
            if (flashT > 0.12 && window.feel && feel.play && Math.random() < 0.18 * fs) {
              try {
                feel.play("thud");
              } catch (e) {
              }
            }
          }
        } else flashT = 0;
        var wet = Math.max(rainAmt, fogAmt * 0.6, snowing ? 0.3 : 0);
        if (wet > 0.04 && !reduced) {
          seedPool(beads, Math.floor(10 + wet * 22), function() {
            return {
              x: 0.06 + Math.random() * 0.88,
              y: Math.random() * 0.7,
              r: 0.8 + Math.random() * 1.6,
              v: 15e-4 + Math.random() * 6e-3 * (0.4 + rainAmt),
              hold: Math.random() * 2
            };
          });
          ctx.fillStyle = "rgba(220,236,248,.42)";
          ctx.strokeStyle = "rgba(255,255,255,.22)";
          ctx.lineWidth = 0.8;
          for (var b = 0; b < beads.length; b++) {
            var be = beads[b];
            be.hold -= 0.016 * fs;
            if (be.hold < 0) be.y += be.v * dt;
            if (be.y > 0.96) {
              be.y = Math.random() * 0.2;
              be.x = 0.05 + Math.random() * 0.9;
              be.hold = 0.4 + Math.random() * 2.2;
            }
            var bpx = px + be.x * pw;
            var bpy = py + be.y * ph;
            ctx.beginPath();
            ctx.ellipse(bpx, bpy, be.r * 0.7, be.r, 0, 0, 7);
            ctx.fill();
          }
        }
        ctx.globalCompositeOperation = "screen";
        var shine = ctx.createLinearGradient(px, py, px + pw * 0.55, py + ph * 0.35);
        shine.addColorStop(0, "rgba(255,255,255," + (0.05 + (1 - cloud) * 0.04).toFixed(3) + ")");
        shine.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = shine;
        ctx.fillRect(px, py, pw, ph * 0.45);
        ctx.globalCompositeOperation = "source-over";
        ctx.restore();
        return { x: px, y: py, w: pw, h: ph, rain: rainAmt, cloud, night };
      }
      function drawShopRoomFx(ctx, x, y, w, h, t, wx) {
        var rs = frameStep("room", t);
        var rainAmt = Math.max(0, wx.rain || 0);
        var fogAmt = Math.max(0, wx.fog || 0);
        var cloud = wx.cloud == null ? 0.3 : wx.cloud;
        var win = drawWindowWeather(ctx, x, y, w, h, t, wx);
        var doorX = win.x, doorY = win.y, doorW = win.w, doorH = win.h;
        var lamps = [
          [0.22, 0.18, 0.16],
          [0.5, 0.16, 0.2],
          [0.78, 0.2, 0.16]
        ];
        for (var L = 0; L < lamps.length; L++) {
          var lx = x + lamps[L][0] * w, ly = y + lamps[L][1] * h, rad = lamps[L][2] * w;
          var flick = reduced ? 0.7 : 0.62 + 0.1 * Math.sin(t * 2.05 + L) + 0.04 * Math.sin(t * 13.7 + L * 2);
          var grd = ctx.createRadialGradient(lx, ly, 2, lx, ly, rad);
          grd.addColorStop(0, "rgba(255,210,140," + (0.22 * flick).toFixed(3) + ")");
          grd.addColorStop(0.45, "rgba(255,170,80," + (0.08 * flick).toFixed(3) + ")");
          grd.addColorStop(1, "rgba(255,140,40,0)");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(lx, ly, rad, 0, 7);
          ctx.fill();
        }
        if (!reduced) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          var sway = Math.sin(t * 0.35) * 0.04;
          var ray = ctx.createLinearGradient(doorX + doorW, doorY, x + w * (0.42 + sway), y + h * 0.92);
          ray.addColorStop(0, "rgba(255,220,170," + ((0.04 + (1 - cloud) * 0.03) * (1 - rainAmt * 0.75) * (win.night ? 0.15 : 1)).toFixed(3) + ")");
          ray.addColorStop(1, "rgba(255,200,120,0)");
          ctx.fillStyle = ray;
          ctx.beginPath();
          ctx.moveTo(doorX + doorW * 0.2, doorY);
          ctx.lineTo(doorX + doorW, doorY);
          ctx.lineTo(x + w * (0.5 + sway), y + h);
          ctx.lineTo(x + w * (0.22 + sway), y + h);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        seedPool(dust, reduced ? 10 : 28, function(i) {
          return {
            x: 0.15 + Math.random() * 0.7,
            y: Math.random(),
            s: 0.6 + Math.random() * 1.4,
            p: Math.random() * 6.28,
            v: 3e-3 + Math.random() * 7e-3
          };
        });
        ctx.fillStyle = "rgba(255,236,200,.55)";
        for (var m = 0; m < dust.length; m++) {
          var u = dust[m];
          u.y -= u.v * (reduced ? 0.4 : 1) * rs;
          u.x += Math.sin(t * 0.4 + u.p) * 35e-5 * rs;
          if (u.y < -0.02) {
            u.y = 1.02;
            u.x = 0.12 + Math.random() * 0.76;
          }
          var a = 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.3 + u.p));
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(x + u.x * w, y + u.y * h, u.s, 0, 7);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(30,20,12,.35)";
        ctx.lineWidth = 1;
        for (var L2 = 0; L2 < lamps.length; L2++) {
          var cx = x + lamps[L2][0] * w;
          var cy = y + lamps[L2][1] * h;
          var sway = Math.sin(t * 1.15 + L2) * w * 4e-3;
          ctx.beginPath();
          ctx.moveTo(cx, y + h * 0.02);
          ctx.quadraticCurveTo(cx + sway, cy * 0.55, cx + sway * 0.4, cy);
          ctx.stroke();
        }
        seedPool(steam, 10, function(i) {
          return { x: 0.2 + Math.random() * 0.04, y: 0.62, life: Math.random(), v: 0.01 + Math.random() * 0.02 };
        });
        for (var s = 0; s < steam.length; s++) {
          var st = steam[s];
          st.life += st.v * rs;
          if (st.life > 1) {
            st.life = 0;
            st.x = 0.19 + Math.random() * 0.05;
          }
          var sy = y + (0.62 - st.life * 0.16) * h;
          var sx = x + (st.x + Math.sin(t * 1.4 + s) * 8e-3 * st.life) * w;
          ctx.globalAlpha = (1 - st.life) * 0.07;
          ctx.fillStyle = "#e8e4dc";
          ctx.beginPath();
          ctx.ellipse(sx, sy, 3 + st.life * 5, 2 + st.life * 4, 0, 0, 7);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (!reduced) {
          ctx.save();
          ctx.translate(x + w * 0.9, y + h * 0.72);
          ctx.rotate(Math.sin(t * 0.9) * 0.05);
          ctx.fillStyle = "rgba(40,90,55,.18)";
          for (var lf = 0; lf < 5; lf++) {
            ctx.save();
            ctx.rotate(-0.5 + lf * 0.22 + Math.sin(t * 1.1 + lf) * 0.06);
            ctx.beginPath();
            ctx.ellipse(0, -h * (0.04 + lf * 0.012), w * 0.012, h * 0.05, 0.4, 0, 7);
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
        }
        try {
          if (window.shopSite && shopSite.wet() > 0.12) {
            var wetA = Math.min(0.38, shopSite.wet() * 0.45);
            ctx.save();
            ctx.globalAlpha = wetA;
            ctx.fillStyle = "rgba(36,64,84,1)";
            ctx.beginPath();
            ctx.ellipse(x + w * 0.48, y + h * 0.74, w * 0.24, h * 0.055, 0, 0, 7);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(x + w * 0.42, y + h * 0.7, w * 0.1, h * 0.03, 0, 0, 7);
            ctx.fill();
            ctx.restore();
            if (shopSite.wet() > 0.2) {
              ctx.save();
              ctx.strokeStyle = "rgba(180,210,230," + (0.25 + shopSite.wet() * 0.3).toFixed(2) + ")";
              ctx.lineWidth = 1.2;
              var dripT = t || 0;
              for (var dr = 0; dr < 3; dr++) {
                var dx = x + w * (0.44 + dr * 0.04);
                var dy = y + h * (0.52 + (dripT * 0.35 + dr * 0.2) % 0.22);
                ctx.beginPath();
                ctx.moveTo(dx, dy);
                ctx.lineTo(dx, dy + h * 0.025);
                ctx.stroke();
              }
              ctx.restore();
            }
          }
        } catch (eWet) {
        }
      }
      function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
      }
      var bubbles = [];
      window.shopInteriorFx = function(ctx, t, wx, tanks, floorY) {
        window.__shopTanks = tanks || [];
        if (!ctx || !tanks || !tanks.length) return;
        t = t || 0;
        var ts = frameStep("tanks", t);
        wx = wx || {};
        var need = tanks.length * (reduced ? 5 : 9);
        seedPool(bubbles, need, function(i2) {
          return { id: i2, u: Math.random(), v: Math.random(), r: 0.8 + Math.random() * 1.6, sp: 0.012 + Math.random() * 0.03, w: Math.random() };
        });
        for (var i = 0; i < tanks.length; i++) {
          var tk = tanks[i];
          var tx = tk[0], ty = tk[1], tw = tk[2], th = tk[3];
          if (tw < 8 || th < 8) continue;
          var pt = (window.__shopTankPts || [])[i];
          var q = pt && pt.q;
          ctx.save();
          ctx.beginPath();
          if (q && q.length >= 8) {
            ctx.moveTo(q[0], q[1]);
            ctx.lineTo(q[2], q[3]);
            ctx.lineTo(q[4], q[5]);
            ctx.lineTo(q[6], q[7]);
            ctx.closePath();
          } else if (ctx.roundRect) ctx.roundRect(tx + 2, ty + th * 0.08, tw - 4, th * 0.78, 3);
          else ctx.rect(tx + 2, ty + th * 0.08, tw - 4, th * 0.78);
          ctx.clip();
          var live = !!(window.shopBg && shopBg.complete && shopBg.naturalWidth);
          if (wx.clog) {
            ctx.fillStyle = live ? "rgba(90,80,40,.08)" : "rgba(90,80,40,.22)";
            ctx.fillRect(tx, ty, tw, th);
          }
          if (!live) {
            ctx.globalCompositeOperation = "lighter";
            for (var c = 0; c < 3; c++) {
              var ph = t * (0.35 + c * 0.12) + i * 0.7 + c;
              ctx.beginPath();
              ctx.moveTo(tx, ty + th);
              for (var px = 0; px <= tw; px += 6) {
                var yy = ty + th * 0.2 + Math.sin(px * 0.045 + ph) * 7 + Math.sin(px * 0.02 + ph * 1.7) * 5 + c * 10;
                ctx.lineTo(tx + px, yy);
              }
              ctx.strokeStyle = wx.clog ? "rgba(180,170,90," + (0.05 + c * 0.015).toFixed(3) + ")" : "rgba(140,220,255," + (0.07 + c * 0.02).toFixed(3) + ")";
              ctx.lineWidth = 5 - c;
              ctx.stroke();
            }
            var sy = ty + th * 0.1 + Math.sin(t * 1.6 + i) * 1.5;
            var sg = ctx.createLinearGradient(tx, sy, tx, sy + 8);
            sg.addColorStop(0, "rgba(200,240,255,.22)");
            sg.addColorStop(1, "rgba(200,240,255,0)");
            ctx.fillStyle = sg;
            ctx.fillRect(tx, sy, tw, 8);
          }
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = "rgba(210,240,255,.55)";
          ctx.lineWidth = 1;
          for (var b = 0; b < bubbles.length; b++) {
            if (b % tanks.length !== i) continue;
            var bu = bubbles[b];
            bu.v -= bu.sp * ts;
            if (bu.v < 0) {
              bu.v = 1;
              bu.u = 0.08 + Math.random() * 0.84;
            }
            var bx = tx + 4 + (bu.u + Math.sin(t * 1.2 + bu.w) * 0.04) * (tw - 8);
            var by = ty + th * 0.12 + bu.v * th * 0.7;
            ctx.globalAlpha = 0.25 + 0.45 * bu.v;
            ctx.beginPath();
            ctx.arc(bx, by, bu.r, 0, 7);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          ctx.restore();
          if (window.shopBg && shopBg.complete && shopBg.naturalWidth) {
            ctx.save();
            if (q && q.length >= 8) {
              ctx.beginPath();
              ctx.moveTo(q[0], q[1]);
              ctx.lineTo(q[2], q[3]);
              ctx.lineTo(q[4], q[5]);
              ctx.lineTo(q[6], q[7]);
              ctx.closePath();
              ctx.clip();
            }
            var shine = ctx.createLinearGradient(tx, ty, tx + tw * 0.35, ty + th * 0.45);
            shine.addColorStop(0, "rgba(255,255,255,.08)");
            shine.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = shine;
            ctx.fillRect(tx + 4, ty + th * 0.12, tw * 0.14, th * 0.4);
            ctx.restore();
          }
          if (!live) {
            ctx.save();
            if (q && q.length >= 8) {
              ctx.beginPath();
              ctx.moveTo(q[0], q[1]);
              ctx.lineTo(q[2], q[3]);
              ctx.lineTo(q[2] + 6, q[3] - 5);
              ctx.lineTo(q[0] + 4, q[1] - 6);
              ctx.closePath();
              ctx.fillStyle = "rgba(210,232,245," + (0.1 + 0.04 * Math.sin((t || 0) + i)).toFixed(3) + ")";
              ctx.fill();
              ctx.beginPath();
              ctx.moveTo(q[2], q[3]);
              ctx.lineTo(q[4], q[5]);
              ctx.lineTo(q[4] + 7, q[5] - 1);
              ctx.lineTo(q[2] + 7, q[3] - 4);
              ctx.closePath();
              ctx.fillStyle = "rgba(6,14,24,.32)";
              ctx.fill();
              ctx.beginPath();
              ctx.moveTo(q[6], q[7]);
              ctx.lineTo(q[4], q[5]);
              ctx.lineTo(q[4] + 3, q[5] + 9);
              ctx.lineTo(q[6] - 2, q[7] + 10);
              ctx.closePath();
              ctx.fillStyle = "rgba(4,8,12,.38)";
              ctx.fill();
              ctx.beginPath();
              ctx.moveTo(q[0], q[1]);
              ctx.lineTo(q[2], q[3]);
              ctx.lineTo(q[4], q[5]);
              ctx.lineTo(q[6], q[7]);
              ctx.closePath();
              ctx.strokeStyle = "rgba(190,230,255,.5)";
              ctx.lineWidth = 1.5;
              ctx.stroke();
            } else {
              ctx.fillStyle = "rgba(8,16,26,.4)";
              ctx.fillRect(tx + tw - 6, ty + th * 0.1, 6, th * 0.76);
              ctx.fillStyle = "rgba(200,230,245,.14)";
              ctx.fillRect(tx + 2, ty + th * 0.07, tw - 4, 5);
              ctx.strokeStyle = "rgba(190,230,255,.42)";
              ctx.lineWidth = 1.2;
              ctx.strokeRect(tx + 2, ty + th * 0.08, tw - 4, th * 0.78);
              ctx.fillStyle = "rgba(0,0,0,.3)";
              ctx.fillRect(tx + 10, ty + th * 0.86, tw - 16, 7);
            }
            ctx.restore();
          }
          if (floorY && !(window.shopBg && shopBg.complete)) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            var cx = tx + tw * 0.5 + Math.sin(t * 0.8 + i) * 6;
            var cy = floorY + 8;
            var glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, tw * 0.45);
            glow.addColorStop(0, "rgba(90,180,220," + (0.1 + 0.05 * Math.sin(t * 1.4 + i)).toFixed(3) + ")");
            glow.addColorStop(1, "rgba(90,180,220,0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.ellipse(cx, cy, tw * 0.42, 10, 0, 0, 7);
            ctx.fill();
            ctx.restore();
          }
        }
      };
      var WORLD_GW = { lon0: -71.125, lon1: -70.995, lat0: 42.31965, lat1: 42.41635 };
      var PHOTO_GW = { lon0: -71.072, lon1: -70.994, lat0: 42.3315, lat1: 42.3865 };
      function worldToLonLat(x, y) {
        return [
          WORLD_GW.lon0 + x / 1e3 * (WORLD_GW.lon1 - WORLD_GW.lon0),
          WORLD_GW.lat1 - y / 1e3 * (WORLD_GW.lat1 - WORLD_GW.lat0)
        ];
      }
      function lonLatToPhoto(lon, lat, iw, ih) {
        return [
          (lon - PHOTO_GW.lon0) / (PHOTO_GW.lon1 - PHOTO_GW.lon0) * iw,
          (PHOTO_GW.lat1 - lat) / (PHOTO_GW.lat1 - PHOTO_GW.lat0) * ih
        ];
      }
      function worldToPhoto(x, y, iw, ih) {
        var ll = worldToLonLat(x, y);
        return lonLatToPhoto(ll[0], ll[1], iw, ih);
      }
      var waterMask = null, waterMW = 256, waterMH = 256;
      function ensureWaterMask() {
        if (waterMask || !cityMap.complete || !cityMap.naturalWidth) return;
        try {
          var c = document.createElement("canvas");
          c.width = waterMW;
          c.height = waterMH;
          var x = c.getContext("2d");
          x.drawImage(cityMap, 0, 0, waterMW, waterMH);
          var data = x.getImageData(0, 0, waterMW, waterMH).data;
          waterMask = new Uint8Array(waterMW * waterMH);
          for (var i = 0; i < waterMask.length; i++) {
            var r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
            waterMask[i] = b > 88 && b > r + 12 && g > r - 8 && r < 150 && b + g > r * 2.1 ? 1 : 0;
          }
        } catch (e) {
          waterMask = new Uint8Array(1);
        }
      }
      function photoIsWater(px, py, iw, ih) {
        if (!waterMask || waterMask.length < 4) return false;
        var mx = Math.max(0, Math.min(waterMW - 1, px / iw * waterMW | 0));
        var my = Math.max(0, Math.min(waterMH - 1, py / ih * waterMH | 0));
        return waterMask[my * waterMW + mx] === 1;
      }
      var cam = { left: 482, top: 472, span: 96 };
      window.townCam = cam;
      window.townToView = function(x, y, w, h) {
        return [(x - cam.left) / cam.span * w, (y - cam.top) / cam.span * h];
      };
      var STREET_CHAINS = [
        ["haymarket", "shop", "salem", "prince", "oldnorth", "copps"],
        ["hanover", "square", "park"],
        ["commercial", "battery", "langone"],
        ["greenway", "prince", "prado", "hanover"],
        ["square", "lewis", "battery"],
        ["shop", "hanover"],
        ["copps", "langone"],
        ["salem", "prado"],
        ["park", "lewis"]
      ];
      function streetSegs(places) {
        var by = /* @__PURE__ */ Object.create(null);
        if (places && places.length) {
          for (var i = 0; i < places.length; i++) {
            var p = places[i];
            if (p && p.id) by[p.id] = p;
          }
        }
        var segs = [];
        for (var c = 0; c < STREET_CHAINS.length; c++) {
          var chain = STREET_CHAINS[c];
          for (var k = 0; k < chain.length - 1; k++) {
            var a = by[chain[k]], b = by[chain[k + 1]];
            if (a && b && isFinite(a.x) && isFinite(b.x)) segs.push([a.x, a.y, b.x, b.y, chain[k], chain[k + 1]]);
          }
        }
        return segs;
      }
      function alongSeg(seg, t, side) {
        var x = seg[0] + (seg[2] - seg[0]) * t;
        var y = seg[1] + (seg[3] - seg[1]) * t;
        var dx = seg[2] - seg[0], dy = seg[3] - seg[1];
        var len = Math.hypot(dx, dy) || 1;
        var nx = -dy / len, ny = dx / len;
        return [x + nx * side, y + ny * side];
      }
      function inHarborWater(px, py, byId) {
        if (px > 585) return true;
        if (px > 560 && py > 560) return true;
        var bat = byId && byId.battery;
        if (bat && px > bat.x + 8 && py > bat.y + 6) return true;
        return false;
      }
      window.scatterTown = function(place, idx, mode) {
        var segs = window.__townSegs;
        var px = place && place.x != null ? place.x : 528;
        var py = place && place.y != null ? place.y : 531;
        var pr = place && place.r != null ? place.r : 18;
        var h1 = (idx * 1103515245 + 12345 >>> 0) / 4294967296;
        var h2 = (idx * 1664525 + 1013904223 >>> 0) / 4294967296;
        if (mode === "place" || mode === "market") {
          var ang = h1 * Math.PI * 2;
          var rad = (0.18 + h2 * 0.55) * pr;
          return [px + Math.cos(ang) * rad, py + Math.sin(ang) * rad * 0.72];
        }
        if (!segs || !segs.length) {
          return [px + (h1 * 22 - 11), py + (h2 * 18 - 9)];
        }
        var seg = segs[idx % segs.length];
        var t = 0.06 + h1 * 0.88;
        var lot = mode === "home" || mode === "work";
        var side = (idx % 2 ? 1 : -1) * (lot ? 5.5 + idx % 7 * 1.15 : 1.6 + idx % 4 * 0.55);
        return alongSeg(seg, t, side);
      };
      function hash01(i, salt) {
        var n = (i + 1) * 2654435761 + (salt || 0) * 1597334677 >>> 0;
        return n / 4294967296;
      }
      function drawMiniPerson(ctx, x, y, size, color, moving, walk, seed) {
        ctx.save();
        ctx.fillStyle = "rgba(8,4,0,.32)";
        ctx.beginPath();
        ctx.ellipse(x + 0.4, y + 0.6, size * 0.32, size * 0.12, 0, 0, 7);
        ctx.fill();
        var bob = moving ? Math.sin((walk || 0) % 1 * Math.PI * 2) * size * 0.08 : 0;
        var stride = moving ? Math.sin((walk || 0) * Math.PI * 2) * size * 0.12 : 0;
        ctx.strokeStyle = "#34414b";
        ctx.lineWidth = Math.max(1, size * 0.13);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x - size * 0.09, y - size * 0.2);
        ctx.lineTo(x - size * 0.09 - stride, y);
        ctx.moveTo(x + size * 0.09, y - size * 0.2);
        ctx.lineTo(x + size * 0.09 + stride, y);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y - size * 0.4 + bob, size * 0.2, size * 0.27, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = ["#d5a581", "#ad795a", "#edc4a0", "#795744"][(seed || 0) % 4];
        ctx.beginPath();
        ctx.arc(x, y - size * 0.76 + bob, Math.max(1.1, size * 0.15), 0, 7);
        ctx.fill();
        ctx.fillStyle = "#3c302c";
        ctx.beginPath();
        ctx.arc(x, y - size * 0.81 + bob, Math.max(1, size * 0.15), Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      var townLamp = null;
      function townLampImage() {
        if (townLamp) return townLamp;
        townLamp = document.createElement("canvas");
        townLamp.width = townLamp.height = 64;
        var c = townLamp.getContext("2d");
        var glow = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        glow.addColorStop(0, "rgba(255,207,123,.55)");
        glow.addColorStop(0.3, "rgba(255,190,100,.18)");
        glow.addColorStop(1, "rgba(255,190,100,0)");
        c.fillStyle = glow;
        c.fillRect(0, 0, 64, 64);
        return townLamp;
      }
      function townLandmark(ctx, x, y, size, id, lit) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(size / 32, size / 32);
        ctx.fillStyle = "rgba(6,14,23,.38)";
        ctx.beginPath();
        ctx.ellipse(3, 2, 18, 5, 0, 0, 7);
        ctx.fill();
        if (id === "shop") {
          ctx.fillStyle = "#71534a";
          ctx.beginPath();
          ctx.moveTo(12, -19);
          ctx.lineTo(18, -23);
          ctx.lineTo(18, -4);
          ctx.lineTo(12, 0);
          ctx.fill();
          ctx.fillStyle = "#bc9377";
          ctx.fillRect(-13, -20, 26, 20);
          ctx.fillStyle = "#46515a";
          ctx.beginPath();
          ctx.moveTo(-15, -20);
          ctx.lineTo(-8, -25);
          ctx.lineTo(18, -25);
          ctx.lineTo(13, -20);
          ctx.fill();
          ctx.fillStyle = lit ? "#edc082" : "#b7d9dc";
          ctx.fillRect(-10, -13, 12, 10);
          ctx.fillStyle = "#263e43";
          ctx.fillRect(5, -13, 5, 13);
          ctx.fillStyle = "#37878c";
          ctx.beginPath();
          ctx.moveTo(-15, -16);
          ctx.lineTo(14, -16);
          ctx.lineTo(16, -12);
          ctx.lineTo(-17, -12);
          ctx.fill();
          ctx.strokeStyle = "#b9d9ce";
          ctx.lineWidth = 1;
          for (var a = -11; a < 14; a += 6) {
            ctx.beginPath();
            ctx.moveTo(a, -16);
            ctx.lineTo(a - 1, -12);
            ctx.stroke();
          }
          ctx.fillStyle = "#f4c453";
          ctx.fillRect(8, -7, 1, 1);
        } else if (id === "oldnorth") {
          ctx.fillStyle = "#b88972";
          ctx.fillRect(-13, -13, 25, 13);
          ctx.fillStyle = "#384752";
          ctx.beginPath();
          ctx.moveTo(-16, -13);
          ctx.lineTo(-2, -22);
          ctx.lineTo(15, -13);
          ctx.fill();
          ctx.fillStyle = "#e2dfcf";
          ctx.fillRect(-5, -31, 8, 20);
          ctx.fillStyle = "#eff0e5";
          ctx.beginPath();
          ctx.moveTo(-6, -31);
          ctx.lineTo(-1, -43);
          ctx.lineTo(4, -31);
          ctx.fill();
          ctx.fillStyle = lit ? "#f3c981" : "#435c66";
          ctx.fillRect(-3, -26, 3, 5);
          ctx.fillRect(-8, -9, 3, 5);
          ctx.fillRect(4, -9, 3, 5);
        } else if (id === "haymarket") {
          for (var stall = 0; stall < 3; stall++) {
            var ox = stall * 13 - 18;
            ctx.fillStyle = "#956d4b";
            ctx.fillRect(ox, -7, 11, 7);
            ctx.fillStyle = stall % 2 ? "#bd7455" : "#478582";
            ctx.beginPath();
            ctx.moveTo(ox - 1, -8);
            ctx.lineTo(ox + 5, -15);
            ctx.lineTo(ox + 12, -8);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "#d8cba9";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ox, -8);
            ctx.lineTo(ox, 0);
            ctx.moveTo(ox + 10, -8);
            ctx.lineTo(ox + 10, 0);
            ctx.stroke();
            ctx.fillStyle = "#9aaf6d";
            ctx.fillRect(ox + 2, -5, 7, 2);
          }
        } else {
          ctx.strokeStyle = "#8f7656";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -15);
          ctx.stroke();
          ctx.fillStyle = lit ? "#34584b" : "#558b65";
          ctx.beginPath();
          ctx.ellipse(-4, -18, 9, 10, -0.2, 0, 7);
          ctx.fill();
          ctx.fillStyle = lit ? "#426b55" : "#75a27a";
          ctx.beginPath();
          ctx.ellipse(4, -22, 8, 9, 0.3, 0, 7);
          ctx.fill();
        }
        ctx.restore();
      }
      function townLabels(ctx, labels, w, h) {
        if (w < 160 || h < 120) return;
        labels.sort(function(a, b) {
          return a.priority - b.priority;
        });
        var placed = [];
        var font = Math.max(9, Math.min(13, Math.round(w * 0.018)));
        ctx.save();
        ctx.font = "600 " + font + "px Nunito, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (var i = 0; i < labels.length; i++) {
          var item = labels[i];
          var text = item.text;
          var maxWidth = w * (item.priority === 0 ? 0.55 : 0.44);
          while (text.length > 5 && ctx.measureText(text).width > maxWidth) text = text.slice(0, -2);
          if (text !== item.text) text += "…";
          var bw = ctx.measureText(text).width + 14;
          var bh = font + 9;
          var offsets = [[0, -item.lift - bh - 5], [0, 7], [bw / 2 + 12, -bh / 2], [-bw / 2 - 12, -bh / 2]];
          var box = null;
          for (var k = 0; k < offsets.length; k++) {
            var xx = Math.max(5, Math.min(w - bw - 5, item.x + offsets[k][0] - bw / 2));
            var yy = Math.max(8, Math.min(h - bh - 36, item.y + offsets[k][1]));
            var free = true;
            for (var j = 0; j < placed.length; j++) {
              var old = placed[j];
              if (xx < old.x + old.w + 4 && xx + bw + 4 > old.x && yy < old.y + old.h + 4 && yy + bh + 4 > old.y) {
                free = false;
                break;
              }
            }
            if (free) {
              box = { x: xx, y: yy, w: bw, h: bh };
              break;
            }
          }
          if (!box) continue;
          placed.push(box);
          var gold = item.priority === 0;
          ctx.strokeStyle = gold ? "rgba(244,196,83,.74)" : "rgba(191,219,225,.4)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(item.x, item.y);
          ctx.lineTo(Math.max(box.x + 5, Math.min(box.x + bw - 5, item.x)), Math.max(box.y, Math.min(box.y + bh, item.y)));
          ctx.stroke();
          ctx.fillStyle = gold ? "rgba(26,35,34,.96)" : "rgba(12,26,36,.88)";
          ctx.beginPath();
          ctx.roundRect(box.x, box.y, bw, bh, 5);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = gold ? "#f4d47d" : "#e2eae9";
          ctx.fillText(text, box.x + bw / 2, box.y + bh / 2 + 0.5);
        }
        ctx.restore();
      }
      function townTraffic(ctx, x, y, angle, size, color, lit) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(size / 16, size / 16);
        ctx.fillStyle = "rgba(0,8,15,.35)";
        ctx.beginPath();
        ctx.roundRect(-8, -2, 17, 7, 3);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-8, -3.5, 16, 7, 3);
        ctx.fill();
        ctx.fillStyle = "#b7d3d6";
        ctx.beginPath();
        ctx.roundRect(-3, -2.8, 7, 5.6, 1.5);
        ctx.fill();
        ctx.fillStyle = "#293e49";
        ctx.fillRect(-0.7, -2.8, 2.5, 5.6);
        ctx.fillStyle = lit ? "#fff0ba" : "#ded9b8";
        ctx.fillRect(6, -2.7, 1.4, 1.2);
        ctx.fillRect(6, 1.5, 1.4, 1.2);
        ctx.fillStyle = "#b96b56";
        ctx.fillRect(-7.5, -2.7, 1, 1.2);
        ctx.fillRect(-7.5, 1.5, 1, 1.2);
        ctx.restore();
      }
      var townPanelHits = /* @__PURE__ */ new WeakMap();
      window.townPickAt = function(canvas, x, y) {
        var data = townPanelHits.get(canvas);
        if (!data || !isFinite(x) || !isFinite(y)) return -1;
        var pick = -1, distance = Infinity;
        for (var i = 0; i < data.hits.length; i++) {
          var hit = data.hits[i];
          var dist = Math.hypot(x - hit.x, y - hit.y + hit.size * 0.4);
          if (dist < Math.max(8, hit.size * 0.7) && dist < distance) {
            distance = dist;
            pick = hit.i;
          }
        }
        return pick;
      };
      function townPanelPick(canvas, H, hits) {
        if (!canvas || canvas.id !== "swmap") return;
        var saved = townPanelHits.get(canvas);
        if (!saved) {
          saved = { H, hits };
          townPanelHits.set(canvas, saved);
          canvas.addEventListener("click", function(event) {
            var handler = canvas.onclick;
            var data = townPanelHits.get(canvas);
            if (typeof handler !== "function" || !data || !data.H) return;
            var bounds = canvas.getBoundingClientRect();
            if (!bounds.width || !bounds.height) return;
            var x = (event.clientX - bounds.left) * canvas.width / bounds.width;
            var y = (event.clientY - bounds.top) * canvas.height / bounds.height;
            var pick = window.townPickAt(canvas, x, y);
            event.preventDefault();
            event.stopImmediatePropagation();
            handler.call(canvas, {
              clientX: bounds.left + (pick >= 0 ? data.H.x[pick] / 1e3 : -1) * bounds.width,
              clientY: bounds.top + (pick >= 0 ? data.H.y[pick] / 1e3 : -1) * bounds.height
            });
          }, true);
        }
        saved.H = H;
        saved.hits = hits;
      }
      function hourOfDay() {
        try {
          if (typeof gameState === "object" && gameState && isFinite(gameState.t))
            return (gameState.t % 2400 + 2400) % 2400 / 100;
        } catch (e) {
        }
        try {
          if (typeof jt === "function") return jt() * 24;
        } catch (e2) {
        }
        var d = /* @__PURE__ */ new Date();
        return d.getHours() + d.getMinutes() / 60;
      }
      function drawCruiser(ctx, x, y, ang, pulse) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.fillStyle = "#d8dde4";
        ctx.fillRect(-11, -5, 22, 10);
        ctx.fillStyle = "#1a2330";
        ctx.fillRect(-7, -4.2, 9, 8.4);
        ctx.fillStyle = pulse > 0.5 ? "#d02030" : "#2040d0";
        ctx.fillRect(-2, -6.2, 7, 2.4);
        ctx.fillStyle = pulse > 0.5 ? "#2040d0" : "#d02030";
        ctx.fillRect(-2, 3.8, 7, 2.4);
        ctx.fillStyle = "#0b1018";
        ctx.beginPath();
        ctx.arc(-6, 5.6, 2.1, 0, 7);
        ctx.arc(6, 5.6, 2.1, 0, 7);
        ctx.fill();
        ctx.restore();
      }
      var town = { buf: null, args: null, w: 0, h: 0, hi: null, inHi: false, hooked: null };
      function hookTownScreen() {
        var tank = document.getElementById("tank");
        var ctx = tank && tank.getContext && tank.getContext("2d");
        if (!ctx || town.hooked === ctx) return;
        town.hooked = ctx;
        var drawImage = ctx.drawImage;
        ctx.drawImage = function(img, dx, dy, dw, dh) {
          if (img === town.buf && town.args && arguments.length === 5 && !town.inHi && dw > 0 && dh > 0) {
            window.townScreen = { left: dx, top: dy, width: dw, height: dh };
            try {
              var scale = Math.max(1, Math.min(4, Math.abs(this.getTransform().a)));
              var pw = Math.round(dw * scale), ph = Math.round(dh * scale);
              if (!town.hi) town.hi = document.createElement("canvas");
              if (town.hi.width !== pw || town.hi.height !== ph) {
                town.hi.width = pw;
                town.hi.height = ph;
              }
              var g = town.hi.getContext("2d");
              g.setTransform(pw / town.w, 0, 0, ph / town.h, 0, 0);
              town.inHi = true;
              try {
                window.paintTownMap.apply(null, [g, town.w, town.h].concat(town.args));
              } finally {
                town.inHi = false;
              }
              return drawImage.call(this, town.hi, dx, dy, dw, dh);
            } catch (e) {
              town.inHi = false;
            }
          }
          return drawImage.apply(this, arguments);
        };
      }
      window.paintTownMap = function(ctx, w, h, H, shop, places, selected, colors, jobs) {
        if (!ctx || !w || !h) return;
        if (!town.inHi && ctx.canvas && !ctx.canvas.isConnected) {
          town.buf = ctx.canvas;
          town.w = w;
          town.h = h;
          town.args = Array.prototype.slice.call(arguments, 3);
          try {
            hookTownScreen();
          } catch (e) {
          }
        }
        ctx.save();
        window.__townPlaces = places;
        window.__townSegs = streetSegs(places);
        var sx = shop && shop.x != null ? shop.x : 528;
        var sy = shop && shop.y != null ? shop.y : 531;
        cam.span = 96;
        cam.left = sx - cam.span * 0.42;
        cam.top = sy - cam.span * 0.52;
        window.townCam = cam;
        var reduced2 = false;
        try {
          reduced2 = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        } catch (e) {
        }
        var now = typeof performance !== "undefined" ? performance.now() : Date.now();
        var motionTime = reduced2 ? 0 : now;
        var hour = hourOfDay();
        var night = hour < 5.5 || hour > 20.5;
        var dusk = hour >= 5.5 && hour < 8 || hour >= 17.5 && hour <= 20.5;
        var fleeingWorld = window.__fleeUntil > now || window.__gunFlash > 0.04;
        if (!window.__gunSiren && window.__gunSirenAt && now > window.__gunSirenAt) window.__gunSiren = 1;
        var shaken = false;
        if (!reduced2 && window.__gunShake > 0.02) {
          var sh = window.__gunShake * window.__gunShake;
          ctx.save();
          shaken = true;
          ctx.translate((Math.random() - 0.5) * sh * 16, (Math.random() - 0.5) * sh * 12);
          window.__gunShake *= Math.pow(0.86, frameStep("shake", now / 1e3));
        }
        ctx.fillStyle = "#07141e";
        ctx.fillRect(0, 0, w, h);
        if (cityMap.complete && cityMap.naturalWidth) {
          var iw = cityMap.naturalWidth, ih = cityMap.naturalHeight;
          ensureWaterMask();
          var nw = worldToPhoto(cam.left, cam.top, iw, ih);
          var se = worldToPhoto(cam.left + cam.span, cam.top + cam.span, iw, ih);
          var srcX = nw[0], srcY = nw[1], srcW = se[0] - nw[0], srcH = se[1] - nw[1];
          if (!(srcW > 12 && srcH > 12)) {
            var shopP = worldToPhoto(sx, sy, iw, ih);
            srcW = iw * 0.15;
            srcH = ih * 0.15;
            srcX = shopP[0] - srcW * 0.42;
            srcY = shopP[1] - srcH * 0.52;
          }
          if (srcX < 0) {
            srcW += srcX;
            srcX = 0;
          }
          if (srcY < 0) {
            srcH += srcY;
            srcY = 0;
          }
          if (srcX + srcW > iw) srcW = iw - srcX;
          if (srcY + srcH > ih) srcH = ih - srcY;
          if (srcW > 8 && srcH > 8) ctx.drawImage(cityMap, srcX, srcY, srcW, srcH, 0, 0, w, h);
          var wash = night ? 0.42 : dusk ? 0.22 : 0.1;
          ctx.fillStyle = night ? "rgba(4,10,22," + wash + ")" : "rgba(6,16,28," + wash + ")";
          ctx.fillRect(0, 0, w, h);
        }
        if (window.__gunFlash > 0.02) {
          ctx.fillStyle = "rgba(255,244,210," + (window.__gunFlash * 0.55).toFixed(3) + ")";
          ctx.fillRect(0, 0, w, h);
          var ring = (1 - window.__gunFlash) * Math.max(24, w * 0.22);
          ctx.strokeStyle = "rgba(255,250,230," + (window.__gunFlash * 0.7).toFixed(3) + ")";
          ctx.lineWidth = 3;
          ctx.beginPath();
          var shopV0 = toVSafe(sx, sy, w, h);
          ctx.arc(shopV0[0], shopV0[1], ring, 0, 7);
          ctx.stroke();
          window.__gunFlash *= Math.pow(0.84, frameStep("flash", now / 1e3));
        }
        if (window.__gunSiren) {
          var pulse = reduced2 ? 0.5 : 0.5 + 0.5 * Math.sin(now / 180);
          ctx.fillStyle = "rgba(180,20,30," + (0.07 * pulse).toFixed(3) + ")";
          ctx.fillRect(0, 0, w * 0.5, h);
          ctx.fillStyle = "rgba(20,40,180," + (0.07 * (1 - pulse)).toFixed(3) + ")";
          ctx.fillRect(w * 0.5, 0, w * 0.5, h);
        }
        function toVSafe(x, y, ww, hh) {
          return [(x - cam.left) / cam.span * ww, (y - cam.top) / cam.span * hh];
        }
        function toV(x, y) {
          return [(x - cam.left) / cam.span * w, (y - cam.top) / cam.span * h];
        }
        var byId = /* @__PURE__ */ Object.create(null);
        var homePlaces = [];
        var mapLabels = [];
        var mapHits = [];
        var selectedView = null;
        if (places && places.length) {
          for (var p0 = 0; p0 < places.length; p0++) {
            var pl0 = places[p0];
            if (pl0 && pl0.id) {
              byId[pl0.id] = pl0;
              if (pl0.q === "ne") homePlaces.push(pl0);
            }
          }
        }
        var segs = window.__townSegs || [];
        if (segs.length) {
          ctx.save();
          ctx.strokeStyle = "rgba(7,21,29,.45)";
          ctx.lineWidth = Math.max(4, w * 0.012);
          ctx.lineCap = "round";
          ctx.beginPath();
          for (var sg = 0; sg < segs.length; sg++) {
            var a = toV(segs[sg][0], segs[sg][1]);
            var b = toV(segs[sg][2], segs[sg][3]);
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
          }
          ctx.stroke();
          ctx.strokeStyle = night ? "rgba(242,207,141,.23)" : "rgba(224,225,204,.48)";
          ctx.lineWidth = Math.max(2, w * 55e-4);
          ctx.stroke();
          ctx.restore();
        }
        if (places && places.length) {
          for (var p = 0; p < places.length; p++) {
            var pl = places[p];
            if (!pl || pl.id === "sea") continue;
            var q = pl.q;
            if (q && q !== "ne" && q !== "dt" && pl.id !== "shop") continue;
            var xy = toV(pl.x, pl.y);
            if (xy[0] < 8 || xy[0] > w - 8 || xy[1] < 8 || xy[1] > h - 8) continue;
            var isPark = pl.id === "prado" || pl.id === "langone" || pl.id === "park" || pl.id === "greenway";
            var landmark = pl.id === "shop" || pl.id === "oldnorth" || pl.id === "haymarket" || isPark;
            var symbolSize = Math.max(18, Math.min(36, w * 0.045));
            if ((night || dusk) && landmark) {
              var glowSize = symbolSize * (pl.id === "shop" ? 3.6 : 2.3);
              ctx.drawImage(townLampImage(), xy[0] - glowSize / 2, xy[1] - glowSize / 2, glowSize, glowSize);
            }
            if (landmark && w > 220) townLandmark(ctx, xy[0], xy[1], symbolSize, pl.id, night || dusk);
            ctx.fillStyle = pl.id === "shop" ? "#f4c453" : "#bdd1cc";
            ctx.beginPath();
            ctx.arc(xy[0], xy[1] + 2, pl.id === "shop" ? 3 : 1.8, 0, 7);
            ctx.fill();
            var priority = pl.id === "shop" ? 0 : pl.id === "oldnorth" ? 1 : pl.id === "haymarket" ? 2 : isPark ? 3 : 4;
            mapLabels.push({
              x: xy[0],
              y: xy[1],
              text: pl.id === "shop" ? "Fin's" : pl.n,
              priority,
              lift: landmark && w > 220 ? symbolSize * (pl.id === "oldnorth" ? 1.35 : 0.85) : 2
            });
          }
        }
        var toShopCap = 0;
        var idleCap = 0;
        var homeCap = 0;
        var workCap = 0;
        var walkCap = 0;
        var shopInside = 0;
        if (H && H.n) {
          var n = H.n;
          var step = n > 1200 ? Math.ceil(n / 900) : 1;
          var folk = typeof window.folkDraw === "function";
          var drawn = 0;
          var cap = night ? 70 : 110;
          for (var i = 0; i < n; i += step) {
            var st = H.st[i];
            if (st === 8) continue;
            var px = H.x[i], py = H.y[i];
            var spd = H.vx && H.vy ? Math.hypot(H.vx[i] || 0, H.vy[i] || 0) : 0;
            var run = fleeingWorld && (st === 7 || st === 1 || st === 3 || st === 5 || spd > 10);
            var job = jobs && jobs[H.job[i]];
            var workId = job && job.work;
            var workPl = workId && byId[workId];
            var homePl = null;
            if (job && job.homes && places) {
              var seedH = (H.who && H.who[i]) >>> 0;
              if (homePlaces.length) homePl = homePlaces[seedH % homePlaces.length];
            }
            if (!run) {
              if (st === 6) {
                if (shopInside > (night ? 2 : 8)) continue;
                var inside = window.scatterTown({ x: sx, y: sy, r: 7 }, i, "place");
                px = inside[0];
                py = inside[1];
                shopInside++;
              } else if (st === 0) {
                if (night && homeCap > 28) continue;
                if (!night && homeCap > 18) continue;
                var homeAt = homePl || byId.copps || { x: sx - 28, y: sy - 22, r: 22 };
                var home = window.scatterTown(homeAt, i, "home");
                px = home[0];
                py = home[1];
                homeCap++;
              } else if (st === 2) {
                if (workCap > 22) continue;
                var wrkAt = workPl || byId.haymarket || { x: sx + 18, y: sy + 16, r: 16 };
                var wrk = window.scatterTown(wrkAt, i + 3, "work");
                px = wrk[0];
                py = wrk[1];
                workCap++;
              } else if (st === 4) {
                var mkt = byId.haymarket || byId.faneuil || { x: sx - 12, y: sy + 24, r: 20 };
                var idle = window.scatterTown(mkt, i, "market");
                px = idle[0];
                py = idle[1];
              } else if (st === 7) {
                if (idleCap > (night ? 8 : 16)) continue;
                var parks = [byId.prado, byId.langone, byId.park, byId.greenway, byId.copps].filter(Boolean);
                var park = parks.length ? parks[i % parks.length] : { x: sx + 10, y: sy - 18, r: 14 };
                var idl = window.scatterTown(park, i, "place");
                px = idl[0];
                py = idl[1];
                idleCap++;
              } else if (st === 5) {
                if (toShopCap > (night ? 3 : 6)) continue;
                if (segs.length) {
                  var toward = segs[0];
                  for (var si = 0; si < segs.length; si++) {
                    if (segs[si][4] === "salem" || segs[si][5] === "shop" || segs[si][4] === "shop") {
                      toward = segs[si];
                      break;
                    }
                  }
                  var tt = 0.18 + toShopCap * 0.12 % 0.7;
                  var on = alongSeg(toward, tt, (toShopCap % 2 ? 1 : -1) * 1.6);
                  px = on[0];
                  py = on[1];
                }
                toShopCap++;
              } else if (st === 1 || st === 3) {
                var walkMax = night ? 8 : hour >= 7 && hour < 9.5 || hour >= 16.5 && hour < 18.5 ? 28 : 18;
                if (walkCap > walkMax) continue;
                if (segs.length) {
                  var walkSeg = segs[i * 3 % segs.length];
                  var wt = (motionTime / 14e3 + hash01(i, 9)) % 1;
                  if (H.vx && H.vx[i] < 0) wt = 1 - wt;
                  var onW = alongSeg(walkSeg, 0.08 + wt * 0.84, (i % 2 ? 1 : -1) * 1.7);
                  px = onW[0];
                  py = onW[1];
                }
                walkCap++;
              }
            }
            var distShop = Math.hypot(px - sx, py - sy);
            if (!run && st !== 5 && st !== 6 && distShop < 9) continue;
            if (!run && inHarborWater(px, py, byId)) continue;
            if (cityMap.complete && cityMap.naturalWidth) {
              var pxy = worldToPhoto(px, py, cityMap.naturalWidth, cityMap.naturalHeight);
              if (photoIsWater(pxy[0], pxy[1], cityMap.naturalWidth, cityMap.naturalHeight)) continue;
            }
            var v = toV(px, py);
            if (v[0] < -8 || v[0] > w + 8 || v[1] < -8 || v[1] > h + 8) continue;
            if (drawn > cap && !run && st !== 5 && st !== 6) continue;
            drawn++;
            var coming = st === 5 || st === 6;
            var near = distShop < 16 || st === 6;
            var size = coming || run ? Math.max(14, w * 0.03) : near ? Math.max(11, w * 0.024) : Math.max(8, w * 0.016);
            var moving = !reduced2 && (st === 1 || st === 3 || st === 5 || run);
            var face = H.vx && H.vx[i] < 0 ? -1 : 1;
            var walk = (i * 0.17 + (H.t || 0) * (moving ? run ? 3.4 : 1.6 : 0)) % 2;
            var jid = job && job.id ? job.id : "";
            var kit = "";
            if (/fisher|hand|netter|ship|cooper|diver|longshore/.test(jid)) kit = "work";
            else if (/dealer|clerk|bank|lawyer|doctor|factor/.test(jid)) kit = "suit";
            else if ((H.who[i] >>> 0) % 11 === 0) kit = "kid";
            else if ((H.who[i] >>> 0) % 9 === 0) kit = "elder";
            var col = run ? "#e8d4b0" : coming ? "#f4c453" : colors && colors[st] ? colors[st] : "#c9b89a";
            var useFolk = folk && (coming || run || near && size >= 22) && drawn < 28;
            if (useFolk) {
              try {
                window.folkDraw(
                  ctx,
                  v[0],
                  v[1],
                  size * 1.15,
                  col,
                  walk,
                  false,
                  face,
                  moving,
                  {
                    id: "map:" + i,
                    seed: (H.who && H.who[i]) >>> 0,
                    fem: ((H.who && H.who[i]) >>> 18 & 1) === 1,
                    kit,
                    stoop: st === 0 && !run && i % 17 === 0
                  }
                );
              } catch (e) {
                folk = false;
                drawMiniPerson(ctx, v[0], v[1], size, col, moving, walk, (H.who && H.who[i]) >>> 0);
              }
            } else {
              drawMiniPerson(ctx, v[0], v[1], size, col, moving, walk, (H.who && H.who[i]) >>> 0);
            }
            mapHits.push({ i, x: v[0], y: v[1], size });
            if (i === selected) selectedView = { x: v[0], y: v[1], size };
            if (run && drawn < 40) {
              ctx.fillStyle = "rgba(255,244,210,.85)";
              ctx.font = "700 " + Math.max(8, Math.round(w * 0.016)) + "px Nunito, sans-serif";
              ctx.textAlign = "center";
              ctx.fillText("!", v[0], v[1] - size * 1.15);
            }
          }
        }
        if (window.__gunSiren) {
          var segs2 = window.__townSegs || [];
          var pulse2 = motionTime / 180 % 1;
          var drive = motionTime / 5500 % 1;
          var cruiserXY = [sx - 18, sy + 6];
          if (segs2.length) {
            var sg2 = segs2[0];
            cruiserXY = alongSeg(sg2, 0.15 + drive * 0.55, 0);
          }
          var cv = toV(cruiserXY[0], cruiserXY[1]);
          var ang = segs2.length ? Math.atan2(segs2[0][3] - segs2[0][1], segs2[0][2] - segs2[0][0]) : 0.2;
          drawCruiser(ctx, cv[0], cv[1], ang, pulse2);
        }
        if (selectedView) {
          ctx.strokeStyle = "#f7ead1";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(
            selectedView.x,
            selectedView.y - selectedView.size * 0.4,
            Math.max(6, selectedView.size * 0.55),
            Math.max(8, selectedView.size * 0.8),
            0,
            0,
            7
          );
          ctx.stroke();
        }
        townPanelPick(ctx.canvas, H, mapHits);
        if (segs.length) {
          for (var car = 0; car < (night ? 2 : 5); car++) {
            var cs = segs[car * 2 % segs.length];
            var ct = (motionTime / (9e3 + car * 1100) + hash01(car, 4)) % 1;
            var cxy = alongSeg(cs, 0.1 + ct * 0.8, 0);
            var cvp = toV(cxy[0], cxy[1]);
            var cang = Math.atan2(cs[3] - cs[1], cs[2] - cs[0]);
            townTraffic(
              ctx,
              cvp[0],
              cvp[1],
              cang,
              Math.max(10, Math.min(18, w * 0.024)),
              ["#6b8286", "#ad6b56", "#c9b18a", "#526877", "#b8c4bd"][car],
              night || dusk
            );
          }
        }
        townLabels(ctx, mapLabels, w, h);
        ctx.fillStyle = "rgba(8,14,22,.84)";
        ctx.fillRect(0, h - 28, w, 28);
        ctx.fillStyle = "rgba(150,187,182,.4)";
        ctx.fillRect(0, h - 29, w, 1);
        ctx.fillStyle = fleeingWorld || window.__gunSiren ? "#f4c453" : "rgba(230,236,242,.82)";
        ctx.font = "600 " + Math.max(10, Math.round(w * 0.02)) + "px Nunito, sans-serif";
        ctx.textAlign = "left";
        var clock = Math.floor(hour);
        var mins = Math.floor((hour - clock) * 60);
        var hhmm = (clock < 10 ? "0" : "") + clock + ":" + (mins < 10 ? "0" : "") + mins;
        ctx.fillText(
          window.__gunSiren ? "North End · a cruiser on Salem Street" : fleeingWorld ? "North End · people running" : "North End · " + hhmm + (night ? " · quiet streets" : dusk ? " · the light going" : hour >= 11.4 && hour < 13.8 ? " · lunch on the street" : " · people at work"),
          10,
          h - 10
        );
        if (shaken) ctx.restore();
        ctx.restore();
      };
    })();
  } catch (e) {
    console.error("Layer world.js failed to start:", e);
  }

  // src/layers/folk.js
  try {
    (function() {
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
        "kid"
      ];
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
        kid: { cols: 4, rows: 2 }
      };
      var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
      var shadowSprite = null;
      var sheets = /* @__PURE__ */ Object.create(null);
      var ready = 0;
      var tintCache = /* @__PURE__ */ new Map();
      var TINT_MAX = 96;
      var stepAt = /* @__PURE__ */ Object.create(null);
      var lastPos = /* @__PURE__ */ Object.create(null);
      function load() {
        KEYS.forEach(function(key) {
          var img = new Image();
          img.onload = function() {
            try {
              sheets[key] = sliceSheet(img, key);
              ready++;
            } catch (err) {
              console.warn("folk: slice failed", key, err);
            }
          };
          img.onerror = function() {
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
        var cols = g.cols, rows = g.rows;
        var fw = img.width / cols, fh = img.height / rows;
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
        return { frames, boxes, box: unionBoxes(boxes), n: frames.length };
      }
      function measure(g, w, h) {
        var data = g.getImageData(0, 0, w, h).data;
        var minX = w, minY = h, maxX = 0, maxY = 0, found = false;
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
        if (!found) return { x: 0, y: 0, w, h };
        return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      }
      function unionBoxes(list) {
        var minX = 1e9, minY = 1e9, maxX = 0, maxY = 0;
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
        id = String(look && look.id || id || "");
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
        if (seed % 11 === 0) return "kid";
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
        if (n === 4) return { i0: 0, i1: 0, t: 0 };
        var p = ((Number(walk) || 0) % 2 + 2) % 2 / 2;
        var f = p * n;
        var i0 = f | 0;
        if (i0 >= n) i0 = 0;
        var i1 = (i0 + 1) % n;
        return { i0, i1, t: ease(f - i0) };
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
        return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
      }
      function lum(c) {
        return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
      }
      function rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var h, s, l = (max + min) / 2;
        if (max === min) h = s = 0;
        else {
          var d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h /= 6;
        }
        return { h, s, l };
      }
      function clamp(n) {
        return n < 0 ? 0 : n > 255 ? 255 : n | 0;
      }
      function tinted(sheetKey, frame, look, clothHex) {
        if (!look || sheetKey === "fin" || sheetKey === "staff") return null;
        var skin = look.skin || "";
        var hair = look.hair || "";
        var trous = look.trous || "";
        var sig = sheetKey + "|" + frame + "|" + skin + "|" + hair + "|" + trous + "|" + (clothHex || "");
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
          var r = d[i], gv = d[i + 1], b = d[i + 2];
          var hsl = rgbToHsl(r, gv, b);
          var y = i / 4 / cv.width | 0;
          var isSkin = hsl.h > 0.015 && hsl.h < 0.14 && hsl.s > 0.12 && hsl.s < 0.72 && hsl.l > 0.22 && hsl.l < 0.88;
          if (isSkin && skinT) {
            var L = lum({ r, g: gv, b });
            var sl = lum(skinT) || 0.5;
            var sh = L / sl;
            d[i] = clamp(r * 0.45 + skinT.r * sh * 0.55);
            d[i + 1] = clamp(gv * 0.45 + skinT.g * sh * 0.55);
            d[i + 2] = clamp(b * 0.45 + skinT.b * sh * 0.55);
            continue;
          }
          var isHair = hairT && y < hairY && hsl.l < 0.42 && (hsl.s < 0.45 || hsl.h < 0.12 || hsl.h > 0.85);
          if (isHair) {
            var Lh = lum({ r, g: gv, b });
            var hl = lum(hairT) || 0.2;
            var hh = Lh / (hl || 0.2);
            d[i] = clamp(r * 0.35 + hairT.r * hh * 0.65);
            d[i + 1] = clamp(gv * 0.35 + hairT.g * hh * 0.65);
            d[i + 2] = clamp(b * 0.35 + hairT.b * hh * 0.65);
            continue;
          }
          if (clothT && hsl.l > 0.08 && hsl.l < 0.86 && !isSkin) {
            var Lc = lum({ r, g: gv, b });
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
        var plant = moving ? 0.55 + 0.45 * Math.cos((walk % 1 + 1) % 1 * Math.PI * 2) : 0.82;
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
      window.folkDraw = function(ctx, x, y, size, colorHex, walk, showFace, face, moving, look) {
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
        var box0 = sheet.boxes && sheet.boxes[fb.i0] || union;
        var box1 = sheet.boxes && sheet.boxes[fb.i1] || union;
        if (!union || union.h < 4) return false;
        var destH = size * (key === "kid" ? 0.72 : 1.02);
        var destW = destH * (union.w / union.h);
        var behind = !!(look && look.behind);
        if (window.__scene === "shop" && window.shopBg && window.shopBg.complete && window.shopBg.naturalWidth && (key === "fin" || key === "staff")) behind = false;
        var quiet = !!(motionQuery && motionQuery.matches);
        var id = look && look.id != null ? String(look.id) : "";
        if (id) {
          var now = typeof performance !== "undefined" ? performance.now() : Date.now();
          var lp = lastPos[id];
          if (lp && lp.ctx === ctx && !quiet && Math.hypot(x - lp.x, y - lp.y) < size * 2) {
            var follow = 1 - Math.exp(-Math.min(0.1, Math.max(0, (now - lp.t) / 1e3)) * 32.7);
            x = lp.x + (x - lp.x) * follow;
            y = lp.y + (y - lp.y) * follow;
          }
          lastPos[id] = { x, y, t: now, ctx };
          var keys = Object.keys(lastPos);
          if (keys.length > 80) delete lastPos[keys[0]];
        }
        ctx.save();
        if (!behind) contactShadow(ctx, x, y, destW, size, moving, walk);
        ctx.translate(x, y);
        if ((face || 1) < 0) ctx.scale(-1, 1);
        if (!moving && !quiet) {
          var t = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1e3;
          var seed = look && look.seed || 0;
          ctx.translate(Math.sin(t * 0.7 + seed) * destW * 0.01, Math.sin(t * 1.15 + seed) * destH * 8e-3);
          ctx.scale(1 + Math.sin(t * 1.4 + seed) * 0.01, 1 + Math.sin(t * 1.4 + seed) * 0.018);
        } else if (!quiet) {
          var phase = ((Number(walk) || 0) % 1 + 1) % 1;
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
          var planted = (walk % 1 + 1) % 1 < 0.14;
          var tick = walk * 2 | 0;
          var last = stepAt[look.id];
          if (planted && tick !== last) {
            stepAt[look.id] = tick;
            try {
              window.folkStep(x, y);
            } catch (e) {
            }
          }
        }
        return true;
      };
      load();
    })();
  } catch (e) {
    console.error("Layer folk.js failed to start:", e);
  }
})();
