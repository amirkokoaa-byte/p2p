const fs = require('fs');

const code = `import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, Download, History, Home, FileIcon, Image as ImageIcon, Video,
  CheckCircle2, XCircle, ArrowRight, Wifi, Smartphone, Loader2,
  UploadCloud, FileText, Lock, Unlock, MoreVertical, Eye, Settings, X, KeyRound, LockKeyhole,
  User, LogOut, ShieldAlert, AlignLeft, Settings2
} from 'lucide-react';
import Peer, { DataConnection } from 'peerjs';
import { QRCodeSVG } from 'qrcode.react';
import localforage from 'localforage';

// --- Types ---
interface TransferRecord {
  id: string;
  name: string;
  size: number;
  timestamp: number;
  isSent: boolean;
  status: 'SUCCESS' | 'FAILED';
  type: string;
  mime: string;
  vaulted?: boolean;
}

interface AppSettings {
  appName: string;
  bannerEnabled: boolean;
  bannerText: string;
  bannerScrolling: boolean;
}

// --- Crypto Helpers (AES-256 GCM) ---
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );
}

async function encryptData(data: ArrayBuffer, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, data);
  return { encrypted, iv, salt };
}

async function decryptData(encrypted: ArrayBuffer, iv: Uint8Array, salt: Uint8Array, password: string) {
  const key = await deriveKey(password, salt);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, encrypted);
}

// --- Helpers ---
const CHUNK_SIZE = 256 * 1024;
const APP_PREFIX = 'p2ptransfer-app-';

const saveToHistory = (record: Omit<TransferRecord, 'id' | 'timestamp'>) => {
  try {
    const existing = JSON.parse(localStorage.getItem('p2p_history') || '[]');
    const id = Math.random().toString(36).substr(2, 9);
    const newRecord: TransferRecord = { ...record, id, timestamp: Date.now(), vaulted: false };
    existing.unshift(newRecord);
    localStorage.setItem('p2p_history', JSON.stringify(existing));
    window.dispatchEvent(new Event('history_updated'));
    return id;
  } catch (e) {
    console.error('Failed to save history', e);
    return null;
  }
};

const getHistory = (): TransferRecord[] => {
  try { return JSON.parse(localStorage.getItem('p2p_history') || '[]'); }
  catch (e) { return []; }
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileType = (mime: string) => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
};

// --- Viewer Component ---
function FileViewer({ file, onClose }: { file: { blob: Blob, name: string, type: string }, onClose: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file.blob), [file.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200">
       <header className="p-4 flex justify-between items-center text-white bg-black/50 absolute top-0 w-full z-10">
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><X size={24} /></button>
          <span className="truncate max-w-[200px] font-bold text-sm text-center flex-1 mx-4" dir="ltr">{file.name}</span>
          <div className="w-10" />
       </header>
       <div className="flex-1 flex items-center justify-center overflow-hidden pt-16">
          {file.type === 'image' ? (
             <img src={url} className="max-w-full max-h-full object-contain" />
          ) : file.type === 'video' ? (
             <video src={url} controls className="max-w-full max-h-full" autoPlay playsInline />
          ) : (
             <div className="text-white flex flex-col items-center">
                <FileText size={64} className="mb-4 text-gray-500" />
                <p className="text-gray-300">لا يمكن عرض هذا النوع من الملفات داخل التطبيق</p>
             </div>
          )}
       </div>
    </div>
  );
}

// --- Main App Component ---
export default function App() {
  const [currentView, setCurrentView] = useState<'auth' | 'home' | 'history' | 'send' | 'receive' | 'vault' | 'admin'>('auth');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  
  const [vaultPassword, setVaultPassword] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{ blob: Blob, name: string, type: string } | null>(null);

  const [settings, setSettings] = useState<AppSettings>({
    appName: 'النقل السريع P2P',
    bannerEnabled: false,
    bannerText: '',
    bannerScrolling: true
  });

  useEffect(() => {
    const loadSettings = () => {
      const stored = localStorage.getItem('p2p_settings');
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    };
    loadSettings();
    window.addEventListener('settings_updated', loadSettings);
    return () => window.removeEventListener('settings_updated', loadSettings);
  }, []);

  const moveFileToVault = async (record: TransferRecord) => {
    if (!vaultPassword) {
      alert('الرجاء فتح قفل المحفظة أولاً من علامة التبويب "المحفظة".');
      setCurrentView('vault');
      return;
    }
    try {
      const fileBlob = await localforage.getItem<Blob>(record.id);
      if (!fileBlob) {
         alert('الملف غير متوفر محلياً (ربما تم حذفه).');
         return;
      }
      const arrayBuffer = await fileBlob.arrayBuffer();
      const { encrypted, iv, salt } = await encryptData(arrayBuffer, vaultPassword);
      
      await localforage.setItem(\`vault_\${record.id}\`, { encrypted, iv, salt });
      await localforage.removeItem(record.id);
      
      const history = getHistory();
      const updated = history.map(r => r.id === record.id ? { ...r, vaulted: true } : r);
      localStorage.setItem('p2p_history', JSON.stringify(updated));
      window.dispatchEvent(new Event('history_updated'));
      alert('تم تشفير الملف ونقله إلى المحفظة بنجاح.');
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء التشفير.');
    }
  };

  const openViewer = async (record: TransferRecord) => {
    try {
      if (record.vaulted) {
        if (!vaultPassword) {
          alert('المحفظة مقفلة.');
          return;
        }
        const vaultedStr = await localforage.getItem<any>(\`vault_\${record.id}\`);
        if (!vaultedStr) return alert('الملف غير موجود.');
        const decryptedBuf = await decryptData(vaultedStr.encrypted, vaultedStr.iv, vaultedStr.salt, vaultPassword);
        const blob = new Blob([decryptedBuf], { type: record.mime });
        setViewingFile({ blob, name: record.name, type: record.type });
      } else {
        const fileBlob = await localforage.getItem<Blob>(record.id);
        if (!fileBlob) return alert('الملف غير متوفر محلياً للعرض.');
        setViewingFile({ blob: fileBlob, name: record.name, type: record.type });
      }
    } catch (e) {
      console.error(e);
      alert('فشل في عرض الملف. قد تكون كلمة المرور غير صحيحة.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('auth');
    setVaultPassword(null);
  };

  if (currentView === 'auth') {
    return <AuthScreen onLogin={(username) => { setCurrentUser(username); setCurrentView('home'); }} />;
  }

  return (
    <div className="flex justify-center bg-[#E5E7EB] min-h-screen rtl font-sans" dir="rtl">
      <div className="w-full max-w-md bg-[#F8F9FA] h-screen shadow-2xl flex flex-col relative overflow-hidden">
        
        {/* App Bar */}
        <header className="bg-[#003366] text-white p-4 shadow-md z-10 flex flex-col shrink-0">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-3">
              {['send', 'receive', 'admin'].includes(currentView) && (
                <button onClick={() => setCurrentView('home')} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                  <ArrowRight size={24} />
                </button>
              )}
              <h1 className="text-xl font-bold">
                {currentView === 'home' ? settings.appName : 
                 currentView === 'history' ? 'سجل النقل' : 
                 currentView === 'vault' ? 'المحفظة المشفرة' :
                 currentView === 'admin' ? 'إعدادات البرنامج' :
                 currentView === 'send' ? 'إرسال ملف' : 'استقبال ملف'}
              </h1>
            </div>
            
            {currentView === 'home' && currentUser === 'admin' && (
               <button onClick={() => setCurrentView('admin')} className="p-2 hover:bg-white/10 rounded-full transition-colors ml-1">
                 <Settings2 size={22} />
               </button>
            )}
            {currentView === 'home' && currentUser !== 'admin' && (
               <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors text-red-300 ml-1">
                 <LogOut size={22} />
               </button>
            )}
          </div>
          
          {/* Banner */}
          {settings.bannerEnabled && settings.bannerText && currentView === 'home' && (
             <div className="mt-3 bg-yellow-400 text-yellow-900 px-3 py-1.5 rounded-lg text-sm font-bold overflow-hidden whitespace-nowrap shadow-sm border border-yellow-500/50">
                {settings.bannerScrolling ? (
                  <div className="inline-block animate-[marquee_10s_linear_infinite]">{settings.bannerText}</div>
                ) : (
                  <div className="text-center">{settings.bannerText}</div>
                )}
             </div>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-20 custom-scrollbar relative">
          {currentView === 'home' && <HomeScreen onNavigate={setCurrentView} />}
          {currentView === 'history' && <HistoryScreen onOpenViewer={openViewer} onMoveToVault={moveFileToVault} />}
          {currentView === 'vault' && <VaultScreen vaultPassword={vaultPassword} setVaultPassword={setVaultPassword} onOpenViewer={openViewer} />}
          {currentView === 'send' && <SendScreen onBack={() => setCurrentView('home')} />}
          {currentView === 'receive' && <ReceiveScreen onBack={() => setCurrentView('home')} />}
          {currentView === 'admin' && <AdminScreen currentSettings={settings} onBack={() => setCurrentView('home')} onLogout={handleLogout} />}
        </main>

        {/* Bottom Navigation */}
        {['home', 'history', 'vault'].includes(currentView) && (
          <nav className="absolute bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-2 z-10 pb-5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <NavItem view="home" current={currentView} icon={<Home size={22} />} label="الرئيسية" onClick={() => setCurrentView('home')} />
            <NavItem view="history" current={currentView} icon={<History size={22} />} label="السجل" onClick={() => setCurrentView('history')} />
            <NavItem view="vault" current={currentView} icon={<LockKeyhole size={22} />} label="المحفظة" onClick={() => setCurrentView('vault')} />
          </nav>
        )}
      </div>

      {viewingFile && (
        <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />
      )}
      
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

function NavItem({ view, current, icon, label, onClick }: any) {
  const active = current === view;
  return (
    <button onClick={onClick} className={\`flex flex-col items-center gap-1 transition-colors p-2 \${active ? 'text-[#003366]' : 'text-gray-400 hover:text-gray-600'}\`}>
      <div className={\`p-1.5 rounded-xl \${active ? 'bg-blue-50' : 'bg-transparent'}\`}>{icon}</div>
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

// --- Screens ---

function AuthScreen({ onLogin }: { onLogin: (username: string) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return alert('الرجاء إدخال اسم المستخدم وكلمة المرور');

    if (username === 'admin' && password === 'admin') {
      onLogin('admin');
      return;
    }

    const users = JSON.parse(localStorage.getItem('p2p_users') || '{}');
    
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
        localStorage.setItem('p2p_users', JSON.stringify(users));
        onLogin(username);
      }
    }
  };

  return (
    <div className="flex justify-center bg-[#E5E7EB] min-h-screen rtl font-sans" dir="rtl">
      <div className="w-full max-w-md bg-white h-screen shadow-2xl flex flex-col justify-center px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 text-[#003366] mb-6 shadow-inner border border-blue-100">
            <ShieldAlert size={40} />
          </div>
          <h2 className="text-3xl font-black text-[#003366] mb-2">النقل السريع P2P</h2>
          <p className="text-gray-500 font-medium">نظام محلي آمن ومستقل بالكامل</p>
        </div>

        <div className="flex bg-gray-100 rounded-xl p-1 mb-8">
          <button 
            className={\`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all \${isLogin ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500 hover:text-gray-700'}\`}
            onClick={() => setIsLogin(true)}
          >تسجيل دخول</button>
          <button 
            className={\`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all \${!isLogin ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500 hover:text-gray-700'}\`}
            onClick={() => setIsLogin(false)}
          >حساب جديد</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <User className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="اسم المستخدم"
                className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-xl pr-12 pl-4 py-4 font-bold text-gray-800 outline-none transition-all"
              />
            </div>
          </div>
          <div>
            <div className="relative">
              <KeyRound className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-xl pr-12 pl-4 py-4 font-bold text-gray-800 outline-none transition-all"
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-[#003366] text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-900 transition-colors mt-4">
            {isLogin ? 'دخول' : 'إنشاء حساب'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminScreen({ currentSettings, onBack, onLogout }: any) {
  const [appName, setAppName] = useState(currentSettings.appName);
  const [bannerEnabled, setBannerEnabled] = useState(currentSettings.bannerEnabled);
  const [bannerText, setBannerText] = useState(currentSettings.bannerText);
  const [bannerScrolling, setBannerScrolling] = useState(currentSettings.bannerScrolling);

  const handleSave = () => {
    const newSettings: AppSettings = { appName, bannerEnabled, bannerText, bannerScrolling };
    localStorage.setItem('p2p_settings', JSON.stringify(newSettings));
    window.dispatchEvent(new Event('settings_updated'));
    alert('تم حفظ الإعدادات بنجاح');
  };

  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-right-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-[#003366] mb-4 flex items-center gap-2">
          <Settings2 size={20} /> إعدادات التطبيق
        </h3>
        <label className="block text-sm font-bold text-gray-700 mb-2">اسم البرنامج (يظهر في الواجهات)</label>
        <input 
          type="text" value={appName} onChange={e => setAppName(e.target.value)}
          className="w-full bg-gray-50 border-2 border-gray-200 focus:border-[#003366] rounded-xl px-4 py-3 font-bold outline-none transition-colors mb-2"
        />
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-[#003366] flex items-center gap-2">
            <AlignLeft size={20} /> الشريط الإعلاني
          </h3>
          <button 
            onClick={() => setBannerEnabled(!bannerEnabled)}
            className={\`relative inline-flex h-6 w-11 items-center rounded-full transition-colors \${bannerEnabled ? 'bg-[#003366]' : 'bg-gray-300'}\`}
          >
            <span className={\`inline-block h-4 w-4 transform rounded-full bg-white transition-transform \${bannerEnabled ? '-translate-x-6' : '-translate-x-1'}\`} />
          </button>
        </div>

        {bannerEnabled && (
          <div className="space-y-4 pt-2 animate-in fade-in zoom-in-95">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">نص الشريط</label>
              <textarea 
                value={bannerText} onChange={e => setBannerText(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-200 focus:border-[#003366] rounded-xl px-4 py-3 font-medium outline-none transition-colors min-h-[80px]"
                placeholder="أدخل الرسالة هنا..."
              />
            </div>
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-sm font-bold text-gray-700">شريط متحرك (Marquee)</span>
              <button 
                onClick={() => setBannerScrolling(!bannerScrolling)}
                className={\`relative inline-flex h-6 w-11 items-center rounded-full transition-colors \${bannerScrolling ? 'bg-[#003366]' : 'bg-gray-300'}\`}
              >
                <span className={\`inline-block h-4 w-4 transform rounded-full bg-white transition-transform \${bannerScrolling ? '-translate-x-6' : '-translate-x-1'}\`} />
              </button>
            </div>
          </div>
        )}
      </div>

      <button onClick={handleSave} className="w-full bg-[#003366] text-white py-4 rounded-xl font-bold text-lg shadow-md hover:bg-blue-900 transition-colors">
        حفظ الإعدادات
      </button>

      <button onClick={onLogout} className="w-full bg-red-50 text-red-600 border border-red-100 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors mt-8">
        <LogOut size={20} /> تسجيل الخروج
      </button>
    </div>
  );
}

function HomeScreen({ onNavigate }: { onNavigate: (v: 'send'|'receive') => void }) {
  return (
    <div className="p-6 flex flex-col gap-6 h-full justify-center pb-24">
      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-[#003366] mb-4 shadow-inner">
          <Wifi size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">نقل ملفات</h2>
        <p className="text-sm text-gray-500 mt-2">مباشر، آمن، وبدون خوادم وسيطة</p>
      </div>

      <button 
        onClick={() => onNavigate('send')}
        className="bg-[#003366] text-white rounded-[2rem] p-8 flex flex-col items-center gap-4 shadow-xl shadow-blue-900/20 hover:bg-[#002244] transition-all transform active:scale-95 group relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center shadow-inner relative z-10">
          <Send size={36} className="ml-1" />
        </div>
        <div className="text-center relative z-10">
          <h2 className="text-3xl font-bold mb-1">إرسال</h2>
          <p className="text-blue-200 text-sm font-medium">مشاركة ملفات، صور، وفيديوهات</p>
        </div>
      </button>

      <button 
        onClick={() => onNavigate('receive')}
        className="bg-white text-[#003366] border-2 border-[#003366] rounded-[2rem] p-8 flex flex-col items-center gap-4 shadow-lg hover:bg-blue-50 transition-all transform active:scale-95 group"
      >
        <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center shadow-inner group-hover:bg-blue-100 transition-colors">
          <Download size={36} />
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-1">استقبال</h2>
          <p className="text-[#003366]/70 text-sm font-medium">استلام الملفات عبر الكود</p>
        </div>
      </button>
    </div>
  );
}

function SendScreen({ onBack }: { onBack: () => void }) {
  const [peerId, setPeerId] = useState<string>('');
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transferSuccess, setTransferSuccess] = useState(false);
  
  const peerRef = useRef<Peer | null>(null);
  const onAckRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = Math.floor(100000 + Math.random() * 900000).toString();
    setPeerId(id);
    const peer = new Peer(\`\${APP_PREFIX}\${id}\`);
    peerRef.current = peer;

    peer.on('connection', (conn) => {
      setConnection(conn);
      conn.on('data', (msg: any) => {
        if (msg.type === 'ack' && onAckRef.current) {
          onAckRef.current();
        }
      });
    });

    return () => { peer.destroy(); };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !connection) return;

    setIsTransferring(true);
    setProgress(0);
    setTransferSuccess(false);
    
    let offset = 0;

    const sendNextChunk = () => {
      if (offset < file.size) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        chunk.arrayBuffer().then(buffer => {
          connection.send({ type: 'chunk', data: buffer });
          offset += chunk.size;
          setProgress(Math.round((offset / file.size) * 100));
        });
      } else {
        connection.send({ type: 'eof' });
        setIsTransferring(false);
        setTransferSuccess(true);
        const recordId = saveToHistory({ 
          name: file.name, size: file.size, isSent: true, status: 'SUCCESS',
          type: getFileType(file.type), mime: file.type
        });
        if (recordId) localforage.setItem(recordId, file);
      }
    };

    onAckRef.current = sendNextChunk;
    connection.send({ type: 'header', name: file.name, size: file.size, mime: file.type });
  };

  return (
    <div className="p-6 flex flex-col items-center min-h-full">
      {!connection ? (
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center flex flex-col items-center mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
            <Smartphone size={32} className="text-[#003366]" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">في انتظار المستلم</h3>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            اطلب من الطرف الآخر فتح التطبيق واختيار <strong>استقبال</strong> وإدخال الكود التالي:
          </p>
          
          <div className="bg-[#F8F9FA] px-8 py-4 rounded-2xl border-2 border-dashed border-gray-300 mb-8 w-full tracking-[0.2em]">
            <span className="text-4xl font-black text-[#003366]">{peerId || '...'}</span>
          </div>
          
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 inline-block mb-6">
            <QRCodeSVG value={peerId} size={120} fgColor="#003366" />
          </div>
          
          <div className="flex items-center gap-2 text-sm text-[#003366] font-medium animate-pulse">
            <Loader2 size={16} className="animate-spin" />
            جاري انتظار الاتصال...
          </div>
        </div>
      ) : (
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center flex flex-col items-center mt-4 animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 size={32} className="text-[#28A745]" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">تم الاتصال بنجاح!</h3>
          <p className="text-gray-500 text-sm mb-8">الجهاز الآخر جاهز لاستقبال الملفات.</p>

          {!isTransferring && !transferSuccess && (
            <>
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 bg-[#003366] text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-900 transition-colors flex items-center justify-center gap-3"
              >
                <UploadCloud size={24} />
                اختر ملفاً للإرسال
              </button>
            </>
          )}

          {isTransferring && (
            <div className="w-full space-y-4">
              <div className="flex justify-between text-sm font-bold text-[#003366]">
                <span>جاري الإرسال...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#003366] transition-all duration-300 rounded-full" style={{ width: \`\${progress}%\` }} />
              </div>
            </div>
          )}

          {transferSuccess && (
            <div className="w-full flex flex-col items-center space-y-4">
              <div className="text-green-600 font-bold flex items-center gap-2 bg-green-50 px-4 py-2 rounded-xl">
                <CheckCircle2 size={20} /> تم إرسال الملف بنجاح
              </div>
              <button onClick={() => setTransferSuccess(false)} className="text-[#003366] font-bold text-sm hover:underline mt-4">
                إرسال ملف آخر
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReceiveScreen({ onBack }: { onBack: () => void }) {
  const [targetId, setTargetId] = useState('');
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [receivedFileDetails, setReceivedFileDetails] = useState<{name: string, size: number} | null>(null);

  const peerRef = useRef<Peer | null>(null);

  useEffect(() => {
    peerRef.current = new Peer();
    return () => { if (peerRef.current) peerRef.current.destroy(); };
  }, []);

  const handleConnect = () => {
    if (!targetId || targetId.length !== 6 || !peerRef.current) return;
    setIsConnecting(true);
    const conn = peerRef.current.connect(\`\${APP_PREFIX}\${targetId}\`, { reliable: true });
    
    conn.on('open', () => {
      setIsConnecting(false);
      setIsConnected(true);
      setConnection(conn);
      setupReceiver(conn);
    });

    conn.on('error', (err) => {
      setIsConnecting(false);
      alert('فشل الاتصال! يرجى التأكد من الكود.');
    });
  };

  const setupReceiver = (conn: DataConnection) => {
    let receivedBuffers: ArrayBuffer[] = [];
    let receivedSize = 0;
    let fileMeta: any = null;

    conn.on('data', (msg: any) => {
      if (msg.type === 'header') {
        setIsTransferring(true);
        setTransferSuccess(false);
        fileMeta = msg;
        setReceivedFileDetails({ name: msg.name, size: msg.size });
        receivedBuffers = [];
        receivedSize = 0;
        conn.send({ type: 'ack' });
      } else if (msg.type === 'chunk') {
        receivedBuffers.push(msg.data);
        receivedSize += msg.data.byteLength;
        setProgress(Math.round((receivedSize / fileMeta.size) * 100));
        conn.send({ type: 'ack' });
      } else if (msg.type === 'eof') {
        const blob = new Blob(receivedBuffers, { type: fileMeta.mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileMeta.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setIsTransferring(false);
        setTransferSuccess(true);
        const recordId = saveToHistory({ 
          name: fileMeta.name, size: fileMeta.size, isSent: false, status: 'SUCCESS',
          type: getFileType(fileMeta.mime), mime: fileMeta.mime
        });
        if (recordId) localforage.setItem(recordId, blob);
      }
    });
  };

  return (
    <div className="p-6 flex flex-col items-center min-h-full">
      {!isConnected ? (
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center mt-4 animate-in slide-in-from-bottom-4 duration-500">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6 mx-auto">
            <Download size={32} className="text-[#003366]" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">أدخل كود الاستلام</h3>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">يرجى إدخال الكود الظاهر في هاتف المُرسل.</p>
          <input
            type="number" value={targetId} onChange={(e) => setTargetId(e.target.value.slice(0, 6))}
            placeholder="000000"
            className="w-full bg-[#F8F9FA] border-2 border-gray-200 rounded-2xl px-6 py-4 text-center text-4xl font-black text-[#003366] tracking-[0.2em] mb-6 focus:border-[#003366] focus:outline-none transition-colors"
          />
          <button
            onClick={handleConnect} disabled={targetId.length !== 6 || isConnecting}
            className="w-full py-4 bg-[#003366] text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isConnecting ? <><Loader2 size={24} className="animate-spin" /> جاري الاتصال...</> : 'اتصال'}
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center flex flex-col items-center mt-4 animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
            <Wifi size={32} className="text-[#28A745]" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">تم الاتصال!</h3>
          {!isTransferring && !transferSuccess && (
            <p className="text-gray-500 text-sm mt-2 animate-pulse">في انتظار الملف...</p>
          )}
          {isTransferring && (
            <div className="w-full mt-6 space-y-4">
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl mb-2 text-right">
                 <FileText size={24} className="text-gray-400 shrink-0 ml-3" />
                 <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{receivedFileDetails?.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatSize(receivedFileDetails?.size || 0)}</p>
                 </div>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#003366]">
                <span>جاري الاستلام...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#003366] transition-all duration-300 rounded-full" style={{ width: \`\${progress}%\` }} />
              </div>
            </div>
          )}
          {transferSuccess && (
            <div className="w-full flex flex-col items-center mt-6 space-y-4">
              <div className="text-green-600 font-bold flex items-center gap-2 bg-green-50 px-4 py-2 rounded-xl border border-green-100">
                <CheckCircle2 size={20} /> اكتمل التحميل! تم حفظ الملف.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryScreen({ onOpenViewer, onMoveToVault }: any) {
  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    const updateRecords = () => setRecords(getHistory().filter(r => !r.vaulted));
    updateRecords();
    window.addEventListener('history_updated', updateRecords);
    return () => window.removeEventListener('history_updated', updateRecords);
  }, []);

  const formatDate = (ts: number) => new Intl.DateTimeFormat('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ts);
  
  const getIcon = (type: string) => {
    if (type === 'video') return <Video className="text-[#003366]" size={22} />;
    if (type === 'image') return <ImageIcon className="text-[#003366]" size={22} />;
    return <FileIcon className="text-[#003366]" size={22} />;
  };

  return (
    <div className="p-5 space-y-3" onClick={() => setOpenMenuId(null)}>
      {records.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-gray-400 opacity-60">
          <History size={48} className="mb-4" />
          <p className="font-medium">لا توجد سجلات غير مشفرة</p>
        </div>
      ) : (
        records.map(record => (
          <div key={record.id} className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow relative">
            <div className="w-14 h-14 rounded-[14px] bg-blue-50 flex items-center justify-center shrink-0 cursor-pointer" onClick={() => onOpenViewer(record)}>
              {getIcon(record.type)}
            </div>
            
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpenViewer(record)}>
              <h3 className="font-bold text-gray-800 truncate text-[15px]" dir="ltr">{record.name}</h3>
              <div className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1.5 font-medium">
                <span className="bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{formatSize(record.size)}</span>
                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                <span>{formatDate(record.timestamp)}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === record.id ? null : record.id); }}
                  className="p-1 text-gray-400 hover:text-[#003366] rounded-full hover:bg-gray-50 transition-colors"
                >
                  <MoreVertical size={20} />
                </button>
                {openMenuId === record.id && (
                  <div className="absolute left-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20 animate-in fade-in zoom-in-95">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); onMoveToVault(record); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Lock size={16} className="text-[#003366]" /> نقل إلى المحفظة
                    </button>
                  </div>
                )}
              </div>
              <div className={\`p-1 rounded-full \${record.isSent ? 'bg-blue-50 text-[#003366]' : 'bg-green-50 text-[#28A745]'}\`}>
                {record.isSent ? <Send size={12} /> : <Download size={12} />}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function VaultScreen({ vaultPassword, setVaultPassword, onOpenViewer }: any) {
  const [setupPass, setSetupPass] = useState('');
  const [unlockPass, setUnlockPass] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(!localStorage.getItem('vault_check'));
  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [newPass, setNewPass] = useState('');

  useEffect(() => {
    const updateRecords = () => setRecords(getHistory().filter(r => r.vaulted));
    updateRecords();
    window.addEventListener('history_updated', updateRecords);
    return () => window.removeEventListener('history_updated', updateRecords);
  }, []);

  const handleSetup = async () => {
    if (setupPass.length < 4) return alert('كلمة المرور يجب أن تكون 4 أحرف على الأقل');
    try {
      const { encrypted, iv, salt } = await encryptData(new TextEncoder().encode('vault_check').buffer, setupPass);
      localStorage.setItem('vault_check', JSON.stringify({
        encrypted: Array.from(new Uint8Array(encrypted)), iv: Array.from(iv), salt: Array.from(salt)
      }));
      setVaultPassword(setupPass);
      setIsSettingUp(false);
    } catch(e) { alert('خطأ في الإعداد'); }
  };

  const handleUnlock = async () => {
    try {
      const checkStr = localStorage.getItem('vault_check');
      if (!checkStr) return;
      const { encrypted, iv, salt } = JSON.parse(checkStr);
      const decrypted = await decryptData(
        new Uint8Array(encrypted).buffer, new Uint8Array(iv), new Uint8Array(salt), unlockPass
      );
      if (new TextDecoder().decode(decrypted) === 'vault_check') {
        setVaultPassword(unlockPass);
      } else alert('كلمة المرور غير صحيحة');
    } catch (e) { alert('كلمة المرور غير صحيحة'); }
  };

  const handleChangePassword = async () => {
    if (newPass.length < 4) return alert('كلمة المرور قصيرة جداً');
    if (!vaultPassword) return;
    try {
      const { encrypted, iv, salt } = await encryptData(new TextEncoder().encode('vault_check').buffer, newPass);
      
      for (const record of records) {
        const vaultedStr = await localforage.getItem<any>(\`vault_\${record.id}\`);
        if (vaultedStr) {
          const decryptedBuf = await decryptData(vaultedStr.encrypted, vaultedStr.iv, vaultedStr.salt, vaultPassword);
          const newEnc = await encryptData(decryptedBuf, newPass);
          await localforage.setItem(\`vault_\${record.id}\`, newEnc);
        }
      }

      localStorage.setItem('vault_check', JSON.stringify({
        encrypted: Array.from(new Uint8Array(encrypted)), iv: Array.from(iv), salt: Array.from(salt)
      }));
      setVaultPassword(newPass);
      setShowSettings(false);
      setNewPass('');
      alert('تم تغيير كلمة المرور بنجاح وإعادة تشفير جميع الملفات.');
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء تغيير كلمة المرور.');
    }
  };

  if (isSettingUp) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full animate-in fade-in">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-blue-100">
          <LockKeyhole size={36} className="text-[#003366]" />
        </div>
        <h2 className="text-2xl font-bold text-[#003366] mb-2">إعداد المحفظة الآمنة</h2>
        <p className="text-sm text-gray-500 text-center mb-8 leading-relaxed max-w-[250px]">
          سيتم تشفير ملفاتك محلياً (AES-256) ولن يتمكن أحد من فتحها بدون كلمة المرور.
        </p>
        <div className="w-full max-w-[280px]">
          <input 
            type="password" value={setupPass} onChange={e => setSetupPass(e.target.value)}
            placeholder="أدخل كلمة مرور قوية" 
            className="w-full bg-white border-2 border-gray-200 rounded-2xl px-4 py-4 mb-4 text-center font-bold text-lg focus:border-[#003366] focus:outline-none transition-colors"
          />
          <button onClick={handleSetup} className="w-full bg-[#003366] text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-900 transition-colors">
            إنشاء المحفظة
          </button>
        </div>
      </div>
    );
  }

  if (!vaultPassword) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full animate-in fade-in">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 border border-gray-200">
          <Lock size={36} className="text-gray-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">المحفظة مقفلة</h2>
        <p className="text-sm text-gray-500 text-center mb-8">أدخل كلمة المرور لفك التشفير وعرض الملفات.</p>
        <div className="w-full max-w-[280px]">
          <input 
            type="password" value={unlockPass} onChange={e => setUnlockPass(e.target.value)}
            placeholder="كلمة المرور" 
            className="w-full bg-white border-2 border-gray-200 rounded-2xl px-4 py-4 mb-4 text-center font-bold text-lg focus:border-[#003366] focus:outline-none transition-colors"
          />
          <button onClick={handleUnlock} className="w-full bg-[#003366] text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-900 transition-colors flex items-center justify-center gap-2">
            <Unlock size={20} /> فتح القفل
          </button>
        </div>
      </div>
    );
  }

  if (showSettings) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full animate-in fade-in zoom-in-95">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
          <Settings size={32} className="text-[#003366]" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-6">تغيير كلمة المرور</h2>
        <div className="w-full max-w-[280px]">
          <input 
            type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
            placeholder="كلمة المرور الجديدة" 
            className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 mb-4 text-center focus:border-[#003366] focus:outline-none"
          />
          <button onClick={handleChangePassword} className="w-full bg-[#003366] text-white py-3 rounded-xl font-bold mb-3 shadow-md">
            حفظ التغييرات
          </button>
          <button onClick={() => setShowSettings(false)} className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors">
            إلغاء
          </button>
        </div>
      </div>
    );
  }

  const getIcon = (type: string) => {
    if (type === 'video') return <Video className="text-[#003366]" size={22} />;
    if (type === 'image') return <ImageIcon className="text-[#003366]" size={22} />;
    return <FileIcon className="text-[#003366]" size={22} />;
  };

  return (
    <div className="p-5 space-y-3">
      <div className="flex justify-between items-center mb-4 px-2">
        <h3 className="font-bold text-gray-700">الملفات المشفرة ({records.length})</h3>
        <button onClick={() => setShowSettings(true)} className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-[#003366] transition-colors border border-gray-200">
          <Settings size={20} />
        </button>
      </div>
      
      {records.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-gray-400 opacity-60">
          <LockKeyhole size={48} className="mb-4" />
          <p className="font-medium">المحفظة فارغة</p>
        </div>
      ) : (
        records.map(record => (
          <div 
            key={record.id} 
            onClick={() => onOpenViewer(record)}
            className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-[#003366]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-14 h-14 rounded-[14px] bg-[#003366]/10 flex items-center justify-center shrink-0">
              {getIcon(record.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-800 truncate text-[15px]" dir="ltr">{record.name}</h3>
              <div className="text-[11px] text-[#003366] mt-1.5 flex items-center gap-1.5 font-bold">
                <Lock size={12} /> مشفر (AES-256)
              </div>
            </div>
            <div className="text-gray-400">
              <Eye size={20} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
`;
fs.writeFileSync('src/App.tsx', code);
