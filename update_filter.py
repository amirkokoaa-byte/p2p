import re
with open('src/App.tsx', 'r') as f:
    content = f.read()
with open('filter_screen.tsx', 'r') as f:
    filter_screen = f.read()

pattern = r'function PremiumScreen\(\{ onBack \}: \{ onBack: \(\) => void \}\) \{.*?(?=function AdminScreen)'
new_content = re.sub(pattern, filter_screen + '\n' + r'\g<0>', content, flags=re.DOTALL)
with open('src/App.tsx', 'w') as f:
    f.write(new_content)
