/* Skin scan (round 5, 11 Nov 2026). A real reading of the shopper's photo, done in the browser:
   MediaPipe Face Landmarker finds the face, then five measurements are taken from the skin areas (forehead, cheeks, nose, under-eyes).
   The photo is never uploaded: nothing here talks to a server. It is an estimate from one photo, not a diagnosis.
   Page config: window.SKINSCAN = { title, concerns: { spots|lines|oil|red|dry: { label, see, ids: [product ids], href } }, cta: {label, href} } */
(function () {
  var CFG = window.SKINSCAN; if (!CFG) return;
  var P = window.PRODUCTS || {}, root = document.body.getAttribute("data-root") || "";
  var MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2";
  var KEYS = ["spots", "lines", "oil", "red", "dry"];
  var inr = function (n) { return "₹" + Math.round(n).toLocaleString("en-IN"); };
  var el = function (h) { var d = document.createElement("div"); d.innerHTML = h; return d.firstElementChild; };
  var model = null;
  function loadModel() {
    if (!model) model = import(MP + "/vision_bundle.mjs").then(function (v) {
      return v.FilesetResolver.forVisionTasks(MP + "/wasm").then(function (fs) {
        return v.FaceLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: root + "vendor/face_landmarker.task", delegate: "CPU" }, runningMode: "IMAGE", numFaces: 1 });
      });
    });
    model.catch(function () { model = null; });
    return model;
  }

  /* ---------- measurement ---------- */
  function lab(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    r = r > .04045 ? Math.pow((r + .055) / 1.055, 2.4) : r / 12.92; g = g > .04045 ? Math.pow((g + .055) / 1.055, 2.4) : g / 12.92; b = b > .04045 ? Math.pow((b + .055) / 1.055, 2.4) : b / 12.92;
    var x = (r * .4124 + g * .3576 + b * .1805) / .95047, y = r * .2126 + g * .7152 + b * .0722, z = (r * .0193 + g * .1192 + b * .9505) / 1.08883;
    var f = function (t) { return t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
  var median = function (a) { if (!a.length) return 0; var s = Array.prototype.slice.call(a).sort(function (x, y) { return x - y; }); return s[s.length >> 1]; };

  function measure(src, pts) {
    var d2 = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
    var fw = d2(pts[234], pts[454]); if (fw < 150) return { error: "far" };
    var noseRatio = (pts[4].x - pts[234].x) / (pts[454].x - pts[234].x); if (noseRatio < .24 || noseRatio > .76) return { error: "turned" };
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pts.forEach(function (p) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(src.width, x1); y1 = Math.min(src.height, y1);
    var U = 360, s = U / fw, W = Math.round((x1 - x0) * s), H = Math.round((y1 - y0) * s);
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var cx = c.getContext("2d", { willReadFrequently: true }); cx.drawImage(src, x0, y0, x1 - x0, y1 - y0, 0, 0, W, H);
    var px = cx.getImageData(0, 0, W, H).data, n = W * H, L = new Float32Array(n), A = new Float32Array(n), Bb = new Float32Array(n);
    for (var i = 0; i < n; i++) { var t = lab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); L[i] = t[0]; A[i] = t[1]; Bb[i] = t[2]; }
    var I = new Float64Array((W + 1) * (H + 1));
    for (var y = 0; y < H; y++) { var row = 0; for (var x = 0; x < W; x++) { row += L[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
    var lmean = function (x, y, r) { var a = Math.max(0, x - r), b = Math.max(0, y - r), e = Math.min(W, x + r + 1), f = Math.min(H, y + r + 1); return (I[f * (W + 1) + e] - I[b * (W + 1) + e] - I[f * (W + 1) + a] + I[b * (W + 1) + a]) / ((e - a) * (f - b)); };
    var pt = function (i) { return { x: (pts[i].x - x0) * s, y: (pts[i].y - y0) * s }; };
    var mix = function (a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
    var reg = function (name, cpt, rx, ry) {
      var out = []; rx *= U; ry *= U;
      for (var y = Math.max(0, Math.floor(cpt.y - ry)); y < Math.min(H, cpt.y + ry); y++) for (var x = Math.max(0, Math.floor(cpt.x - rx)); x < Math.min(W, cpt.x + rx); x++) {
        var dx = (x - cpt.x) / rx, dy = (y - cpt.y) / ry; if (dx * dx + dy * dy <= 1) out.push(y * W + x);
      }
      return { name: name, c: cpt, idx: out };
    };
    var R = {
      forehead: reg("forehead", mix(pt(9), pt(10), .45), .20, .065),
      cheekL: reg("cheekL", pt(205), .095, .095), cheekR: reg("cheekR", pt(425), .095, .095),
      nose: reg("nose", pt(4), .05, .05), bridge: reg("bridge", pt(197), .035, .05),
      eyeL: reg("eyeL", mix(pt(230), pt(205), .12), .075, .028), eyeR: reg("eyeR", mix(pt(450), pt(425), .12), .075, .028),
      irisL: reg("irisL", mix(pt(33), pt(133), .5), .07, .035), irisR: reg("irisR", mix(pt(362), pt(263), .5), .07, .035)
    };
    var stat = function (rs, arr) { var sum = 0, k = 0; rs.forEach(function (r) { r.idx.forEach(function (i) { sum += arr[i]; k++; }); }); return k ? sum / k : 0; };
    var fine = function (rs, r) { var sum = 0, k = 0; rs.forEach(function (g) { g.idx.forEach(function (i) { sum += Math.abs(L[i] - lmean(i % W, (i / W) | 0, r)); k++; }); }); return k ? sum / k : 0; };
    var skin = [R.forehead, R.cheekL, R.cheekR], all = []; skin.forEach(function (r) { r.idx.forEach(function (i) { all.push(i); }); });
    var medL = median(all.map(function (i) { return L[i]; })), medC = median(all.map(function (i) { return Math.hypot(A[i], Bb[i]); }));
    var sharp = fine([R.irisL, R.irisR], 3) || 1;                       // eyes always carry sharp edges: the photo's own sharpness reference
    // dark spots and uneven tone: pixels clearly darker than their surroundings, on cheeks and forehead
    var spotK = 0, spotsAt = [];
    all.forEach(function (i) { var x = i % W, y = (i / W) | 0, dl = lmean(x, y, 16) - lmean(x, y, 2); if (dl > 3.2) { spotK++; if (dl > 5.5) spotsAt.push({ x: x, y: y, v: dl }); } });
    var spotFrac = spotK / all.length;
    var tone = Math.abs(stat([R.cheekL], L) - stat([R.cheekR], L));    // left/right light difference (lighting check)
    // fine lines: fine detail on forehead and under the eyes, against the photo's own sharpness
    var lineRaw = Math.max(0, fine([R.forehead, R.eyeL, R.eyeR], 3) - .8 * fine([R.cheekL, R.cheekR], 3)) / sharp;   // creased areas carry more fine detail than the cheeks do
    // rough, dry-looking texture on the cheeks
    var roughRaw = fine([R.cheekL, R.cheekR], 2) / sharp;
    // shine: bright, washed-out pixels on forehead and nose
    var tz = []; [R.forehead, R.nose, R.bridge].forEach(function (r) { r.idx.forEach(function (i) { tz.push(i); }); });
    var shineK = 0; tz.forEach(function (i) { if (L[i] > medL + 13 && Math.hypot(A[i], Bb[i]) < medC - 1.5) shineK++; });
    var shine = shineK / tz.length;
    // redness: how red the cheeks and nose are against the forehead, plus the overall red-to-yellow balance
    var aC = stat([R.cheekL, R.cheekR, R.nose], A), aF = stat([R.forehead], A), bC = stat([R.cheekL, R.cheekR], Bb);
    var redRaw = (aC - aF) + .35 * (aC - .8 * bC);
    var raw = { spots: spotFrac, lines: lineRaw, oil: shine, red: redRaw, rough: roughRaw, medL: medL, tone: tone, sharp: sharp };
    var sc = {
      spots: clamp((spotFrac - .012) / .075), lines: clamp((lineRaw - .05) / .22), oil: clamp((shine - .02) / .16),
      red: clamp((redRaw - 1.5) / 7), dry: clamp((roughRaw - .26) / .26) * clamp(1.15 - shine * 5)
    };
    sc.lines *= 1 - .6 * sc.spots;   // blemishes add fine detail too; do not read them as lines
    spotsAt.sort(function (a, b) { return b.v - a.v; });
    var marks = { spots: [], lines: [R.forehead.c, R.eyeL.c], oil: [R.forehead.c, R.nose.c], red: [R.cheekL.c, R.cheekR.c], dry: [R.cheekL.c, R.cheekR.c] };
    spotsAt.forEach(function (p) { if (marks.spots.length < 3 && marks.spots.every(function (q) { return Math.hypot(q.x - p.x, q.y - p.y) > 40; })) marks.spots.push(p); });
    if (!marks.spots.length) marks.spots = [R.cheekL.c];
    var back = function (p) { return { x: (p.x / s + x0) / src.width, y: (p.y / s + y0) / src.height }; };
    Object.keys(marks).forEach(function (k) { marks[k] = marks[k].map(back); });
    var warn = medL < 28 ? "dark" : medL > 90 ? "bright" : tone > 14 ? "side" : "";
    return { raw: raw, scores: sc, marks: marks, warn: warn, box: { x: x0 / src.width, y: y0 / src.height, w: (x1 - x0) / src.width, h: (y1 - y0) / src.height } };
  }

  function analyze(source) {   // source: img, video or canvas
    var w = source.videoWidth || source.naturalWidth || source.width, h = source.videoHeight || source.naturalHeight || source.height;
    var k = Math.min(1, 1100 / Math.max(w, h)), c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext("2d").drawImage(source, 0, 0, c.width, c.height);
    return loadModel().then(function (m) {
      var r = m.detect(c), f = r.faceLandmarks && r.faceLandmarks[0];
      if (!f) return { error: "noface", canvas: c };
      var out = measure(c, f.map(function (p) { return { x: p.x * c.width, y: p.y * c.height }; })); out.canvas = c; return out;
    });
  }

  /* ---------- interface ---------- */
  var ERR = { noface: "We could not find a face in this photo. Use a clear, front-facing photo of your face.", far: "Your face is too small in this photo. Move closer so your face fills the oval.",
    turned: "Please face the camera straight on.", model: "The skin scan could not load on this connection. Please try again, or pick your concern from the list." };
  var WARN = { dark: "This photo is quite dark, so the reading is rougher. Try again facing a window.", bright: "This photo is very bright, so the reading is rougher. Try softer light.", side: "The light falls from one side, so the reading is rougher. Face the light for a better one." };
  var LEVEL = function (v) { return v >= .62 ? ["Most visible", "hi"] : v >= .34 ? ["Some signs", "mid"] : ["Little to none", "lo"]; };
  var dlg, stream;
  function stopCam() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } }
  function close() { stopCam(); if (dlg) { dlg.remove(); dlg = null; document.documentElement.classList.remove("ss-open"); } }
  function show(html) { $(".ss-body").innerHTML = html; $(".ss-panel").scrollTop = 0; }
  function $(s) { return dlg.querySelector(s); }
  function open() {
    if (dlg) return;
    dlg = el('<div class="ss" role="dialog" aria-modal="true" aria-label="' + (CFG.title || "Skin scan") + '"><div class="ss-panel"><button class="ss-x" type="button" aria-label="Close" data-ss-close>&times;</button><div class="ss-body"></div></div></div>');
    document.body.appendChild(dlg); document.documentElement.classList.add("ss-open");
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg || e.target.closest("[data-ss-close]")) return close();
      if (e.target.closest("[data-ss-cam]")) return camera();
      if (e.target.closest("[data-ss-snap]")) return snap();
      if (e.target.closest("[data-ss-again]")) { stopCam(); return intro(); }
      var row = e.target.closest("[data-ss-pick]"); if (row) { row.classList.toggle("on"); row.setAttribute("aria-pressed", row.classList.contains("on")); return products(); }
    });
    dlg.addEventListener("change", function (e) { if (e.target.matches("[data-ss-file]") && e.target.files[0]) fromFile(e.target.files[0]); });
    document.addEventListener("keydown", esc);
    intro(); loadModel().catch(function () {});
  }
  function esc(e) { if (e.key === "Escape" && dlg) close(); if (!dlg) document.removeEventListener("keydown", esc); }
  function intro(msg) {
    var cam = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    show('<p class="ss-eye">AI skin scan</p><h2>' + (CFG.title || "See what your skin needs") + '</h2>' +
      '<p class="ss-lede">Take a selfie or upload a photo. We read five things from it: dark spots, fine lines, shine, redness and dry texture, then suggest what fits.</p>' +
      (msg ? '<p class="ss-err" role="alert">' + msg + "</p>" : "") +
      '<div class="ss-act">' + (cam ? '<button class="btn" type="button" data-ss-cam>Take a selfie</button>' : "") +
      '<label class="btn ghost ss-up"><input type="file" accept="image/*" data-ss-file>Upload a photo</label></div>' +
      '<ul class="ss-tips"><li>Face a window or a soft light</li><li>No makeup, glasses off, hair off your forehead</li><li>Look straight at the camera</li></ul>' +
      '<p class="ss-priv">Your photo stays on this device. It is read here in your browser and is never uploaded or saved.</p>');
  }
  function camera() {
    show('<p class="ss-eye">AI skin scan</p><h2>Fit your face in the oval</h2><div class="ss-cam"><video playsinline autoplay muted></video><i></i></div>' +
      '<div class="ss-act"><button class="btn" type="button" data-ss-snap>Take photo</button><button class="btn ghost" type="button" data-ss-again>Back</button></div>');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false }).then(function (s) {
      if (!dlg) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s; var v = $("video"); if (v) { v.srcObject = s; v.play().catch(function () {}); }
    }).catch(function () { intro("We could not open the camera. Allow camera access, or upload a photo instead."); });
  }
  function snap() {
    var v = $("video"); if (!v || !v.videoWidth) return;
    var c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
    stopCam(); run(c);
  }
  function fromFile(f) {
    var img = new Image(); img.onload = function () { run(img); URL.revokeObjectURL(img.src); }; img.onerror = function () { intro("We could not open that file. Please choose a photo."); };
    img.src = URL.createObjectURL(f);
  }
  function run(source) {
    show('<p class="ss-eye">AI skin scan</p><h2>Reading your skin...</h2><div class="ss-shot scanning"><canvas></canvas></div><p class="ss-lede" data-ss-step>Finding your face</p>');
    var cv = $(".ss-shot canvas"), w = source.videoWidth || source.naturalWidth || source.width, h = source.videoHeight || source.naturalHeight || source.height, k = Math.min(1, 900 / Math.max(w, h));
    cv.width = Math.round(w * k); cv.height = Math.round(h * k); cv.getContext("2d").drawImage(source, 0, 0, cv.width, cv.height);
    var steps = ["Finding your face", "Checking tone and dark spots", "Checking texture and fine lines", "Checking shine and redness"], si = 0;
    var tick = setInterval(function () { var s = dlg && $("[data-ss-step]"); if (s && si < steps.length - 1) s.textContent = steps[++si]; }, 650);
    var t0 = Date.now();
    analyze(cv).then(function (r) { return new Promise(function (ok) { setTimeout(function () { ok(r); }, Math.max(0, 2000 - (Date.now() - t0))); }); })
      .then(function (r) { clearInterval(tick); if (!dlg) return; if (r.error) return intro(ERR[r.error]); result(cv, r); })
      .catch(function () { clearInterval(tick); if (dlg) intro(ERR.model); });
  }
  var last;
  function result(cv, r) {
    last = r;
    var order = KEYS.filter(function (k) { return CFG.concerns[k]; }).sort(function (a, b) { return r.scores[b] - r.scores[a]; });
    var top = order.filter(function (k, i) { return i === 0 || (i === 1 && r.scores[k] >= .34); });
    var rows = order.map(function (k) {
      var c = CFG.concerns[k], lv = LEVEL(r.scores[k]), on = top.indexOf(k) > -1;
      return '<button type="button" class="ss-row ' + lv[1] + (on ? " on" : "") + '" data-ss-pick="' + k + '" aria-pressed="' + on + '"><span class="ss-ck"></span><span class="ss-rt"><b>' + c.label + "</b><small>" + c.see + '</small></span>' +
        '<span class="ss-lv">' + lv[0] + '</span><span class="ss-bar"><i style="width:' + Math.max(6, Math.round(r.scores[k] * 100)) + '%"></i></span></button>';
    }).join("");
    var calm = r.scores[order[0]] < .34;
    show('<p class="ss-eye">Your skin scan</p><h2>' + (calm ? "Your skin looks balanced in this photo" : "What your photo shows") + "</h2>" +
      (r.warn ? '<p class="ss-warn">' + WARN[r.warn] + "</p>" : "") +
      '<div class="ss-res"><div class="ss-shot"><canvas></canvas><div class="ss-marks"></div></div><div class="ss-rows"><p class="ss-hint">Tick what you want to work on. We have ticked what shows most.</p>' + rows + "</div></div>" +
      '<div class="ss-prod"></div>' +
      '<p class="ss-priv">An estimate from one photo, read on your device. Light, makeup and the camera change it. It is not a medical diagnosis; for a skin condition, see a dermatologist.</p>' +
      '<div class="ss-act"><button class="btn ghost" type="button" data-ss-again>Scan again</button>' + (CFG.cta ? '<a class="btn ghost" href="' + CFG.cta.href + '">' + CFG.cta.label + "</a>" : "") + "</div>");
    var out = $(".ss-shot canvas"), b = r.box, pad = .12, sx = Math.max(0, b.x - b.w * pad), sy = Math.max(0, b.y - b.h * .28), sw = Math.min(1 - sx, b.w * (1 + 2 * pad)), sh = Math.min(1 - sy, b.h * 1.4);
    out.width = Math.round(sw * cv.width); out.height = Math.round(sh * cv.height);
    out.getContext("2d").drawImage(cv, sx * cv.width, sy * cv.height, out.width, out.height, 0, 0, out.width, out.height);
    out.dataset.sx = sx; out.dataset.sy = sy; out.dataset.sw = sw; out.dataset.sh = sh;
    products();
  }
  function products() {
    var picked = Array.prototype.map.call(dlg.querySelectorAll(".ss-row.on"), function (b) { return b.getAttribute("data-ss-pick"); });
    var out = $(".ss-shot canvas"), sx = +out.dataset.sx, sy = +out.dataset.sy, sw = +out.dataset.sw, sh = +out.dataset.sh, mk = "";
    picked.forEach(function (k) { (last.marks[k] || []).forEach(function (p) { mk += '<i class="m-' + k + '" style="left:' + ((p.x - sx) / sw * 100) + "%;top:" + ((p.y - sy) / sh * 100) + '%"></i>'; }); });
    $(".ss-marks").innerHTML = mk;
    var ids = [], per = picked.length > 1 ? 2 : 4;
    picked.forEach(function (k) { var n = 0; (CFG.concerns[k].ids || []).forEach(function (id) { if (P[id] && ids.indexOf(id) < 0 && n < per) { ids.push(id); n++; } }); });
    var box = $(".ss-prod");
    if (!picked.length) { box.innerHTML = '<p class="ss-hint">Tick at least one to see products.</p>'; return; }
    var names = picked.map(function (k) { return CFG.concerns[k].label.toLowerCase(); }).join(" and ");
    box.innerHTML = "<h3>Picked for " + names + '</h3><div class="ss-grid">' + ids.map(function (id) {
      var p = P[id], grp = (CFG.group || []).indexOf(id) > -1;
      return '<article class="ss-card"><a class="ph" href="' + root + p.u + '"><img src="' + root + p.i + '" alt="" width="300" height="300" loading="lazy"></a><h4><a href="' + root + p.u + '">' + p.n + "</a></h4><p>" + (p.s || "") + '</p><div class="rw"><b>' + inr(p.p) + "</b>" +
        (grp ? '<a class="add" href="' + root + p.u + '">View</a>' : '<button class="add" type="button" data-add="' + id + '">Add</button>') + "</div></article>";
    }).join("") + "</div>" + (picked.length === 1 && CFG.concerns[picked[0]].href ? '<a class="link" href="' + root + CFG.concerns[picked[0]].href + '">See everything for ' + names + "</a>" : "");
  }
  document.addEventListener("click", function (e) { if (e.target.closest("[data-scan-open]")) { e.preventDefault(); open(); } });
  window.__skinscan = { analyze: analyze, open: open, close: close };
})();
