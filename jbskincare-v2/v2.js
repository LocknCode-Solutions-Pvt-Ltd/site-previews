/* v2 layer (round 9, 12 Nov 2026): reveal on scroll, tabs, counting numbers, add-to-cart feedback, Skinolin hero haze animation. */
(function () {
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- tabs ---- */
  $$("[data-tabs]").forEach(function (box) {
    var btns = $$("[data-tab]", box), panes = $$("[data-tp]", box);
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-tab");
        btns.forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
        panes.forEach(function (p) { p.hidden = p.getAttribute("data-tp") !== k; });
      });
    });
  });

  /* ---- add to cart feedback ---- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-add]"); if (!a || a.hasAttribute("data-buynow")) return;
    if (!a._t) a._t = a.innerHTML;
    a.classList.add("ok"); a.innerHTML = "Added ✓";
    setTimeout(function () { a.classList.remove("ok"); a.innerHTML = a._t; }, 1500);
    $$('.hdr [data-open="cart"]').forEach(function (c) { c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); });
  }, true);

  if (!("IntersectionObserver" in window)) return;

  /* ---- reveal on scroll ---- */
  if (!still) {
    document.documentElement.classList.add("v2js");
    var sel = ".sec-h,.grid>.card,.psteps>.pstep,.ptotal,.vgrid>*,.band>*,.revs>.rev,.facts>div,.proof>div,.spot,.carousel,.skincheck>*,.clist>a,.statrow>div,.brands2>*,.match-in>*,.sw-in>*,.watch2>.wt,.cattiles>a,.refer-in>*,.wasign,.consult,.salonfind,.revmock,.awardband>*,.smogsec h2,.smogsec .lede,.tested,.probanner";
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    var seen = [];
    $$(sel).forEach(function (el) {
      if (el.closest(".hero,.sheet,.search,.modal,.ss")) return;
      /* inside a sideways swipe row the row itself is revealed, never its items (they would stay hidden until swiped) */
      var ox = getComputedStyle(el.parentNode).overflowX;
      if (ox === "auto" || ox === "scroll") el = el.parentNode;
      if (seen.indexOf(el) > -1 || el.closest(".rv")) return; seen.push(el);
      var i = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.style.setProperty("--d", Math.min(i, 5) * 80 + "ms");
      el.classList.add("rv"); io.observe(el);
    });
    /* safety: anything still hidden 2.5 s after it should have shown (print, odd browsers) */
    window.addEventListener("beforeprint", function () { $$(".rv").forEach(function (e) { e.classList.add("in"); }); });
  }

  /* ---- counting numbers ---- */
  var cio = new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (!en.isIntersecting) return; cio.unobserve(en.target);
      var el = en.target, to = parseFloat(el.getAttribute("data-count-to")), t0 = null, dur = 1400;
      if (still) { el.textContent = to; return; }
      var step = function (t) { if (!t0) t0 = t; var k = Math.min(1, (t - t0) / dur); k = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * k); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  $$("[data-count-to]").forEach(function (el) { cio.observe(el); });

  /* ---- Skinolin hero: city haze drifts in, then clears around the four packs ----
     Drawn on a canvas over the hero photo. No video, no extra image. The packs' position comes from data-box (fractions of the photo). */
  $$("canvas.smogfx").forEach(function (cv) {
    var hero = cv.closest(".hero"), img = hero.querySelector("picture img"), ctx = cv.getContext("2d");
    var W = 0, H = 0, dpr = 1, dome = null, parts = [], puffs = [], rings = [], t0 = 0, raf = 0, on = false;
    var boxes = { wide: cv.getAttribute("data-box-wide").split(",").map(Number), tall: cv.getAttribute("data-box-tall").split(",").map(Number) };
    function layout() {
      var r = img.getBoundingClientRect(), hr = hero.getBoundingClientRect();
      W = r.width; H = r.height; dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.style.left = (r.left - hr.left) + "px"; cv.style.top = (r.top - hr.top) + "px"; cv.style.width = W + "px"; cv.style.height = H + "px";
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      /* where the packs sit on screen: map the photo's own box through object-fit: cover */
      var nw = img.naturalWidth || 3200, nh = img.naturalHeight || 889, tall = nw / nh < 2, b = tall ? boxes.tall : boxes.wide;
      var s = Math.max(W / nw, H / nh), dw = nw * s, dh = nh * s, op = getComputedStyle(img).objectPosition.split(" ");
      var px = parseFloat(op[0]) / 100, py = parseFloat(op[1]) / 100, ox = (W - dw) * px, oy = (H - dh) * py;
      var x0 = ox + b[0] * dw, x1 = ox + b[1] * dw, y0 = oy + b[2] * dh, y1 = oy + b[3] * dh;
      dome = { cx: (x0 + x1) / 2, cy: y1, rx: (x1 - x0) * 0.62, ry: (y1 - y0) * 1.16 };
      var n = Math.round(Math.min(120, Math.max(46, W / 11)));
      parts = []; for (var i = 0; i < n; i++) parts.push(spawn({}, true));
      puffs = []; for (var j = 0; j < 9; j++) puffs.push({ x: Math.random() * W, y: Math.random() * H * 0.9, r: (0.18 + Math.random() * 0.22) * Math.max(W * 0.5, H), v: 6 + Math.random() * 10, a: 0.05 + Math.random() * 0.06 });
    }
    function spawn(p, anywhere) {
      p.x = anywhere ? Math.random() * W : -20 - Math.random() * W * 0.15; p.y = Math.random() * H * 0.96;
      p.r = 0.8 + Math.pow(Math.random(), 2.2) * 3.4; p.vx = 16 + Math.random() * 34; p.vy = -4 + Math.random() * 12;
      p.a = 0.18 + Math.random() * 0.4; p.ph = Math.random() * 6.28; p.life = 1; p.hit = false; return p;
    }
    function inside(x, y, k) { var dx = (x - dome.cx) / (dome.rx * k), dy = (y - dome.cy) / (dome.ry * k); return y <= dome.cy + 6 && dx * dx + dy * dy < 1; }
    function ease(k) { return k < 0 ? 0 : k > 1 ? 1 : 1 - Math.pow(1 - k, 3); }
    function frame(now) {
      raf = 0; if (!on) return; if (!t0) t0 = now; var t = (now - t0) / 1000, dt = Math.min(0.05, (now - (frame.last || now)) / 1000); frame.last = now;
      var clear = ease((t - 2.1) / 1.5);          /* 0 = city haze everywhere, 1 = cleared around the packs */
      var k = 0.05 + 0.95 * clear;                /* dome size */
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      /* haze: a warm grey veil, thick at first, then thin */
      var veil = 0.46 * (1 - clear) + 0.07;
      ctx.fillStyle = "rgba(108,98,90," + veil.toFixed(3) + ")"; ctx.fillRect(0, 0, W, H);
      for (var j = 0; j < puffs.length; j++) {
        var q = puffs[j]; q.x += q.v * dt; if (q.x - q.r > W) q.x = -q.r;
        var g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r); var a = q.a * (1.5 - 0.9 * clear);
        g.addColorStop(0, "rgba(96,88,82," + a.toFixed(3) + ")"); g.addColorStop(1, "rgba(96,88,82,0)"); ctx.fillStyle = g; ctx.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2);
      }
      /* specks of dust and soot, blown toward the packs */
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i]; p.ph += dt * 1.3;
        p.x += (p.vx + Math.sin(p.ph) * 6) * dt; p.y += (p.vy + Math.cos(p.ph * 0.7) * 5) * dt;
        if (clear > 0.02 && !p.hit && inside(p.x, p.y, k)) { p.hit = true; if (rings.length < 14 && clear > 0.6) rings.push({ x: p.x, y: p.y, t: 0 }); }
        if (p.hit) {                                /* slides off the clean air and fades */
          var dx = p.x - dome.cx, dy = p.y - dome.cy, d = Math.sqrt(dx * dx + dy * dy) || 1; p.x += dx / d * 46 * dt - p.vx * dt * 0.9; p.y += dy / d * 46 * dt - 14 * dt; p.life -= dt * 1.9;
        }
        if (p.life <= 0 || p.x > W + 20 || p.y > H + 20 || p.y < -30) { spawn(p, false); continue; }
        ctx.globalAlpha = p.a * p.life * (1 - 0.35 * clear); ctx.fillStyle = "#4a403a"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
      /* clean air around the packs: wipe the haze inside the dome */
      if (clear > 0) {
        ctx.save(); ctx.globalCompositeOperation = "destination-out"; ctx.translate(dome.cx, dome.cy); ctx.scale(dome.rx * k, dome.ry * k);
        var cg = ctx.createRadialGradient(0, 0, 0.55, 0, 0, 1.12); cg.addColorStop(0, "rgba(0,0,0,1)"); cg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, 1.12, 0, 6.2832); ctx.fill(); ctx.restore();
        /* the sweep: one soft ring of light as the air clears, then a slow breath */
        var sweep = (t - 2.1) / 1.5, breath = 0.10 + 0.05 * Math.sin(t * 0.9);
        var ra = sweep < 1 ? 0.75 * (1 - sweep) + breath * sweep : breath;
        ctx.save(); ctx.translate(dome.cx, dome.cy); ctx.scale(dome.rx * k, dome.ry * k); ctx.beginPath(); ctx.arc(0, 0, 1, Math.PI, 2 * Math.PI);
        ctx.restore(); ctx.lineWidth = sweep < 1 ? 2.2 : 1.2; ctx.strokeStyle = "rgba(255,255,255," + ra.toFixed(3) + ")"; ctx.shadowColor = "rgba(255,244,226,.9)"; ctx.shadowBlur = 22; ctx.stroke(); ctx.shadowBlur = 0;
      }
      /* a small ripple where a speck is turned away */
      for (var r = rings.length - 1; r >= 0; r--) {
        var o = rings[r]; o.t += dt; if (o.t > 0.7) { rings.splice(r, 1); continue; }
        ctx.beginPath(); ctx.arc(o.x, o.y, 3 + o.t * 26, 0, 6.2832); ctx.strokeStyle = "rgba(255,255,255," + (0.5 * (1 - o.t / 0.7)).toFixed(3) + ")"; ctx.lineWidth = 1; ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (on) return; on = true; frame.last = 0; if (!raf) raf = requestAnimationFrame(frame); }
    function stop() { on = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    function boot() {
      layout(); hero.classList.add("fx-on");
      if (still) { t0 = performance.now() - 60000; on = true; frame(performance.now()); stop(); return; }   /* reduced motion: one still frame, already cleared */
      new IntersectionObserver(function (es) { es[0].isIntersecting && !document.hidden ? start() : stop(); }, { threshold: 0.05 }).observe(hero);
      document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
      var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(layout, 150); });
      var rp = hero.querySelector("[data-fx-replay]"); if (rp) rp.addEventListener("click", function () { t0 = 0; layout(); start(); });
    }
    if (img.complete && img.naturalWidth) boot(); else img.addEventListener("load", boot);
  });
})();
