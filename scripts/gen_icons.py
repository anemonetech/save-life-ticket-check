"""Génère les icônes PWA brandées Save Life dans /public."""
from PIL import Image, ImageDraw, ImageFont
import os

RED = (177, 17, 22, 255)
GOLD = (226, 165, 7, 255)
WHITE = (255, 255, 255, 255)

OUT = os.path.join(os.path.dirname(__file__), "..", "public")
os.makedirs(OUT, exist_ok=True)


def font(size):
    for p in [r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\Arial.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def make(size, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = int(size * 0.10) if maskable else 0
    # Fond rouge arrondi
    r = int(size * 0.22)
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=r, fill=RED)
    # Pastille or (motif billet)
    inner = size - 2 * pad
    cx, cy = size / 2, size / 2
    rad = inner * 0.30
    d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=GOLD)
    # Texte SL
    f = font(int(inner * 0.30))
    text = "SL"
    bbox = d.textbbox((0, 0), text, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), text, font=f, fill=RED)
    return img


make(192).save(os.path.join(OUT, "pwa-192x192.png"))
make(512).save(os.path.join(OUT, "pwa-512x512.png"))
make(512, maskable=True).save(os.path.join(OUT, "maskable-512x512.png"))
make(180).save(os.path.join(OUT, "apple-touch-icon.png"))
print("icons generated")
