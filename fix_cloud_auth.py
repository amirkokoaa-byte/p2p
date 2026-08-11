import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# 1. Update loadUsersData and saveUsersData
cloud_funcs = """
async function saveUsersData(users: Record<string, UserData>) {
  try {
    const dataStr = JSON.stringify(users);
    const enc = await encryptData(new TextEncoder().encode(dataStr).buffer, ADMIN_KEY);
    const payload = JSON.stringify({
      encrypted: Array.from(new Uint8Array(enc.encrypted)),
      iv: Array.from(enc.iv),
      salt: Array.from(enc.salt)
    });
    localStorage.setItem('p2p_users_encrypted', payload);
    await fetch('/api/store', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ key: 'p2p_users_encrypted', value: payload })
    });
  } catch (e) { console.error(e); }
}

async function loadUsersData(): Promise<Record<string, UserData>> {
  try {
    let checkStr = null;
    try {
      const res = await fetch('/api/load/p2p_users_encrypted');
      const data = await res.json();
      if (data.value) checkStr = data.value;
    } catch(e) {}
    if (!checkStr) {
      checkStr = localStorage.getItem('p2p_users_encrypted');
    }
    if (!checkStr) return {};
    const { encrypted, iv, salt } = JSON.parse(checkStr);
    const decrypted = await decryptData(
      new Uint8Array(encrypted).buffer, new Uint8Array(iv), new Uint8Array(salt), ADMIN_KEY
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (e) {
    return {};
  }
}

async function loadAuthUsers(): Promise<Record<string, string>> {
  try {
    const res = await fetch('/api/load/p2p_auth_users');
    const data = await res.json();
    if (data.value) {
      const { encrypted, iv, salt } = JSON.parse(data.value);
      const decrypted = await decryptData(
        new Uint8Array(encrypted).buffer, new Uint8Array(iv), new Uint8Array(salt), ADMIN_KEY
      );
      return JSON.parse(new TextDecoder().decode(decrypted));
    }
  } catch (e) { }
  return JSON.parse(localStorage.getItem('p2p_users') || '{}');
}

async function saveAuthUsers(users: Record<string, string>) {
  localStorage.setItem('p2p_users', JSON.stringify(users));
  try {
    const dataStr = JSON.stringify(users);
    const enc = await encryptData(new TextEncoder().encode(dataStr).buffer, ADMIN_KEY);
    const payload = JSON.stringify({
      encrypted: Array.from(new Uint8Array(enc.encrypted)),
      iv: Array.from(enc.iv),
      salt: Array.from(enc.salt)
    });
    await fetch('/api/store', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ key: 'p2p_auth_users', value: payload })
    });
  } catch (e) { console.error(e); }
}
"""

content = re.sub(
    r'async function saveUsersData.*?catch \(e\) \{\n    return \{\};\n  \}\n\}',
    cloud_funcs,
    content,
    flags=re.DOTALL
)

# 2. Update AuthScreen to be async
auth_component = """
function AuthScreen({ onLogin }: { onLogin: (u: string) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return alert('الرجاء إدخال اسم المستخدم وكلمة المرور');

    if (username === 'admin' && password === 'admin') {
      onLogin('admin');
      return;
    }

    setIsLoading(true);
    const users = await loadAuthUsers();
    
    if (isLogin) {
      if (users[username] === password) {
        onLogin(username);
      } else {
        alert('اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    } else {
      if (users[username]) {
        alert('اسم المستخدم مستخدم بالفعل');
      } else {
        users[username] = password;
        await saveAuthUsers(users);
        onLogin(username);
      }
    }
    setIsLoading(false);
  };
"""

content = re.sub(
    r'function AuthScreen\(\{ onLogin \}: \{ onLogin: \(u: string\) => void \}\) \{.*?const handleSubmit = \(e: React.FormEvent\) => \{.*?\}\n    \}\n  \};',
    auth_component,
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'تسجيل الدخول</button>\n          </form>',
    r'تسجيل الدخول</button>\n          </form>\n          {isLoading && <div className="text-center mt-4 text-[#003366] font-bold">جاري الاتصال...</div>}',
    content
)

content = re.sub(
    r'إنشاء حساب</button>\n          </form>',
    r'إنشاء حساب</button>\n          </form>\n          {isLoading && <div className="text-center mt-4 text-[#003366] font-bold">جاري الاتصال...</div>}',
    content
)

with open('src/App.tsx', 'w') as f:
    f.write(content)

