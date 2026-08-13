from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

pkg_path = ROOT / 'package.json'
pkg = json.loads(pkg_path.read_text(encoding='utf-8'))
if pkg.get('version') != '0.4.1-beta.11':
    raise SystemExit(f"Version inattendue: {pkg.get('version')}")

pkg.setdefault('build', {})['extraResources'] = [
    {'from': 'build/icon.ico', 'to': 'icon.ico'}
]
pkg['build'].setdefault('win', {})['icon'] = 'build/icon.ico'
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

main_path = ROOT / 'desktop' / 'main.cjs'
main = main_path.read_text(encoding='utf-8')
main = main.replace("path.join(process.resourcesPath, 'icon.png')", "path.join(process.resourcesPath, 'icon.ico')")
main = main.replace("path.join(__dirname, '..', 'build', 'icon.png')", "path.join(__dirname, '..', 'build', 'icon.ico')")
main_path.write_text(main, encoding='utf-8')

print('beta11: même ICO multi-résolution pour Electron et l’exécutable Windows')
