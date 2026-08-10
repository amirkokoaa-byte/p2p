function AdminScreen({ currentSettings, onBack, onLogout, users, onUpdateUser, onUpdateSettings }: any) {
  const [appName, setAppName] = useState(currentSettings.appName);
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

      <button onClick={handleSave} className="w-full bg-[#003366] text-white py-4 rounded-xl font-bold text-lg shadow-md hover:bg-blue-900 transition-colors">
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
