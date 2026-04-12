with open('backend/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix extra closing parenthesis on service_role key lines
old = 'HxKGdH-kVL6p5knR2PgTgUl9OsIZ59G732StkQ8EXus"))'
new = 'HxKGdH-kVL6p5knR2PgTgUl9OsIZ59G732StkQ8EXus")'
count = content.count(old)
content = content.replace(old, new)
with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Fixed {count} occurrences')
