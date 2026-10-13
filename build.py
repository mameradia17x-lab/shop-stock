#!/usr/bin/env python3
"""Join src/ parts into one index.html. Usage: build.py [--preview OUTDIR]"""
import sys, os
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, 'src')
preview = '--preview' in sys.argv
out = sys.argv[sys.argv.index('--preview') + 1] if preview else here
r = lambda n: open(os.path.join(src, n), encoding='utf-8').read()
order = ['core.js', 'i18n.js', 'ui.js', 'logic.js', 'views.js', 'sheets.js', 'sheets2.js', 'actions.js', 'boot.js']
js = '\n'.join(r(n) for n in order)
if preview:
    js = js.replace("var KEY='shop-stock.v1'", "var KEY='shop-stock.preview'")
    js = "window.__REGISTER_SW__=false;\n" + js
else:
    js = "window.__REGISTER_SW__=true;\n" + js
js = js.replace("'use strict';\n", '')
title = 'Shop Stock (preview)' if preview else 'Shop Stock'
manifest = 'manifest.webmanifest'
html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="theme-color" content="#1B1B1D">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="{title}">
<link rel="manifest" href="{manifest}">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Unbounded:wght@600;700&family=Noto+Sans+Ethiopic:wght@400;600;700&display=swap">
<style>
{r('style.css')}
</style>
</head>
<body>
<div id="app"></div>
<div id="sheetRoot"></div>
<div id="confRoot"></div>
<nav class="nav" id="nav" aria-label="Main"><div class="in" id="navIn"></div></nav>
<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
<script>
(function(){{
'use strict';
{js}
}})();
</script>
</body>
</html>
'''
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
print('wrote', os.path.join(out, 'index.html'), len(html))
