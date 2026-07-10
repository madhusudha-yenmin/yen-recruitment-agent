import pymupdf

doc = pymupdf.open()
page = doc.new_page()

# Left column
page.insert_text((50, 100), "Left Column Line 1")
page.insert_text((50, 150), "Left Column Line 2")

# Right column
page.insert_text((300, 100), "Right Column Line 1")
page.insert_text((300, 150), "Right Column Line 2")

blocks = page.get_text("blocks")
print("--- Default PyMuPDF Block Order ---")
for b in blocks:
    print(b[4].strip())

print("\n--- Sorted by (y0, x0) ---")
sorted_blocks = sorted(blocks, key=lambda x: (x[1], x[0]))
for b in sorted_blocks:
    print(b[4].strip())
