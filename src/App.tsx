/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Download, 
  History, 
  Home, 
  FileIcon, 
  Image as ImageIcon, 
  Video,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Wifi,
  Smartphone,
  Loader2,
  ChevronRight,
  UploadCloud,
  FileText
} from 'lucide-react';
import Peer, { DataConnection } from 'peerjs';
import { QRCodeSVG } from 'qrcode.react';

// --- Types ---
interface TransferRecord {
  id: string;
  name: string;
  size: number;
  timestamp: number;
  isSent: boolean;
  status: 'SUCCESS' | 'FAILED';
  type: string;
}

// --- Helpers ---
const CHUNK_SIZE = 256 * 1024; // 256 KB per chunk for stable WebRTC transfer
const APP_PREFIX = 'p2ptransfer-app-';

const saveToHistory = (record: Omit<TransferRecord, 'id' | 'timestamp'>) => {
  try {
    const existing = JSON.parse(localStorage.getItem('p2p_history') || '[]');
    const newRecord: TransferRecord = {
      ...record,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };
    existing.unshift(newRecord);
    localStorage.setItem('p2p_history', JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to save history', e);
  }
};

const getHistory = (): TransferRecord[] => {
  try {
    return JSON.parse(localStorage.getItem('p2p_history') || '[]');
  } catch (e) {
    return [];
  }
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

// --- Main App Component ---
export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'history' | 'send' | 'receive'>('home');

  return (
    <div className="flex justify-center bg-[#E5E7EB] min-h-screen rtl font-sans" dir="rtl">
      {/* Mobile Frame Simulation */}
      <div className="w-full max-w-md bg-[#F8F9FA] h-screen shadow-2xl flex flex-col relative overflow-hidden">
        
        {/* App Bar */}
        <header className="bg-[#003366] text-white p-4 shadow-md z-10 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            {(currentView === 'send' || currentView === 'receive') && (
              <button 
                onClick={() => setCurrentView('home')}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <ArrowRight size={24} />
              </button>
            )}
            <h1 className="text-xl font-bold">
              {currentView === 'home' ? 'النقل السريع P2P' : 
               currentView === 'history' ? 'سجل النقل' : 
               currentView === 'send' ? 'إرسال ملف' : 'استقبال ملف'}
            </h1>
          </div>
          {currentView === 'home' && (
             <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shadow-sm">
               <span className="text-sm font-bold text-blue-50">PT</span>
             </div>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-20 custom-scrollbar relative">
          {currentView === 'home' && <HomeScreen onNavigate={setCurrentView} />}
          {currentView === 'history' && <HistoryScreen />}
          {currentView === 'send' && <SendScreen onBack={() => setCurrentView('home')} />}
          {currentView === 'receive' && <ReceiveScreen onBack={() => setCurrentView('home')} />}
        </main>

        {/* Bottom Navigation */}
        {(currentView === 'home' || currentView === 'history') && (
          <nav className="absolute bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-2 z-10 pb-5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <button 
              onClick={() => setCurrentView('home')}
              className={`flex flex-col items-center gap-1 transition-colors p-2 ${currentView === 'home' ? 'text-[#003366]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <div className={`p-1.5 rounded-xl ${currentView === 'home' ? 'bg-blue-50' : 'bg-transparent'}`}>
                <Home size={22} />
              </div>
              <span className="text-[10px] font-bold">الرئيسية</span>
            </button>
            <button 
              onClick={() => setCurrentView('history')}
              className={`flex flex-col items-center gap-1 transition-colors p-2 ${currentView === 'history' ? 'text-[#003366]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <div className={`p-1.5 rounded-xl ${currentView === 'history' ? 'bg-blue-50' : 'bg-transparent'}`}>
                <History size={22} />
              </div>
              <span className="text-[10px] font-bold">السجل</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}

// --- Home Screen ---
function HomeScreen({ onNavigate }: { onNavigate: (v: 'send'|'receive') => void }) {
  return (
    <div className="p-6 flex flex-col gap-6 h-full justify-center pb-24">
      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-[#003366] mb-4 shadow-inner">
          <Wifi size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">نقل الملفات عبر المتصفح</h2>
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

// --- Send Screen ---
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
    // Generate a 6 digit PIN
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

    return () => {
      peer.destroy();
    };
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
        saveToHistory({ 
          name: file.name, 
          size: file.size, 
          isSent: true, 
          status: 'SUCCESS',
          type: getFileType(file.type)
        });
      }
    };

    onAckRef.current = sendNextChunk;

    // Send metadata header first
    connection.send({
      type: 'header',
      name: file.name,
      size: file.size,
      mime: file.type
    });
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
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
              />
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
                <div 
                  className="h-full bg-[#003366] transition-all duration-300 rounded-full" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {transferSuccess && (
            <div className="w-full flex flex-col items-center space-y-4">
              <div className="text-green-600 font-bold flex items-center gap-2 bg-green-50 px-4 py-2 rounded-xl">
                <CheckCircle2 size={20} />
                تم إرسال الملف بنجاح
              </div>
              <button 
                onClick={() => setTransferSuccess(false)}
                className="text-[#003366] font-bold text-sm hover:underline mt-4"
              >
                إرسال ملف آخر
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Receive Screen ---
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
    return () => {
      if (peerRef.current) peerRef.current.destroy();
    };
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
      console.error(err);
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
        // Transfer complete, trigger download
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
        saveToHistory({ 
          name: fileMeta.name, 
          size: fileMeta.size, 
          isSent: false, 
          status: 'SUCCESS',
          type: getFileType(fileMeta.mime)
        });
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
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            يرجى إدخال الكود المكون من 6 أرقام الظاهر في هاتف المُرسل.
          </p>
          
          <input
            type="number"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value.slice(0, 6))}
            placeholder="000000"
            className="w-full bg-[#F8F9FA] border-2 border-gray-200 rounded-2xl px-6 py-4 text-center text-4xl font-black text-[#003366] tracking-[0.2em] mb-6 focus:border-[#003366] focus:outline-none transition-colors"
          />
          
          <button
            onClick={handleConnect}
            disabled={targetId.length !== 6 || isConnecting}
            className="w-full py-4 bg-[#003366] text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isConnecting ? (
              <><Loader2 size={24} className="animate-spin" /> جاري الاتصال...</>
            ) : (
              'اتصال'
            )}
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center flex flex-col items-center mt-4 animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
            <Wifi size={32} className="text-[#28A745]" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">تم الاتصال!</h3>
          
          {!isTransferring && !transferSuccess && (
            <p className="text-gray-500 text-sm mt-2 animate-pulse">في انتظار قيام الطرف الآخر بإرسال ملف...</p>
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
                <div 
                  className="h-full bg-[#003366] transition-all duration-300 rounded-full" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {transferSuccess && (
            <div className="w-full flex flex-col items-center mt-6 space-y-4">
              <div className="text-green-600 font-bold flex items-center gap-2 bg-green-50 px-4 py-2 rounded-xl border border-green-100">
                <CheckCircle2 size={20} />
                اكتمل التحميل! تم حفظ الملف.
              </div>
              <p className="text-xs text-gray-400 mt-2">يمكنك استلام المزيد من الملفات تلقائياً.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- History Screen ---
function HistoryScreen() {
  const [records, setRecords] = useState<TransferRecord[]>([]);

  useEffect(() => {
    setRecords(getHistory());
  }, []);

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('ar-EG', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(ts);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="text-[#003366]" size={22} />;
      case 'image': return <ImageIcon className="text-[#003366]" size={22} />;
      default: return <FileIcon className="text-[#003366]" size={22} />;
    }
  };

  return (
    <div className="p-5 space-y-3">
      {records.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-gray-400 opacity-60">
          <History size={48} className="mb-4" />
          <p className="font-medium">لا توجد سجلات نقل سابقة</p>
        </div>
      ) : (
        records.map(record => (
          <div key={record.id} className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            {/* Thumbnail */}
            <div className="w-14 h-14 rounded-[14px] bg-blue-50 flex items-center justify-center shrink-0">
              {getIcon(record.type)}
            </div>
            
            {/* Details */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-800 truncate text-[15px]">{record.name}</h3>
              <div className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1.5 font-medium">
                <span className="bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{formatSize(record.size)}</span>
                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                <span>{formatDate(record.timestamp)}</span>
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-col items-end gap-2 shrink-0 pl-1">
              <div className={`p-1.5 rounded-full ${record.isSent ? 'bg-blue-50 text-[#003366]' : 'bg-green-50 text-[#28A745]'}`}>
                {record.isSent ? <Send size={14} /> : <Download size={14} />}
              </div>
              {record.status === 'SUCCESS' ? (
                <span className="text-[10px] font-bold text-[#28A745] flex items-center gap-0.5">
                  <CheckCircle2 size={10} /> ناجح
                </span>
              ) : (
                <span className="text-[10px] font-bold text-[#DC3545] flex items-center gap-0.5">
                  <XCircle size={10} /> فشل
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
