/* LockNCode design preview: cart, drawers, search, filters, gallery. Nothing here talks to a server; the cart lives in this browser only. */
(function () {
  var B = window.BRAND || {}, P = window.PRODUCTS || {}, KEY = "lnc_cart_" + (B.key || "x");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var inr = function (n) { return "₹" + Math.round(n).toLocaleString("en-IN"); };
  var root = document.body.getAttribute("data-root") || "";

  /* header shadow */
  var hdr = $(".hdr");
  if (hdr) window.addEventListener("scroll", function () { hdr.classList.toggle("scrolled", window.scrollY > 8); }, { passive: true });

  /* sheets: menu, cart, search */
  var scrim = $(".scrim");
  function open(id) {
    var el = document.getElementById(id); if (!el) return;
    if (id === "search") { el.classList.add("on"); var i = $("input", el); setTimeout(function () { i && i.focus(); }, 30); return; }
    el.classList.add("on"); scrim && scrim.classList.add("on"); document.body.style.overflow = "hidden";
  }
  function closeAll() {
    $$(".sheet.on,.search.on,.modal.on").forEach(function (e) { e.classList.remove("on"); });
    scrim && scrim.classList.remove("on"); document.body.style.overflow = "";
  }
  document.addEventListener("click", function (e) {
    var o = e.target.closest("[data-open]"); if (o) { e.preventDefault(); open(o.getAttribute("data-open")); return; }
    if (e.target.closest("[data-close]") || e.target === scrim) { e.preventDefault(); closeAll(); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });

  /* toast */
  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("on"); clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove("on"); }, 1800);
  }

  /* cart */
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function save(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} render(); }
  function add(id, q) {
    if (!P[id]) return; var c = load(), f = c.filter(function (x) { return x.id === id; })[0];
    if (f) f.q += q; else c.push({ id: id, q: q }); save(c);
  }
  function setQ(id, q) { var c = load().map(function (x) { if (x.id === id) x.q = q; return x; }).filter(function (x) { return x.q > 0; }); save(c); }
  function totals(c) { var s = 0, n = 0; c.forEach(function (x) { if (P[x.id]) { s += P[x.id].p * x.q; n += x.q; } }); return { s: s, n: n }; }
  function suggestion(c) {
    var ids = c.map(function (x) { return x.id; });
    var pick = (B.suggest || []).filter(function (r) { return ids.indexOf(r[0]) > -1 && ids.indexOf(r[1]) < 0; })[0];
    var id = pick ? pick[1] : (B.fallbackSuggest || []).filter(function (x) { return ids.indexOf(x) < 0; })[0];
    return id && P[id] ? id : null;
  }
  function itemHTML(x) {
    var p = P[x.id];
    return '<div class="ci"><a href="' + root + p.u + '"><img src="' + root + p.i + '" alt="" loading="lazy"></a><div><b>' + p.n + '</b>' +
      '<span class="muted small">' + (p.s || "") + '</span><div><span class="q"><button data-q="' + x.id + '" data-d="-1" aria-label="Fewer">−</button><span>' + x.q +
      '</span><button data-q="' + x.id + '" data-d="1" aria-label="More">+</button></span><button class="rm" data-q="' + x.id + '" data-d="rm">Remove</button></div></div>' +
      '<b>' + inr(p.p * x.q) + '</b></div>';
  }
  function giftHTML(s) {
    if (!B.gift) return "";
    var left = B.gift.at - s, pct = Math.min(100, s / B.gift.at * 100);
    return '<div class="gift">' + (left > 0 ? "Add " + inr(left) + " more for " + B.gift.label : "✓ " + B.gift.unlocked) +
      '<div class="bar"><i style="width:' + pct + '%"></i></div></div>';
  }
  function upsellHTML(c) {
    var id = suggestion(c); if (!id) return "";
    var p = P[id];
    return '<div class="upsell"><img src="' + root + p.i + '" alt=""><div><span class="muted small">' + (B.suggestLabel || "Complete the routine") +
      '</span><br><b>' + p.n + '</b><br>' + inr(p.p) + '</div><button class="add" data-add="' + id + '">Add</button></div>';
  }
  function render() {
    var c = load(), t = totals(c);
    $$("[data-count]").forEach(function (e) { e.textContent = t.n; e.style.display = t.n ? "flex" : "none"; });
    var box = $("#cartItems");
    if (box) {
      box.innerHTML = c.length ? '<div class="cart-items">' + c.map(itemHTML).join("") + "</div>" + giftHTML(t.s) + upsellHTML(c)
        : '<div class="empty"><p><b>Your cart is empty.</b></p><p>Free shipping on every order.</p><a class="btn" href="' + root + 'shop.html">Shop best sellers</a></div>';
      var f = $("#cartFoot"); if (f) f.style.display = c.length ? "grid" : "none";
      $$("[data-sub]").forEach(function (e) { e.textContent = inr(t.s); });
    }
    var pg = $("#cartPage");
    if (pg) {
      pg.innerHTML = c.length ? c.map(itemHTML).join('<hr style="border:0;border-top:1px solid var(--line);margin:18px 0">') + giftHTML(t.s) + upsellHTML(c)
        : '<div class="empty"><p><b>Your cart is empty.</b></p><a class="btn" href="' + root + 'shop.html">Shop best sellers</a></div>';
      $$("[data-sub]").forEach(function (e) { e.textContent = inr(t.s); });
    }
    var ck = $("#ckItems");
    if (ck) {
      ck.innerHTML = c.length ? c.map(function (x) { var p = P[x.id]; return '<div class="ci" style="grid-template-columns:56px 1fr auto"><img src="' + root + p.i + '" style="width:56px;height:56px" alt=""><div><b>' + p.n + '</b><span class="muted small">Qty ' + x.q + '</span></div><b>' + inr(p.p * x.q) + '</b></div>'; }).join("")
        : '<p class="muted">Your cart is empty. <a class="link" href="' + root + 'shop.html">Shop</a></p>';
      $$("[data-sub]").forEach(function (e) { e.textContent = inr(t.s); });
      var gl = $("#ckGift"); if (gl && B.gift) gl.style.display = t.s >= B.gift.at ? "flex" : "none";
    }
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-add]");
    if (a) {
      e.preventDefault(); var id = a.getAttribute("data-add"), q = 1, qi = a.closest("[data-qty-scope]");
      if (qi) { var inp = $("input", qi); q = Math.max(1, parseInt(inp && inp.value, 10) || 1); }
      add(id, q);
      if (a.hasAttribute("data-buynow")) { location.href = root + "checkout.html"; return; }
      if (!a.closest(".sheet")) open("cart"); else toast("Added to cart: " + (P[id] ? P[id].n : "")); return;
    }
    var q = e.target.closest("[data-q]");
    if (q) {
      var id2 = q.getAttribute("data-q"), d = q.getAttribute("data-d"), cur = load().filter(function (x) { return x.id === id2; })[0];
      if (!cur) return; setQ(id2, d === "rm" ? 0 : cur.q + parseInt(d, 10)); return;
    }
    var st = e.target.closest("[data-step]");
    if (st) { var i2 = $("input", st.parentNode); i2.value = Math.max(1, (parseInt(i2.value, 10) || 1) + parseInt(st.getAttribute("data-step"), 10)); }
  });
  render();

  /* search */
  var si = $("#searchInput"), sr = $("#searchRes");
  if (si && sr) {
    var all = Object.keys(P).map(function (k) { var p = P[k]; p.id = k; return p; });
    var draw = function () {
      var v = si.value.trim().toLowerCase();
      var list = v ? all.filter(function (p) { return (p.n + " " + (p.k || "") + " " + (p.s || "")).toLowerCase().indexOf(v) > -1; }) : all.filter(function (p) { return p.top; });
      sr.innerHTML = (v ? "" : '<p class="eyebrow" style="grid-column:1/-1">Popular right now</p>') +
        (list.length ? list.slice(0, 24).map(function (p) { return '<a href="' + root + p.u + '"><img src="' + root + p.i + '" alt=""><div><b>' + p.n + '</b><br><span class="muted small">' + inr(p.p) + "</span></div></a>"; }).join("")
          : '<p class="muted">No products match "' + si.value + '". Try a skin concern, like oily skin or dark spots.</p>');
    };
    si.addEventListener("input", draw); draw();
  }

  /* shop filters (NAV-010) */
  var shop = $("#shopGrid");
  if (shop) {
    var cards = $$(".card", shop), st2 = { concern: "", cat: "" }, sortSel = $("#sort");
    var qs = new URLSearchParams(location.search); st2.concern = qs.get("concern") || ""; st2.cat = qs.get("cat") || "";
    var apply = function () {
      var shown = 0;
      cards.forEach(function (c) {
        var ok = (!st2.concern || (" " + c.getAttribute("data-concern") + " ").indexOf(" " + st2.concern + " ") > -1) &&
                 (!st2.cat || (" " + c.getAttribute("data-cat") + " ").indexOf(" " + st2.cat + " ") > -1);
        c.style.display = ok ? "" : "none"; if (ok) shown++;
      });
      $$("[data-f-concern]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-f-concern") === st2.concern); });
      $$("[data-f-cat]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-f-cat") === st2.cat); });
      var n = $("#shopCount"); if (n) n.textContent = shown + (shown === 1 ? " product" : " products");
      var h = $("#shopTitle"), d = $("#shopDesc"), meta = (window.SHOP_META || {})[st2.concern || st2.cat || ""];
      if (meta && h) { h.textContent = meta[0]; if (d) d.textContent = meta[1]; }
      var u = new URL(location.href); u.searchParams.delete("concern"); u.searchParams.delete("cat");
      if (st2.concern) u.searchParams.set("concern", st2.concern); if (st2.cat) u.searchParams.set("cat", st2.cat);
      history.replaceState(null, "", u);
    };
    document.addEventListener("click", function (e) {
      var f = e.target.closest("[data-f-concern],[data-f-cat]"); if (!f) return; e.preventDefault();
      if (f.hasAttribute("data-f-concern")) { var v = f.getAttribute("data-f-concern"); st2.concern = st2.concern === v ? "" : v; }
      else { var v2 = f.getAttribute("data-f-cat"); st2.cat = st2.cat === v2 ? "" : v2; }
      apply();
    });
    if (sortSel) sortSel.addEventListener("change", function () {
      var k = sortSel.value;
      cards.sort(function (a, b) {
        if (k === "low") return a.dataset.price - b.dataset.price;
        if (k === "high") return b.dataset.price - a.dataset.price;
        if (k === "rated") return (b.dataset.rating || 0) - (a.dataset.rating || 0);
        return a.dataset.rank - b.dataset.rank;
      }).forEach(function (c) { shop.appendChild(c); });
    });
    apply();
  }

  /* carousels */
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".cbtn"); if (!b) return;
    var tr = b.parentNode.querySelector(".ctrack"); if (!tr) return;
    tr.scrollBy({ left: (b.classList.contains("prev") ? -1 : 1) * tr.clientWidth * 0.92, behavior: "smooth" });
  });

  /* banner slider */
  $$("[data-slider]").forEach(function (sl) {
    var tr = $(".slides", sl), n = $$(".slide", sl).length, i = 0, paused = false, dots = $$(".sdots button", sl);
    var go = function (k) { i = (k + n) % n; tr.style.transform = "translateX(" + (-100 * i) + "%)"; dots.forEach(function (d, j) { d.classList.toggle("on", j === i); d.setAttribute("aria-current", j === i ? "true" : "false"); }); };
    sl.addEventListener("click", function (e) {
      var b = e.target.closest(".sarr,.sdots button"); if (!b) return;
      if (b.classList.contains("prev")) go(i - 1); else if (b.classList.contains("next")) go(i + 1); else go(dots.indexOf(b));
      paused = true;
    });
    ["mouseenter", "focusin", "touchstart"].forEach(function (ev) { sl.addEventListener(ev, function () { paused = true; }, { passive: true }); });
    sl.addEventListener("mouseleave", function () { paused = false; });
    var x0 = null;
    sl.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    sl.addEventListener("touchend", function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1)); x0 = null; });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(function () { if (!paused && !document.hidden) go(i + 1); }, 6500);
    go(0);
  });

  /* gallery (PDP-025) */
  var gm = $(".gal-main img");
  $$(".gal-strip button").forEach(function (b) {
    b.addEventListener("click", function () {
      $$(".gal-strip button").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on");
      gm.src = b.getAttribute("data-src"); gm.alt = b.getAttribute("data-alt") || "";
    });
  });

  /* variant picker (one page per kit type, one swatch per scent) */
  $$("[data-variant]").forEach(function (v) {
    v.addEventListener("click", function () {
      $$("[data-variant]").forEach(function (x) { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); });
      v.classList.add("on"); v.setAttribute("aria-pressed", "true");
      var id = v.getAttribute("data-variant"), p = P[id]; if (!p) return;
      $$("[data-add]").forEach(function (b) { if (b.closest(".buy") || b.closest(".stickybar")) b.setAttribute("data-add", id); });
      var lab = $("#vName"); if (lab) lab.textContent = v.getAttribute("data-label");
      $$("[data-vprice]").forEach(function (e) { e.textContent = inr(p.p); });
      var add = $("#mainAdd"); if (add) add.textContent = "Add to cart · " + inr(p.p);
      if (gm && v.getAttribute("data-img")) { gm.src = v.getAttribute("data-img"); }
    });
  });

  /* sticky phone buy bar: appears once the main Add to Cart scrolls away */
  var vOn = $(".variants button.on");
  if (vOn && vOn.parentNode.scrollWidth > vOn.parentNode.clientWidth) vOn.parentNode.scrollLeft = vOn.offsetLeft - vOn.parentNode.offsetLeft - 16;
  var mainAdd = $("#mainAdd"), bar = $(".stickybar");
  if (mainAdd && bar) {
    var sb = function () { bar.classList.toggle("on", mainAdd.getBoundingClientRect().bottom < 0); };
    window.addEventListener("scroll", sb, { passive: true }); window.addEventListener("resize", sb); sb();
  }

  /* reading bar on articles (BLOG-010) */
  var rb = $(".rbar");
  if (rb) window.addEventListener("scroll", function () {
    var h = document.documentElement, p = h.scrollTop / (h.scrollHeight - h.clientHeight);
    rb.classList.toggle("on", p > 0.18 && p < 0.97);
  }, { passive: true });

  /* checkout preview: never places an order */
  var form = $("#ckForm");
  if (form) form.addEventListener("submit", function (e) { e.preventDefault(); var m = $("#ckModal"); m && m.classList.add("on"); });
})();
