import re
with open('src/App.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'  const formatSize = \(bytes: number\) => \{\n    if \(bytes === 0\) return \'0 B\';\n    const k = 1024;\n    const sizes = \[\'B\', \'KB\', \'MB\', \'GB\'\];\n    const i = Math.floor\(Math.log\(bytes\) / Math.log\(k\)\);\n    return parseFloat\(\(bytes / Math.pow\(k, i\)\)\.toFixed\(1\)\) \+ \' \' \+ sizes\[i\];\n  \};\n', '', content)

with open('src/App.tsx', 'w') as f:
    f.write(content)
