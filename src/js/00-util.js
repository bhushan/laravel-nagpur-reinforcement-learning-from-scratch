/* ==========================================================================
   UTILITIES shared by the engine and every widget.
   ====================================================================== */
(function () {
  'use strict';
  var Deck = window.Deck = { widgets: {}, failures: [], errors: [] };

  window.addEventListener('error', function (e) { Deck.errors.push(String(e.message || e)); });
  window.addEventListener('unhandledrejection', function (e) { Deck.errors.push(String(e.reason)); });

  /* Seeded random numbers (mulberry32). Every rehearsal converges the same
     way, so the speaker can say "watch what happens at episode 40" and be right. */
  Deck.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  var SVGNS = 'http://www.w3.org/2000/svg';
  Deck.svg = function (tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  Deck.el = function (tag, cls, html, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    if (parent) parent.appendChild(n);
    return n;
  };
  Deck.esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  Deck.clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  Deck.reduced = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };

  /* A requestAnimationFrame loop that only runs while the slide is on screen
     and the tab is visible. Widgets call loop.start() in enter() and
     loop.stop() in leave(). */
  Deck.loop = function (fn, fps) {
    var raf = 0, last = 0, interval = 1000 / (fps || 60);
    function tick(t) {
      raf = requestAnimationFrame(tick);
      if (t - last < interval) return;
      var dt = (t - last) / 1000; last = t;
      fn(Math.min(dt, 0.1), t);
    }
    return {
      start: function () { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } },
      stop: function () { if (raf) { cancelAnimationFrame(raf); raf = 0; } },
      running: function () { return !!raf; }
    };
  };

  /* A steady timer with the same contract (start/stop), for step-by-step
     simulations that tick a few times a second rather than every frame. */
  Deck.ticker = function (fn, ms) {
    var id = 0;
    return {
      start: function () { if (!id) id = setInterval(fn, ms); },
      stop: function () { if (id) { clearInterval(id); id = 0; } },
      running: function () { return !!id; },
      every: function (n) { ms = n; if (id) { clearInterval(id); id = setInterval(fn, ms); } }
    };
  };

  /* Controls inside a slide must not drive the deck: a range slider eats the
     arrow keys, a button eats Space. The engine asks this before it navigates. */
  Deck.isControl = function (t) {
    return !!(t && t.closest && t.closest('input,select,textarea,[data-noswipe]'));
  };

  /* Widgets reveal their own parts: elements with data-w="n" appear at step n. */
  Deck.wsteps = function (host, n) {
    host.querySelectorAll('[data-w]').forEach(function (e) { e.classList.toggle('on', (parseInt(e.getAttribute('data-w'), 10) || 0) <= n); });
  };

  /* ---- syntax highlighting -------------------------------------------- */
  var RULES = {
    php: [[/\/\/[^\n]*/g, 'c'], [/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, 's'], [/\$[A-Za-z_]\w*/g, 'v'],
      [/\b(?:public|private|protected|function|return|new|use|class|extends|implements|if|else|elseif|foreach|as|static|null|true|false|match|fn|array|throw|try|catch|namespace|it|expect)\b/g, 'k'],
      [/[A-Za-z_]\w*(?=\s*\()/g, 'f'], [/\b\d+(?:\.\d+)?\b/g, 'n']],
    json: [[/"(?:[^"\\]|\\.)*"(?=\s*:)/g, 'v'], [/"(?:[^"\\]|\\.)*"/g, 's'], [/\b(?:true|false|null)\b/g, 'k'], [/-?\b\d+(?:\.\d+)?\b/g, 'n']],
    bash: [[/#[^\n]*/g, 'c'], [/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, 's'], [/^\s*\$/gm, 'p'], [/--[\w-]+/g, 'v'], [/\b(?:docker|php|artisan|git|npm|composer|pest|uv|python)\b/g, 'k']],
    py: [[/#[^\n]*/g, 'c'], [/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, 's'], [/\b(?:def|return|if|else|for|in|import|from|class|None|True|False|and|or|not|with|as)\b/g, 'k'],
      [/[A-Za-z_]\w*(?=\s*\()/g, 'f'], [/\b\d+(?:\.\d+)?\b/g, 'n']],
    text: [[/\bFILE:[^\n]*/g, 'f'], [/\bPASS\b/g, 's'], [/\bFAIL\b/g, 'v']]
  };
  Deck.highlight = function (code, lang) {
    var rules = RULES[lang], marks = [];
    if (rules) rules.forEach(function (r) {
      var re = new RegExp(r[0].source, r[0].flags), m;
      while ((m = re.exec(code))) {
        if (m[0] === '') { re.lastIndex++; continue; }
        var s = m.index, e = s + m[0].length;
        if (!marks.some(function (k) { return s < k.e && e > k.s; })) marks.push({ s: s, e: e, c: r[1] });
      }
    });
    marks.sort(function (a, b) { return a.s - b.s; });
    var out = '', pos = 0;
    marks.forEach(function (k) {
      out += Deck.esc(code.slice(pos, k.s)) + '<span class="tok-' + k.c + '">' + Deck.esc(code.slice(k.s, k.e)) + '</span>';
      pos = k.e;
    });
    return out + Deck.esc(code.slice(pos));
  };

  /* <pre data-lang="php"> blocks. A line ending in "@@" is permanently
     highlighted; "@@2" lights up only while the slide is on step 2, so the
     speaker walks a spotlight down the code with the forward key. */
  Deck.codeBlocks = function (root) {
    (root || document).querySelectorAll('pre[data-lang]').forEach(function (pre) {
      var lang = pre.getAttribute('data-lang');
      var raw = pre.textContent.replace(/^\n/, '').replace(/\s+$/, '');
      var lines = raw.split('\n'), tags = [];
      lines = lines.map(function (ln) {
        var m = /\s*@@(\d*)$/.exec(ln);
        if (m) { tags.push(m[1] === '' ? 'on' : m[1]); return ln.slice(0, m.index); }
        tags.push(null); return ln;
      });
      var html = Deck.highlight(lines.join('\n'), lang).split('\n');
      pre.innerHTML = html.map(function (h, i) {
        var t = tags[i], a = '';
        if (t === 'on') a = ' ln-on';
        else if (t) a = '" data-hs="' + t;
        return '<span class="l' + a + '">' + (h || ' ') + '</span>';
      }).join('');
    });
  };
})();
