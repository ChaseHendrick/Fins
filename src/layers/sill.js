/* sill.js — windows on Salem are tanks.
   You sold a fish. Open Map. Their window is lit. A tiny one swims
   in it. Night, they glow. They die, the window goes dark. Click it.
   The gold line names the house. The baker's window is the first
   one you learn to look for. The choir already heard them. Now you
   can see them. No second HUD. Pixels, speech, the gold line. */
(function () {
  "use strict";

  var lastTick = 0;
  var lastUi = 0;
  var lastGold = "";
  var lastGoldAt = 0;
  var lastDeathKey = "";
  var overlay = null;
  var octx = null;
  var hits = [];
  var wiredClick = false;
  var hover = -1;
  var didChoir = false;
  var didBrowse = false;

  function now() {
    return typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000;
  }

  function gs() {
    try {
      if (typeof gameState === "function") return gameState();
      if (typeof gameState === "object" && gameState) return gameState;
    } catch (e) {}
    return null;
  }

  function sceneName() {
    try {
      if (document.body.classList.contains("titling")) return "title";
      if (document.body.classList.contains("work")) return "work";
      if (typeof sceneNow === "function") return String(sceneNow() || "");
    } catch (e) {}
    return "tank";
  }

  function hour() {
    try {
      if (typeof jt === "function") return jt() * 24;
      var g = gs();
      if (g && isFinite(g.t)) return (((g.t % 2400) + 2400) % 2400) / 100;
    } catch (e) {}
    return 12;
  }

  function night() {
    var h = hour();
    return h < 6.2 || h >= 19.2;
  }

  function hash32(s) {
    var h = 2166136261;
    s = String(s || "");
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function because(text) {
    if (!text) return;
    try {
      if (window.weave && weave.because) weave.because(text);
    } catch (e) {}
    try {
      if (window.desk && desk.think) desk.think("sill", text);
    } catch (e2) {}
  }

  function egg(id, line) {
    try {
      if (typeof findEgg === "function") findEgg(id, line);
    } catch (e) {}
  }

  function play(name) {
    try {
      if (window.feel && feel.play) feel.play(name);
    } catch (e) {}
  }

  function gold(text, force) {
    if (!text) return;
    lastGold = text;
    lastGoldAt = now();
    try {
      var el = document.getElementById("hookWhisper");
      if (el && (force || el.textContent !== text)) {
        el.textContent = text;
        el.classList.add("on", "pop");
      }
    } catch (e) {}
  }

  function homes() {
    try {
      if (window.going && going.homes) return going.homes() || [];
    } catch (e) {}
    return [];
  }

  function fishList() {
    try {
      if (typeof allFish === "function") return allFish() || [];
    } catch (e) {}
    return [];
  }

  function places() {
    return window.__townPlaces || [];
  }

  function placeById(id) {
    var ps = places();
    for (var i = 0; i < ps.length; i++) if (ps[i] && ps[i].id === id) return ps[i];
    return null;
  }

  function neIds() {
    var ps = places();
    var ids = [];
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (!p || !p.id || p.id === "shop" || p.id === "sea") continue;
      if (p.q && p.q !== "ne" && p.q !== "dt") continue;
      ids.push(p.id);
    }
    if (!ids.length) ids = ["salem", "copps", "prince", "hanover", "prado", "park"];
    return ids;
  }

  function placeOf(home) {
    if (!home) return "salem";
    if (home.place) return home.place;
    if (home.neighbor) home.place = "salem";
    else {
      var ids = neIds();
      home.place = ids[hash32(String(home.who || "") + ":" + String(home.sp || "")) % ids.length];
    }
    return home.place;
  }

  function toView(x, y, w, h) {
    try {
      if (typeof window.townToView === "function") {
        var screen = window.townScreen;
        if (screen && screen.width > 0 && screen.height > 0) {
          var xy = window.townToView(x, y, screen.width, screen.height);
          return [screen.left + xy[0], screen.top + xy[1]];
        }
        return window.townToView(x, y, w, h);
      }
    } catch (e) {}
    var cam = window.townCam || { left: 482, top: 472, span: 96 };
    return [((x - cam.left) / cam.span) * w, ((y - cam.top) / cam.span) * h];
  }

  function shopXY() {
    var p = placeById("shop");
    if (p && isFinite(p.x)) return [p.x, p.y];
    return [528, 531];
  }

  function kindColor(sp) {
    var s = String(sp || "");
    if (/gold/.test(s)) return "#e0a030";
    if (/betta/.test(s)) return "#c45a7a";
    if (/guppy/.test(s)) return "#6ec4a8";
    if (/tetra/.test(s)) return "#5aa0d4";
    if (/angel/.test(s)) return "#c8c0e8";
    if (/cichlid/.test(s)) return "#d4783c";
    return "#7eb8d4";
  }

  function paneEtch() {
    try {
      if (window.pane && pane.etch) return pane.etch() || 0;
    } catch (e) {}
    return 0;
  }

  function ensureOverlay() {
    if (overlay && overlay.parentNode) return;
    overlay = document.getElementById("sillVeil");
    if (!overlay) {
      overlay = document.createElement("canvas");
      overlay.id = "sillVeil";
      overlay.setAttribute("aria-hidden", "true");
      document.body.appendChild(overlay);
    }
    octx = overlay.getContext("2d");
  }

  function resize() {
    ensureOverlay();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = window.innerWidth;
    var h = window.innerHeight;
    if (overlay.width !== ((w * dpr) | 0) || overlay.height !== ((h * dpr) | 0)) {
      overlay.width = (w * dpr) | 0;
      overlay.height = (h * dpr) | 0;
      overlay.style.cssText =
        "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:4";
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function windowRect(home, index, w, h) {
    var place = placeById(placeOf(home));
    var s = place && isFinite(place.x) ? [place.x, place.y] : shopXY();
    var v = toView(s[0], s[1], w, h);
    var mapWidth = window.townScreen ? window.townScreen.width : w;
    var ang = -2.35 + (index % 8) * 0.78;
    var rad = Math.max(18, mapWidth * 0.035) + Math.floor(index / 8) * 8;
    var bw = Math.max(16, Math.min(25, mapWidth * 0.034));
    var bh = bw * 1.16;
    var wx = v[0] + Math.cos(ang) * rad;
    var wy = v[1] + Math.sin(ang) * rad * 0.72;
    return {
      x: wx - bw * 0.5,
      y: wy - bh,
      w: bw,
      h: bh,
      home: home,
      place: placeOf(home),
    };
  }

  function shopWindowRect(w, h) {
    var s = shopXY();
    var v = toView(s[0], s[1], w, h);
    var mapWidth = window.townScreen ? window.townScreen.width : w;
    var symbolSize = Math.max(18, Math.min(36, mapWidth * 0.045));
    // The pane fits the drawn storefront's window instead of floating elsewhere on the screen.
    return { x: v[0] - symbolSize * 10 / 32, y: v[1] - symbolSize * 13 / 32,
      w: symbolSize * 12 / 32, h: symbolSize * 10 / 32, shop: true };
  }

  function drawTinyFish(ctx, rx, t, col, dead) {
    if (dead) return;
    var cx = rx.x + rx.w * (0.3 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.4 + rx.x)));
    var cy = rx.y + rx.h * (0.45 + 0.18 * Math.sin(t * 2.1 + rx.y));
    var dir = Math.cos(t * 1.4 + rx.x) >= 0 ? 1 : -1;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(2.2, rx.w * 0.18), Math.max(1.1, rx.h * 0.1), 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - dir * rx.w * 0.18, cy);
    ctx.lineTo(cx - dir * rx.w * 0.32, cy - rx.h * 0.08);
    ctx.lineTo(cx - dir * rx.w * 0.32, cy + rx.h * 0.08);
    ctx.closePath();
    ctx.fill();
  }

  function drawOne(ctx, rx, t, nite, hi) {
    var home = rx.home;
    var dead = !!(home && home.dead);
    var live = home && !dead;
    ctx.save();
    ctx.fillStyle = "rgba(20,28,30,.86)";
    ctx.beginPath(); ctx.roundRect(rx.x - 2, rx.y - 2, rx.w + 4, rx.h + 4, rx.shop ? 1 : 4); ctx.fill();
    if (dead) {
      ctx.fillStyle = "rgba(6,8,12,.92)";
      ctx.fillRect(rx.x, rx.y, rx.w, rx.h);
      ctx.fillStyle = "rgba(20,16,14,.8)";
      ctx.fillRect(rx.x + 1, rx.y + rx.h * 0.35, rx.w - 2, rx.h * 0.65);
    } else {
      var glow = nite ? 0.42 : 0.22;
      if (rx.shop) glow += 0.12;
      ctx.fillStyle = "rgba(244,210,120," + glow.toFixed(3) + ")";
      ctx.fillRect(rx.x, rx.y, rx.w, rx.h);
      ctx.fillStyle = "rgba(40,90,110,0.55)";
      ctx.fillRect(rx.x + 1, rx.y + 2, rx.w - 2, rx.h - 4);
      if (live) drawTinyFish(ctx, rx, t, kindColor(home.sp), false);
      if (rx.shop) {
        var n = fishList().length;
        for (var k = 0; k < Math.min(3, n); k++) {
          var fake = { x: rx.x + k * 3, y: rx.y, w: rx.w, h: rx.h };
          drawTinyFish(ctx, fake, t + k * 0.7, "#8fd0e8", false);
        }
        var etch = paneEtch();
        if (etch > 0.25) {
          ctx.fillStyle = "rgba(210,220,214," + (etch * 0.45).toFixed(3) + ")";
          ctx.fillRect(rx.x, rx.y, rx.w, rx.h);
        }
      }
    }
    ctx.strokeStyle = hi ? "rgba(244,196,83,.95)" : "rgba(244,214,160,.55)";
    ctx.lineWidth = hi ? 2.5 : 1.4;
    ctx.beginPath(); ctx.roundRect(rx.x, rx.y, rx.w, rx.h, rx.shop ? 1 : 3); ctx.stroke();
    if (home && home.named && !dead) {
      ctx.strokeStyle = "rgba(244,196,83,.85)";
      ctx.lineWidth = 2;
      ctx.strokeRect(rx.x - 1.5, rx.y - 1.5, rx.w + 3, rx.h + 3);
    }
    var cap = "";
    if (rx.shop) cap = "";
    else if (home && home.dead) cap = "dark";
    else if (home && home.neighbor) cap = (home.who || "Mae").split(" ")[0];
    else if (home && home.nick) cap = home.nick;
    else if (home) cap = home.sp || "window";
    if (cap) {
      ctx.font = "600 " + Math.max(9, Math.min(11, (rx.w * 0.4) | 0)) + "px Nunito, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(8,12,18,.78)";
      var cw = ctx.measureText(cap).width + 8;
      ctx.fillRect(rx.x + rx.w * 0.5 - cw / 2, rx.y + rx.h + 2, cw, 13);
      ctx.fillStyle = dead ? "rgba(200,210,220,.7)" : "#f4c453";
      ctx.fillText(cap, rx.x + rx.w * 0.5, rx.y + rx.h + 12);
    }
    ctx.restore();
  }

  function labelOf(rx) {
    if (rx.shop) {
      var n = fishList().length;
      var etch = paneEtch();
      if (etch > 0.5) return "Fin's window. They can't see in.";
      if (!n) return "Fin's window. The tanks are empty from the street.";
      return "Fin's window. " + n + (n === 1 ? " fish" : " fish") + " from the street.";
    }
    var h = rx.home;
    if (!h) return "";
    var call = h.nick || "The " + (h.sp || "fish");
    if (h.dead) return call + " died in " + (h.who || "someone") + "'s window. It went dark.";
    return call + " is still in " + (h.who || "someone") + "'s window.";
  }

  function drawSill() {
    var sc = sceneName();
    if (sc !== "street") {
      hits = [];
      if (overlay && overlay.width) { overlay.width = overlay.height = 0; }
      return;
    }
    resize();
    var w = window.innerWidth;
    var h = window.innerHeight;
    octx.clearRect(0, 0, w, h);
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var t = reduced ? 0 : now();
    var nite = night();
    var hs = homes();
    hits = [];

    var shopR = shopWindowRect(w, h);
    hits.push(shopR);
    drawOne(octx, shopR, t, nite, hover === 0);

    for (var i = 0; i < hs.length; i++) {
      var home = hs[i];
      if (!home) continue;
      var rx = windowRect(home, i, w, h);
      var screen = window.townScreen;
      if (screen && (rx.x < screen.left + 3 || rx.y < screen.top + 4 ||
        rx.x + rx.w > screen.left + screen.width - 3 || rx.y + rx.h + 16 > screen.top + screen.height - 30)) continue;
      hits.push(rx);
      drawOne(octx, rx, t, nite, hover === hits.length - 1);
    }

    if (hover >= 0 && hits[hover]) {
      var lab = labelOf(hits[hover]);
      if (lab) {
        var hx = hits[hover].x + hits[hover].w * 0.5;
        var hy = hits[hover].y - 8;
        octx.save();
        octx.font = "600 12px Nunito, sans-serif";
        octx.textAlign = "center";
        var tw = octx.measureText(lab).width + 14;
        octx.fillStyle = "rgba(8,12,18,.78)";
        octx.fillRect(hx - tw / 2, hy - 16, tw, 18);
        octx.fillStyle = "#f4c453";
        octx.fillText(lab, hx, hy - 3);
        octx.restore();
      }
    }
  }

  function hitAt(cx, cy) {
    for (var i = hits.length - 1; i >= 0; i--) {
      var r = hits[i];
      if (cx >= r.x - 2 && cx <= r.x + r.w + 2 && cy >= r.y - 2 && cy <= r.y + r.h + 2) return i;
    }
    return -1;
  }

  function bindClick() {
    if (wiredClick) return;
    wiredClick = true;
    window.addEventListener(
      "click",
      function (e) {
        if (sceneName() !== "street") return;
        var i = hitAt(e.clientX, e.clientY);
        if (i < 0) return;
        var line = labelOf(hits[i]);
        if (!line) return;
        gold(line, true);
        because(line);
        play("wood");
        egg("sillwin", line);
      },
      true
    );
    window.addEventListener(
      "mousemove",
      function (e) {
        if (sceneName() !== "street") {
          hover = -1;
          return;
        }
        hover = hitAt(e.clientX, e.clientY);
      },
      true
    );
  }

  function watchDeaths() {
    var hs = homes();
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i];
      if (!h || !h.dead) continue;
      var key = (h.nick || h.sp || i) + ":" + (h.who || "") + ":dead";
      if (key === lastDeathKey) continue;
      if (h._sillTold) continue;
      h._sillTold = 1;
      lastDeathKey = key;
      var line = (h.nick || "The " + h.sp) + " died in " + h.who + "'s window. It went dark.";
      because(line);
      gold(line, true);
      play("drip");
      egg("silldark", line);
    }
  }

  function wrapChoir() {
    if (didChoir || !window.choir || !choir.weather) return;
    didChoir = true;
    var orig = choir.weather;
    choir.weather = function () {
      var w = orig.apply(this, arguments);
      try {
        var hs = homes();
        var live = 0;
        var dark = 0;
        for (var i = 0; i < hs.length; i++) {
          if (!hs[i]) continue;
          if (hs[i].dead) dark++;
          else live++;
        }
        w.windows = live;
        w.dark = dark;
        if (live) w.sweet = Math.min(1, (w.sweet || 0) + Math.min(0.16, live * 0.04));
        if (dark && now() - lastGoldAt < 20) w.sour = Math.min(1, (w.sour || 0) + 0.1);
        if (!w.line && dark && now() - lastGoldAt < 16) {
          w.line = lastGold || "A window on Salem went dark.";
        }
      } catch (e) {}
      return w;
    };
  }

  function wrapBrowse() {
    if (didBrowse || !window.shopBrowse) return;
    didBrowse = true;
    var orig = window.shopBrowse;
    window.shopBrowse = function (idx, slot, W, floorY, personS, simT) {
      var rec = orig.apply(this, arguments);
      try {
        if (!rec) return rec;
        var st = window.shopLife && shopLife.browse ? shopLife.browse()[idx] : null;
        if (!st || st._sillSaid) return rec;
        if (rec.phase !== "look") return rec;
        var hs = homes();
        var hit = null;
        for (var i = 0; i < hs.length; i++) {
          var h = hs[i];
          if (!h) continue;
          if (h.whoKind === rec.kind || (h.neighbor && rec.kind === "neighbor")) {
            hit = h;
            if (h.neighbor) break;
          }
        }
        if (hit && hit.dead) {
          st._sillSaid = 1;
          rec.line = rec.line || "The window went dark. " + (hit.nick || "The " + hit.sp) + ".";
          st.line = rec.line;
        } else if (hit && !hit.dead && rec.kind === "kid") {
          st._sillSaid = 1;
          rec.line = rec.line || "I can see " + (hit.nick || "yours") + " from the street. In their window.";
          st.line = rec.line;
        }
      } catch (e) {}
      return rec;
    };
  }

  function whisper() {
    if (lastGold && now() - lastGoldAt < 14) return lastGold;
    return "";
  }

  function line() {
    var hs = homes();
    var live = 0;
    var dark = 0;
    var first = "";
    for (var i = 0; i < hs.length; i++) {
      if (!hs[i]) continue;
      if (hs[i].dead) dark++;
      else {
        live++;
        if (!first) first = (hs[i].nick || "The " + hs[i].sp) + " in " + hs[i].who + "'s window";
      }
    }
    if (lastGold && now() - lastGoldAt < 40) return lastGold;
    if (first) return first + (live > 1 ? " · " + live + " windows lit" : ".");
    if (dark) return dark + (dark === 1 ? " window" : " windows") + " went dark.";
    return "Open Map. The windows on Salem are tanks, if anyone took one home.";
  }

  function seedWiki() {
    try {
      var wiki = typeof WIKI === "function" ? WIKI() : window.WIKI;
      if (!wiki || !wiki.push) return;
      if (wiki.some(function (a) { return a && a.id === "k_sill"; })) return;
      wiki.push({
        id: "k_sill",
        sec: "The quarter",
        t: "Windows on Salem are tanks",
        tags: "map window salem baker home swim dark click block sold",
        w: "<p>You sold a fish. Open Map. Their window is lit. A tiny one swims in it. Night, they glow. They die, the window goes dark. Click it. The gold line names the house. The baker's window is the first one you learn to look for. The choir already heard them. Now you can see them.</p><p><b>What to do about it:</b> open Map after a fish bag. Do not sell a sick fish to the baker. A dark window is a name in the book from the street, not the glass.</p>",
      });
    } catch (e) {}
  }

  function tick() {
    try {
      bindClick();
      wrapChoir();
      wrapBrowse();
      seedWiki();
      if (now() - lastTick > 0.8) {
        lastTick = now();
        watchDeaths();
      }
      if (now() - lastUi > 0.05) {
        lastUi = now();
        drawSill();
      }
    } catch (e) {}
  }

  window.sill = {
    whisper: whisper,
    line: line,
    lit: function () {
      var hs = homes();
      var n = 0;
      for (var i = 0; i < hs.length; i++) if (hs[i] && !hs[i].dead) n++;
      return n;
    },
    dark: function () {
      var hs = homes();
      var n = 0;
      for (var i = 0; i < hs.length; i++) if (hs[i] && hs[i].dead) n++;
      return n;
    },
  };

  if (window.__onBeat) window.__onBeat(tick, 70);
  else
    setTimeout(function loop() {
      tick();
      setTimeout(loop, 70);
    }, 160);
})();
