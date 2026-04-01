with open('backend/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

old = 'os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmZndlaW93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzY1ODEsImV4cCI6MjA5MDIxMjU4MX0.HxKGdH-kVL6p5knR2PgTgUl9OsIZ59G732StkQ8EXus"))'
new = '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmZndlaW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.HxKGdH-kVL6p5knR2PgTgUl9OsIZ59G732StkQ8EXus"))'

count = content.count(old)
content = content.replace(old, new)
with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Replaced {count} occurrences')
