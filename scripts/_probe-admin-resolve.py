#!/usr/bin/env python3
import urllib.request

data = (
    urllib.request.urlopen("https://admin.cullinos.com/assets/index-DG6rVvpu.js", timeout=30)
    .read()
    .decode("utf-8", "replace")
)
idx = data.find('wC="http://localhost:3000/api/v1"')
print(data[idx : idx + 450])
# also find API_BASE assignment usage near fetch
idx2 = data.find("signal:AbortSignal.timeout(2e4)")
print("\n--- fetch ---")
print(data[max(0, idx2 - 350) : idx2 + 80])
