import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

home_screen_code = """
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

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
"""

pattern = r'function HomeScreen.*?\{.*?\n\}\n'
new_content = re.sub(pattern, home_screen_code, content, flags=re.DOTALL)

with open('src/App.tsx', 'w') as f:
    f.write(new_content)
