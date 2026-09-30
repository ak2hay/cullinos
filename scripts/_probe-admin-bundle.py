#!/usr/bin/env python3
import re
import urllib.request

data = (
    urllib.request.urlopen("https://admin.cullinos.com/assets/index-DG6rVvpu.js", timeout=30)
    .read()
    .decode("utf-8", "replace")
)
idx = data.find("organizations/current")
print("org idx", idx)
print(data[max(0, idx - 250) : idx + 100])
print("api.cullinos count", data.count("api.cullinos"))
print("localhost count", data.count("localhost"))
print("/api/v1 count", data.count("/api/v1"))
# likely Vite inlines import.meta.env.VITE_API_URL as a string literal near fetch base
for needle in [
    "http://localhost:3000/api/v1",
    "https://api.cullinos.com/api/v1",
    "http://127.0.0.1:3000/api/v1",
    '"/api/v1"',
    "'/api/v1'",
]:
    print(repr(needle), data.count(needle))

# Find strings containing api/v1
found = sorted(set(re.findall(r"[\"']([^\"']*api/v1[^\"']*)[\"']", data)))
print("api/v1 string literals:")
for f in found[:40]:
    print(" ", f)
