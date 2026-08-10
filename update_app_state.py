import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

state_code = """
  const [homeSessionStart, setHomeSessionStart] = useState(Date.now());
  const prevViewRef = useRef(currentView);

  useEffect(() => {
    if (currentView === 'home' && !['send', 'receive', 'home'].includes(prevViewRef.current)) {
      setHomeSessionStart(Date.now());
    }
    prevViewRef.current = currentView;
  }, [currentView]);
"""

content = re.sub(
    r'(const \[resendFile, setResendFile\] = useState.*?;\n)',
    r'\1' + state_code,
    content
)

content = re.sub(
    r'(<HomeScreen onNavigate=\{setCurrentView\} \/>)',
    r'<HomeScreen onNavigate={setCurrentView} sessionStartTime={homeSessionStart} onOpenViewer={(r) => handleViewFile(r)} />',
    content
)

with open('src/App.tsx', 'w') as f:
    f.write(content)
