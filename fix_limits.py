import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Full limits in SendScreen
send_limits = """
    const isPremium = userData?.isPremium;
    if (isPremium || currentUser === 'admin') {
      allowedImages = Infinity;
      allowedVideos = Infinity;
    }
"""
content = re.sub(
    r'const isPremium = userData\?\.isPremium;\s*if \(isPremium\) \{\s*allowedImages = 500;\s*allowedVideos = 50;\s*\}\s*if \(currentUser === \'admin\'\) \{\s*allowedImages = 500;\s*allowedVideos = 50;\s*\}',
    send_limits,
    content,
    flags=re.DOTALL
)

with open('src/App.tsx', 'w') as f:
    f.write(content)

