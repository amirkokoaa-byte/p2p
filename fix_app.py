import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

bad_string = """      <div className="bg-white dark:bg-gray-900 px-4 pt-4 pb-0 shadow-sm border-b border-gray-200 dark:border-gray-800 shrink-             {sortOpen && ("""
good_string = """      <div className="bg-white dark:bg-gray-900 px-4 pt-4 pb-0 shadow-sm border-b border-gray-200 dark:border-gray-800 shrink-0 sticky top-0 z-10">
        <div className="flex gap-4 overflow-x-auto custom-scrollbar no-scrollbar pb-2">
          <button 
            onClick={() => setActiveTab('all')}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-colors ${activeTab === 'all' ? 'bg-[#003366] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
          >
            الكل
          </button>
          <button 
            onClick={() => setActiveTab('image')}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-colors ${activeTab === 'image' ? 'bg-[#003366] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
          >
            الصور
          </button>
          <button 
            onClick={() => setActiveTab('video')}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-colors ${activeTab === 'video' ? 'bg-[#003366] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
          >
            الفيديوهات
          </button>
          <button 
            onClick={() => setActiveTab('audio')}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-colors ${activeTab === 'audio' ? 'bg-[#003366] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
          >
            الموسيقى
          </button>
          <button 
            onClick={() => setActiveTab('file')}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-colors ${activeTab === 'file' ? 'bg-[#003366] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
          >
            الملفات
          </button>
        </div>
        
        <div className="flex gap-2 py-3 border-t border-gray-100 dark:border-gray-800">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="ابحث بالاسم..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-[#003366] border-2 rounded-xl py-2 pr-10 pl-4 text-sm outline-none transition-all dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>
          
          <div className="relative">
             <button onClick={() => setSortOpen(!sortOpen)} className={`p-2 rounded-xl transition-colors ${sortOpen ? 'bg-[#003366] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}>
               <ArrowUpDown size={20} />
             </button>
             {sortOpen && ("""

content = content.replace(bad_string, good_string)

with open('src/App.tsx', 'w') as f:
    f.write(content)
