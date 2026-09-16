import os

path = 'src/lib/llm.ts'

with open(path, 'rb') as f:
    data = f.read()

idx = data.find(b'DEFAULT_CLINE_MODEL_FALLBACKS')
print(f'Found at offset {idx}')

comment_start = data.rfind(b'/**', 0, idx)
print(f'Comment /* at offset {comment_start}')

chunk = data[comment_start:idx+50]
print()
for i, b in enumerate(chunk[:80]):
    pos = comment_start + i
    c = chr(b) if 32 <= b < 127 else '.'
    print(f'  {pos}: 0x{b:02x} ({c})')
