#!/usr/bin/env bash
# Dart defines for guest and waiter release builds.
# TURNSTILE_SITE_KEY is the public Turnstile site key (not the secret).
# Override by exporting TURNSTILE_SITE_KEY before invoking this script.
site_key="${TURNSTILE_SITE_KEY:-0x4AAAAAAGI4qZ7befLdSFze}"
printf -- '--dart-define=TURNSTILE_SITE_KEY=%s\n' "$site_key"
