#!/usr/bin/env python3
import re
from pathlib import Path

for app in ["admin", "super-admin", "kds", "management", "pos", "app-ops", "kiosk"]:
    assets = Path(f"apps/{app}/dist/assets")
    if not assets.is_dir():
        print(app, "NO DIST")
        continue
    urls = set()
    for f in assets.glob("*.js"):
        data = f.read_text(encoding="utf-8", errors="replace")
        urls.update(re.findall(r'viteApiUrl:"([^"]+)"', data))
        if "https://api.example.com" in data:
            urls.add("HAS_api.example.com_literal")
    print(app, urls or {"(no viteApiUrl found)"})
