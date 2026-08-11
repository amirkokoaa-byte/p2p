import json

with open('package.json', 'r') as f:
    pkg = json.load(f)

pkg['scripts']['dev'] = "tsx server.ts"
pkg['scripts']['build'] = "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs"
pkg['scripts']['start'] = "node dist/server.cjs"

with open('package.json', 'w') as f:
    json.dump(pkg, f, indent=2)

