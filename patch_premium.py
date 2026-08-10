import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# 1. Add state for showPremiumWelcome
if "const [showPremiumWelcome" not in content:
    content = re.sub(
        r'(const \[currentUser, setCurrentUser\] = useState<string \| null>\(null\);)',
        r'\1\n  const [showPremiumWelcome, setShowPremiumWelcome] = useState(false);',
        content
    )

# 2. Update AuthScreen logic
auth_logic = """
  if (currentView === 'auth') {
    return <AuthScreen onLogin={(username) => {
      setCurrentUser(username);
      setCurrentView('home');
      if (username !== 'admin') {
        const u = users[username];
        if (u && u.isPremium) {
           setShowPremiumWelcome(true);
        } else if (!u) {
           handleUpdateUser(username, { username, isPremium: false, premiumExpiryDate: null });
        }
      }
    }} />;
  }
"""
content = re.sub(
    r'if \(currentView === \'auth\'\) \{[\s\S]*?return <AuthScreen onLogin=\{\(username\) => \{.*?setCurrentUser\(username\);.*?setCurrentView\(\'home\'\);.*?if \(username !== \'admin\' && !users\[username\]\) \{.*?handleUpdateUser\(username, \{ username, isPremium: false, premiumExpiryDate: null \}\);.*?\}[\s\S]*?\}\} />;[\s\S]*?\}',
    auth_logic,
    content,
    flags=re.DOTALL
)

# 3. Hide premium button if premium
header_buttons = """
            {currentView === 'home' && currentUser !== 'admin' && (
               <div className="flex items-center gap-1">
                 {!users[currentUser]?.isPremium && (
                   <button onClick={() => setCurrentView('premium')} className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-amber-500 text-white px-3 py-1.5 rounded-full shadow hover:opacity-90 transition-opacity">
                     <Crown size={16} className="text-white fill-current" />
                     <span className="text-sm font-bold">Premium</span>
                   </button>
                 )}
                 <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors text-red-300 ml-1">
"""
content = re.sub(
    r'\{currentView === \'home\' && currentUser !== \'admin\' && \(\s*<div className="flex items-center gap-1">\s*<button onClick=\{\(\) => setCurrentView\(\'premium\'\)\} className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-amber-500 text-white px-3 py-1.5 rounded-full shadow hover:opacity-90 transition-opacity">\s*<Crown size=\{16\} className="text-white fill-current" \/>\s*<span className="text-sm font-bold">Premium<\/span>\s*<\/button>\s*<button onClick=\{handleLogout\} className="p-2 hover:bg-white/10 rounded-full transition-colors text-red-300 ml-1">',
    header_buttons,
    content,
    flags=re.DOTALL
)

# 4. Show premium welcome modal at the bottom of the App component (before closing div)
welcome_modal = """
      {showPremiumWelcome && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
           <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Crown size={32} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">أهلاً بك في الباقة المميزة!</h3>
                <p className="text-gray-600 font-medium text-sm mb-6 leading-relaxed">
                  تم شراء الباقة بنجاح ({users[currentUser!]?.premiumExpiryDate === null ? 'مدى الحياة' : (users[currentUser!]?.premiumExpiryDate! - Date.now() > 300*24*60*60*1000 ? 'سنوية' : 'شهرية')}).<br/>
                  تم أخذ الصلاحيات كاملة وغير محدودة.
                </p>
                <button 
                  onClick={() => setShowPremiumWelcome(false)}
                  className="w-full bg-[#003366] text-white hover:bg-blue-900 py-3.5 rounded-xl font-bold transition-colors shadow-md"
                >
                  استمرار
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
"""
content = re.sub(
    r'    </div>\n  \);\n}\n\nexport default App;',
    welcome_modal + '  );\n}\n\nexport default App;',
    content
)
# Note: we changed export default to inline export default function App() earlier. Let's adjust for that.
content = re.sub(
    r'    </div>\n  \);\n}\n\n?$',
    welcome_modal + '  );\n}\n',
    content
)


# 5. Full limits in SendScreen
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

