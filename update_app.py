import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Replace AdminScreen
with open('admin_screen.tsx', 'r') as f:
    admin_screen = f.read()

pattern = r"function AdminScreen\(\{ currentSettings, onBack, onLogout \}: any\) \{.*?(?=function HomeScreen)"
content = re.sub(pattern, admin_screen + "\n", content, flags=re.DOTALL)

# Add PremiumScreen before AdminScreen
premium_screen = """
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

"""
content = content.replace("function AdminScreen", premium_screen + "\nfunction AdminScreen")

with open('src/App.tsx', 'w') as f:
    f.write(content)

