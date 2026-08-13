from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'motif introuvable: {label}')
    return text.replace(old, new, 1)

app_path = ROOT / 'src' / 'AppV4.jsx'
a = app_path.read_text(encoding='utf-8')

a = replace_once(
    a,
    "import React, { useEffect, useMemo, useState } from 'react';\n",
    "import React, { useEffect, useMemo, useState } from 'react';\nimport appIconBase64 from './assets/app-icon.b64?raw';\n\nconst APP_ICON_DATA_URL = `data:image/png;base64,${appIconBase64.trim()}`;\n",
    'import app icon'
)

a = replace_once(
    a,
    '<button className="brand" onClick={() => setActive(\'create\')}><span className="brand-mark">C</span><span className="brand-name">Créateur d’AO</span></button>',
    '<button className="brand" onClick={() => setActive(\'create\')}><span className="brand-mark"><img src={APP_ICON_DATA_URL} alt=""/></span><span className="brand-name">Créateur d’AO</span></button>',
    'sidebar brand icon'
)
app_path.write_text(a, encoding='utf-8')

css_path = ROOT / 'src' / 'styles.css'
c = css_path.read_text(encoding='utf-8')
old = '.brand-mark{width:36px;height:36px;display:grid;place-items:center;flex:0 0 auto;border-radius:11px;background:var(--accent);color:#fff;font-size:15px;font-weight:850;box-shadow:0 7px 18px rgba(233,102,66,.18)}'
new = '.brand-mark{width:36px;height:36px;display:grid;place-items:center;flex:0 0 auto}.brand-mark img{display:block;width:36px;height:36px;object-fit:contain}'
c = replace_once(c, old, new, 'sidebar brand css')
css_path.write_text(c, encoding='utf-8')

pkg_path = ROOT / 'package.json'
pkg = json.loads(pkg_path.read_text(encoding='utf-8'))
pkg['version'] = '0.4.1-beta.6'
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('beta6 icon hotfix applied')
