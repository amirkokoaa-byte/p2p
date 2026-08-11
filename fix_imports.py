import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# the imports line:
# import { Home, History, Settings, ... CheckCircle2, Loader2, Save, Check } from 'lucide-react';
# and maybe another one with CheckCircle2, Loader2. Let's just remove the first occurence.

content = re.sub(r'CheckCircle2,\s*Loader2,\s*', '', content, count=1)

with open('src/App.tsx', 'w') as f:
    f.write(content)
