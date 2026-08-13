from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
app_path = ROOT / 'src' / 'AppV4.jsx'
app = app_path.read_text(encoding='utf-8')

old = '<img src="/app-icon.png" alt=""/>'
new = '<span aria-hidden="true" style={{width:36,height:36,borderRadius:11,display:\'grid\',placeItems:\'center\',background:\'linear-gradient(145deg,#f27a54,#df5838)\',border:\'1px solid rgba(145,63,38,.18)\',boxShadow:\'0 7px 18px rgba(233,102,66,.20), inset 0 1px 0 rgba(255,255,255,.28)\',color:\'#fff7ee\',fontFamily:\'Georgia,serif\',fontSize:21,fontWeight:700,lineHeight:1}}>C</span>'

if old in app:
    app = app.replace(old, new, 1)
elif new not in app:
    raise SystemExit('Logo attendu introuvable dans AppV4.jsx')
app_path.write_text(app, encoding='utf-8')

pkg_path = ROOT / 'package.json'
pkg = json.loads(pkg_path.read_text(encoding='utf-8'))
pkg['version'] = '0.4.1-beta.9'
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('beta9: logo inline + version prête')
