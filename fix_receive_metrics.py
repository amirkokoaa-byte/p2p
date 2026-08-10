with open('src/App.tsx', 'r') as f:
    content = f.read()

# ReceiveScreen states
recv_states = """
  const [currentFileTransferred, setCurrentFileTransferred] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const speedRef = useRef({ lastBytes: 0, lastTime: 0 });
"""
if "const [currentFileTransferred, setCurrentFileTransferred] = useState(0);" not in content.split('function ReceiveScreen')[1]:
    content = content.replace(
        "const [receivedFileDetails, setReceivedFileDetails] = useState<{name: string, size: number} | null>(null);",
        "const [receivedFileDetails, setReceivedFileDetails] = useState<{name: string, size: number} | null>(null);\n" + recv_states
    )

# ReceiveScreen header reset
header_reset = """
        receivedSize = 0;
        setCurrentFileTransferred(0);
        setTransferSpeed(0);
        setEta(null);
        speedRef.current = { lastBytes: 0, lastTime: performance.now() };
"""
if "setCurrentFileTransferred(0);" not in content.split('if (msg.type === \'header\') {')[1].split('conn.send')[0]:
    content = content.replace("receivedSize = 0;", header_reset)

# ReceiveScreen chunk update
chunk_update = """
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
if "setCurrentFileTransferred(receivedSize);" not in content.split('if (msg.type === \'chunk\') {')[1]:
    content = content.replace(
"""        receivedSize += msg.data.byteLength;
        setProgress(Math.round((receivedSize / fileMeta.size) * 100));""",
        chunk_update
    )

# ReceiveScreen UI
ui_replace = """
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
import re
# We need to find the specific block in ReceiveScreen to replace
res = re.split(r'function ReceiveScreen.*?\{', content, maxsplit=1, flags=re.DOTALL)
if len(res) > 1:
    recv_body = res[1]
    recv_body = re.sub(
        r'<div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">.*?</div>',
        ui_replace,
        recv_body,
        flags=re.DOTALL,
        count=1
    )
    content = res[0] + 'function ReceiveScreen({ onBack }: { onBack: () => void }) {' + recv_body

with open('src/App.tsx', 'w') as f:
    f.write(content)

