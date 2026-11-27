/* Explore or exploit: three approaches with hidden pass rates (30, 55, 80%).
   Seed 41 was chosen so the scripted greedy run gets stuck on the middle arm,
   which is the point being made. Verified in a standalone simulation. */
(function () {
  'use strict';
  var Deck = window.Deck;
  var RATES = [0.3, 0.55, 0.8], NAMES = ['Approach A', 'Approach B', 'Approach C'];

  Deck.widgets.bandit = function (host) {
    var rng, cnt, win, n, eps = 0, target = 0, results = {}, reveal = false, mode = 'free';
    host.classList.add('bandit');
    host.innerHTML =
      '<div class="bd-arms"></div>' +
      '<div class="bd-side">' +
      '<div class="ctrl"><label>exploration <input type="range" min="0" max="50" value="0" data-a="eps" aria-label="exploration percent"><output data-o="eps">0%</output></label></div>' +
      '<div class="ctrl"><button class="btn" data-a="pull10">Pull 10</button><button class="btn primary" data-a="run">Run 60</button><button class="btn" data-a="reset">Reset</button></div>' +
      '<div class="bd-tot"><div><span class="k">pulls</span><b data-o="n">0</b></div><div><span class="k">tests passed</span><b data-o="tot" class="good">0</b></div><div><span class="k">picked the best arm</span><b data-o="best">0%</b></div></div>' +
      '<div class="bd-cmp" data-o="cmp"></div>' +
      '<p class="tiny">Each pull is one attempt at the same task with that approach. The agent sees only pass or fail.</p>' +
      '</div>';
    var armsEl = host.querySelector('.bd-arms'), $ = function (k) { return host.querySelector('[data-o=' + k + ']'); };
    var arms = RATES.map(function (_, i) {
      var d = Deck.el('div', 'bd-arm', '<div class="nm">' + NAMES[i] + '</div><div class="tr"><span class="fill"></span></div><div class="meta"><span data-m="est">no data</span><span data-m="cnt">0 pulls</span><span data-m="true"></span></div>', armsEl);
      return d;
    });
    function init(seed) { rng = Deck.rng(seed); cnt = [0, 0, 0]; win = [0, 0, 0]; n = 0; }
    function pull() {
      var a;
      if (n < 3) a = n;
      else if (rng() < eps) a = Math.floor(rng() * 3);
      else { var est = cnt.map(function (c, k) { return win[k] / c; }); a = est.indexOf(Math.max.apply(null, est)); }
      var w = rng() < RATES[a] ? 1 : 0;
      cnt[a]++; win[a] += w; n++;
    }
    function paint() {
      var tot = win[0] + win[1] + win[2];
      arms.forEach(function (d, i) {
        var est = cnt[i] ? win[i] / cnt[i] : 0;
        d.querySelector('.fill').style.inlineSize = (est * 100) + '%';
        d.querySelector('.fill').className = 'fill' + (i === 2 && cnt[i] > 5 ? ' g' : '');
        d.querySelector('[data-m=est]').textContent = cnt[i] ? 'seen ' + Math.round(est * 100) + '% pass' : 'no data';
        d.querySelector('[data-m=cnt]').textContent = cnt[i] + ' pulls';
        d.querySelector('[data-m=true]').textContent = reveal ? 'true ' + Math.round(RATES[i] * 100) + '%' : '';
        d.classList.toggle('best', reveal && i === 2);
      });
      $('n').textContent = n; $('tot').textContent = tot;
      $('best').textContent = n ? Math.round(cnt[2] / n * 100) + '%' : '0%';
      var c = '';
      if (results.greedy) c += '<div class="row"><b>Greedy, 0% exploring:</b> <span>' + results.greedy.tot + ' passed, picked the best arm ' + results.greedy.best + '% of the time</span></div>';
      if (results.explore) c += '<div class="row"><b class="good">15% exploring:</b> <span>' + results.explore.tot + ' passed, picked the best arm ' + results.explore.best + '% of the time</span></div>';
      $('cmp').innerHTML = c;
    }
    function setEps(v) { eps = v; host.querySelector('[data-a=eps]').value = Math.round(v * 100); $('eps').textContent = Math.round(v * 100) + '%'; }
    var tk = Deck.ticker(function () { if (n < target) { pull(); paint(); } else { tk.stop(); record(); } }, 70);
    function record() {
      if (mode === 'greedy' || mode === 'explore') { results[mode] = { tot: win[0] + win[1] + win[2], best: Math.round(cnt[2] / n * 100) }; paint(); }
    }
    function scripted(which) {
      tk.stop(); mode = which; reveal = true; setEps(which === 'greedy' ? 0 : 0.15); init(41); target = 60;
      if (Deck.reduced()) { while (n < target) pull(); record(); } else tk.start();
      paint();
    }
    host.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.getAttribute('data-a'); mode = 'free';
      if (a === 'pull10') { for (var i = 0; i < 10; i++) pull(); paint(); }
      else if (a === 'run') { target = n + 60; tk.start(); }
      else if (a === 'reset') { tk.stop(); init(99); results = {}; reveal = false; paint(); }
    });
    host.querySelector('[data-a=eps]').addEventListener('input', function (e) { eps = e.target.value / 100; $('eps').textContent = e.target.value + '%'; });
    init(99); paint();
    return {
      reset: function () { tk.stop(); init(99); results = {}; reveal = false; setEps(0); mode = 'free'; paint(); },
      leave: function () { tk.stop(); },
      step: function (s) {
        if (s === 0) return;
        if (s === 1) scripted('greedy');
        else if (s === 2) { if (!results.greedy) { scripted('greedy'); tk.stop(); while (n < 60) pull(); record(); } scripted('explore'); }
        else if (s >= 3) { tk.stop(); if (!results.greedy) { init(41); setEps(0); mode = 'greedy'; while (n < 60) pull(); record(); } if (!results.explore) { init(41); setEps(0.15); mode = 'explore'; while (n < 60) pull(); record(); } reveal = true; paint(); }
      }
    };
  };
})();
