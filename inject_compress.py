import re

with open('src/App.tsx', 'r') as f:
    app_code = f.read()

with open('compress_screen.tsx', 'r') as f:
    compress_code = f.read()

# Extract FFmpeg imports
ffmpeg_imports = """
// @ts-ignore
import { FFmpeg } from '@ffmpeg/ffmpeg';
// @ts-ignore
import { fetchFile } from '@ffmpeg/util';
"""

if "import { FFmpeg }" not in app_code:
    app_code = app_code.replace("import * as localforage from 'localforage';", "import * as localforage from 'localforage';\n" + ffmpeg_imports)

# Extract just the function definition of CompressScreen
compress_func = re.search(r'(const compressImageCanvas.*?)(?=export default CompressScreen;)', compress_code, re.DOTALL).group(1)

if "function CompressScreen" not in app_code:
    # Insert it before function AdminScreen or just above function App
    app_code = app_code.replace('function App() {', compress_func + '\nfunction App() {')

# Add Compress to bottom navigation
nav_item_compress = """<NavItem view="compress" current={currentView} icon={<Minimize size={22} />} label="ضغط" onClick={() => setCurrentView('compress')} />"""
if "view=\"compress\"" not in app_code:
    app_code = app_code.replace(
        "<NavItem view=\"filter\"", 
        nav_item_compress + "\n            <NavItem view=\"filter\""
    )

# Add Compress to currentView state type
app_code = app_code.replace(
    "'home' | 'receive' | 'history' | 'vault' | 'admin' | 'premium' | 'filter'",
    "'home' | 'receive' | 'history' | 'vault' | 'admin' | 'premium' | 'filter' | 'compress'"
)

# Add to navigation array
app_code = app_code.replace(
    "['home', 'history', 'vault', 'filter']",
    "['home', 'history', 'vault', 'filter', 'compress']"
)

# Add component to view
compress_route = """{currentView === 'compress' && <CompressScreen getHistory={getHistory} onOpenViewer={setViewingFile} />}"""
if "{currentView === 'compress'" not in app_code:
    app_code = app_code.replace(
        "{currentView === 'filter' && <FilterScreen />}",
        "{currentView === 'filter' && <FilterScreen />}\n          " + compress_route
    )

with open('src/App.tsx', 'w') as f:
    f.write(app_code)

