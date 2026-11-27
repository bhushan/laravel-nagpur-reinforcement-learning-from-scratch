/* Widgets for the anatomy act. Every one is seeded and steps from the keyboard.
   Probabilities and rewards marked illustrative are illustrations of the
   mechanism, not recorded measurements. */
(function () {
  'use strict';
  var Deck = window.Deck;
  var pct = function (v) { return Math.round(v * 100) + '%'; };

  /* ---------------------------------------------------------------- policy */
  Deck.widgets.tokenpolicy = function (host) {
    var TOK = [['addItem', 2.0], ['store', 1.6], ['add', 0.7], ['items', 0.0], ['(other)', -0.4]];
    var T = 1, rng = Deck.rng(5), drawn = [], tk;
    host.classList.add('tp');
    host.innerHTML =
      '<div class="tp-left">' +
      '<div class="win" data-w="1"><div class="win-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="win-name">the answer so far</span><span class="win-tag">illustrative</span></div>' +
      '<pre class="code" style="padding:.9rem 0;font-size:.82rem"><span class="l">Route::post(\'/carts/{email}/items\',</span><span class="l">    [CartController::class, \'<b class="tp-next" data-o="next">&#9608;</b></span></pre></div>' +
      '<div class="bars" data-w="1" data-o="bars"></div>' +
      '</div>' +
      '<div class="tp-right">' +
      '<div class="panel" data-w="2"><div class="ph">Temperature: how adventurous</div><div class="ctrl"><label>low <input type="range" min="2" max="20" value="10" data-a="t" aria-label="temperature"> high</label><output data-o="t">1.0</output></div><p class="tiny">Low: always the favourite. High: the long tail gets a turn.</p></div>' +
      '<div class="panel" data-w="3"><div class="ph">Sample the next token</div><div class="ctrl"><button class="btn primary" data-a="draw">Sample</button><button class="btn" data-a="clear">Clear</button></div><div class="tp-drawn" data-o="drawn"></div></div>' +
      '<div class="panel acc" data-w="4"><div class="ph">What training changes</div><p>Training moves these bars. Raise the probability of choices that led to a green run, lower the rest. Nothing else changes in the model.</p></div>' +
      '</div>';
    var $ = function (k) { return host.querySelector('[data-o=' + k + ']'); };
    function probs() {
      var ex = TOK.map(function (t) { return Math.exp(t[1] / T); }), sum = ex.reduce(function (a, b) { return a + b; }, 0);
      return ex.map(function (v) { return v / sum; });
    }
    function paint() {
      var p = probs(), bars = $('bars');
      bars.innerHTML = TOK.map(function (t, i) { return '<div class="brow"><span>' + Deck.esc(t[0]) + '</span><span class="track"><span class="fill ' + (i === 0 ? 'g' : '') + '" style="inline-size:' + (p[i] * 100).toFixed(1) + '%"></span></span><span>' + pct(p[i]) + '</span></div>'; }).join('');
      $('t').textContent = T.toFixed(1);
      $('drawn').innerHTML = drawn.map(function (i) { return '<span class="chip">' + Deck.esc(TOK[i][0]) + '</span>'; }).join('');
      var last = drawn.length ? TOK[drawn[drawn.length - 1]][0] : '';
      $('next').innerHTML = last ? Deck.esc(last) + '\'' : '&#9608;';
    }
    function draw() {
      var p = probs(), r = rng(), c = 0, k = 0;
      for (; k < p.length; k++) { c += p[k]; if (r < c) break; }
      drawn.push(Math.min(k, p.length - 1)); if (drawn.length > 10) drawn.shift(); paint();
    }
    host.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; if (b.getAttribute('data-a') === 'draw') draw(); else { drawn = []; paint(); } });
    host.querySelector('[data-a=t]').addEventListener('input', function (e) { T = e.target.value / 10; paint(); });
    tk = Deck.ticker(function () { if (drawn.length >= 8) { tk.stop(); return; } draw(); }, 260);
    paint();
    return {
      reset: function () { drawn = []; T = 1; rng = Deck.rng(5); host.querySelector('[data-a=t]').value = 10; paint(); },
      leave: function () { tk.stop(); },
      step: function (n) {
        Deck.wsteps(host, n);
        if (n === 3 && !drawn.length) { if (Deck.reduced()) { for (var i = 0; i < 8; i++) draw(); } else tk.start(); }
        if (n < 3) { tk.stop(); drawn = []; paint(); }
      }
    };
  };

  /* ------------------------------------------------------------ reward lab */
  Deck.widgets.rewardlab = function (host) {
    /* cart-update-001: 25 tests, 21 existing and 4 new. Real counts. */
    var CAND = [
      { name: 'Empty answer', sub: 'changes nothing', all: 21, nw: 0 },
      { name: 'The model\'s real try', sub: 'new feature missing', all: 21, nw: 0 },
      { name: 'Half done', sub: '2 of 4 new tests pass', all: 23, nw: 2 },
      { name: 'Correct', sub: 'all 25 pass', all: 25, nw: 4 }
    ];
    var DES = [
      { id: 'bin', name: 'All or nothing', fn: function (c) { return c.all === 25 ? 1 : 0; }, note: 'Fair, but a near miss earns nothing.' },
      { id: 'all', name: 'Share of all tests', fn: function (c) { return c.all / 25; }, note: 'Doing nothing scores 0.84. Same as trying.' },
      { id: 'new', name: 'Share of the new tests', fn: function (c) { return c.nw / 4; }, note: 'Pays only for what the task asked for.' }
    ];
    var cur = 0;
    host.classList.add('rl');
    host.innerHTML =
      '<div class="ctrl" data-o="des"></div><div class="bars rl-bars" data-o="bars"></div><div class="panel rl-note" data-o="note"></div>';
    var $ = function (k) { return host.querySelector('[data-o=' + k + ']'); };
    $('des').innerHTML = DES.map(function (d, i) { return '<button class="btn" data-i="' + i + '">' + d.name + '</button>'; }).join('');
    function paint() {
      var d = DES[cur];
      $('des').querySelectorAll('button').forEach(function (b, i) { b.setAttribute('aria-pressed', i === cur); });
      $('bars').innerHTML = CAND.map(function (c) {
        var v = d.fn(c);
        var cls = (d.id === 'all' && c.nw === 0) ? 'r' : (v === 1 ? 'g' : (v > 0 ? 'a' : ''));
        return '<div class="brow wide"><span>' + c.name + '<br><span class="tiny">' + c.sub + '</span></span><span class="track"><span class="fill ' + cls + '" style="inline-size:' + (v * 100) + '%"></span></span><span>' + v.toFixed(2) + '</span></div>';
      }).join('');
      var n = $('note'); n.className = 'panel rl-note ' + (d.id === 'all' ? 'bad' : (d.id === 'new' ? 'good' : 'acc')); n.innerHTML = '<p class="big">' + d.note + '</p>';
    }
    $('des').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; cur = +b.getAttribute('data-i'); paint(); });
    paint();
    return {
      reset: function () { cur = 0; paint(); },
      step: function (n) { cur = Deck.clamp(n - 1, 0, 2); paint(); }
    };
  };

  /* One group of eight answers to the same task, shared by the next three widgets. */
  var GROUP = [0, 0, 1, 0, 0, 0, 1, 0];

  /* ---------------------------------------------------------- group sample */
  Deck.widgets.groupsample = function (host) {
    host.classList.add('gs');
    host.innerHTML =
      '<div class="gs-main">' +
      '<div class="gs-dots" data-o="dots"></div>' +
      '<div data-o="res"></div>' +
      '</div>' +
      '<div class="gs-side">' +
      '<div class="panel acc" data-w="3"><div class="ph">Why eight, not one</div><p class="big">A score means something only next to other scores.</p></div>' +
      '</div>';
    var $ = function (k) { return host.querySelector('[data-o=' + k + ']'); };
    function paint(R) {
      $('dots').innerHTML = R.map(function (v, i) { return '<span class="gs-d ' + (v ? 'g' : 'r') + '"><b>' + (v ? '1.0' : '0.0') + '</b><i>#' + (i + 1) + '</i></span>'; }).join('');
      var k = R.reduce(function (a, b) { return a + b; }, 0);
      $('res').innerHTML = !R.length ? '' : (k === 0
        ? '<div class="panel bad"><div class="ph">Today\'s model: 0 of 8</div><p class="big">All the same. Nothing to learn from.</p></div>'
        : '<div class="panel good"><div class="ph">A better model: ' + k + ' of 8</div><p class="big">Now winners stand out from losers.</p></div>');
    }
    paint([]);
    return {
      reset: function () { paint([]); },
      step: function (n) {
        Deck.wsteps(host, n);
        paint(n <= 0 ? [] : (n === 1 ? [0, 0, 0, 0, 0, 0, 0, 0] : GROUP));
      }
    };
  };

  /* ------------------------------------------------------------- advantage */
  Deck.widgets.advantage = function (host) {
    var R = GROUP.slice();
    host.classList.add('av');
    host.innerHTML =
      '<div class="av-row" data-o="chips"></div>' +
      '<div class="av-avg" data-o="avg"></div>' +
      '<div class="av-bars" data-w="2" data-o="bars"></div>' +
      '<div data-o="msg"></div>';
    var $ = function (k) { return host.querySelector('[data-o=' + k + ']'); };
    function stats() {
      var n = R.length, m = R.reduce(function (a, b) { return a + b; }, 0) / n;
      var sd = Math.sqrt(R.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / n);
      return { m: m, sd: sd, adv: R.map(function (r) { return sd < 1e-9 ? 0 : (r - m) / sd; }) };
    }
    function paint() {
      var s = stats();
      $('chips').innerHTML = R.map(function (r, i) { return '<button class="av-chip ' + (r ? 'g' : 'r') + '" data-i="' + i + '"><span>#' + (i + 1) + '</span><b>' + (r ? '1.0' : '0.0') + '</b></button>'; }).join('');
      $('avg').innerHTML = 'Group average <b>' + s.m.toFixed(2) + '</b>';
      $('bars').innerHTML = s.adv.map(function (a) {
        var h = Math.min(100, Math.abs(a) / 2 * 100);
        return '<div class="av-col"><div class="up">' + (a > 0 ? '<span style="block-size:' + h + '%" class="g"></span>' : '') + '</div><div class="dn">' + (a < 0 ? '<span style="block-size:' + h + '%" class="r"></span>' : '') + '</div><em>' + (a > 0 ? '+' : '') + a.toFixed(1) + '</em></div>';
      }).join('');
      $('msg').innerHTML = s.sd < 1e-9
        ? '<div class="panel bad"><p class="big">All equal: every advantage is 0. No signal.</p></div>'
        : '<div class="panel acc"><p class="big">Above average: do more of it. Below: do less.</p></div>';
    }
    host.addEventListener('click', function (e) { var b = e.target.closest('.av-chip'); if (!b) return; var i = +b.getAttribute('data-i'); R[i] = R[i] ? 0 : 1; paint(); });
    paint();
    return {
      reset: function () { R = GROUP.slice(); paint(); },
      step: function (n) {
        Deck.wsteps(host, n);
        $('msg').hidden = n < 2;
        R = n >= 3 ? [0, 0, 0, 0, 0, 0, 0, 0] : GROUP.slice();
        paint();
      }
    };
  };

  /* ---------------------------------------------------------- policy update */
  Deck.widgets.policyupdate = function (host) {
    var OPT = ['firstOrNew', 'create', 'updateOrCreate', '(other)'];
    var BEFORE = [18, 50, 20, 12], AFTER = [31, 38, 18, 13];
    host.classList.add('pu');
    host.innerHTML =
      '<div class="pu-main">' +
      '<div class="win"><div class="win-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="win-name">one choice inside an answer</span><span class="win-tag">illustrative</span></div>' +
      '<pre class="code" style="padding:.8rem 0;font-size:.82rem"><span class="l">$item = $cart->items()-&gt;<b class="tp-next">&#9608;</b></span></pre></div>' +
      '<div class="bars" data-o="bars"></div>' +
      '</div>' +
      '<div class="pu-rails">' +
      '<div class="pu-adv" data-w="2"><div class="up"><b>+1.7</b> winners chose <span class="mono">firstOrNew</span></div><div class="dn"><b>-0.6</b> losers chose <span class="mono">create</span></div></div>' +
      '<div class="panel acc" data-w="3"><p class="big">A small nudge per lap, never a rewrite.</p></div>' +
      '</div>';
    var $ = function (k) { return host.querySelector('[data-o=' + k + ']'); };
    function paint(after) {
      var v = after ? AFTER : BEFORE;
      $('bars').innerHTML = OPT.map(function (o, i) { return '<div class="brow"><span>' + o + '</span><span class="track"><span class="fill ' + (i === 0 ? 'g' : (i === 1 ? 'r' : '')) + '" style="inline-size:' + v[i] + '%"></span></span><span>' + v[i] + '%' + (after && i === 0 ? ' <b class="good">up</b>' : '') + (after && i === 1 ? ' <b class="bad">down</b>' : '') + '</span></div>'; }).join('');
    }
    paint(false);
    return {
      reset: function () { paint(false); },
      step: function (n) { Deck.wsteps(host, n); paint(n >= 3); }
    };
  };
})();
