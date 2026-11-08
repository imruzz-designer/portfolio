/* ==========================================================================
   IMRUZZ — effects.js  (index.html only)
   "Being built live": named cursors fly to each block, drag a Figma-style
   selection box around it, and the block appears as the box completes.
   Also: red scroll-progress line, cursor glow, hero parallax, active nav
   link, package-strip arrows, and the "previous / next" list that the
   image viewer uses.
   Speed: only transform/opacity are animated, scroll work is throttled to one
   frame, off-screen animations are paused, and touch / low-power devices run
   in "lite" mode (simple fades, no cursors).
   If anything fails, every hidden block is revealed (see revealAll).
   ========================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(hover: none)').matches;
  var conn = navigator.connection || {};
  var weak = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4) || conn.saveData;
  var lite = coarse || weak;
  if (lite) root.classList.add('lite');

  function revealAll() {
    document.querySelectorAll('[data-build],.reveal').forEach(function (el) { el.classList.add('b-in'); });
  }
  var show = function (el) { el.classList.add('b-in'); };

  /* ---------- fills in the parts you do not have to write by hand ---------- */
  function prepare() {
    var enc = encodeURIComponent;
    /* every picture block: link to its own page, add the hover caption, handle missing files */
    document.querySelectorAll('a.work').forEach(function (a) {
      var img = a.querySelector('img');
      if (!img) return;
      var src = img.getAttribute('src');
      a.href = 'media-viewer.html?file=' + enc(src);
      a.setAttribute('aria-label', 'Open ' + (a.getAttribute('data-build') || 'image'));
      a.setAttribute('data-path', src);
      var kindEl = a.closest('[data-kind]');
      var cap = document.createElement('span');
      cap.className = 'work-cap';
      cap.innerHTML = '<b></b><i></i><u aria-hidden="true">\u2197</u>';
      cap.firstChild.textContent = a.getAttribute('data-build') || '';
      cap.children[1].textContent = kindEl ? kindEl.getAttribute('data-kind') : '';
      a.appendChild(cap);
      var miss = function () { img.hidden = true; a.classList.add('missing'); };
      img.addEventListener('error', miss);
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('loading') !== 'lazy') miss();
    });
    /* PDF cards: data-pdf on the card feeds both links */
    document.querySelectorAll('[data-pdf]').forEach(function (card) {
      var href = 'pdf-viewer.html?file=' + enc(card.getAttribute('data-pdf'));
      card.querySelectorAll('a').forEach(function (a) { a.href = href; });
      var img = card.querySelector('img');
      if (img) img.addEventListener('error', function () { img.hidden = true; });
    });
  }

  /* ---------- viewer navigation: remember the group that was clicked ---------- */
  function viewerList() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a.work');
      if (!a) return;
      try {
        var group = a.closest('.masonry,.logo-grid,.brand-sheets,.strip,.ui-grid');
        if (!group) return;
        var items = Array.prototype.map.call(group.querySelectorAll('a.work'), function (n) {
          return { f: new URL(n.href, location.href).searchParams.get('file'), t: n.getAttribute('data-build') || '' };
        });
        var sec = a.closest('section');
        sessionStorage.setItem('imruzz-set', JSON.stringify({ back: sec ? sec.id : 'work', items: items }));
      } catch (err) { /* storage blocked: viewer just hides the arrows */ }
    });
  }

  function strips() {
    document.querySelectorAll('[data-strip]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var strip = btn.closest('.strip-wrap').querySelector('.strip');
        strip.scrollBy({ left: Number(btn.dataset.strip) * strip.clientWidth * 0.8, behavior: 'smooth' });
      });
    });
  }

  function progress() {
    var bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var hero = document.querySelector('.hero-bgword');
    var heroOn = !!hero && !reduce && !lite;
    var ticking = false;
    function update() {
      var max = root.scrollHeight - innerHeight;
      bar.style.transform = 'scaleY(' + (max > 0 ? Math.min(1, scrollY / max) : 0) + ')';
      if (heroOn && scrollY < innerHeight * 1.2) hero.style.setProperty('--py', (scrollY * 0.18) + 'px');
      ticking = false;
    }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  function glow() {
    if (lite) return;
    var g = document.createElement('div');
    g.className = 'cursor-glow';
    g.setAttribute('aria-hidden', 'true');
    document.body.appendChild(g);
    var x = 0, y = 0, pending = false;
    addEventListener('mousemove', function (e) {
      x = e.clientX; y = e.clientY;
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { g.style.opacity = 1; g.style.transform = 'translate(' + x + 'px,' + y + 'px)'; pending = false; });
    }, { passive: true });
    document.addEventListener('mouseleave', function () { g.style.opacity = 0; });
  }

  function activeNav() {
    var links = {};
    document.querySelectorAll('.main-nav a[href^="#"]').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.toggle('active', k === en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
    document.querySelectorAll('.main-nav a').forEach(function (a) {
      a.addEventListener('click', function () { var t = document.getElementById('nav-toggle'); if (t) t.checked = false; });
    });
  }

  /* pause the marquee when it is off-screen */
  function marquee() {
    var m = document.querySelector('.marquee');
    if (!m) return;
    new IntersectionObserver(function (en) { m.classList.toggle('paused', !en[0].isIntersecting); }).observe(m);
  }

  /* ---------- the cursor build effect ---------- */
  function builder() {
    var targets = Array.prototype.slice.call(document.querySelectorAll('[data-build],.reveal'));
    if (!targets.length) return;
    var hd = document.querySelector('.site-header'); if (hd) show(hd);

    /* hero lines without their own data-build appear with the headline */
    var follow = document.querySelectorAll('.hero-role,.hero-tag,.hero-description,.hero-actions,.hero-status');
    var heroName = document.querySelector('.hero h1[data-build]');
    var followHero = function () { follow.forEach(function (el, i) { setTimeout(function () { show(el); }, 90 * (i + 1)); }); };

    /* simple mode: plain fades (reduced motion, touch, low-power) */
    if (reduce || lite) {
      var fade = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          fade.unobserve(en.target);
          show(en.target);
          if (en.target === heroName) followHero();
        });
      }, { threshold: 0.05, rootMargin: '0px 0px -4% 0px' });
      targets.forEach(function (t) { fade.observe(t); });
      if (reduce) { revealAll(); follow.forEach(show); }
      return;
    }

    var layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);

    var people = [
      { name: 'IMRUZZ', color: '#FF5D55' },
      { name: 'Designer', color: '#2f8cff' },
      { name: 'Art Director', color: '#22c55e' }
    ];
    var arrow = function (c) {
      return '<svg viewBox="0 0 24 24"><path d="M3 2l17 8-7.5 2L9.5 20z" fill="' + c + '" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    };
    var workers = people.map(function (p, i) {
      var cur = document.createElement('div');
      cur.className = 'fx-cursor';
      cur.innerHTML = arrow(p.color) + '<span class="fx-tag" style="background:' + p.color + '">' + p.name + '</span>';
      var sel = document.createElement('div');
      sel.className = 'fx-sel';
      sel.innerHTML = '<i></i><i></i><i></i><i></i><b></b>';
      layer.appendChild(sel);
      layer.appendChild(cur);
      return { cur: cur, sel: sel, label: sel.querySelector('b'), x: innerWidth * (0.2 + 0.3 * i), y: -40, busy: false, hideT: 0 };
    });

    var queue = [], seen = new WeakSet();
    var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var lerp = function (a, b, t) { return a + (b - a) * t; };
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var frames = function (ms, fn) {
      return new Promise(function (res) {
        var t0 = performance.now();
        (function step(now) {
          var p = Math.min(1, (now - t0) / ms);
          fn(p);
          p < 1 ? requestAnimationFrame(step) : res();
        })(t0);
      });
    };
    var place = function (w, x, y) { w.x = x; w.y = y; w.cur.style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
    var area = function (el) {
      var r = el.getBoundingClientRect();
      var top = Math.max(r.top, 8), bottom = Math.min(r.bottom, innerHeight - 8);
      return { l: r.left, t: top, w: r.width, h: Math.max(20, bottom - top), full: r };
    };

    function reveal(el, w) {
      return (async function () {
        var a = area(el);
        var gone = function () { var r = el.getBoundingClientRect(); return r.bottom < 0 || r.top > innerHeight; };
        if (gone() || a.w < 40 || a.h < 30) { show(el); return; }
        clearTimeout(w.hideT);
        w.cur.classList.add('on');
        var name = el.getAttribute('data-build');
        w.label.textContent = (name || 'Frame') + ' · ' + Math.round(a.full.width) + ' × ' + Math.round(a.full.height);
        var fromX = w.x, fromY = w.y, aborted = false;
        /* 1 — fly to the top-left corner of the block */
        await frames(320, function (p) {
          if (aborted || (aborted = gone())) return;
          var k = ease(p), t = area(el);
          place(w, lerp(fromX, t.l, k), lerp(fromY, t.t, k));
        });
        /* 2 — drag the selection box out to the bottom-right corner */
        if (!aborted) w.sel.classList.add('on');
        await frames(400, function (p) {
          if (aborted || (aborted = gone())) return;
          var k = ease(p), t = area(el);
          var bw = t.w * k, bh = t.h * k;
          w.sel.style.transform = 'translate(' + t.l + 'px,' + t.t + 'px)';
          w.sel.style.width = bw + 'px';
          w.sel.style.height = bh + 'px';
          place(w, t.l + bw, t.t + bh);
        });
        /* 3 — the block appears; the box fades and the cursor wanders off while the next job starts */
        show(el);
        await wait(aborted ? 0 : 120);
        w.sel.classList.remove('on');
        var px = Math.random() * innerWidth * 0.8 + innerWidth * 0.1;
        var py = Math.random() < 0.5 ? innerHeight * 0.1 : innerHeight * 0.9;
        var sx = w.x, sy = w.y;
        w.hideT = setTimeout(function () { w.cur.classList.remove('on'); }, 1400);
        w.busy = false; pump();
        frames(500, function (p) { if (!w.busy) { var k = ease(p); place(w, lerp(sx, px, k), lerp(sy, py, k)); } });
      })();
    }

    function pump() {
      workers.forEach(function (w) {
        if (w.busy || !queue.length) return;
        var el = queue.shift();
        /* if we are behind (fast scrolling), reveal quickly instead of drawing every box */
        if (queue.length > 3) { show(el); if (el === heroName) followHero(); return pump(); }
        w.busy = true;
        reveal(el, w).catch(function () { show(el); }).then(function () { if (w.busy) { w.busy = false; pump(); } });
      });
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting || seen.has(en.target)) return;
        seen.add(en.target);
        io.unobserve(en.target);
        /* plain .reveal items fade in on their own; only [data-build] items get a cursor box */
        if (en.target.hasAttribute('data-build')) queue.push(en.target);
        else setTimeout(function () { show(en.target); }, 60);
      });
      pump();
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (t) { io.observe(t); });

    if (heroName) {
      var obs = new MutationObserver(function () {
        if (!heroName.classList.contains('b-in')) return;
        obs.disconnect();
        followHero();
      });
      obs.observe(heroName, { attributes: true, attributeFilter: ['class'] });
    } else follow.forEach(show);
  }

  try {
    prepare();
    viewerList();
    strips();
    progress();
    glow();
    activeNav();
    marquee();
    if (root.classList.contains('js-ready')) builder();
    window.__fx = true;
  } catch (err) {
    console.error('effects.js:', err);
    window.__fx = true;
    revealAll();
    root.classList.remove('js-ready');
  }
})();
