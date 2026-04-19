import csv
from pathlib import Path

ROOT = r"C:\Users\ganesh\Downloads\Twin Birds\Twin Birds"
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff", ".jfif"}

root = Path(ROOT)
rows = []
for p in root.rglob("*"):
    if p.is_file() and p.suffix.lower() in EXTS:
        rows.append({
            "FullPath": str(p),
            "RelativePath": str(p.relative_to(root)),
            "Directory": str(p.parent),
            "FolderName": p.parent.name,
            "FileName": p.stem,
            "Extension": p.suffix.lower(),
            "SizeBytes": p.stat().st_size,
        })

out = root / "image_inventory.csv"
with out.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else
                            ["FullPath","RelativePath","Directory","FolderName","FileName","Extension","SizeBytes"])
    writer.writeheader()
    writer.writerows(rows)

print(f"Found {len(rows)} images")
print(f"Saved: {out}")
