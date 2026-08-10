import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

format_time_func = """
const formatTime = (seconds: number | null) => {
  if (seconds === null || !isFinite(seconds) || seconds < 0) return 'جاري الحساب...';
  if (seconds < 60) return `متبقي ${Math.ceil(seconds)} ثانية`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `متبقي ${m} دقيقة و ${s} ثانية`;
};
"""

if "const formatTime =" not in content:
    content = content.replace("const formatSize =", format_time_func + "\nconst formatSize =")

# SendScreen logic updates
# 1. Add states
send_states = """
  const [currentFileTransferred, setCurrentFileTransferred] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const speedRef = useRef({ lastBytes: 0, lastTime: 0 });
"""
content = re.sub(
    r'(const \[currentFileIndex, setCurrentFileIndex\] = useState\(0\);)',
    r'\1\n' + send_states,
    content
)

# 2. Reset speed on startTransfers
content = re.sub(
    r'(setCurrentFileIndex\(0\);)',
    r'\1\n    speedRef.current = { lastBytes: 0, lastTime: performance.now() };\n    setCurrentFileTransferred(0);\n    setTransferSpeed(0);\n    setEta(null);',
    content
)

# 3. Update speed on chunk sent
send_chunk_update = """
          offset += chunk.size;
          setProgress(Math.round((offset / currentItem.size) * 100));
          setCurrentFileTransferred(offset);
          
          const now = performance.now();
          if (now - speedRef.current.lastTime >= 1000) {
            const bytesSinceLast = offset - speedRef.current.lastBytes;
            const timeSinceLast = (now - speedRef.current.lastTime) / 1000;
            const speed = bytesSinceLast / timeSinceLast;
            setTransferSpeed(speed);
            setEta(speed > 0 ? (currentItem.size - offset) / speed : null);
            speedRef.current = { lastBytes: offset, lastTime: now };
          }
"""
content = re.sub(
    r'(offset \+= chunk.size;\s*setProgress\(Math.round\(\(offset / currentItem.size\) \* 100\)\);)',
    send_chunk_update,
    content
)

# 4. Reset on next file
content = re.sub(
    r'(setCurrentFileIndex\(index\);\s*setProgress\(0\);)',
    r'\1\n          setCurrentFileTransferred(0);\n          setTransferSpeed(0);\n          setEta(null);\n          speedRef.current = { lastBytes: 0, lastTime: performance.now() };',
    content
)

# 5. UI Update SendScreen
send_ui_update = """
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#003366] transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-xs text-gray-500 truncate" dir="ltr">{filesQueue[currentFileIndex]?.name}</div>
              <div className="flex justify-between items-center text-xs font-medium mt-1 text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                 <div className="flex flex-col gap-1 text-right">
                   <span className="text-[#003366] font-bold">الحجم الإجمالي: {formatSize(filesQueue[currentFileIndex]?.size)}</span>
                   <span>تم إرسال: {formatSize(currentFileTransferred)}</span>
                 </div>
                 <div className="flex flex-col items-end gap-1">
                    <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-bold" dir="ltr">{formatSize(transferSpeed)}/s</span>
                    <span className="text-[#003366] font-bold">{formatTime(eta)}</span>
                 </div>
              </div>
"""
content = re.sub(
    r'(<div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">.*?<div className="text-xs text-gray-500 truncate" dir="ltr">\{filesQueue\[currentFileIndex\]\?\.name\}</div>)',
    send_ui_update,
    content,
    flags=re.DOTALL
)


# ReceiveScreen logic updates
# 1. Add states
recv_states = """
  const [currentFileTransferred, setCurrentFileTransferred] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const speedRef = useRef({ lastBytes: 0, lastTime: 0 });
"""
content = re.sub(
    r'(const \[receivedFileDetails, setReceivedFileDetails\] = useState<\{name: string, size: number\} \| null>\(null\);)',
    r'\1\n' + recv_states,
    content
)

# 2. Reset speed on header
content = re.sub(
    r'(receivedSize = 0;)',
    r'\1\n        setCurrentFileTransferred(0);\n        setTransferSpeed(0);\n        setEta(null);\n        speedRef.current = { lastBytes: 0, lastTime: performance.now() };',
    content
)

# 3. Update speed on chunk
recv_chunk_update = """
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
"""
content = re.sub(
    r'(receivedSize \+= msg\.data\.byteLength;\s*setProgress\(Math\.round\(\(receivedSize / fileMeta\.size\) \* 100\)\);)',
    recv_chunk_update,
    content
)

# 4. UI Update ReceiveScreen
recv_ui_update = """
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
"""
content = re.sub(
    r'(<div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">.*?</div>)',
    recv_ui_update,
    content,
    flags=re.DOTALL,
    count=2 # replace only the second occurrence which is in ReceiveScreen
)
# The Regex above is dangerous if it hits SendScreen again, wait I should use distinct string matching.

