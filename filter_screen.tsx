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

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
