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
    if (isPremium) {
      allowedImages = 500;
      allowedVideos = 50;
    }
    if (currentUser === 'admin') {
      allowedImages = 500;
      allowedVideos = 50;
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
                          <span className="truncate w-full font-bold text-sm text-gray-800 text-right" dir="ltr">{resendFile.name}</span>
                          <span className="text-xs text-gray-500">{formatSize(resendFile.size)}</span>
                       </div>
                     </div>
                     <button onClick={onClearResend} className="p-2 text-red-400 hover:text-red-600 bg-white rounded-full hover:bg-red-50 transition-colors shadow-sm shrink-0">
                       <X size={20} />
                     </button>
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
