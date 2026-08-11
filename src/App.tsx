import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, Download, History, Home, FileIcon, Image as ImageIcon, Video,
  CheckCircle2, XCircle, ArrowRight, Wifi, Smartphone, Loader2,
  UploadCloud, FileText, Lock, Unlock, MoreVertical, Eye, Settings, X, KeyRound, LockKeyhole,
  User, LogOut, ShieldAlert, AlignLeft, Settings2, Share2, Repeat, Trash2, LayoutGrid, List as ListIcon, Crown, Filter, Sparkles, Minimize, Save, Check, ExternalLink, Star
} from 'lucide-react';

import Peer, { DataConnection } from 'peerjs';
import { QRCodeSVG } from 'qrcode.react';
import localforage from 'localforage';
// @ts-ignore
import { FFmpeg } from '@ffmpeg/ffmpeg';
// @ts-ignore
import { fetchFile } from '@ffmpeg/util';

// --- Types ---

interface SuggestedApp {
  id: string;
  name: string;
  url: string;
  imageUri: string;
}

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
  freeImagesLimit: number;
  freeVideosLimit: number;
}

export interface UserData {
  username: string;
  isPremium: boolean;
  premiumExpiryDate: number | null;
}

const ADMIN_KEY = 'super_secret_anti_cheat_key_2026';


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



function FileThumbnail({ recordId }: { recordId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  
  useEffect(() => {
    let objectUrl = '';
    localforage.getItem<Blob>(recordId).then(blob => {
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      }
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [recordId]);

  if (!url) return <div className="w-12 h-12 bg-gray-100 rounded-xl animate-pulse shrink-0" />;
  
  return (
    <img src={url} alt="Thumbnail" className="w-12 h-12 object-cover rounded-xl shadow-sm shrink-0 border border-gray-100" />
  );
}

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


const getFileType = (mime: string) => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
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
const compressImageCanvas = async (blob: Blob, ratio: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas not supported');
      
      const scale = 1; 
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const quality = ratio === 0.2 ? 0.8 : 0.6;
      
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject('Compression failed');
      }, 'image/jpeg', quality);
    };
    img.onerror = () => reject('Image load failed');
    img.src = url;
  });
};


function CompressScreen({ getHistory, onOpenViewer }: any) {
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [records, setRecords] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [ratio, setRatio] = useState<number>(0.2);
  
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  
  const [showDialog, setShowDialog] = useState(false);
  const [compressedResults, setCompressedResults] = useState<{ original: any, compressedBlob: Blob }[]>([]);

  const ffmpegRef = useRef(new FFmpeg());

  useEffect(() => {
    const loadFfmpeg = async () => {
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg.loaded) {
        try {
          await ffmpeg.load({
            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
            wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
          });
        } catch (e) {
          console.error("FFmpeg load error:", e);
        }
      }
    };
    loadFfmpeg();
  }, []);

  useEffect(() => {
    const r = getHistory().filter((x: any) => x.type === activeTab && !x.isSent && !x.vaulted);
    setRecords(r);
    setSelectedIds(new Set());
  }, [activeTab]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else {
      if (newSet.size < 100) newSet.add(id);
      else alert('الحد الأقصى هو 100 ملف');
    }
    setSelectedIds(newSet);
  };

  const selectedRecords = records.filter(r => selectedIds.has(r.id));
  const currentTotalSize = selectedRecords.reduce((acc, r) => acc + r.size, 0);
  const estimatedNewSize = currentTotalSize * (1 - ratio);

  const startCompression = async () => {
    if (selectedIds.size === 0) return;
    setIsCompressing(true);
    setProgress(0);
    setCompressedResults([]);
    
    const results: { original: any, compressedBlob: Blob }[] = [];
    const totalFiles = selectedRecords.length;
    
    for (let i = 0; i < totalFiles; i++) {
      const record = selectedRecords[i];
      setProgressText(`جاري ضغط الملف ${i + 1} من ${totalFiles}...`);
      
      try {
        const blob = await localforage.getItem<Blob>(record.id);
        if (!blob) continue;
        
        let compressedBlob: Blob;
        
        if (record.type === 'image') {
          compressedBlob = await compressImageCanvas(blob, ratio);
        } else if (record.type === 'video') {
          const ffmpeg = ffmpegRef.current;
          if (!ffmpeg.loaded) throw new Error('FFmpeg not loaded');
          
          const inputName = `input_${i}.mp4`;
          const outputName = `output_${i}.mp4`;
          
          await ffmpeg.writeFile(inputName, await fetchFile(blob));
          
          ffmpeg.on('progress', ({ progress, time }) => {
             const fileProgress = Math.max(0, Math.min(1, progress)) * 100;
             const overallProgress = ((i / totalFiles) * 100) + (fileProgress / totalFiles);
             setProgress(overallProgress);
          });
          
          const crf = ratio === 0.2 ? '28' : '32';
          await ffmpeg.exec(['-i', inputName, '-vcodec', 'libx264', '-crf', crf, '-preset', 'ultrafast', outputName]);
          
          const data = await ffmpeg.readFile(outputName);
          compressedBlob = new Blob([data], { type: 'video/mp4' });
          
          await ffmpeg.deleteFile(inputName);
          await ffmpeg.deleteFile(outputName);
        } else {
           continue; 
        }
        
        results.push({ original: record, compressedBlob });
        
      } catch (e) {
        console.error('Compression failed for', record.name, e);
      }
      
      setProgress(((i + 1) / totalFiles) * 100);
    }
    
    setCompressedResults(results);
    setIsCompressing(false);
    if (results.length > 0) {
      setShowDialog(true);
    } else {
      alert('فشلت عملية الضغط.');
    }
  };

  const handleDialogChoice = async (replaceOriginal: boolean) => {
    let history = getHistory();
    
    for (const res of compressedResults) {
      const newId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const ext = res.original.name.split('.').pop();
      const base = res.original.name.substring(0, res.original.name.lastIndexOf('.'));
      
      const newRecord = {
        ...res.original,
        id: newId,
        size: res.compressedBlob.size,
        timestamp: Date.now(),
        name: `${base}_compressed.${ext}`
      };
      
      await localforage.setItem(newId, res.compressedBlob);
      history.unshift(newRecord);
      
      if (replaceOriginal) {
        await localforage.removeItem(res.original.id);
        history = history.filter((r: any) => r.id !== res.original.id);
      }
    }
    
    localStorage.setItem('p2p_history', JSON.stringify(history));
    window.dispatchEvent(new Event('history_updated'));
    setShowDialog(false);
    setSelectedIds(new Set());
    
    const r = history.filter((x: any) => x.type === activeTab && !x.isSent && !x.vaulted);
    setRecords(r);
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FA]">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm border-b border-gray-200 shrink-0">
         <h2 className="text-xl font-bold text-[#003366] flex items-center gap-2 mb-4">
           <Minimize size={24} /> أداة الضغط الذكي
         </h2>
         <div className="flex gap-2 bg-gray-100 p-1 rounded-xl mb-4">
           <button 
             onClick={() => setActiveTab('image')}
             className={`flex-1 py-2 font-bold text-sm rounded-lg transition-colors ${activeTab === 'image' ? 'bg-white shadow-sm text-[#003366]' : 'text-gray-500 hover:text-gray-700'}`}
           >
             الصور
           </button>
           <button 
             onClick={() => setActiveTab('video')}
             className={`flex-1 py-2 font-bold text-sm rounded-lg transition-colors ${activeTab === 'video' ? 'bg-white shadow-sm text-[#003366]' : 'text-gray-500 hover:text-gray-700'}`}
           >
             الفيديوهات
           </button>
         </div>

         {selectedIds.size > 0 && !isCompressing && (
           <div className="space-y-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
             <div className="flex gap-2">
               <button 
                 onClick={() => setRatio(0.2)}
                 className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition-colors ${ratio === 0.2 ? 'border-[#003366] bg-blue-100 text-[#003366]' : 'border-transparent bg-white text-gray-500 hover:bg-gray-50'}`}
               >
                 ضغط 20%
               </button>
               <button 
                 onClick={() => setRatio(0.3)}
                 className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition-colors ${ratio === 0.3 ? 'border-[#003366] bg-blue-100 text-[#003366]' : 'border-transparent bg-white text-gray-500 hover:bg-gray-50'}`}
               >
                 ضغط 30%
               </button>
             </div>
             <div className="flex justify-between items-center text-sm px-1">
               <div className="text-gray-500 font-medium flex flex-col">
                 <span>الحجم الفعلي: <span className="text-gray-800 font-bold" dir="ltr">{formatSize(currentTotalSize)}</span></span>
               </div>
               <div className="text-green-600 font-medium flex flex-col text-left">
                 <span>المتوقع: <span className="font-bold" dir="ltr">{formatSize(estimatedNewSize)}</span></span>
               </div>
             </div>
           </div>
         )}
      </div>

      {/* List */}
      <div className="p-4 flex-1 overflow-y-auto pb-24 relative">
        {isCompressing ? (
          <div className="absolute inset-0 bg-white/90 z-10 flex flex-col items-center justify-center space-y-6">
             <div className="relative">
               <Loader2 size={64} className="text-[#003366] animate-spin" />
               <div className="absolute inset-0 flex items-center justify-center font-bold text-sm text-[#003366]">{Math.round(progress)}%</div>
             </div>
             <div className="text-center">
               <p className="font-bold text-gray-800 text-lg mb-1">جاري الضغط محلياً...</p>
               <p className="font-medium text-gray-500 text-sm">{progressText}</p>
             </div>
             <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#003366] transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
             </div>
          </div>
        ) : records.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-80">
            <Minimize size={64} className="mb-4" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">لا توجد ملفات</h3>
            <p className="font-medium text-center">لا توجد {activeTab === 'image' ? 'صور' : 'فيديوهات'} مستلمة قابلة للضغط.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {records.map(record => (
              <div 
                key={record.id} 
                onClick={() => toggleSelection(record.id)}
                className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden flex flex-col cursor-pointer transition-all relative ${selectedIds.has(record.id) ? 'border-[#003366] ring-2 ring-[#003366]/20' : 'border-gray-100 hover:border-gray-300'}`}
              >
                 <div className="aspect-square w-full bg-gray-50 relative flex items-center justify-center">
                   {activeTab === 'image' ? <ImageIcon className="text-gray-300" size={32} /> : <Video className="text-gray-300" size={32} />}
                   <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-colors ${selectedIds.has(record.id) ? 'bg-[#003366] border-[#003366] text-white' : 'bg-white/80 border-gray-300 text-transparent'}`}>
                     <Check size={14} strokeWidth={3} />
                   </div>
                 </div>
                 <div className="p-2">
                    <h4 className="font-bold text-gray-800 text-xs truncate" dir="ltr">{record.name}</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">{formatSize(record.size)}</p>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Start Button */}
      {selectedIds.size > 0 && !isCompressing && (
        <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)] pb-[80px]">
           <button 
             onClick={startCompression}
             className="w-full bg-[#003366] text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-900 transition-colors flex items-center justify-center gap-2"
           >
             <Minimize size={24} />
             بدء الضغط ({selectedIds.size})
           </button>
        </div>
      )}

      {/* Post-Compression Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">تم الضغط بنجاح!</h3>
                <p className="text-gray-500 font-medium text-sm mb-6">
                  تم ضغط {compressedResults.length} ملف لتوفير مساحة جهازك. ماذا تريد أن تفعل بالملفات الأصلية؟
                </p>
                <div className="space-y-3">
                  <button 
                    onClick={() => handleDialogChoice(true)}
                    className="w-full bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 py-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={20} />
                    حفظ المضغوط وحذف الأصل
                  </button>
                  <button 
                    onClick={() => handleDialogChoice(false)}
                    className="w-full bg-[#003366] text-white hover:bg-blue-900 py-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-md"
                  >
                    <Save size={20} />
                    الاحتفاظ بكلاهما
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}


export default function App() {
  const [currentView, setCurrentView] = useState<'auth' | 'home' | 'history' | 'send' | 'receive' | 'vault' | 'admin' | 'premium' | 'filter' | 'compress' | 'suggested'>(localStorage.getItem('p2p_session') ? 'home' : 'auth');
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('p2p_session') || null);
  const [showPremiumWelcome, setShowPremiumWelcome] = useState(false);
  const [users, setUsers] = useState<Record<string, UserData>>({});
  
  const [vaultPassword, setVaultPassword] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{ blob: Blob, name: string, type: string } | null>(null);
  const [resendFile, setResendFile] = useState<{ blob: Blob, name: string, mime: string, size: number } | null>(null);

  const [homeSessionStart, setHomeSessionStart] = useState(Date.now());
  const prevViewRef = useRef(currentView);

  useEffect(() => {
    if (currentView === 'home' && !['send', 'receive', 'home'].includes(prevViewRef.current)) {
      setHomeSessionStart(Date.now());
    }
    prevViewRef.current = currentView;
  }, [currentView]);

  const [settings, setSettings] = useState<AppSettings>({
    appName: 'النقل السريع P2P',
    bannerEnabled: false,
    bannerText: '',
    bannerScrolling: true,
    freeImagesLimit: 20,
    freeVideosLimit: 4
  });

  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('p2p_settings');
      if (stored) {
        setSettings({ ...settings, ...JSON.parse(stored) });
      }
      const u = await loadUsersData();
      setUsers(u);
    };
    init();
    
    const loadSettings = () => {
      const stored = localStorage.getItem('p2p_settings');
      if (stored) {
        setSettings(prev => ({ ...prev, ...JSON.parse(stored) }));
      }
    };
    window.addEventListener('settings_updated', loadSettings);
    return () => window.removeEventListener('settings_updated', loadSettings);
  }, []);

  const handleUpdateUser = async (username: string, updates: Partial<UserData>) => {
    const updatedUsers = { ...users };
    if (!updatedUsers[username]) {
       updatedUsers[username] = { username, isPremium: false, premiumExpiryDate: null };
    }
    updatedUsers[username] = { ...updatedUsers[username], ...updates };
    setUsers(updatedUsers);
    await saveUsersData(updatedUsers);
  };


  const handleResend = (fileDetails: any) => {
    setResendFile(fileDetails);
    setCurrentView('send');
  };

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
      
      await localforage.setItem(`vault_${record.id}`, { encrypted, iv, salt });
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
        const vaultedStr = await localforage.getItem<any>(`vault_${record.id}`);
        if (!vaultedStr) return alert('الملف غير موجود.');
        const decryptedBuf = await decryptData(vaultedStr.encrypted, vaultedStr.iv, vaultedStr.salt, vaultPassword);
        const blob = new Blob([decryptedBuf], { type: record.mime });
        setViewingFile({ blob, name: record.name, type: record.type });
      } else {
        const fileBlob = await localforage.getItem<Blob>(record.id);
        if (!fileBlob) return alert('الملف غير متوفر محلياً للعرض. قد يكون تم حذفه من التخزين المؤقت للمتصفح.');
        setViewingFile({ blob: fileBlob, name: record.name, type: record.type });
      }
    } catch (e) {
      console.error(e);
      alert('فشل في عرض الملف. قد تكون كلمة المرور غير صحيحة.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('p2p_session');
    setCurrentUser(null);
    setCurrentView('auth');
    setVaultPassword(null);
  };

  
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
               <div className="flex items-center gap-1">
                 {!users[currentUser]?.isPremium && (
                   <button onClick={() => setCurrentView('premium')} className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-amber-500 text-white px-3 py-1.5 rounded-full shadow hover:opacity-90 transition-opacity">
                     <Crown size={16} className="text-white fill-current" />
                     <span className="text-sm font-bold">Premium</span>
                   </button>
                 )}
                 <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors text-red-300 ml-1">

                   <LogOut size={22} />
                 </button>
               </div>
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
          {currentView === 'home' && <HomeScreen onNavigate={setCurrentView} sessionStartTime={homeSessionStart} onOpenViewer={openViewer} />}
          {currentView === 'history' && <HistoryScreen onOpenViewer={openViewer} onMoveToVault={moveFileToVault} onResend={handleResend} />}
          {currentView === 'vault' && <VaultScreen vaultPassword={vaultPassword} setVaultPassword={setVaultPassword} onOpenViewer={openViewer} />}
          {currentView === 'send' && <SendScreen onBack={() => { setResendFile(null); setCurrentView('home'); }} resendFile={resendFile} onClearResend={() => setResendFile(null)} settings={settings} currentUser={currentUser} userData={currentUser ? users[currentUser] : null} onLimitExceeded={() => setCurrentView('premium')} />}
          {currentView === 'receive' && <ReceiveScreen onBack={() => setCurrentView('home')} />}
          {currentView === 'admin' && <AdminScreen currentSettings={settings} onBack={() => setCurrentView('home')} onLogout={handleLogout} users={users} onUpdateUser={handleUpdateUser} onUpdateSettings={setSettings} />}
          {currentView === 'premium' && <PremiumScreen onBack={() => setCurrentView('home')} />}
          {currentView === 'filter' && <FilterScreen />}
          {currentView === 'suggested' && <SuggestedAppsScreen />}
          {currentView === 'compress' && <CompressScreen getHistory={getHistory} onOpenViewer={setViewingFile} />}
        </main>

        {/* Bottom Navigation */}
        {['home', 'history', 'vault', 'filter', 'compress', 'suggested'].includes(currentView) && (
          <nav className="absolute bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-2 z-10 pb-5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <NavItem view="home" current={currentView} icon={<Home size={22} />} label="الرئيسية" onClick={() => setCurrentView('home')} />
            <NavItem view="history" current={currentView} icon={<History size={22} />} label="السجل" onClick={() => setCurrentView('history')} />
            <NavItem view="vault" current={currentView} icon={<LockKeyhole size={22} />} label="المحفظة" onClick={() => setCurrentView('vault')} />
            <NavItem view="compress" current={currentView} icon={<Minimize size={22} />} label="ضغط" onClick={() => setCurrentView('compress')} />
            <NavItem view="filter" current={currentView} icon={<Filter size={22} />} label="فلترة" onClick={() => setCurrentView('filter')} />
            <NavItem view="suggested" current={currentView} icon={<Star size={22} />} label="مقترحة" onClick={() => setCurrentView('suggested')} />
          </nav>
        )}
      </div>

      {viewingFile && (
        <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />
      )}
      

      {showPremiumWelcome && currentUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
           <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Crown size={32} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">أهلاً بك في الباقة المميزة!</h3>
                <p className="text-gray-600 font-medium text-sm mb-6 leading-relaxed">
                  تم شراء الباقة بنجاح ({users[currentUser]?.premiumExpiryDate === null ? 'مدى الحياة' : (users[currentUser]?.premiumExpiryDate! - Date.now() > 300*24*60*60*1000 ? 'سنوية' : 'شهرية')}).<br/>
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
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors p-2 ${active ? 'text-[#003366]' : 'text-gray-400 hover:text-gray-600'}`}>
      <div className={`p-1.5 rounded-xl ${active ? 'bg-blue-50' : 'bg-transparent'}`}>{icon}</div>
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

// --- Screens ---

function AuthScreen({ onLogin }: { onLogin: (username: string) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return alert('الرجاء إدخال اسم المستخدم وكلمة المرور');

    const handleSuccess = () => {
      if (rememberMe) {
        localStorage.setItem('p2p_session', username);
      }
      onLogin(username);
    };

    if (username === 'admin' && password === 'admin') {
      handleSuccess();
      return;
    }

    const users = JSON.parse(localStorage.getItem('p2p_users') || '{}');
    
    if (isLogin) {
      if (users[username] === password) {
        handleSuccess();
      } else {
        alert('اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    } else {
      if (users[username]) {
        alert('اسم المستخدم مستخدم بالفعل');
      } else {
        users[username] = password;
        localStorage.setItem('p2p_users', JSON.stringify(users));
        handleSuccess();
      }
    }
  };

  return (
    <div className="flex justify-center bg-[#E5E7EB] min-h-screen rtl font-sans" dir="rtl">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl flex flex-col px-8 relative">
        <div className="flex-1 flex flex-col justify-center">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 text-[#003366] mb-6 shadow-inner border border-blue-100">
              <ShieldAlert size={40} />
            </div>
            <h2 className="text-3xl font-black text-[#003366] mb-2">النقل السريع P2P</h2>
            <p className="text-gray-500 font-medium">نظام محلي آمن ومستقل بالكامل</p>
          </div>

          <div className="flex bg-gray-100 rounded-xl p-1 mb-8">
            <button 
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${isLogin ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setIsLogin(true)}
            >تسجيل دخول</button>
            <button 
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${!isLogin ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
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
            
            <div className="flex items-center gap-2 mt-2">
              <input 
                type="checkbox" 
                id="rememberMe" 
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-[#003366] bg-gray-100 border-gray-300 rounded focus:ring-[#003366]"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-600 font-medium cursor-pointer">
                حفظ البيانات
              </label>
            </div>

            <button type="submit" className="w-full bg-[#003366] text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-900 transition-colors mt-4">
              {isLogin ? 'دخول' : 'إنشاء حساب'}
            </button>
          </form>
        </div>
        
        <div className="py-6 text-center text-sm font-medium text-gray-500">
          مع تحيات المبرمج Amir Lamay.
        </div>
      </div>
    </div>
  );
}



function SuggestedAppsScreen() {
  const [apps, setApps] = useState<SuggestedApp[]>([]);

  useEffect(() => {
    const loadedApps = JSON.parse(localStorage.getItem('p2p_suggested_apps') || '[]');
    setApps(loadedApps);
  }, []);

  const handleOpenLink = (url: string) => {
    // Basic formatting for urls to ensure they work
    let finalUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      finalUrl = 'https://' + url;
    }
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="p-6 pb-24 animate-in slide-in-from-right-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-50 text-purple-600 rounded-xl shadow-sm">
          <Sparkles size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-800">برامج مقترحة</h2>
          <p className="text-sm font-medium text-gray-500 mt-1">تطبيقات ومواقع نوصي بها</p>
        </div>
      </div>

      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm text-center px-6">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Star size={32} className="text-gray-300" />
          </div>
          <p className="text-gray-500 font-bold mb-2">لا توجد برامج مقترحة حالياً</p>
          <p className="text-sm text-gray-400">تابعنا قريباً لاكتشاف أفضل البرامج</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {apps.map(app => (
            <div key={app.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
              <img src={app.imageUri} alt={app.name} className="w-16 h-16 object-cover rounded-2xl shadow-sm shrink-0 bg-gray-50 border border-gray-100" />
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="font-bold text-gray-800 truncate mb-1">{app.name}</h3>
                <button 
                  onClick={() => handleOpenLink(app.url)}
                  className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:underline self-start bg-blue-50 px-2 py-1 rounded-md"
                >
                  اضغط هنا <ExternalLink size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterScreen() {
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [duplicates, setDuplicates] = useState<{ original: TransferRecord, copies: TransferRecord[] }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());

  const scanForDuplicates = async () => {
    setIsScanning(true);
    setDuplicates([]);
    setSelectedForDeletion(new Set());
    
    // Slight delay for UX
    await new Promise(r => setTimeout(r, 800));

    const history = getHistory().filter(r => r.type === activeTab && !r.isSent && !r.vaulted);
    
    // A fast algorithm to find duplicates based on name and size
    // For local received files, identical files usually have the exact same name and size
    const groups = new Map<string, TransferRecord[]>();
    
    for (const record of history) {
      const key = `${record.name}_${record.size}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }
    
    const dups = Array.from(groups.values())
      .filter(group => group.length > 1)
      .map(group => {
        // Sort by timestamp, keep the oldest as original
        const sorted = group.sort((a, b) => a.timestamp - b.timestamp);
        return {
          original: sorted[0],
          copies: sorted.slice(1)
        };
      });
      
    setDuplicates(dups);
    setIsScanning(false);
  };

  useEffect(() => {
    scanForDuplicates();
  }, [activeTab]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedForDeletion);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedForDeletion(newSet);
  };

  const selectAllCopies = () => {
    const newSet = new Set<string>();
    duplicates.forEach(d => {
      d.copies.forEach(c => newSet.add(c.id));
    });
    setSelectedForDeletion(newSet);
  };

  const deleteSelected = async () => {
    if (selectedForDeletion.size === 0) return;
    if (!confirm(`هل أنت متأكد من حذف ${selectedForDeletion.size} ملف/ملفات مكررة لتوفير المساحة؟`)) return;
    
    const history = getHistory();
    let updatedHistory = history;
    
    for (const id of selectedForDeletion) {
      await localforage.removeItem(id);
      updatedHistory = updatedHistory.filter(r => r.id !== id);
    }
    
    localStorage.setItem('p2p_history', JSON.stringify(updatedHistory));
    window.dispatchEvent(new Event('history_updated'));
    
    alert('تم تنظيف الملفات المكررة بنجاح.');
    scanForDuplicates();
  };

  const getIcon = (type: string) => {
    if (type === 'video') return <Video className="text-[#003366]" size={22} />;
    if (type === 'image') return <ImageIcon className="text-[#003366]" size={22} />;
    return <FileIcon className="text-[#003366]" size={22} />;
  };


  return (
    <div className="flex flex-col h-full bg-[#F8F9FA]">
      <div className="bg-white p-4 shadow-sm border-b border-gray-200 shrink-0">
         <h2 className="text-xl font-bold text-[#003366] flex items-center gap-2 mb-4">
           <Filter size={24} /> فلترة التكرار
         </h2>
         <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
           <button 
             onClick={() => setActiveTab('image')}
             className={`flex-1 py-2 font-bold text-sm rounded-lg transition-colors ${activeTab === 'image' ? 'bg-white shadow-sm text-[#003366]' : 'text-gray-500 hover:text-gray-700'}`}
           >
             الصور
           </button>
           <button 
             onClick={() => setActiveTab('video')}
             className={`flex-1 py-2 font-bold text-sm rounded-lg transition-colors ${activeTab === 'video' ? 'bg-white shadow-sm text-[#003366]' : 'text-gray-500 hover:text-gray-700'}`}
           >
             الفيديوهات
           </button>
         </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {isScanning ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
             <Loader2 size={48} className="text-[#003366] animate-spin" />
             <p className="font-bold text-gray-600 animate-pulse">جاري فحص الملفات المكررة...</p>
          </div>
        ) : duplicates.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-80">
            <Sparkles size={64} className="mb-4 text-green-500" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">جهازك نظيف!</h3>
            <p className="font-medium text-center max-w-[250px]">لا توجد ملفات {activeTab === 'image' ? 'صور' : 'فيديوهات'} مكررة في السجل.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-blue-50 p-3 rounded-xl border border-blue-100">
               <span className="font-bold text-[#003366] text-sm">تم العثور على {duplicates.reduce((acc, d) => acc + d.copies.length, 0)} ملف مكرر</span>
               <button onClick={selectAllCopies} className="text-xs bg-white border border-blue-200 text-[#003366] px-3 py-1.5 rounded-lg font-bold shadow-sm">تحديد الكل</button>
            </div>
            
            {duplicates.map((group, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                 <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                   <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                     {getIcon(group.original.type)}
                   </div>
                   <div className="flex-1 min-w-0">
                     <h4 className="font-bold text-gray-800 text-sm truncate" dir="ltr">{group.original.name}</h4>
                     <p className="text-xs text-gray-500">{formatSize(group.original.size)} • النسخة الأصلية</p>
                   </div>
                 </div>
                 <div className="p-2 space-y-2">
                   {group.copies.map(copy => (
                     <div 
                       key={copy.id}
                       onClick={() => toggleSelection(copy.id)}
                       className={`p-3 rounded-xl border-2 cursor-pointer transition-colors flex items-center justify-between ${selectedForDeletion.has(copy.id) ? 'border-red-400 bg-red-50' : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}
                     >
                       <div className="flex-1 min-w-0 pr-2">
                         <span className="text-xs text-gray-500">نسخة مكررة</span>
                       </div>
                       <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedForDeletion.has(copy.id) ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300'}`}>
                         {selectedForDeletion.has(copy.id) && <CheckCircle2 size={16} />}
                       </div>
                     </div>
                   ))}
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedForDeletion.size > 0 && (
        <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)]">
           <button 
             onClick={deleteSelected}
             className="w-full bg-red-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
           >
             <Trash2 size={24} />
             حذف المكرر ({selectedForDeletion.size})
           </button>
        </div>
      )}
    </div>
  );
}

function PremiumScreen({ onBack }: { onBack: () => void }) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  return (
    <>
      <div className="p-6 flex flex-col h-full bg-gradient-to-b from-amber-50 to-white animate-in slide-in-from-bottom-4 relative">
         <button onClick={onBack} className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-gray-800">
           <X size={24} />
         </button>
         
         <div className="text-center mt-8 mb-8">
           <Crown size={64} className="mx-auto text-amber-500 mb-4 fill-current" />
           <h2 className="text-3xl font-black text-gray-800 mb-2">Premium</h2>
           <p className="text-gray-600">أرسل أكثر من 500 صورة و 50 فيديو دفعة واحدة!</p>
         </div>
         
         <div className="space-y-4 flex-1 overflow-y-auto pb-10">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
               <div>
                 <h3 className="font-bold text-lg text-gray-800">اشتراك شهري</h3>
                 <p className="text-sm text-gray-500">تجديد كل شهر</p>
               </div>
               <div className="text-left flex flex-col items-end">
                 <span className="block font-black text-2xl text-amber-600 mb-2">1$</span>
                 <button onClick={() => setSelectedPlan('شهري')} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors">ادفع</button>
               </div>
            </div>
            
            <div className="bg-amber-50 p-5 rounded-2xl shadow-md border-2 border-amber-200 flex items-center justify-between relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">الأكثر شعبية</div>
               <div>
                 <h3 className="font-bold text-lg text-amber-900">اشتراك سنوي</h3>
                 <p className="text-sm text-amber-700/70">توفير كبير جداً</p>
               </div>
               <div className="text-left flex flex-col items-end">
                 <span className="block font-black text-2xl text-amber-600 mb-2">10$</span>
                 <button onClick={() => setSelectedPlan('سنوي')} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-md transition-colors">ادفع</button>
               </div>
            </div>
            
            <div className="bg-gray-900 p-5 rounded-2xl shadow-lg border-2 border-gray-800 flex items-center justify-between">
               <div>
                 <h3 className="font-bold text-lg text-amber-400">مدى الحياة</h3>
                 <p className="text-sm text-gray-400">دفع مرة واحدة فقط</p>
               </div>
               <div className="text-left flex flex-col items-end">
                 <span className="block font-black text-2xl text-white mb-2">20$</span>
                 <button onClick={() => setSelectedPlan('مدى الحياة')} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors">ادفع</button>
               </div>
            </div>
         </div>
      </div>

      {selectedPlan && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
             <button onClick={() => setSelectedPlan(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800">
               <X size={24} />
             </button>
             <div className="text-center mt-4">
               <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Smartphone size={32} className="text-green-600" />
               </div>
               <h3 className="text-xl font-bold text-gray-800 mb-2">تواصل للدفع</h3>
               <p className="text-gray-500 text-sm leading-relaxed mb-6">
                 لإتمام الدفع وتفعيل الباقة ({selectedPlan})، يرجى التواصل معنا عبر واتساب. سيتم تفعيل حسابك فوراً.
               </p>
               <button 
                 onClick={() => {
                   const message = encodeURIComponent(`مرحباً، أود الاشتراك في باقة ${selectedPlan} لتطبيق النقل السريع.`);
                   window.open(`https://wa.me/201014955160?text=${message}`, '_blank');
                 }}
                 className="w-full bg-[#25D366] text-white py-3 rounded-xl font-bold text-lg shadow-md hover:bg-[#25D366]/90 transition-colors flex items-center justify-center gap-2"
               >
                 تواصل عبر واتساب
               </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
}


function AdminScreen({ currentSettings, onBack, onLogout, users, onUpdateUser, onUpdateSettings }: any) {
  
  const [appName, setAppName] = useState(currentSettings.appName);
  
  // Suggested Apps
  const [suggestedApps, setSuggestedApps] = useState<SuggestedApp[]>([]);
  const [newAppName, setNewAppName] = useState('');
  const [newAppUrl, setNewAppUrl] = useState('');
  const [newAppImage, setNewAppImage] = useState('');

  useEffect(() => {
    const apps = JSON.parse(localStorage.getItem('p2p_suggested_apps') || '[]');
    setSuggestedApps(apps);
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewAppImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddApp = () => {
    if (!newAppName || !newAppUrl || !newAppImage) {
      return alert('الرجاء إدخال اسم البرنامج، والرابط، واختيار صورة');
    }
    const newApp: SuggestedApp = {
      id: Date.now().toString(),
      name: newAppName,
      url: newAppUrl,
      imageUri: newAppImage
    };
    const updated = [...suggestedApps, newApp];
    setSuggestedApps(updated);
    localStorage.setItem('p2p_suggested_apps', JSON.stringify(updated));
    setNewAppName('');
    setNewAppUrl('');
    setNewAppImage('');
    alert('تمت إضافة البرنامج بنجاح');
  };

  const handleDeleteApp = (id: string) => {
    const updated = suggestedApps.filter(app => app.id !== id);
    setSuggestedApps(updated);
    localStorage.setItem('p2p_suggested_apps', JSON.stringify(updated));
  };

  const [bannerEnabled, setBannerEnabled] = useState(currentSettings.bannerEnabled);
  const [bannerText, setBannerText] = useState(currentSettings.bannerText);
  const [bannerScrolling, setBannerScrolling] = useState(currentSettings.bannerScrolling);
  const [freeImagesLimit, setFreeImagesLimit] = useState(currentSettings.freeImagesLimit || 20);
  const [freeVideosLimit, setFreeVideosLimit] = useState(currentSettings.freeVideosLimit || 4);

  const handleSave = () => {
    const newSettings: AppSettings = { appName, bannerEnabled, bannerText, bannerScrolling, freeImagesLimit, freeVideosLimit };
    localStorage.setItem('p2p_settings', JSON.stringify(newSettings));
    onUpdateSettings(newSettings);
    window.dispatchEvent(new Event('settings_updated'));
    alert('تم حفظ الإعدادات بنجاح');
  };

  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-right-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-[#003366] mb-4 flex items-center gap-2">
          <Settings2 size={20} /> الإعدادات العامة
        </h3>
        <label className="block text-sm font-bold text-gray-700 mb-2">اسم البرنامج</label>
        <input 
          type="text" value={appName} onChange={e => setAppName(e.target.value)}
          className="w-full bg-gray-50 border-2 border-gray-200 focus:border-[#003366] rounded-xl px-4 py-3 font-bold outline-none transition-colors mb-2"
        />
        
        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="block text-sm font-bold text-gray-700 mb-2">حدود الإرسال المجانية</label>
          <div className="flex gap-4">
            <div className="flex-1">
              <span className="text-xs text-gray-500 mb-1 block">الصور</span>
              <input type="number" value={freeImagesLimit} onChange={e => setFreeImagesLimit(Number(e.target.value))} className="w-full bg-gray-50 border-2 border-gray-200 focus:border-[#003366] rounded-xl px-4 py-3 font-bold outline-none" />
            </div>
            <div className="flex-1">
              <span className="text-xs text-gray-500 mb-1 block">الفيديوهات</span>
              <input type="number" value={freeVideosLimit} onChange={e => setFreeVideosLimit(Number(e.target.value))} className="w-full bg-gray-50 border-2 border-gray-200 focus:border-[#003366] rounded-xl px-4 py-3 font-bold outline-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-[#003366] flex items-center gap-2">
            <AlignLeft size={20} /> الشريط الإعلاني
          </h3>
          <button 
            onClick={() => setBannerEnabled(!bannerEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${bannerEnabled ? 'bg-[#003366]' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${bannerEnabled ? '-translate-x-6' : '-translate-x-1'}`} />
          </button>
        </div>
        {bannerEnabled && (
          <div className="space-y-4 pt-2 animate-in fade-in zoom-in-95">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">نص الشريط</label>
              <textarea 
                value={bannerText} onChange={e => setBannerText(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-200 focus:border-[#003366] rounded-xl px-4 py-3 font-medium outline-none transition-colors min-h-[80px]"
              />
            </div>
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-sm font-bold text-gray-700">شريط متحرك</span>
              <button 
                onClick={() => setBannerScrolling(!bannerScrolling)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${bannerScrolling ? 'bg-[#003366]' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${bannerScrolling ? '-translate-x-6' : '-translate-x-1'}`} />
              </button>
            </div>
          </div>
        )}
      
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <h3 className="text-lg font-bold text-[#003366] flex items-center gap-2">
          <Star size={20} /> برامج مقترحة من المطور
        </h3>
        
        <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">اسم البرنامج/الموقع</label>
            <input 
              type="text" value={newAppName} onChange={e => setNewAppName(e.target.value)}
              className="w-full bg-white border border-gray-200 focus:border-[#003366] rounded-lg px-3 py-2 text-sm font-bold outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">رابط الموقع</label>
            <input 
              type="url" value={newAppUrl} onChange={e => setNewAppUrl(e.target.value)} dir="ltr"
              className="w-full bg-white border border-gray-200 focus:border-[#003366] rounded-lg px-3 py-2 text-sm text-left outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">صورة البرنامج</label>
            <input 
              type="file" accept="image/*" onChange={handleImageSelect}
              className="w-full text-sm text-gray-500 file:mr-0 file:ml-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-[#003366] hover:file:bg-blue-100"
            />
            {newAppImage && <img src={newAppImage} alt="Preview" className="mt-2 w-16 h-16 object-cover rounded-xl shadow-sm" />}
          </div>
          <button onClick={handleAddApp} className="w-full bg-[#003366] text-white py-2.5 rounded-lg font-bold text-sm shadow-md hover:bg-blue-900 transition-colors mt-2">
            ارفع
          </button>
        </div>

        {suggestedApps.length > 0 && (
          <div className="mt-4 space-y-2">
            <label className="block text-xs font-bold text-gray-700 mb-2">البرامج المضافة:</label>
            {suggestedApps.map(app => (
              <div key={app.id} className="flex items-center gap-3 bg-white border border-gray-100 p-2 rounded-xl shadow-sm">
                <img src={app.imageUri} alt={app.name} className="w-10 h-10 object-cover rounded-lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{app.name}</p>
                  <p className="text-xs text-gray-500 truncate" dir="ltr">{app.url}</p>
                </div>
                <button onClick={() => handleDeleteApp(app.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={handleSave}
 className="w-full bg-[#003366] text-white py-4 rounded-xl font-bold text-lg shadow-md hover:bg-blue-900 transition-colors">
        حفظ الإعدادات
      </button>
      
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mt-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <User size={20} className="text-[#003366]" /> إدارة المستخدمين
        </h3>
        <div className="space-y-3">
          {Object.values(users).length === 0 ? (
             <p className="text-sm text-gray-500 text-center py-4">لا يوجد مستخدمين حالياً</p>
          ) : (
            Object.values(users).map((u: any) => (
              <div key={u.username} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                 <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800">{u.username}</span>
                    {u.isPremium ? (
                      <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
                        <Crown size={12} /> Premium
                      </span>
                    ) : (
                      <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full font-bold">مجاني</span>
                    )}
                 </div>
                 
                 <div className="flex gap-2 mt-2 flex-wrap">
                    {!u.isPremium ? (
                       <>
                         <button onClick={() => onUpdateUser(u.username, { isPremium: true, premiumExpiryDate: Date.now() + 30*24*60*60*1000 })} className="text-xs bg-[#003366] text-white px-3 py-1.5 rounded shadow-sm flex-1">شهر</button>
                         <button onClick={() => onUpdateUser(u.username, { isPremium: true, premiumExpiryDate: Date.now() + 365*24*60*60*1000 })} className="text-xs bg-[#003366] text-white px-3 py-1.5 rounded shadow-sm flex-1">سنة</button>
                         <button onClick={() => onUpdateUser(u.username, { isPremium: true, premiumExpiryDate: null })} className="text-xs bg-[#003366] text-white px-3 py-1.5 rounded shadow-sm flex-1">مدى الحياة</button>
                       </>
                    ) : (
                       <button onClick={() => onUpdateUser(u.username, { isPremium: false, premiumExpiryDate: null })} className="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1.5 rounded shadow-sm w-full font-bold">
                         إيقاف الباقة (Revoke)
                       </button>
                    )}
                 </div>
              </div>
            ))
          )}
        </div>
      </div>

      <button onClick={onLogout} className="w-full bg-red-50 text-red-600 border border-red-100 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors mt-8">
        <LogOut size={20} /> تسجيل الخروج
      </button>
    </div>
  );
}


function HomeScreen({ onNavigate, sessionStartTime, onOpenViewer }: any) {
  const [recentRecords, setRecentRecords] = useState<any[]>([]);

  useEffect(() => {
    const updateRecords = () => {
      const history = JSON.parse(localStorage.getItem('p2p_history') || '[]');
      const filtered = history.filter((r: any) => r.timestamp >= sessionStartTime && !r.vaulted);
      setRecentRecords(filtered);
    };
    updateRecords();
    window.addEventListener('history_updated', updateRecords);
    return () => window.removeEventListener('history_updated', updateRecords);
  }, [sessionStartTime]);

  const getIcon = (type: string) => {
    if (type === 'video') return <Video className="text-[#003366]" size={18} />;
    if (type === 'image') return <ImageIcon className="text-[#003366]" size={18} />;
    return <FileIcon className="text-[#003366]" size={18} />;
  };


  return (
    <div className="p-6 flex flex-col h-full bg-[#F8F9FA] overflow-y-auto pb-24">
      <div className="text-center mb-8 mt-4 animate-in slide-in-from-top-4 duration-500">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-100 to-white text-[#003366] mb-4 shadow-sm border border-white">
          <Wifi size={40} className="drop-shadow-sm" />
        </div>
        <h2 className="text-2xl font-black text-gray-800 tracking-tight">نقل ملفات سريع</h2>
        <p className="text-sm text-gray-500 mt-2 font-medium">مباشر، آمن، وبدون خوادم وسيطة</p>
      </div>

      <div className="flex flex-row gap-4 mb-8">
        <button 
          onClick={() => onNavigate('send')}
          className="flex-1 bg-[#003366] text-white rounded-3xl p-6 flex flex-col items-center gap-3 shadow-lg shadow-blue-900/20 hover:shadow-[0_0_20px_rgba(0,51,102,0.6)] hover:bg-[#002244] transition-all duration-300 transform active:scale-95 group relative overflow-hidden border border-[#004080]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center shadow-inner relative z-10 group-hover:scale-110 transition-transform duration-300">
            <Send size={32} className="ml-1 drop-shadow-md" />
          </div>
          <div className="text-center relative z-10 w-full">
            <h2 className="text-xl font-bold mb-1 truncate">إرسال</h2>
            <p className="text-blue-200 text-xs font-medium truncate w-full">مشاركة فورية</p>
          </div>
        </button>

        <button 
          onClick={() => onNavigate('receive')}
          className="flex-1 bg-white text-[#003366] border border-blue-100 rounded-3xl p-6 flex flex-col items-center gap-3 shadow-lg shadow-blue-900/5 hover:shadow-[0_0_20px_rgba(0,51,102,0.2)] hover:bg-blue-50 transition-all duration-300 transform active:scale-95 group relative overflow-hidden"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-50/50 flex items-center justify-center shadow-inner relative z-10 group-hover:bg-white group-hover:scale-110 transition-all duration-300 border border-blue-100/50">
            <Download size={32} className="drop-shadow-sm text-blue-600" />
          </div>
          <div className="text-center relative z-10 w-full">
            <h2 className="text-xl font-bold mb-1 truncate">استقبال</h2>
            <p className="text-gray-500 text-xs font-medium truncate w-full">استلام بالكود</p>
          </div>
        </button>
      </div>

      {recentRecords.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
             <Sparkles size={18} className="text-amber-500" />
             العمليات المنتهية للتو
           </h3>
           <div className="space-y-3">
             {recentRecords.map(record => (
               <div 
                 key={record.id} 
                 onClick={() => onOpenViewer(record)}
                 className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer"
               >
                 <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 relative overflow-hidden">
                   <Thumbnail record={record} icon={getIcon(record.type)} />
                 </div>
                 
                 <div className="flex-1 min-w-0">
                   <h3 className="font-bold text-gray-800 truncate text-[14px]" dir="ltr">{record.name}</h3>
                   <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 font-medium">
                     <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${record.isSent ? 'bg-blue-50 text-[#003366]' : 'bg-green-50 text-[#28A745]'}`}>
                       {record.isSent ? <Send size={8} /> : <Download size={8} />}
                       {record.isSent ? 'مُرسل' : 'مُستلم'}
                     </span>
                     <span>{formatSize(record.size)}</span>
                   </div>
                 </div>
                 
                 <div className="shrink-0 text-green-500 bg-green-50 p-2 rounded-full">
                   <CheckCircle2 size={16} />
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
}


function SendScreen({ onBack, resendFile, onClearResend, settings, currentUser, userData, onLimitExceeded }: any) {
  const [peerId, setPeerId] = useState<string>('');
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [filesQueue, setFilesQueue] = useState<{blob: Blob|File, name: string, mime: string, size: number}[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  
  const peerRef = useRef<Peer | null>(null);
  const onAckRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = Math.floor(100000 + Math.random() * 900000).toString();
    setPeerId(id);
    const peer = new Peer(`${APP_PREFIX}${id}`);
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

  const startTransfers = (items: {blob: Blob|File, name: string, mime: string, size: number}[]) => {
    if (!connection || !items.length) return;
    setIsTransferring(true);
    setProgress(0);
    setTransferSuccess(false);
    
    let index = 0;
    let offset = 0;
    let currentItem = items[index];
    
    setFilesQueue(items);
    setCurrentFileIndex(0);

    const sendNextChunk = () => {
      if (offset < currentItem.size) {
        const chunk = currentItem.blob.slice(offset, offset + CHUNK_SIZE);
        chunk.arrayBuffer().then(buffer => {
          connection.send({ type: 'chunk', data: buffer });
          offset += chunk.size;
          setProgress(Math.round((offset / currentItem.size) * 100));
        });
      } else {
        connection.send({ type: 'eof' });
        
        if (!resendFile) {
           const recordId = saveToHistory({
              name: currentItem.name, size: currentItem.size, isSent: true, status: 'SUCCESS',
             type: getFileType(currentItem.mime), mime: currentItem.mime
           });
           if (recordId) localforage.setItem(recordId, currentItem.blob);
        }
        
        index++;
        if (index < items.length) {
          currentItem = items[index];
          offset = 0;
          setCurrentFileIndex(index);
          setProgress(0);
          connection.send({ type: 'header', name: currentItem.name, size: currentItem.size, mime: currentItem.mime });
        } else {
          setIsTransferring(false);
          setTransferSuccess(true);
        }
      }
    };
    onAckRef.current = sendNextChunk;
    connection.send({ type: 'header', name: currentItem.name, size: currentItem.size, mime: currentItem.mime });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let allowedImages = settings?.freeImagesLimit || 20;
    let allowedVideos = settings?.freeVideosLimit || 4;
    
    const isPremium = userData?.isPremium;
    if (isPremium || currentUser === 'admin') {
      allowedImages = Infinity;
      allowedVideos = Infinity;
    }

    const imageCount = files.filter(f => f.type.startsWith('image/')).length;
    const videoCount = files.filter(f => f.type.startsWith('video/')).length;

    if (imageCount > allowedImages || videoCount > allowedVideos) {
       alert(`لا يمكن تحديد أكثر من ${allowedImages} صورة و ${allowedVideos} فيديوهات في الباقة الحالية`);
       if (!isPremium && currentUser !== 'admin') {
          onLimitExceeded();
       }
       return;
    }

    const items = files.map(f => ({ blob: f, name: f.name, mime: f.type, size: f.size }));
    startTransfers(items);
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
            <div className="w-full animate-in fade-in">
              {resendFile ? (
                 <div className="w-full flex flex-col gap-4">
                   <div className="p-4 bg-blue-50 rounded-2xl flex items-center justify-between border border-blue-100">
                     <div className="flex items-center gap-3 min-w-0">
                       <div className="p-2 bg-white rounded-xl shadow-sm text-[#003366]">
                         <FileText size={24} />
                       </div>
                       <div className="flex flex-col items-start min-w-0 flex-1">
                          <span className="font-bold text-sm text-[#003366] truncate w-full text-right" dir="ltr">{resendFile.name}</span>
                          <span className="text-xs text-gray-500">{formatSize(resendFile.size)}</span>
                       </div>
                     </div>
                   </div>
                   <button 
                     onClick={() => startTransfers([{blob: resendFile.blob, name: resendFile.name, mime: resendFile.mime, size: resendFile.size}])}
                     className="w-full py-4 bg-[#003366] text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-900 transition-colors flex items-center justify-center gap-3"
                   >
                     <Send size={24} />
                     إرسال الملف
                   </button>
                 </div>
              ) : (
                 <>
                   <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="w-full py-4 bg-[#003366] text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-900 transition-colors flex items-center justify-center gap-3"
                   >
                     <UploadCloud size={24} />
                     اختر ملفات للإرسال
                   </button>
                 </>
              )}
            </div>
          )}

          {isTransferring && (
            <div className="w-full space-y-4">
              <div className="flex justify-between text-sm font-bold text-[#003366]">
                <span>جاري الإرسال ({currentFileIndex + 1}/{filesQueue.length})...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#003366] transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-xs text-gray-500 truncate" dir="ltr">{filesQueue[currentFileIndex]?.name}</div>
            </div>
          )}

          {transferSuccess && (
            <div className="w-full flex flex-col items-center space-y-4">
              <div className="text-green-600 font-bold flex items-center gap-2 bg-green-50 px-4 py-2 rounded-xl border border-green-100 w-full justify-center">
                <CheckCircle2 size={20} /> تم الإرسال بنجاح!
              </div>
              <button onClick={() => { setTransferSuccess(false); if (onClearResend) onClearResend(); }} className="text-[#003366] font-bold text-sm hover:underline mt-4">
                إرسال ملفات أخرى
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

  const [currentFileTransferred, setCurrentFileTransferred] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const speedRef = useRef({ lastBytes: 0, lastTime: 0 });


  const peerRef = useRef<Peer | null>(null);

  useEffect(() => {
    peerRef.current = new Peer();
    return () => { if (peerRef.current) peerRef.current.destroy(); };
  }, []);

  const handleConnect = () => {
    if (!targetId || targetId.length !== 6 || !peerRef.current) return;
    setIsConnecting(true);
    const conn = peerRef.current.connect(`${APP_PREFIX}${targetId}`, { reliable: true });
    
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
    let 
        receivedSize = 0;
        setCurrentFileTransferred(0);
        setTransferSpeed(0);
        setEta(null);
        speedRef.current = { lastBytes: 0, lastTime: performance.now() };

    let fileMeta: any = null;

    conn.on('data', (msg: any) => {
      if (msg.type === 'header') {
        setIsTransferring(true);
        setTransferSuccess(false);
        fileMeta = msg;
        setReceivedFileDetails({ name: msg.name, size: msg.size });
        receivedBuffers = [];
        
        receivedSize = 0;
        setCurrentFileTransferred(0);
        setTransferSpeed(0);
        setEta(null);
        speedRef.current = { lastBytes: 0, lastTime: performance.now() };

        conn.send({ type: 'ack' });
      } else if (msg.type === 'chunk') {
        receivedBuffers.push(msg.data);

        receivedSize += msg.data.byteLength;
        setProgress(Math.round((receivedSize / fileMeta.size) * 100));
        setCurrentFileTransferred(receivedSize);

        const now = performance.now();
        if (now - speedRef.current.lastTime >= 1000) {
          const bytesSinceLast = receivedSize - speedRef.current.lastBytes;
          const timeSinceLast = (now - speedRef.current.lastTime) / 1000;
          const speed = bytesSinceLast / timeSinceLast;
          setTransferSpeed(speed);
          setEta(speed > 0 ? (fileMeta.size - receivedSize) / speed : null);
          speedRef.current = { lastBytes: receivedSize, lastTime: now };
        }

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
                <div className="h-full bg-[#003366] transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between items-center text-xs font-medium mt-1 text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                 <div className="flex flex-col gap-1 text-right">
                   <span className="text-[#003366] font-bold">الحجم الإجمالي: {formatSize(receivedFileDetails?.size || 0)}</span>
                   <span>تم استلام: {formatSize(currentFileTransferred)}</span>
                 </div>
                 <div className="flex flex-col items-end gap-1">
                    <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-md font-bold" dir="ltr">{formatSize(transferSpeed)}/s</span>
                    <span className="text-[#003366] font-bold">{formatTime(eta)}</span>
                 </div>
              </div>

            </div>
          )}
          {transferSuccess && (
            <div className="w-full flex flex-col items-center mt-6 space-y-4">
              <div className="text-green-600 font-bold flex items-center gap-2 bg-green-50 px-4 py-2 rounded-xl border border-green-100">
                <CheckCircle2 size={20} /> اكتمل التحميل! تم تنزيل الملف وحفظه.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Thumbnail({ record, icon }: { record: TransferRecord, icon: React.ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let isMounted = true;
    
    if (record.type === 'image' || record.type === 'video') {
      localforage.getItem<Blob>(record.id).then(blob => {
        if (blob && isMounted) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      });
    }
    
    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [record.id, record.type]);

  if (url) {
    if (record.type === 'image') return <img src={url} className="w-full h-full object-cover" />;
    if (record.type === 'video') return (
      <div className="relative w-full h-full">
         <video src={url} className="w-full h-full object-cover" />
         <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Video size={16} className="text-white" />
         </div>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full bg-blue-50 flex items-center justify-center">
      {icon}
    </div>
  );
}

function HistoryItemMenu({ onMoveToVault, onShare, onDelete, onResend }: any) {
  return (
    <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-30 animate-in fade-in zoom-in-95">
      <button onClick={(e) => { e.stopPropagation(); onShare(); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
        <Share2 size={16} className="text-blue-500" /> مشاركة
      </button>
      <button onClick={(e) => { e.stopPropagation(); onResend(); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
        <Repeat size={16} className="text-green-500" /> إعادة إرسال
      </button>
      <button onClick={(e) => { e.stopPropagation(); onMoveToVault(); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
        <Lock size={16} className="text-[#003366]" /> نقل إلى المحفظة
      </button>
      <div className="h-px bg-gray-100 my-1" />
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
        <Trash2 size={16} /> حذف الملف
      </button>
    </div>
  );
}

function HistoryScreen({ onOpenViewer, onMoveToVault, onResend }: any) {
  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [activeTab, setActiveTab] = useState<'all' | 'image' | 'video' | 'audio' | 'file'>('all');

  useEffect(() => {
    const updateRecords = () => setRecords(getHistory().filter(r => !r.vaulted));
    updateRecords();
    window.addEventListener('history_updated', updateRecords);
    return () => window.removeEventListener('history_updated', updateRecords);
  }, []);

  const handleShare = async (record: TransferRecord) => {
    try {
      const blob = await localforage.getItem<Blob>(record.id);
      if (!blob) return alert('الملف غير متوفر محلياً للمشاركة');
      const file = new File([blob], record.name, { type: record.mime });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: record.name });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = record.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch(e) { console.error(e); }
    setOpenMenuId(null);
  };

  const handleDelete = async (record: TransferRecord) => {
    if (!confirm('هل أنت متأكد من حذف هذا الملف نهائياً؟')) return;
    await localforage.removeItem(record.id);
    const history = getHistory().filter(r => r.id !== record.id);
    localStorage.setItem('p2p_history', JSON.stringify(history));
    window.dispatchEvent(new Event('history_updated'));
    setOpenMenuId(null);
  };

  const handleResendRecord = async (record: TransferRecord) => {
    const blob = await localforage.getItem<Blob>(record.id);
    if (!blob) return alert('الملف غير متوفر محلياً لإعادة الإرسال');
    onResend({ blob, name: record.name, mime: record.mime, size: record.size });
    setOpenMenuId(null);
  };

  const formatDate = (ts: number) => new Intl.DateTimeFormat('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ts);
  
  const getIcon = (type: string) => {
    if (type === 'video') return <Video className="text-[#003366]" size={22} />;
    if (type === 'image') return <ImageIcon className="text-[#003366]" size={22} />;
    return <FileIcon className="text-[#003366]" size={22} />;
  };

  const filteredRecords = records.filter(r => activeTab === 'all' || r.type === activeTab);

  return (
    <div className="flex flex-col h-full bg-[#E5E7EB]">
      <div className="bg-white px-4 pt-4 pb-0 shadow-sm border-b border-gray-200 shrink-0 sticky top-0 z-10">
        <div className="flex gap-4 overflow-x-auto custom-scrollbar no-scrollbar pb-2">
          <button 
            onClick={() => setActiveTab('all')}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-colors ${activeTab === 'all' ? 'bg-[#003366] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            الكل
          </button>
          <button 
            onClick={() => setActiveTab('image')}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-colors ${activeTab === 'image' ? 'bg-[#003366] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            الصور
          </button>
          <button 
            onClick={() => setActiveTab('video')}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-colors ${activeTab === 'video' ? 'bg-[#003366] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            الفيديوهات
          </button>
          <button 
            onClick={() => setActiveTab('audio')}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-colors ${activeTab === 'audio' ? 'bg-[#003366] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            الموسيقى
          </button>
          <button 
            onClick={() => setActiveTab('file')}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-colors ${activeTab === 'file' ? 'bg-[#003366] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            الملفات
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4 overflow-y-auto flex-1" onClick={() => setOpenMenuId(null)}>
        <div className="flex justify-between items-center mb-2 px-1">
           <h2 className="text-lg font-bold text-[#003366]">سجل الملفات ({filteredRecords.length})</h2>
           <button onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')} className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-[#003366] transition-colors border border-gray-200">
             {viewMode === 'list' ? <LayoutGrid size={20} /> : <ListIcon size={20} />}
           </button>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400 opacity-60">
            <History size={48} className="mb-4" />
            <p className="font-medium">لا توجد سجلات</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "space-y-3"}>
            {filteredRecords.map(record => {
              if (viewMode === 'grid') {
                return (
                  <div key={record.id} className="bg-white rounded-2xl shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] border border-gray-100 flex flex-col hover:shadow-md transition-shadow relative overflow-hidden group">
                     <div className="aspect-square w-full bg-gray-50 cursor-pointer relative overflow-hidden" onClick={() => onOpenViewer(record)}>
                        <Thumbnail record={record} icon={getIcon(record.type)} />
                        <div className={`absolute top-2 right-2 p-1.5 rounded-full shadow-sm ${record.isSent ? 'bg-blue-50 text-[#003366]' : 'bg-green-50 text-[#28A745]'}`}>
                          {record.isSent ? <Send size={12} /> : <Download size={12} />}
                        </div>
                     </div>
                     <div className="p-3 flex items-center justify-between">
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onOpenViewer(record)}>
                          <h3 className="font-bold text-gray-800 truncate text-[13px]" dir="ltr">{record.name}</h3>
                          <p className="text-[10px] text-gray-500 mt-0.5">{formatSize(record.size)}</p>
                        </div>
                        <div className="relative shrink-0 ml-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === record.id ? null : record.id); }}
                            className="p-1 text-gray-400 hover:text-[#003366] rounded-full hover:bg-gray-50 transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>
                          {openMenuId === record.id && (
                            <HistoryItemMenu 
                              onMoveToVault={() => { onMoveToVault(record); setOpenMenuId(null); }}
                              onShare={() => handleShare(record)}
                              onDelete={() => handleDelete(record)}
                              onResend={() => handleResendRecord(record)}
                            />
                          )}
                        </div>
                     </div>
                  </div>
                );
              }

              return (
                <div 
                  key={record.id} 
                  className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow relative"
                >
                  <div className="w-14 h-14 rounded-[14px] bg-gray-50 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden border border-gray-100" onClick={() => onOpenViewer(record)}>
                    <Thumbnail record={record} icon={getIcon(record.type)} />
                  </div>
                  
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpenViewer(record)}>
                    <h3 className="font-bold text-gray-800 truncate text-[15px]" dir="ltr">{record.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 font-medium">
                      <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm border ${record.isSent ? 'bg-blue-50 text-[#003366] border-blue-100' : 'bg-green-50 text-[#28A745] border-green-100'}`}>
                        {record.isSent ? <Send size={10} /> : <Download size={10} />}
                        {record.isSent ? 'مُرسل' : 'مُستلم'}
                      </span>
                      <span>{formatSize(record.size)}</span>
                      <span>•</span>
                      <span>{formatDate(record.timestamp)}</span>
                    </div>
                  </div>

                  <div className="relative shrink-0 flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === record.id ? null : record.id); }}
                      className="p-2 text-gray-400 hover:text-[#003366] rounded-full hover:bg-gray-50 transition-colors"
                    >
                      <MoreVertical size={20} />
                    </button>
                    {openMenuId === record.id && (
                      <HistoryItemMenu 
                        onMoveToVault={() => { onMoveToVault(record); setOpenMenuId(null); }}
                        onShare={() => handleShare(record)}
                        onDelete={() => handleDelete(record)}
                        onResend={() => handleResendRecord(record)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
        const vaultedStr = await localforage.getItem<any>(`vault_${record.id}`);
        if (vaultedStr) {
          const decryptedBuf = await decryptData(vaultedStr.encrypted, vaultedStr.iv, vaultedStr.salt, vaultPassword);
          const newEnc = await encryptData(decryptedBuf, newPass);
          await localforage.setItem(`vault_${record.id}`, newEnc);
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
