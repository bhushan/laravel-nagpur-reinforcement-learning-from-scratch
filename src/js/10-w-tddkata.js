/* The TDD kata: the same cart test the room later sees used as a reward.
   Seven steps, driven by the forward key. Real test names from rl-gym's
   cart-add-001; the code is trimmed to fit the screen. */
(function () {
  'use strict';
  var Deck = window.Deck;

  var T1 = [
    "it('adds a product to a new cart', function () {",
    "    $mug = Product::factory()->create();",
    "    $url = '/api/carts/ada@example.com/items';",
    "",
    "    $this->postJson($url, ['product_id' => $mug->id, 'quantity' => 2])",
    "        ->assertOk()",
    "        ->assertJsonPath('data.items.0.quantity', 2);",
    "});"
  ];
  var T2 = [
    "",
    "it('adds the same product twice by increasing its quantity', function () {",
    "    $mug = Product::factory()->create();",
    "    $url = '/api/carts/ada@example.com/items';",
    "",
    "    $this->postJson($url, ['product_id' => $mug->id, 'quantity' => 2]);",
    "    $this->postJson($url, ['product_id' => $mug->id, 'quantity' => 3])",
    "        ->assertJsonCount(1, 'data.items')",
    "        ->assertJsonPath('data.items.0.quantity', 5);",
    "});"
  ];
  var ROUTE = ["// routes/api.php", "Route::post('/carts/{email}/items', [CartController::class, 'addItem']);", ""];
  var V1 = ROUTE.concat([
    "public function addItem(Request $request, string $email)",
    "{",
    "    $cart = Cart::firstOrCreate(['customer_email' => $email]);",
    "    $cart->items()->create($request->only('product_id', 'quantity'));",
    "",
    "    return response()->json(['data' => ['customer_email' => $email,",
    "        'items' => $cart->items()->get(['product_id', 'quantity'])]]);",
    "}"
  ]);
  var V2 = ROUTE.concat([
    "public function addItem(Request $request, string $email)",
    "{",
    "    $cart = Cart::firstOrCreate(['customer_email' => $email]);",
    "    $item = $cart->items()->firstOrNew(['product_id' => $request->product_id]);",
    "    $item->quantity += $request->quantity;",
    "    $item->save();",
    "",
    "    return response()->json(['data' => ['customer_email' => $email,",
    "        'items' => $cart->items()->get(['product_id', 'quantity'])]]);",
    "}"
  ]);
  var V3 = ROUTE.concat([
    "public function addItem(Request $request, string $email)",
    "{",
    "    $cart = Cart::firstOrCreate(['customer_email' => $email]);",
    "    $item = $cart->items()->firstOrNew(['product_id' => $request->product_id]);",
    "    $item->quantity += $request->quantity;",
    "    $item->save();",
    "",
    "    return $this->cartResponse($cart);",
    "}"
  ]);

  var B = function (cls, t) { return '<span class="badge ' + cls + '">' + t + '</span>'; };
  var run = function (head, rows, sum) {
    return '<div>' + head + '</div><div></div>' + rows.map(function (r) { return '<div>' + r + '</div>'; }).join('') + '<div></div><div class="dim">' + sum + '</div>';
  };
  var OK = '<span class="ok"> .  </span>', NO = '<span class="no"> F  </span>';
  var N1 = 'adds a product to a new cart', N2 = 'adds the same product twice by increasing its quantity';
  var R1 = run(B('fail', 'FAIL') + 'Tests\\Feature\\CartAddTest', [NO + N1, '<span class="dim">      Expected response status code [200] but received 404.</span>'], 'Tests:  <span class="no">1 failed</span>');
  var R2 = run(B('pass', 'PASS') + 'Tests\\Feature\\CartAddTest', [OK + N1], 'Tests:  <span class="ok">1 passed</span>');
  var R3 = run(B('fail', 'FAIL') + 'Tests\\Feature\\CartAddTest', [OK + N1, NO + N2, '<span class="dim">      Failed asserting that actual size 2 matches expected size 1.</span>'], 'Tests:  <span class="no">1 failed</span>, <span class="ok">1 passed</span>');
  var R4 = run(B('pass', 'PASS') + 'Tests\\Feature\\CartAddTest', [OK + N1, OK + N2], 'Tests:  <span class="ok">2 passed</span>');

  var STEPS = [
    { cap: 'An empty editor and a feature request.', phase: ['', 'ready'], test: [], impl: [], out: '' },
    { cap: 'Write the test first. It says what "correct" means before any code exists.', phase: ['red', 'red'], test: T1, impl: [], out: '' },
    { cap: 'Run it. It fails, as it must: there is no route yet.', phase: ['red', 'red'], test: T1, impl: [], out: R1 },
    { cap: 'Write the smallest code that could make it pass.', phase: ['green', 'green'], test: T1, impl: V1, out: R1 },
    { cap: 'Run it again. Green. We never told the test how the code works.', phase: ['green', 'green'], test: T1, impl: V1, out: R2 },
    { cap: 'A new requirement is a new failing test. Back to red.', phase: ['red', 'red'], test: T1.concat(T2), impl: V1, out: R3 },
    { cap: 'Fix it: repeat adds now merge into one line. Green again.', phase: ['green', 'green'], test: T1.concat(T2), impl: V2, out: R4 },
    { cap: 'Refactor with a safety net. Same tests, same verdict, cleaner code.', phase: ['refactor', 'refactor'], test: T1.concat(T2), impl: V3, out: R4 }
  ];

  function paint(pre, lines, prev) {
    var seen = {}; prev.forEach(function (l) { seen[l] = (seen[l] || 0) + 1; });
    pre.innerHTML = lines.map(function (l) {
      var fresh = seen[l] ? (seen[l]--, '') : ' fresh';
      return '<span class="l' + (l.trim() ? fresh : '') + '">' + (Deck.highlight(l, 'php') || ' ') + '</span>';
    }).join('');
  }

  Deck.widgets.tddkata = function (host) {
    host.classList.add('kata');
    host.innerHTML =
      '<div class="kata-top"><span class="phase">ready</span><span class="kata-cap"></span></div>' +
      '<div class="kata-grid"><div class="col">' +
      '<div class="win"><div class="win-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="win-name">tests/Feature/CartAddTest.php</span></div><pre class="code" data-k="test"></pre></div>' +
      '</div><div class="col">' +
      '<div class="win"><div class="win-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="win-name">app/Http/Controllers/CartController.php</span></div><pre class="code" data-k="impl"></pre></div>' +
      '<div class="win"><div class="win-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="win-name">php artisan test</span></div><div class="pest" data-k="out"></div></div>' +
      '</div></div>';
    var phase = host.querySelector('.phase'), cap = host.querySelector('.kata-cap');
    var pt = host.querySelector('[data-k=test]'), pi = host.querySelector('[data-k=impl]'), po = host.querySelector('[data-k=out]');
    var prevTest = [], prevImpl = [];
    function show(n, animate) {
      var s = STEPS[Deck.clamp(n, 0, STEPS.length - 1)];
      phase.className = 'phase ' + s.phase[0]; phase.textContent = s.phase[1];
      cap.textContent = s.cap;
      paint(pt, s.test, animate ? prevTest : s.test);
      paint(pi, s.impl, animate ? prevImpl : s.impl);
      po.innerHTML = s.out;
      prevTest = s.test; prevImpl = s.impl;
    }
    show(0);
    return {
      reset: function () { prevTest = []; prevImpl = []; show(0); },
      step: function (n) { show(n, true); }
    };
  };
})();
