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
