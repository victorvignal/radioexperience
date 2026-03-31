import re

with open('App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all lines with template literals containing ${
for i, line in enumerate(content.split('\n'), 1):
    if '${' in line and '`' in line:
        print(f'Line {i}: {line.strip()[:80]}')
