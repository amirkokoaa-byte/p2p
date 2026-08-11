import re
with open('src/App.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'^const formatSize =.*?return .*?sizes\[i\];\n};\n', '', content, flags=re.MULTILINE|re.DOTALL, count=1)

with open('src/App.tsx', 'w') as f:
    f.write(content)
