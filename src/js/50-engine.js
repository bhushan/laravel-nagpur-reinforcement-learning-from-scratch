/* ==========================================================================
   ENGINE
   --------------------------------------------------------------------------
   A slide has steps. Elements marked data-s="n" appear when the slide reaches
   step n. The forward key advances one step, and only when the slide is fully
   revealed does it move to the next slide. Widgets get the step number too, so
   every demo is driven from the keyboard as well as the mouse.
   ====================================================================== */
(function () {
  'use strict';
  var Deck = window.Deck;
  var params = new URLSearchParams(location.search);
  var SHOW_ALL = params.has('all');
  if (SHOW_ALL || params.has('selftest') || params.has('static')) document.documentElement.classList.add('static');

  var slides = [].slice.call(document.querySelectorAll('.slide'));
  var total = slides.length;
  var cur = -1;

  var $ = function (id) { return document.getElementById(id); };
  var railSection = $('railSection'), railIdx = $('railIdx'), ticksEl = $('ticks'), railClock = $('railClock');
  var overview = $('overview'), mapEl = $('map'), drawer = $('notesDrawer');
  var notesBody = $('notesBody'), notesTitle = $('notesTitle'), ogrid = $('ogrid'), omap = $('omap');
  var progress = $('progress');

  /* ---- per-slide model --------------------------------------------------- */
  /* Authoring shorthand: data-s="2 fade" means step 2 plus the class "fade". */
  document.querySelectorAll('[data-s]').forEach(function (e) {
    var parts = e.getAttribute('data-s').trim().split(/\s+/);
    e.setAttribute('data-s', parts[0]);
    parts.slice(1).forEach(function (c) { e.classList.add(c); });
  });
  var cumulative = 0;
  var model = slides.map(function (s, i) {
    var els = [].slice.call(s.querySelectorAll('[data-s]'));
    var max = els.reduce(function (m, e) { return Math.max(m, parseInt(e.dataset.s, 10) || 0, parseInt(e.dataset.until, 10) || 0); }, 0);
    var panes = [].slice.call(s.querySelectorAll('.pane[data-pane]'));
    var pnotes = [].slice.call(s.querySelectorAll('aside.notes[data-pane-start]'));
    max = Math.max(max, parseInt(s.dataset.steps, 10) || 0); /* steps driven by a widget, not by markup */
    var dur = parseInt(s.dataset.dur, 10) || 0;
    var m = { el: s, els: els, panes: panes, pnotes: pnotes, max: max, step: 0, widgets: [], dur: dur, start: cumulative, title: s.dataset.title, section: s.dataset.section, fail: s.dataset.result === 'fail' };
    cumulative += dur;
    s.dataset.index = i;
    return m;
  });
  Deck.totalSeconds = cumulative;

  Deck.codeBlocks(document);
  Deck.icons(document);

  /* The stage tracker: which of the ten steps of the training lap we are in. */
  var STAGES = ['Task', 'Prompt', 'Policy', 'Answer', 'Sandbox', 'Reward', 'Group', 'Advantage', 'Update', 'Repeat'];
  document.querySelectorAll('.tracker').forEach(function (t) {
    var now = parseInt(t.getAttribute('data-now'), 10);
    t.innerHTML = STAGES.map(function (name, i) {
      return '<span class="t' + (i + 1 < now ? ' past' : (i + 1 === now ? ' now' : '')) + '">' + (i + 1) + ' ' + name + '</span>';
    }).join('');
  });

  /* ---- widgets ----------------------------------------------------------- */
  document.querySelectorAll('[data-widget]').forEach(function (host) {
    var name = host.getAttribute('data-widget');
    var slideEl = host.closest('.slide');
    var m = model[slides.indexOf(slideEl)];
    var factory = Deck.widgets[name];
    if (!factory) { Deck.failures.push('missing widget: ' + name); return; }
    try {
      var inst = factory(host, { slide: slideEl, seed: 7 });
      inst.name = name; inst.__from = parseInt(host.getAttribute('data-from'), 10) || 0;
      m.widgets.push(inst);
    } catch (err) {
      Deck.failures.push(name + ': ' + (err && err.message));
      host.classList.add('widget-failed');
    }
  });
  function each(m, fn, arg) {
    m.widgets.forEach(function (w) {
      try { if (w[fn]) w[fn](fn === 'step' ? Math.max(0, arg - (w.__from || 0)) : arg); } catch (err) { Deck.failures.push(w.name + '.' + fn + ': ' + (err && err.message)); }
    });
  }

  /* ---- rail --------------------------------------------------------------- */
  model.forEach(function (m, i) {
    var t = document.createElement('i');
    t.title = (i + 1) + '. ' + m.title;
    if (i === 0 || model[i - 1].section !== m.section) t.classList.add('sect-start');
    if (m.fail) t.classList.add('fail');
    t.addEventListener('click', function () { go(i); });
    ticksEl.appendChild(t);
    var b = document.createElement('button');
    b.innerHTML = '<span class="n">' + String(i + 1).padStart(2, '0') + '</span>' + m.title;
    b.addEventListener('click', function () { closeOverlays(); go(i); });
    ogrid.appendChild(b);
  });
  var sections = [];
  model.forEach(function (m, i) {
    var f = sections.filter(function (s) { return s.name === m.section; })[0];
    if (!f) { f = { name: m.section, items: [], secs: 0 }; sections.push(f); }
    f.items.push({ i: i, t: m.title });
    f.secs += m.dur;
  });
  sections.forEach(function (sec) {
    var wrap = Deck.el('div', 'sec', null, omap);
    Deck.el('div', 'sname', Deck.esc(sec.name) + '<span>' + Math.round(sec.secs / 60) + ' min</span>', wrap);
    sec.items.forEach(function (it) {
      var b = Deck.el('button', '', '<span class="n">' + String(it.i + 1).padStart(2, '0') + '</span>' + Deck.esc(it.t), wrap);
      b.dataset.idx = it.i;
      b.addEventListener('click', function () { closeOverlays(); go(it.i); });
    });
  });

  function fmt(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }

  /* ---- panes ----------------------------------------------------------------
     A slide can hold several panes that take turns: each is visible from its
     data-s step until data-until. The strip at the top names them. The notes
     drawer follows the pane on screen. */
  model.forEach(function (m) {
    if (m.panes.length < 2) return;
    var nav = Deck.el('div', 'pane-nav', '', m.el);
    nav.setAttribute('aria-hidden', 'true');
    m.panes.forEach(function (p) { Deck.el('span', '', Deck.esc(p.getAttribute('data-pane')), nav); });
    m.nav = nav;
  });
  function activePane(m) {
    var idx = 0;
    m.panes.forEach(function (p, i) { if ((parseInt(p.dataset.s, 10) || 0) <= m.step) idx = i; });
    return idx;
  }
  function paneState(m) {
    if (!m.nav) return;
    var a = activePane(m);
    [].forEach.call(m.nav.children, function (c, i) { c.className = i === a ? 'now' : (i < a ? 'past' : ''); });
  }
  function paneNotes(m) {
    if (!m.pnotes.length) return '';
    var a = activePane(m), start = parseInt(m.panes[a] ? m.panes[a].dataset.s : '0', 10);
    var n = m.pnotes.filter(function (x) { return parseInt(x.getAttribute('data-pane-start'), 10) === start; })[0] || m.pnotes[0];
    return n.innerHTML;
  }

  /* A pane that opens empty and fills one press later feels broken: the first
     group of a pane is shown the moment the pane (or the slide) arrives. */
  function firstGroup(m, n) {
    return m.panes.some(function (p) {
      if ((parseInt(p.dataset.s, 10) || 0) !== n) return false;
      return [].some.call(p.querySelectorAll('[data-s]'), function (e) { return !e.classList.contains('pane') && parseInt(e.dataset.s, 10) === n + 1; });
    });
  }
  /* Where a view lands when you arrive on it: fully revealed, so nothing waits
     for another key press. A view with a live demo lands on the demo's opening
     state instead (its first step), so the demo is not already finished. */
  function paneEnd(m, i) { var u = m.panes[i] && m.panes[i].getAttribute('data-until'); return u === null || u === undefined ? m.max : parseInt(u, 10); }
  function landing(m, i) {
    var p = m.panes[i];
    if (!p) return m.max;
    var start = parseInt(p.dataset.s, 10) || 0, end = paneEnd(m, i);
    var land = p.getAttribute('data-land');
    if (land !== null) return Math.min(end, start + (parseInt(land, 10) || 0));
    return p.querySelector('[data-widget]:not([data-ambient])') ? Math.min(end, start + 1) : end;
  }
  function settle(m, n) { return (n < m.max && firstGroup(m, n)) ? n + 1 : n; }

  /* ---- steps -------------------------------------------------------------- */
  function applyStep(m) {
    m.els.forEach(function (e) {
      var u = e.getAttribute('data-until');
      e.classList.toggle('on', (parseInt(e.dataset.s, 10) || 0) <= m.step && (u === null || m.step <= parseInt(u, 10)));
    });
    paneState(m);
    m.el.querySelectorAll('.l[data-hs]').forEach(function (l) { l.classList.toggle('hot', parseInt(l.dataset.hs, 10) === m.step); });
    m.el.dataset.step = m.step;
    if (m.pnotes.length && cur >= 0 && model[cur] === m) { notesBody.innerHTML = paneNotes(m); }
    each(m, 'step', m.step);
    var pct = ((m.start + m.dur * (m.max ? m.step / m.max : 1)) / Deck.totalSeconds) * 100;
    progress.style.transform = 'scaleX(' + (pct / 100).toFixed(4) + ')';
    document.dispatchEvent(new CustomEvent('deck:step', { detail: { index: cur, step: m.step, max: m.max } }));
  }
  function setStep(n) {
    var m = model[cur];
    m.step = Deck.clamp(n, 0, m.max);
    applyStep(m);
  }

  /* ---- autoplay ------------------------------------------------------------
     One key (A) plays the rest of the slide's steps at a talking pace, so the
     speaker can stop pressing arrows. It paces itself from the slide's planned
     time: duration / (steps + 1), kept between 2 and 12 seconds. It never
     moves to the next slide, and any manual key press or slide change stops it. */
  var autoTimer = 0;
  function autoStop() { if (autoTimer) { clearTimeout(autoTimer); autoTimer = 0; } document.body.classList.remove('autoplaying'); }
  function autoplay(speedUp) {
    var m = model[cur];
    if (autoTimer) { autoStop(); return; }
    if (m.step >= m.max) { setStep(settle(m, 0)); }
    if (m.step >= m.max) return;
    var gap = speedUp || Deck.clamp(m.dur / (m.max + 1), 2, 12) * 1000;
    document.body.classList.add('autoplaying');
    (function tick() {
      autoTimer = setTimeout(function () {
        autoTimer = 0;
        var mm = model[cur];
        if (mm.step < mm.max) setStep(settle(mm, mm.step + 1));
        if (model[cur].step < model[cur].max) tick(); else autoStop();
      }, gap);
    })();
  }
  Deck.autoplay = autoplay;

  /* ---- navigation --------------------------------------------------------- */
  /* go(i, where): where is a pane index, 'last' for the last pane, or omitted
     for the first. The view always arrives fully revealed. */
  function go(i, where) {
    i = Deck.clamp(i, 0, total - 1);
    if (cur >= 0 && cur !== i) {
      var old = model[cur];
      old.el.classList.remove('active');
      each(old, 'leave');
    }
    var changed = cur !== i;
    autoStop();
    cur = i;
    var m = model[cur];
    m.el.classList.add('active');
    if (changed) each(m, 'reset');
    var idx = where === 'last' ? m.panes.length - 1 : (where || 0);
    m.step = SHOW_ALL ? m.max : landing(m, Math.max(0, idx));
    applyStep(m);
    if (changed) each(m, 'enter');

    railSection.textContent = m.section;
    railIdx.textContent = String(cur + 1).padStart(2, '0') + ' / ' + total;
    railClock.textContent = 'planned ' + fmt(m.start) + ' / ' + fmt(Deck.totalSeconds);
    [].forEach.call(ticksEl.children, function (t, n) {
      t.classList.toggle('cur', n === cur);
      t.classList.toggle('done', n < cur);
    });
    [].forEach.call(ogrid.children, function (b, n) { b.classList.toggle('cur', n === cur); });
    omap.querySelectorAll('button').forEach(function (b) { b.classList.toggle('cur', +b.dataset.idx === cur); });
    var note = m.pnotes.length ? null : m.el.querySelector('.notes');
    notesTitle.textContent = String(cur + 1).padStart(2, '0') + ' · ' + m.title + ' · ' + fmt(m.dur);
    notesBody.innerHTML = note ? note.innerHTML : paneNotes(m);
    if (history.replaceState) history.replaceState(null, '', location.search + '#' + (cur + 1));
  }
  function next() {
    autoStop();
    var m = model[cur];
    if (m.step < m.max) setStep(settle(m, m.step + 1)); else if (cur < total - 1) go(cur + 1);
  }
  function prev() {
    autoStop();
    var m = model[cur], base = settle(m, 0);
    if (m.step > base) {
      var n = m.step - 1;
      while (n > base && firstGroup(m, n)) n--; /* never land on a pane that is still empty */
      setStep(n);
    } else if (cur > 0) go(cur - 1);
  }
  /* Arrow keys. Slide mode (default): one press, one slide. View mode (press V):
     one press, one view, so every view of a long slide is reachable by arrows. */
  var viewMode = false;
  function nextSlide() {
    autoStop();
    var m = model[cur];
    if (viewMode) { var a = activePane(m); if (a < m.panes.length - 1) { setStep(landing(m, a + 1)); return; } }
    if (cur < total - 1) go(cur + 1);
  }
  function prevSlide() {
    autoStop();
    var m = model[cur];
    if (viewMode) { var a = activePane(m); if (a > 0) { setStep(landing(m, a - 1)); return; } if (cur > 0) { go(cur - 1, 'last'); return; } }
    if (cur > 0) go(cur - 1);
  }
  function closeOverlays() { overview.classList.remove('open'); mapEl.classList.remove('open'); }
  function anyOverlay() { return overview.classList.contains('open') || mapEl.classList.contains('open'); }

  /* ---- input -------------------------------------------------------------- */
  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (k === 'Escape') {
      e.preventDefault();
      if (mapEl.classList.contains('open')) closeOverlays(); else overview.classList.toggle('open');
      return;
    }
    if (anyOverlay()) { if (k === 'm' || k === 'M') closeOverlays(); return; }
    var inControl = Deck.isControl(e.target);
    var onButton = e.target && e.target.closest && e.target.closest('button,a');
    /* Arrows and Page keys change the SLIDE in one press. Space (and Down/Up) step
       within a slide, and A plays all the remaining steps. */
    if (k === 'ArrowRight' || k === 'PageDown') { if (inControl && k !== 'PageDown') return; e.preventDefault(); nextSlide(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { if (inControl && k !== 'PageUp') return; e.preventDefault(); prevSlide(); }
    else if (k === ' ' && !onButton) { e.preventDefault(); next(); }
    else if (k === 'ArrowDown' || k === 'ArrowUp') { if (inControl) return; e.preventDefault(); (k === 'ArrowDown' ? next : prev)(); }
    else if (inControl) return;
    else if (k === 'Home') { e.preventDefault(); go(0); }
    else if (k === 'End') { e.preventDefault(); go(total - 1); }
    else if (k === 'm' || k === 'M') { e.preventDefault(); mapEl.classList.toggle('open'); }
    else if (k === 'n' || k === 'N') { e.preventDefault(); drawer.classList.toggle('open'); }
    else if (k === 'a' || k === 'A') { e.preventDefault(); autoplay(); }
    else if (k === 'v' || k === 'V') { e.preventDefault(); viewMode = !viewMode; document.body.classList.toggle('view-mode', viewMode); }
    else if (k === 't' || k === 'T') { e.preventDefault(); document.body.classList.toggle('show-clock'); }
    else if (k === 'f' || k === 'F') {
      e.preventDefault();
      if (!document.fullscreenElement) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }
      else document.exitFullscreen();
    }
  });
  overview.addEventListener('click', function (e) { if (e.target === overview) closeOverlays(); });
  mapEl.addEventListener('click', function (e) { if (e.target === mapEl) closeOverlays(); });
  /* Clicking the slide does nothing: the presenter drives with the keyboard, and a
     stray click while pointing at something must never change the slide. */

  var wheelLock = 0;
  window.addEventListener('wheel', function (e) {
    if (anyOverlay() || drawer.classList.contains('open') || Deck.isControl(e.target)) return;
    var now = Date.now();
    if (now - wheelLock < 650 || Math.abs(e.deltaY) < 24) return;
    wheelLock = now;
    (e.deltaY > 0 ? nextSlide : prevSlide)();
  }, { passive: true });
  var tx = 0, ty = 0;
  window.addEventListener('touchstart', function (e) { tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', function (e) {
    if (Deck.isControl(e.target)) return;
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? nextSlide : prevSlide)();
  }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (cur < 0) return;
    each(model[cur], document.hidden ? 'leave' : 'enter');
  });

  /* ---- boot --------------------------------------------------------------- */
  Deck.go = go; Deck.next = next; Deck.prev = prev; Deck.nextSlide = nextSlide; Deck.prevSlide = prevSlide; Deck.total = total;
  Deck.model = model;
  /* After a mouse click on a control, hand the keyboard back to the deck:
     otherwise Space re-presses the last button and arrows move a slider. */
  document.addEventListener('pointerup', function (e) {
    var c = e.target.closest && e.target.closest('button,input,select,textarea');
    if (c) setTimeout(function () { if (document.activeElement === c) c.blur(); }, 0);
  });
  Deck.setStep = function (n) { setStep(n); };
  Deck.paneIndex = function () { return activePane(model[cur]); };
  Deck.setViewMode = function (v) { viewMode = !!v; };
  Deck.revealAll = function () { setStep(model[cur].max); };
  Deck.current = function () { return cur; };

  Deck.start = function () {
    document.documentElement.classList.remove('no-js');
    var n = parseInt((location.hash || '#1').slice(1), 10);
    go(isNaN(n) ? 0 : n - 1);
  };
})();
