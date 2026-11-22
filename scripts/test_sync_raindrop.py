import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))

import sync_raindrop as sr

BASE = {
    "_id": 1,
    "title": "BlueStore",
    "link": "https://ceph.io/a",
    "domain": "ceph.io",
    "created": "2026-11-21T03:00:00.000Z",
    "tags": ["ceph"],
    "note": "good",
    "excerpt": "about bluestore",
}


def item(**over):
    return {**BASE, **over}


class ToEntryTests(unittest.TestCase):
    def test_to_entry_maps_fields(self):
        self.assertEqual(
            sr.to_entry(item()),
            {
                "title": "BlueStore",
                "url": "https://ceph.io/a",
                "site": "ceph.io",
                "date": "2026-11-21",
                "tags": ["ceph"],
                "note": "good",
                "excerpt": "about bluestore",
            },
        )

    def test_date_uses_vietnam_time(self):
        e = sr.to_entry(item(created="2026-11-21T18:30:00.000Z"))
        self.assertEqual(e["date"], "2026-11-22")

    def test_tags_normalized(self):
        e = sr.to_entry(item(tags=["Ceph", " ceph ", "Storage", ""]))
        self.assertEqual(e["tags"], ["ceph", "storage"])

    def test_missing_fields_default_empty(self):
        raw = item(title="  Hello  ")
        for k in ("note", "excerpt", "tags"):
            del raw[k]
        e = sr.to_entry(raw)
        self.assertEqual((e["note"], e["excerpt"], e["tags"]), ("", "", []))
        self.assertEqual(e["title"], "Hello")
        e = sr.to_entry(item(note="  hi \n"))
        self.assertEqual(e["note"], "hi")

    def test_title_falls_back_to_url(self):
        e = sr.to_entry(item(title=""))
        self.assertEqual(e["title"], e["url"])

    def test_non_http_link_skipped(self):
        self.assertIsNone(sr.to_entry(item(link="javascript:alert(1)")))


class FetchAllTests(unittest.TestCase):
    def stub(self, sizes):
        pages = []

        def get_page(n):
            pages.append(n)
            size = sizes[n] if n < len(sizes) else 0
            return {"result": True, "items": [{"_id": n * 100 + i} for i in range(size)]}

        return get_page, pages

    def test_fetch_all_stops_on_empty_page(self):
        get_page, pages = self.stub([50, 50, 0])
        self.assertEqual(len(sr.fetch_all(get_page)), 100)
        self.assertEqual(pages, [0, 1, 2])

    def test_fetch_all_stops_on_short_page(self):
        get_page, pages = self.stub([50, 3])
        self.assertEqual(len(sr.fetch_all(get_page)), 53)
        self.assertEqual(pages, [0, 1])

    def test_fetch_all_raises_on_result_false(self):
        with self.assertRaises(sr.SyncError):
            sr.fetch_all(lambda n: {"result": False, "errorMessage": "x"})


class BuildAndRenderTests(unittest.TestCase):
    def test_build_entries_newest_first(self):
        items = [
            item(_id=1, created="2026-11-01T00:00:00.000Z", link="https://a.example/1"),
            item(_id=2, created="2026-11-20T00:00:00.000Z", link="https://a.example/2"),
            item(_id=3, created="2026-11-25T00:00:00.000Z", link="ftp://nope"),
        ]
        entries = sr.build_entries(items)
        self.assertEqual([e["date"] for e in entries], ["2026-11-20", "2026-11-01"])

    def test_render_stable_and_unicode(self):
        entries = [sr.to_entry(item(title="Tiếng Việt"))]
        out = sr.render(entries)
        self.assertEqual(out, sr.render(entries))
        self.assertTrue(out.endswith("\n"))
        self.assertIn("Tiếng Việt", out)

    def test_check_not_wiping(self):
        with self.assertRaises(sr.SyncError):
            sr.check_not_wiping('[{"title":"x"}]', [])
        sr.check_not_wiping(None, [])
        sr.check_not_wiping("[]", [])


class MainTests(unittest.TestCase):
    def test_failed_run_leaves_existing_file_untouched(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "reading.json")
            old = '[{"title": "keep me"}]\n'
            with open(out, "w", encoding="utf-8") as f:
                f.write(old)
            before = os.stat(out).st_mtime_ns
            env = {"RAINDROP_TOKEN": "t", "RAINDROP_COLLECTION_ID": "1"}
            with mock.patch.dict(os.environ, env), mock.patch.object(
                sr, "fetch_all", side_effect=sr.SyncError("boom")
            ):
                self.assertEqual(sr.main(["--output", out]), 1)
            with open(out, encoding="utf-8") as f:
                self.assertEqual(f.read(), old)
            self.assertEqual(os.stat(out).st_mtime_ns, before)
            self.assertEqual(os.listdir(d), ["reading.json"])

    def test_crash_during_write_leaves_existing_file_untouched(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "reading.json")
            with open(out, "w", encoding="utf-8") as f:
                f.write("old\n")
            with mock.patch.object(sr.os, "replace", side_effect=OSError("disk")):
                with self.assertRaises(OSError):
                    sr.write_atomically(out, "new\n")
            with open(out, encoding="utf-8") as f:
                self.assertEqual(f.read(), "old\n")
            self.assertEqual(os.listdir(d), ["reading.json"])


if __name__ == "__main__":
    unittest.main()
