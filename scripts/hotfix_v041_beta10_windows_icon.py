from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

pkg_path = ROOT / 'package.json'
pkg = json.loads(pkg_path.read_text(encoding='utf-8'))
pkg['version'] = '0.4.1-beta.10'
pkg['build']['extraResources'] = [{'from': 'build/icon.png', 'to': 'icon.png'}]
pkg['build']['win']['icon'] = 'build/icon.png'
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

main_path = ROOT / 'desktop' / 'main.cjs'
main = main_path.read_text(encoding='utf-8')
main = main.replace("path.join(process.resourcesPath, 'icon.ico')", "path.join(process.resourcesPath, 'icon.png')")
main = main.replace("path.join(__dirname, '..', 'build', 'icon.ico')", "path.join(__dirname, '..', 'build', 'icon.png')")
main_path.write_text(main, encoding='utf-8')

print('beta10: PNG natif utilisé par Electron et electron-builder')
