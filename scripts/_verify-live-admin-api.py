#!/usr/bin/env python3
import re
import urllib.request

html = urllib.request.urlopen("https://admin.cullinos.com/", timeout=15).read().decode()
assets = re.findall(r'src="(/assets/[^"]+)"', html)
print("assets", assets)
data = urllib.request.urlopen("https://admin.cullinos.com" + assets[0], timeout=30).read().decode(
    "utf-8", "replace"
)
print("viteApiUrl", re.findall(r'viteApiUrl:"([^"]+)"', data))
print("has api.example.com", "api.example.com" in data)
print("has api.cullinos.com/api/v1", "api.cullinos.com/api/v1" in data)
