with open('src/App.tsx', 'r') as f:
    content = f.read()

import_end = content.find("} from 'lucide-react';")
if import_end != -1:
    import_end = content.find('\n', import_end) + 1
    
format_size_func = """
const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
"""

content = content[:import_end] + format_size_func + content[import_end:]

with open('src/App.tsx', 'w') as f:
    f.write(content)
