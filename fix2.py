with open('src/App.tsx', 'r') as f:
    lines = f.readlines()

# The bad line starts at index 2603 (line 2604)
# Let's verify by printing
print(lines[2603])

del lines[2603:2642]

# Insert the proper tag
lines.insert(2603, '      <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar" onClick={() => setOpenMenuId(null)}>\n')

with open('src/App.tsx', 'w') as f:
    f.writelines(lines)
