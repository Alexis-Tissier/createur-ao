from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

app_path = ROOT / 'src' / 'AppV4.jsx'
a = app_path.read_text(encoding='utf-8')
old = "const APP_ICON_DATA_URL = `data:image/png;base64,${appIconBase64.trim()}`;"
new = "const APP_ICON_DATA_URL = `data:image/png;base64,${appIconBase64.replace(/\\s+/g,'')}`;"
if old not in a:
    raise SystemExit('motif APP_ICON_DATA_URL introuvable')
a = a.replace(old, new, 1)
app_path.write_text(a, encoding='utf-8')

pkg_path = ROOT / 'package.json'
pkg = json.loads(pkg_path.read_text(encoding='utf-8'))
pkg['version'] = '0.4.1-beta.7'
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('beta7 icon data URL fixed')
