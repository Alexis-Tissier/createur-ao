from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / 'build'
BUILD.mkdir(parents=True, exist_ok=True)

SIZE = 1024
BG_TOP = (242, 122, 84, 255)   # #f27a54
BG_BOTTOM = (223, 88, 56, 255) # #df5838
CREAM = (255, 247, 238, 255)   # #fff7ee

img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))

# Ombre douce, équivalente au rendu CSS du logo dans l'application.
shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
shadow_draw = ImageDraw.Draw(shadow)
margin = 92
radius = 300
shadow_draw.rounded_rectangle(
    (margin, margin + 26, SIZE - margin, SIZE - margin + 26),
    radius=radius,
    fill=(110, 46, 28, 82),
)
shadow = shadow.filter(ImageFilter.GaussianBlur(34))
img.alpha_composite(shadow)

# Masque du carré arrondi.
mask = Image.new('L', (SIZE, SIZE), 0)
mask_draw = ImageDraw.Draw(mask)
mask_draw.rounded_rectangle((margin, margin, SIZE - margin, SIZE - margin), radius=radius, fill=255)

# Dégradé diagonal CSS-like : #f27a54 -> #df5838.
grad = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
p = grad.load()
for y in range(SIZE):
    for x in range(SIZE):
        t = max(0.0, min(1.0, (x + y) / (2 * (SIZE - 1))))
        p[x, y] = tuple(round(BG_TOP[i] * (1 - t) + BG_BOTTOM[i] * t) for i in range(4))
img.alpha_composite(Image.composite(grad, Image.new('RGBA', (SIZE, SIZE), (0,0,0,0)), mask))

# Liseré léger comme border: 1px rgba(...)
draw = ImageDraw.Draw(img)
draw.rounded_rectangle(
    (margin, margin, SIZE - margin, SIZE - margin),
    radius=radius,
    outline=(145, 63, 38, 46),
    width=5,
)

# Le logo React actuel utilise Georgia en gras. On prend georgiab.ttf sur Windows.
font_candidates = [
    Path(os.environ.get('WINDIR', r'C:\\Windows')) / 'Fonts' / 'georgiab.ttf',
    Path(os.environ.get('WINDIR', r'C:\\Windows')) / 'Fonts' / 'georgia.ttf',
    Path('/usr/share/fonts/truetype/msttcorefonts/Georgia_Bold.ttf'),
    Path('/usr/share/fonts/truetype/msttcorefonts/Georgia.ttf'),
]
font_path = next((p for p in font_candidates if p.exists()), None)
if not font_path:
    raise SystemExit('Police Georgia introuvable pour générer le logo Windows.')

font = ImageFont.truetype(str(font_path), 610)
text = 'C'
# ancrage optique centré
bbox = draw.textbbox((0, 0), text, font=font)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
x = (SIZE - tw) / 2 - bbox[0] - 8
y = (SIZE - th) / 2 - bbox[1] - 36
draw.text((x, y), text, font=font, fill=CREAM)

# PNG propre, utilisé par Electron pour la fenêtre.
png = img.resize((256, 256), Image.Resampling.LANCZOS)
png_path = BUILD / 'icon.png'
png.save(png_path, format='PNG', optimize=True)

# ICO multi-résolution : indispensable pour barre de titre, Alt+Tab, barre des tâches,
# menu Démarrer et raccourcis Windows.
ico_path = BUILD / 'icon.ico'
png.save(
    ico_path,
    format='ICO',
    sizes=[(16,16),(20,20),(24,24),(32,32),(40,40),(48,48),(64,64),(128,128),(256,256)],
)

print(f'Logo Windows généré : {png_path}')
print(f'ICO multi-résolution généré : {ico_path}')
