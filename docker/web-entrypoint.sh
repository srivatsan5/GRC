#!/bin/sh
# Writes the browser's runtime settings from the container environment, then starts the app.
#   API_URL  public URL of the Pericope API, e.g. https://api.example.com
set -e
if [ -n "$API_URL" ]; then
  node -e '
    const url = new URL(process.env.API_URL); // throws on a malformed URL
    if (!/^https?:$/.test(url.protocol)) throw new Error("API_URL must be http(s)")
    const cfg = { apiUrl: url.origin + url.pathname.replace(/\/$/, "") }
    require("fs").writeFileSync("/app/public/runtime-config.js", "window.__PERICOPE_CONFIG__ = " + JSON.stringify(cfg) + ";\n")
    console.log("[web] API_URL = " + cfg.apiUrl)
  '
fi
exec "$@"
