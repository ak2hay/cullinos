#!/usr/bin/env python3
import re
import urllib.request

data = (
    urllib.request.urlopen("https://admin.cullinos.com/assets/index-DG6rVvpu.js", timeout=30)
    .read()
    .decode("utf-8", "replace")
)
# Find calls to SS( which is resolveViteApiBase
for m in re.finditer(r"SS\(\{[^}]{0,200}\}\)", data):
    print(m.group(0))
# Also search viteApiUrl patterns
for m in re.finditer(r"viteApiUrl:[^,}]{0,80}", data):
    print("viteApiUrl:", m.group(0))
for m in re.finditer(r"isProd:[^,}]{0,40}", data):
    s = m.group(0)
    if "viteApiUrl" in data[max(0, m.start() - 80) : m.end() + 20]:
        print("near:", data[max(0, m.start() - 80) : m.end() + 20])
