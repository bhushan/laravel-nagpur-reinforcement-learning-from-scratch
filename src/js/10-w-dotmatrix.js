/* The attempt matrix: N attempts at one task, one dot per hidden test.
   ILLUSTRATIVE. It shows the shape of learning (mostly red, then not), it is
   not a recorded training run. */
(function () {
  'use strict';
  var Deck = window.Deck;
  Deck.widgets.dotmatrix = function (host, ctx) {
    var rows = +host.dataset.rows || 8, cols = +host.dataset.cols || 13;
    var rng = Deck.rng(ctx.seed + 3), round = 0, cells = [], rewards = [];
    host.classList.add('dotmatrix');
    var grid = Deck.el('div', 'dm-grid', null, host);
    for (var r = 0; r < rows; r++) {
      var row = Deck.el('div', 'dm-row', '<span class="dm-id">#' + (r + 1) + '</span>', grid), line = [];
      for (var c = 0; c < cols; c++) line.push(Deck.el('i', 'dm-dot', null, row));
      rewards.push(Deck.el('span', 'dm-rw', '', row));
      cells.push(line);
    }
    var cap = Deck.el('div', 'dm-cap', '', host);

    function paint() {
      var skill = Math.min(1, 0.05 + 0.09 * round), solved = 0;
      for (var r = 0; r < rows; r++) {
        var q = Deck.clamp(skill + (rng() - 0.5) * 0.34, 0, 1);
        var k = Math.round(q * cols), done = k === cols;
        if (done) solved++;
        var order = cells[r].map(function (_, i) { return i; }).sort(function () { return rng() - 0.5; });
        var pass = {}; order.slice(0, k).forEach(function (i) { pass[i] = 1; });
        for (var c = 0; c < cols; c++) {
          cells[r][c].style.transitionDelay = (c * 14) + 'ms';
          cells[r][c].className = 'dm-dot ' + (round === 0 ? '' : (pass[c] ? 'g' : 'r'));
        }
        rewards[r].textContent = round === 0 ? '' : (done ? '1.0' : '0.0');
        rewards[r].className = 'dm-rw' + (done ? ' g' : '');
      }
      cap.innerHTML = round === 0 ? 'round 0 · waiting' : 'round ' + round + ' · <b>' + solved + ' of ' + rows + '</b> attempts pass every test';
    }
    function tick() { round = round >= 12 ? 0 : round + 1; paint(); }
    var t = Deck.ticker(tick, 1150);
    paint();
    return {
      reset: function () { round = 0; paint(); },
      enter: function () { if (Deck.reduced()) { round = 9; paint(); } else { t.start(); } },
      leave: function () { t.stop(); }
    };
  };
})();
