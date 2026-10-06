from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


OUT = Path("public/diamond-student-hub-hero.png")
W, H = 1600, 1050


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "C:/Windows/Fonts/seguisb.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def rounded(draw: ImageDraw.ImageDraw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def shadowed_card(base, xy, radius, fill, shadow=(30, 64, 175, 36), offset=(0, 18), blur=34):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    sx0, sy0, sx1, sy1 = xy
    ox, oy = offset
    d.rounded_rectangle((sx0 + ox, sy0 + oy, sx1 + ox, sy1 + oy), radius=radius, fill=shadow)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(layer)
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(xy, radius=radius, fill=fill)


def gradient_background() -> Image.Image:
    image = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    pix = image.load()
    for y in range(H):
        for x in range(W):
            tx = x / W
            ty = y / H
            r = int(246 + 7 * (1 - ty))
            g = int(250 + 3 * tx)
            b = int(255 - 10 * ty)
            pix[x, y] = (r, g, b, 255)
    return image


def main():
    base = gradient_background()
    draw = ImageDraw.Draw(base)

    for cx, cy, color, radius in [
        (1250, 190, (59, 130, 246, 50), 300),
        (1120, 800, (20, 184, 166, 42), 260),
        (520, 240, (245, 158, 11, 30), 220),
        (1360, 680, (99, 102, 241, 34), 210),
    ]:
        layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=color)
        base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(70)))

    draw = ImageDraw.Draw(base)

    shadowed_card(base, (330, 170, 1310, 780), 44, (255, 255, 255, 255), shadow=(37, 99, 235, 34))
    draw.rounded_rectangle((385, 230, 1255, 705), radius=26, fill=(247, 250, 255, 255), outline=(214, 226, 245, 255), width=3)
    draw.rounded_rectangle((385, 230, 1255, 292), radius=26, fill=(255, 255, 255, 255))
    draw.rectangle((385, 266, 1255, 292), fill=(255, 255, 255, 255))

    draw.ellipse((428, 252, 446, 270), fill=(37, 99, 235, 255))
    draw.ellipse((458, 252, 476, 270), fill=(20, 184, 166, 255))
    draw.ellipse((488, 252, 506, 270), fill=(245, 158, 11, 255))
    draw.text((540, 248), "Diamond Student Hub", fill=(15, 23, 42, 255), font=font(25, True))
    draw.text((930, 250), "Class 9 Maharashtra Board", fill=(71, 85, 105, 255), font=font(22))

    rounded(draw, (430, 330, 680, 520), 22, (255, 255, 255, 255), outline=(219, 234, 254, 255), width=2)
    draw.text((460, 356), "Overall Progress", fill=(71, 85, 105, 255), font=font(22, True))
    draw.text((460, 397), "72%", fill=(37, 99, 235, 255), font=font(74, True))
    draw.rounded_rectangle((460, 484, 650, 502), radius=9, fill=(219, 234, 254, 255))
    draw.rounded_rectangle((460, 484, 596, 502), radius=9, fill=(37, 99, 235, 255))

    rounded(draw, (710, 330, 1000, 520), 22, (255, 255, 255, 255), outline=(204, 251, 241, 255), width=2)
    draw.text((740, 356), "Weekly Score", fill=(71, 85, 105, 255), font=font(22, True))
    points = [(750, 475), (800, 430), (850, 450), (900, 392), (950, 410)]
    draw.line(points, fill=(20, 184, 166, 255), width=8, joint="curve")
    for x, y in points:
        draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill=(20, 184, 166, 255))

    rounded(draw, (1030, 330, 1210, 520), 22, (255, 255, 255, 255), outline=(254, 243, 199, 255), width=2)
    draw.text((1062, 356), "Streak", fill=(71, 85, 105, 255), font=font(22, True))
    draw.text((1062, 402), "14", fill=(245, 158, 11, 255), font=font(70, True))
    draw.text((1068, 470), "days", fill=(100, 116, 139, 255), font=font(24, True))

    rounded(draw, (430, 555, 760, 668), 22, (255, 255, 255, 255), outline=(226, 232, 240, 255), width=2)
    draw.text((460, 584), "Science: Motion", fill=(15, 23, 42, 255), font=font(25, True))
    draw.text((460, 623), "Video lesson + notes ready", fill=(100, 116, 139, 255), font=font(22))
    draw.polygon([(705, 590), (705, 638), (746, 614)], fill=(37, 99, 235, 255))

    rounded(draw, (790, 555, 1210, 668), 22, (255, 255, 255, 255), outline=(226, 232, 240, 255), width=2)
    draw.text((820, 584), "Mathematics Quiz", fill=(15, 23, 42, 255), font=font(25, True))
    for i, color in enumerate([(34, 197, 94, 255), (34, 197, 94, 255), (245, 158, 11, 255), (37, 99, 235, 255)]):
        x = 820 + i * 58
        draw.rounded_rectangle((x, 628, x + 38, 648), radius=10, fill=color)
    draw.text((1080, 620), "18/20", fill=(37, 99, 235, 255), font=font(28, True))

    shadowed_card(base, (185, 610, 520, 875), 36, (255, 255, 255, 255), shadow=(15, 23, 42, 30))
    draw.text((230, 660), "Formula Sheet", fill=(15, 23, 42, 255), font=font(32, True))
    for idx, label in enumerate(["Algebra", "Geometry", "Statistics"]):
        y = 716 + idx * 42
        draw.rounded_rectangle((230, y, 475, y + 26), radius=13, fill=(239, 246, 255, 255))
        draw.text((250, y - 2), label, fill=(37, 99, 235, 255), font=font(21, True))

    shadowed_card(base, (1075, 635, 1430, 875), 36, (255, 255, 255, 255), shadow=(20, 184, 166, 30))
    draw.text((1122, 684), "Leaderboard", fill=(15, 23, 42, 255), font=font(32, True))
    names = [("Aarav", "980"), ("Isha", "948"), ("Riya", "921")]
    for i, (name, score) in enumerate(names, start=1):
        y = 735 + (i - 1) * 44
        draw.ellipse((1124, y, 1154, y + 30), fill=[(245, 158, 11, 255), (37, 99, 235, 255), (20, 184, 166, 255)][i - 1])
        draw.text((1170, y - 2), f"{i}. {name}", fill=(51, 65, 85, 255), font=font(22, True))
        draw.text((1338, y - 2), score, fill=(37, 99, 235, 255), font=font(22, True), anchor="ra")

    for xy, color in [
        ((210, 250, 310, 350), (37, 99, 235, 255)),
        ((1320, 245, 1405, 330), (20, 184, 166, 255)),
        ((1240, 120, 1300, 180), (245, 158, 11, 255)),
    ]:
        draw.rounded_rectangle(xy, radius=18, fill=color)
        x0, y0, x1, y1 = xy
        draw.line((x0 + 22, y0 + 30, x1 - 22, y0 + 30), fill=(255, 255, 255, 210), width=5)
        draw.line((x0 + 22, y0 + 52, x1 - 22, y0 + 52), fill=(255, 255, 255, 150), width=5)

    base = base.convert("RGB")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    base.save(OUT, quality=94)
    print(OUT)


if __name__ == "__main__":
    main()
