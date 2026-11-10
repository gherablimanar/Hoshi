#!/usr/bin/env python3
"""Regenerate committed standalone learning pages; no third-party packages required.
Run manually after editing docs/user-guide-ar.md or docs/science-ar.md.
The normal frontend build copies the committed files; it does not require Python.
"""
from pathlib import Path
import html
import re

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "frontend/public"
CSS = """
*{box-sizing:border-box}html{scroll-padding-top:28px}body{margin:0;background:#15191e;color:#dce6ee;font:17px/1.95 system-ui,"Segoe UI",sans-serif}
header{padding:22px max(20px,calc((100vw - 1040px)/2));border-bottom:1px solid #374351;background:#202a35;display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px;font-size:14px}
header a[aria-current=page]{color:#fff;text-decoration-thickness:3px}a{color:#a2d1ff;text-underline-offset:5px}
main{max-width:1040px;margin:auto;padding:30px 22px 90px}h1{font-size:clamp(25px,4vw,38px);line-height:1.5}h2{margin-top:64px;padding-top:20px;border-top:1px solid #3c5063;color:#b5d8fa;font-size:25px}h3{margin-top:34px;color:#d6e8f8}
p,li{max-width:90ch}code{font:.92em/1.6 ui-monospace,monospace;color:#b8d9fa;overflow-wrap:anywhere}h1 code{font:inherit;color:inherit}
nav{padding:20px;background:#202a35;border:1px solid #3b5064;border-radius:12px}nav h2{margin:0;padding:0;border:0;font-size:20px}nav ol{columns:2;column-gap:35px;padding:0;list-style:none}nav li{break-inside:avoid;padding:4px}
.table-wrap{margin:22px 0;overflow-x:auto;border:1px solid #3b4856;border-radius:9px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{text-align:start;vertical-align:top;padding:14px 16px;border-bottom:1px solid #36414d;overflow-wrap:anywhere}th{background:#263646;color:#eff7ff}th:first-child,td.term{width:34%}td.term{background:#1d2731;color:#b6d8f7;font-weight:600}tr:last-child td{border:0}tr:nth-child(even){background:#1a2028}
.equation{direction:ltr;text-align:center;padding:18px;margin:24px 0;background:#202d3b;border-inline-start:3px solid #8ec5fa;border-radius:6px;font-size:19px;overflow-wrap:anywhere}
figure{margin:30px 0;padding:12px;background:#202b37;border:1px solid #3d5369;border-radius:14px}figure img{width:100%;height:auto;display:block;border-radius:9px}figcaption{font-size:14px;color:#b6c7d8;padding:8px 10px}
footer{margin-top:60px;padding-top:20px;border-top:1px solid #374351;color:#9fb0c2}
@media(max-width:620px){body{font-size:15px}main{padding-inline:12px}nav ol{columns:1}td,th{padding:11px 9px}th:first-child,td.term{width:38%}h2{font-size:22px}header{gap:10px 18px}figure{padding:5px}.equation{font-size:16px}}
@media print{body{background:white;color:black;font-size:11pt}header,nav{display:none}main{max-width:none;padding:0}h2{break-after:avoid;color:black}td.term,th,tr:nth-child(even){background:white;color:black}td,th{border:1px solid #999;padding:8px}a,code{color:black}.table-wrap{overflow:visible}tr,figure{break-inside:avoid}.equation{color:black;background:#eee}figure{background:white}figcaption,footer{color:black}}
"""


def inline(text):
    for source, target in [("user-guide-ar.md", "guide-ar.html"), ("science-ar.md", "science-ar.html")]:
        text = text.replace(f"]({source})", f"]({target})")
    text = html.escape(text)
    text = re.sub(r"`([^`]+)`", r'<bdi dir="ltr"><code>\1</code></bdi>', text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(
        r"\[([^\]]+)\]\((https://[^)]+|[a-z0-9_-]+\.html(?:#[a-z0-9_-]+)?)\)",
        r'<a href="\2" rel="noreferrer">\1</a>', text,
    )
    return text


def render(source):
    lines = source.splitlines()
    out, toc = [], []
    i = section = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            title = line[level:].strip()
            ident = f"section-{section}"
            section += 1
            out.append(f'<h{level} id="{ident}">{inline(title)}</h{level}>')
            if level == 2:
                toc.append(f'<li><a href="#{ident}">{inline(title)}</a></li>')
            i += 1
            continue
        image = re.fullmatch(r"!\[([^\]]+)\]\(\.\./frontend/public/(learn/[a-z-]+\.svg)\)", line)
        if image:
            alt, path = image.groups()
            if not (PUBLIC / path).is_file():
                raise FileNotFoundError(path)
            out.append(f'<figure><img src="{path}" alt="{html.escape(alt, quote=True)}" loading="lazy"><figcaption>{inline(alt)}</figcaption></figure>')
            i += 1
            continue
        if line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r"[:\- ]+", c) for c in cells):
                    rows.append(cells)
                i += 1
            out.append('<div class="table-wrap"><table><thead><tr>' + ''.join('<th scope="col">' + inline(c) + '</th>' for c in rows[0]) + '</tr></thead><tbody>')
            for row in rows[1:]:
                cells = []
                for j, cell in enumerate(row):
                    cls = ' class="term"' if j == 0 else ''
                    cells.append(f'<td{cls}><bdi dir="auto">{inline(cell)}</bdi></td>')
                out.append('<tr>' + ''.join(cells) + '</tr>')
            out.append('</tbody></table></div>')
            continue
        if re.match(r"^(\d+\. |\- )", line):
            ordered = bool(re.match(r"^\d+\. ", line))
            pattern = r"^\d+\. " if ordered else r"^\- "
            tag = "ol" if ordered else "ul"
            out.append(f'<{tag}>')
            while i < len(lines) and re.match(pattern, lines[i].strip()):
                out.append('<li>' + inline(re.sub(pattern, '', lines[i].strip())) + '</li>')
                i += 1
            out.append(f'</{tag}>')
            continue
        if line.startswith("`") and line.endswith("`"):
            out.append(f'<div class="equation">{inline(line)}</div>')
            i += 1
            continue
        paragraph = []
        while i < len(lines) and lines[i].strip() and not lines[i].lstrip().startswith(("#", "|", "![")):
            paragraph.append(lines[i].strip())
            i += 1
        out.append('<p>' + inline(' '.join(paragraph)) + '</p>')
    return out, toc


def write_page(source_path, target, title, description):
    out, toc = render((ROOT / source_path).read_text())
    links = ['<a href="./">العودة إلى <bdi dir="ltr">Hoshi</bdi></a>']
    for href, label in [("guide-ar.html", "How to use it"), ("science-ar.html", "The science behind it")]:
        current = ' aria-current="page"' if href == target else ''
        links.append(f'<a href="{href}" lang="en" dir="ltr"{current}>{label}</a>')
    links.append(f'<a href="https://github.com/gherablimanar/Hoshi/blob/main/{source_path}">نسخة نصية</a>')
    page = '\n'.join([
        '<!doctype html>', '<html lang="ar" dir="rtl">', '<head>', '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        f'<meta name="description" content="{html.escape(description, quote=True)}">',
        f'<title>{html.escape(title)}</title>', f'<style>{CSS}</style>', '</head><body>',
        '<header aria-label="التنقل بين موارد التعلم">' + ''.join(links) + '</header>',
        '<main>' + out[0],
        '<p>استخدم الفهرس للانتقال إلى القسم المطلوب، أو ابحث داخل الصفحة بواسطة <bdi dir="ltr">Ctrl + F</bdi>. يمكنك طباعة الصفحة أو حفظها بصيغة PDF من المتصفح.</p>',
        '<nav aria-label="فهرس المحتوى"><h2>محتويات الصفحة</h2><ol>' + ''.join(toc) + '</ol></nav>',
        ''.join(out[1:]),
        '<footer>Hoshi 0.8 · شرح تعليمي بالعربية مع المصطلحات الإنجليزية. راجع وحدات الحقول وافتراضات النموذج عند تطبيق المعلومات.</footer>',
        '</main></body></html>',
    ])
    (PUBLIC / target).write_text(page)
    print(f'{target}: {len(toc)} sections')


if __name__ == "__main__":
    write_page("docs/user-guide-ar.md", "guide-ar.html", "How to use it — Hoshi بالعربية", "شرح عربي لأزرار Hoshi وحقول التصميم والمحاكاة مع الأسماء الإنجليزية.")
    write_page("docs/science-ar.md", "science-ar.html", "The science behind it — Hoshi بالعربية", "مقال عربي عن علم تصميم الصواريخ والقوى والدفع والاستقرار والجو والاسترجاع والتحقق من المحاكاة.")
