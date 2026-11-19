#!/usr/bin/env python3
"""Tests for the API upstream swap used by roll-api.sh."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from nginx_roll import rewrite  # noqa: E402

SAMPLE = """\
upstream cullinos_api {
    server 127.0.0.1:3000;
    keepalive 32;
}

upstream other_api {
    server 127.0.0.1:3001;
}

server {
    listen 443 ssl http2;
    location / {
        proxy_pass http://cullinos_api;
    }
}

server {
    listen 80;
    location / {
        proxy_pass http://127.0.0.1:3000;
    }
    location /marketing/ {
        proxy_pass http://127.0.0.1:5180;
    }
    location /sync/ {
        proxy_pass http://127.0.0.1:3001;
    }
    location /wide/ {
        proxy_pass http://127.0.0.1:30100;
    }
}
"""


class RewriteTests(unittest.TestCase):
    def test_moves_api_listeners_to_standby_port(self) -> None:
        updated, hits = rewrite(SAMPLE, "3010")
        self.assertEqual(hits, 2)
        self.assertIn("server 127.0.0.1:3010;", updated)
        self.assertIn("proxy_pass http://127.0.0.1:3010;", updated)
        self.assertIn("proxy_pass http://cullinos_api;", updated)
        self.assertIn("proxy_pass http://127.0.0.1:5180;", updated)
        self.assertIn("server 127.0.0.1:3001;", updated)
        self.assertIn("proxy_pass http://127.0.0.1:3001;", updated)
        self.assertIn("proxy_pass http://127.0.0.1:30100;", updated)
        self.assertNotIn("127.0.0.1:3000", updated)

    def test_round_trip(self) -> None:
        moved, _ = rewrite(SAMPLE, "3010")
        restored, hits = rewrite(moved, "3000")
        self.assertEqual(hits, 2)
        self.assertEqual(restored, SAMPLE)

    def test_no_match(self) -> None:
        text = "proxy_pass http://cullinos_web;\n"
        updated, hits = rewrite(text, "3010")
        self.assertEqual(hits, 0)
        self.assertEqual(updated, text)

    def test_leaves_unrelated_ports(self) -> None:
        text = "\n".join(
            [
                "upstream other {",
                "    server 127.0.0.1:3001;",
                "}",
                "proxy_pass http://127.0.0.1:3001;",
                "proxy_pass http://127.0.0.1:5180;",
                "proxy_pass http://127.0.0.1:30100;",
                "proxy_pass http://127.0.0.1:3002;",
                "",
            ]
        )
        updated, hits = rewrite(text, "3010")
        self.assertEqual(hits, 0)
        self.assertEqual(updated, text)
        updated, hits = rewrite(text, "3000")
        self.assertEqual(hits, 0)
        self.assertEqual(updated, text)

    def test_rejects_other_ports(self) -> None:
        for port in ("8080", "3001", "3002", "30100"):
            with self.assertRaises(ValueError):
                rewrite(SAMPLE, port)


if __name__ == "__main__":
    unittest.main()
