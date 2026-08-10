import React, { useState, useEffect, useRef } from 'react';
import { Minimize, Image as ImageIcon, Video, FileIcon, CheckCircle2, Loader2, Save, Trash2, Check } from 'lucide-react';
// @ts-ignore
import { FFmpeg } from '@ffmpeg/ffmpeg';
// @ts-ignore
import { fetchFile } from '@ffmpeg/util';
import * as localforage from 'localforage';

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

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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

export default CompressScreen;
