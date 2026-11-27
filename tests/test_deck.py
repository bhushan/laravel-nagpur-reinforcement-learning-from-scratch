"""Checks for the built deck (index.html).

Run:  python3 -m unittest discover -s tests -v
Needs: python3 (stdlib only). The browser tests also need Google Chrome and are
skipped when it is not installed.
"""
import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# The three vendored fonts are Latin subsets. A character outside this set
# silently renders in a fallback face, so the deck must not use one.
FONT_RANGES = [
    (0x0000, 0x00FF), (0x0131, 0x0131), (0x0152, 0x0153), (0x02BB, 0x02BC),
    (0x02C6, 0x02C6), (0x02DA, 0x02DA), (0x02DC, 0x02DC), (0x0304, 0x0304),
    (0x0308, 0x0308), (0x0329, 0x0329), (0x2000, 0x206F), (0x20AC, 0x20AC),
    (0x2122, 0x2122), (0x2191, 0x2191), (0x2193, 0x2193), (0x2212, 0x2212),
    (0x2215, 0x2215), (0xFEFF, 0xFEFF), (0xFFFD, 0xFFFD),
]


def in_font(ch):
    cp = ord(ch)
    return any(lo <= cp <= hi for lo, hi in FONT_RANGES)


class Slide:
    def __init__(self, attrs):
        self.attrs = dict(attrs)
        self.notes = ""
        self.text = ""


class DeckParser(HTMLParser):
    """Collects <section class="slide"> elements, their attributes and notes."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.slides = []
        self.depth_stack = []  # stack of tag names while inside a slide
        self.in_notes = 0
        self.skip = 0  # inside script/style
        self.all_text = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("script", "style"):
            self.skip += 1
        if tag == "section" and "slide" in (a.get("class") or "").split():
            self.slides.append(Slide(attrs))
            self.depth_stack = ["section"]
            return
        if self.depth_stack:
            if tag not in ("br", "img", "input", "meta", "link", "path", "circle", "rect", "line", "stop", "use", "polyline", "ellipse", "hr"):
                self.depth_stack.append(tag)
            if tag == "aside" and "notes" in (a.get("class") or "").split():
                self.in_notes = len(self.depth_stack)

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
        if self.depth_stack:
            if self.in_notes and len(self.depth_stack) == self.in_notes and tag == "aside":
                self.in_notes = 0
            if self.depth_stack and self.depth_stack[-1] == tag:
                self.depth_stack.pop()

    def handle_data(self, data):
        if self.skip:
            return
        self.all_text.append(data)
        if self.depth_stack and self.slides:
            if self.in_notes:
                self.slides[-1].notes += data
            else:
                self.slides[-1].text += data


def parse():
    p = DeckParser()
    p.feed(INDEX.read_text(encoding="utf-8"))
    return p


class StaticChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        assert INDEX.exists(), "index.html missing: run `python3 build.py`"
        cls.html = INDEX.read_text(encoding="utf-8")
        cls.parsed = parse()
        cls.slides = cls.parsed.slides

    def test_it_is_a_single_self_contained_file(self):
        # No remote asset of any kind. Outbound <a href> links are fine.
        bad = re.findall(r'(?:src|srcset|poster)\s*=\s*["\']\s*(?:https?:)?//', self.html)
        bad += re.findall(r'<link[^>]+href\s*=\s*["\']\s*(?:https?:)?//', self.html)
        bad += re.findall(r'@import\s+(?:url\()?["\']?\s*(?:https?:)?//', self.html)
        bad += re.findall(r'url\(\s*["\']?\s*(?:https?:)?//', self.html)
        bad += re.findall(r'\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(', self.html)
        self.assertEqual(bad, [])

    def test_content_security_policy_blocks_the_network(self):
        # Served from GitHub Pages: the page may run only its own inline code and load nothing remote.
        m = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)">', self.html)
        self.assertTrue(m, "CSP meta tag missing")
        csp = m.group(1)
        for rule in ("default-src 'none'", "connect-src 'none'", "base-uri 'none'", "form-action 'none'",
                     "img-src data:", "font-src data:", "object-src 'none'"):
            self.assertIn(rule, csp)
        self.assertNotRegex(csp, r"https?:|\*", "CSP must not allow any remote origin")
        self.assertLess(self.html.index("Content-Security-Policy"), self.html.index("<style"), "CSP must come before any style or script")
        self.assertIn('<meta name="referrer" content="no-referrer">', self.html)

    def test_portrait_is_a_square_jpeg(self):
        import base64, struct
        data = base64.b64decode((ROOT / "assets" / "portrait.b64").read_text())
        self.assertEqual(data[:2], b"\xff\xd8", "portrait must be a JPEG")
        i = 2
        while i < len(data):
            marker, size = data[i + 1], struct.unpack(">H", data[i + 2:i + 4])[0]
            if marker in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack(">HH", data[i + 5:i + 9])
                break
            i += 2 + size
        self.assertEqual(w, h, f"portrait is {w}x{h}, want square")
        self.assertGreaterEqual(w, 400)

    def test_new_tab_links_cannot_reach_back(self):
        for tag in re.findall(r'<a [^>]*target="_blank"[^>]*>', self.html):
            self.assertIn("noopener", tag)
            self.assertIn("noreferrer", tag)

    def test_no_unresolved_build_placeholders(self):
        self.assertNotIn("{{", self.html)

    def test_slide_count_is_between_ten_and_fifteen(self):
        self.assertTrue(10 <= len(self.slides) <= 15, f"{len(self.slides)} slides, want 10 to 15")

    def test_every_slide_has_title_section_and_duration(self):
        for i, s in enumerate(self.slides, 1):
            for key in ("data-title", "data-section", "data-dur"):
                self.assertTrue(s.attrs.get(key), f"slide {i} missing {key}")
            self.assertTrue(s.attrs["data-dur"].isdigit(), f"slide {i} data-dur must be whole seconds")

    def test_every_slide_has_speaker_notes(self):
        for i, s in enumerate(self.slides, 1):
            self.assertGreater(len(s.notes.strip()), 60, f"slide {i} ({s.attrs.get('data-title')}) needs notes")

    def test_durations_add_up_to_forty_five_minutes(self):
        total = sum(int(s.attrs["data-dur"]) for s in self.slides)
        self.assertTrue(2670 <= total <= 2730, f"planned time is {total}s, want about 2700s")

    def test_tdd_section_is_about_five_minutes(self):
        tdd = sum(int(s.attrs["data-dur"]) for s in self.slides if s.attrs["data-section"] == "TDD")
        self.assertTrue(285 <= tdd <= 315, f"TDD is {tdd}s, want about 300s")

    def test_opening_is_short(self):
        opening = sum(int(s.attrs["data-dur"]) for s in self.slides if s.attrs["data-section"] == "Opening")
        self.assertLessEqual(opening, 180)

    def test_the_talk_runs_in_the_requested_order(self):
        order = []
        for s in self.slides:
            sec = s.attrs["data-section"]
            if not order or order[-1] != sec:
                order.append(sec)
        self.assertEqual(order, ["Opening", "TDD", "From TDD to RL", "Anatomy of RL", "Real world"])

    def test_no_en_or_em_dashes(self):
        # House writing rule: commas, colons, periods or a plain hyphen instead.
        self.assertNotIn("–", self.html)
        self.assertNotIn("—", self.html)

    def test_every_character_exists_in_the_vendored_fonts(self):
        text = "".join(self.parsed.all_text)
        text += " ".join(re.findall(r'(?:title|aria-label|alt|placeholder)="([^"]*)"', self.html))
        missing = sorted({c for c in text if not in_font(c) and not c.isspace()})
        self.assertEqual(missing, [], "characters the fonts cannot draw: " + " ".join(f"{c}(U+{ord(c):04X})" for c in missing))

    def test_event_details_are_filled_in(self):
        self.assertNotIn("[event name]", self.html)
        self.assertNotIn("[date]", self.html)
        self.assertIn("Laravel Nagpur", self.html)
        self.assertIn("27 Nov 2026", self.html)

    def test_speaker_identity_is_present(self):
        self.assertIn("Bhushan Gaikwad", self.html)
        self.assertIn("Alfred Scholar", self.html)

    def test_no_zoom_stage_directions_from_the_old_talk(self):
        low = self.html.lower()
        for phrase in ("camera on", "camera off", "type 1 in chat", "chat poll"):
            self.assertNotIn(phrase, low)

    def test_honest_about_training_status(self):
        # No RL training has been run yet. The deck must say so on the case-study slides.
        case = " ".join(s.text + s.notes for s in self.slides if s.attrs["data-section"] == "Real world").lower()
        self.assertIn("not trained yet", case)
        self.assertIn("0 of 7", case)

    def test_keyboard_help_names_the_keys(self):
        # Presenter-only: the key list sits inside the speaker-notes drawer.
        keys = re.search(r'<div class="notes-drawer".*?<p class="keys">(.*?)</p>', self.html, re.S)
        self.assertTrue(keys, "key help missing from the notes drawer")
        for key in ("Esc", "notes", "full screen", "A auto-play"):
            self.assertIn(key, keys.group(1))

    def test_autoplay_key_is_documented(self):
        self.assertIn("A auto-play", self.html)

    def test_prefers_reduced_motion_is_respected(self):
        self.assertIn("prefers-reduced-motion", self.html)

    def test_no_presenter_instructions_on_screen(self):
        # The audience sees slides, not key bindings. Key help lives only in the notes drawer.
        screen = " ".join(s.text for s in self.slides)
        shell = re.sub(r'<div class="notes-drawer".*?<p class="keys">.*?</p>', "", self.html.split("</main>")[-1], flags=re.S)
        shell = re.sub(r"<script.*?</script>|<style.*?</style>", "", shell, flags=re.S)
        shell_text = re.sub(r"<[^>]+>", " ", shell)
        for where, text in (("slides", screen), ("chrome", shell_text)):
            for phrase in ("press ", "click", "esc ", "esc,", "forward key", "a auto-play"):
                self.assertNotIn(phrase, text.lower(), f"instruction '{phrase.strip()}' visible in {where}")
        js = " ".join(re.findall(r"<script[^>]*>(.*?)</script>", self.html, re.S))
        self.assertNotIn("demo-hint", js, "a widget still prints an instruction line")

    def test_real_world_examples_slide_is_one_view_and_thank_you_closes(self):
        m = re.search(r'<section class="slide"[^>]*data-title="RL in the real world".*?</section>', self.html, re.S)
        self.assertTrue(m, "RL in the real world slide missing")
        body = re.sub(r'<aside class="notes".*?</aside>', "", m.group(0), flags=re.S)
        self.assertEqual(len(re.findall(r'<div class="pane[" ]', body)), 1, "examples should be a single view")
        text = re.sub(r"<[^>]+>", " ", body)
        for name in ("AlphaGo", "Data centre cooling", "ChatGPT", "DeepSeek-R1", "CoastRunners"):
            self.assertIn(name, text)
        self.assertLessEqual(len(text.split()), 90, "examples slide should stay short")
        self.assertEqual(re.findall(r"\b(?:19|20)\d\d\b", text), [], "no years on the examples slide")
        for row in ("AlphaGo</b>, Game", "CoastRunners</b>, Game", "ChatGPT</b>, Chat assistant"):
            self.assertIn(row, body)
        self.assertEqual(self.slides[-2].attrs.get("data-title"), "RL in the real world")
        last = self.slides[-1]
        self.assertEqual(last.attrs.get("data-title"), "Thank you")
        self.assertIn("A test suite is not just a safety net. It is a reward function.", last.text)
        self.assertIn("Bhushan Gaikwad", last.text)

    def test_sandbox_to_learning_slides_are_simple(self):
        # One idea per view: few views, few words on screen. Detail lives in the notes.
        for title in ("Anatomy 2", "Anatomy 3"):
            m = re.search(r'<section class="slide"[^>]*data-title="' + title + r'[^"]*".*?</section>', self.html, re.S)
            self.assertTrue(m, f"{title} slide missing")
            body = re.sub(r'<aside class="notes".*?</aside>', "", m.group(0), flags=re.S)
            panes = re.split(r'<div class="pane[" ]', body)[1:]
            self.assertLessEqual(len(panes), 4, f"{title} has {len(panes)} views, want at most 4")
            for p in panes:
                name = re.search(r'data-pane="([^"]*)"', p).group(1)
                words = len(re.sub(r"<[^>]+>", " ", p).split())
                self.assertLessEqual(words, 60, f"{title} / {name}: {words} words on screen, want at most 60")


def run_page(query, attr, width=1920, height=1080):
    profile = tempfile.mkdtemp(prefix="rl-deck-chrome-")
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
           f"--user-data-dir={profile}", f"--window-size={width},{height}",
           "--virtual-time-budget=20000", "--dump-dom", INDEX.as_uri() + query]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    try:
        out, _ = proc.communicate(timeout=120)
    finally:
        if proc.poll() is None:
            proc.kill()
        shutil.rmtree(profile, ignore_errors=True)
    m = re.search(attr + r'="([^"]*)"', out)
    return json.loads(m.group(1).replace("&quot;", '"').replace("&amp;", "&")) if m else None


def run_selftest(width, height):
    profile = tempfile.mkdtemp(prefix="rl-deck-chrome-")
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
           f"--user-data-dir={profile}", f"--window-size={width},{height}",
           "--virtual-time-budget=240000", "--dump-dom", INDEX.as_uri() + "?selftest"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    try:
        out, _ = proc.communicate(timeout=300)
    finally:
        if proc.poll() is None:
            proc.kill()  # by PID, never by name
        shutil.rmtree(profile, ignore_errors=True)
    m = re.search(r'data-selftest="([^"]*)"', out)
    return json.loads(m.group(1).replace("&quot;", '"').replace("&amp;", "&")) if m else None


@unittest.skipUnless(os.path.exists(CHROME), "Google Chrome not installed")
class BrowserChecks(unittest.TestCase):
    """Loads the deck in headless Chrome at three sizes. At each size every slide is
    stepped from 0 to its last step and back, and every intermediate state is checked."""

    SIZES = [(1920, 1080), (1512, 982), (1280, 720)]

    @classmethod
    def setUpClass(cls):
        cls.reports = {size: run_selftest(*size) for size in cls.SIZES}

    def each(self):
        for size, rep in self.reports.items():
            self.assertIsNotNone(rep, f"{size}: the ?selftest hook did not run")
            yield size, rep

    def test_no_javascript_errors(self):
        for size, rep in self.each():
            self.assertEqual(rep["errors"], [], size)

    def test_nothing_overflows_at_any_step(self):
        for size, rep in self.each():
            self.assertEqual(rep["overflow"], [], size)

    def test_no_code_line_is_cut_off(self):
        for size, rep in self.each():
            self.assertEqual(rep["truncated"], [], size)

    def test_every_slide_was_visited_and_stepped(self):
        for size, rep in self.each():
            self.assertEqual(rep["visited"], rep["total"], size)
            self.assertGreater(rep["steps"], rep["total"] * 2, size)

    def test_every_widget_boots_and_steps(self):
        for size, rep in self.each():
            self.assertEqual(rep["widgetFailures"], [], size)

    def test_step_tracker_never_moves(self):
        # The ten-step tracker is a fixed landmark: same height on every view of every anatomy slide.
        for size, rep in self.each():
            tops = rep.get("trackerTops", [])
            self.assertTrue(tops, f"{size}: no tracker measured")
            self.assertEqual(len(set(tops)), 1, f"{size}: tracker sits at {sorted(set(tops))}")


@unittest.skipUnless(os.path.exists(CHROME), "Google Chrome not installed")
class ArrowWalk(unittest.TestCase):
    """Press only arrow keys through the deck. Every view must arrive fully revealed."""

    @classmethod
    def setUpClass(cls):
        cls.walk = run_page("?walktest", "data-walktest")

    def test_walk_ran(self):
        self.assertIsNotNone(self.walk)

    def test_right_arrow_moves_exactly_one_slide(self):
        n = len(parse().slides)
        self.assertEqual([x.split(":")[0] for x in self.walk["slideMode"]], [str(i) for i in range(n)])

    def test_every_view_is_visited_once_in_view_mode_and_mirrors_back(self):
        fwd = self.walk["viewMode"]
        self.assertEqual(len(fwd), len(set(fwd)), "a view was visited twice")
        self.assertGreater(len(fwd), len(parse().slides), "view mode must reach more views than slides")
        self.assertEqual(self.walk["back"], list(reversed(fwd))[1:])

    def test_nothing_waits_for_another_key_on_arrival(self):
        self.assertEqual(self.walk["problems"], [])

    def test_no_errors_while_walking(self):
        self.assertEqual(self.walk["errors"], [])


if __name__ == "__main__":
    unittest.main()
