#!/usr/bin/env bash
# Copies the redesign into dist/test/ and adjusts it for a preview at /test:
# share tags point at /test/, and search engines are told not to index it.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist/test
cp ../../kevinsarasom/index.html dist/test/index.html
cp -R ../../kevinsarasom/media dist/test/media
python3 - <<'PY'
p = "dist/test/index.html"
s = open(p, encoding="utf-8").read()
s = s.replace('<meta property="og:url" content="https://kevinsarasom.com/">', '<meta property="og:url" content="https://kevinsarasom.com/test/">')
s = s.replace("https://kevinsarasom.com/media/og.jpg", "https://kevinsarasom.com/test/media/og.jpg")
s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex, nofollow">', 1)
assert "noindex" in s and "/test/media/og.jpg" in s and "/test/\">" in s
open(p, "w", encoding="utf-8").write(s)
PY
echo "Built dist/test ($(du -sh dist | cut -f1))"
