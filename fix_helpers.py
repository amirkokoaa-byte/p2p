import re
with open('src/App.tsx', 'r') as f:
    content = f.read()

helpers = """
// --- Helpers ---
const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatTime = (seconds: number | null) => {
  if (seconds === null || !isFinite(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const CHUNK_SIZE = 256 * 1024;
"""

content = re.sub(r'// --- Helpers ---\nconst CHUNK_SIZE = 256 \* 1024;', helpers, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)

