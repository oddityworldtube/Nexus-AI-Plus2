
import React, { useState, useEffect, useRef } from 'react';
import { ChannelStats, VideoData, UserPreferences } from './types';
import { fetchChannelStats, fetchRecentVideos } from './services/youtubeService';
import { ToastProvider } from './contexts/ToastContext';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { SyncProvider } from './contexts/SyncContext'; // Import SyncProvider
import VaultScreen from './components/VaultScreen';
import Settings from './components/Settings';
import Dashboard from './components/Dashboard';
import VideoList from './components/VideoList';
import Analysis from './components/Analysis';
import ShortsIdeas from './components/ShortsIdeas';
import VideoOptimizer from './components/VideoOptimizer';
import CompetitorAnalysis from './components/CompetitorAnalysis';
import IdeaGenerator from './components/IdeaGenerator';
import FullContentGenerator from './components/FullContentGenerator';
import ImageStudio from './components/ImageStudio';
import VisualScripting from './components/VisualScripting'; // Import New Component
import Copilot from './components/Copilot';
import * as db from './services/dbService';
import { LayoutDashboard, Settings as SettingsIcon, Video, Youtube, Zap, Wand2, PlusCircle, Target, Lightbulb, Moon, Sun, Layers, BrainCircuit, PenTool, Image as ImageIcon, Move, Layout } from 'lucide-react';

const AppContent: React.FC = () => {
  const { profiles, currentProfileId, isLoading, theme, setTheme, selectProfile, settings } = useAppContext();
  
  const [channelStats, setChannelStats] = useState<ChannelStats | null>(null);
  const [recentVideos, setRecentVideos] = useState<VideoData[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  
  // Added 'visual_scripting' to activeTab type
  const [activeTab, setActiveTab] = useState<'dashboard' | 'videos' | 'analysis' | 'shorts_ideas' | 'optimizer' | 'settings' | 'competitors' | 'ideas' | 'full_content' | 'image_studio' | 'visual_scripting'>('settings');
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Copilot State
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | undefined>(undefined);

  // --- Draggable FAB State ---
  // Initial position: Bottom Right (approx)
  const [fabPos, setFabPos] = useState({ x: window.innerWidth - 90, y: window.innerHeight - 100 });
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 }); // Mouse offset relative to button
  const hasMovedRef = useRef(false); // To distinguish click vs drag

  // Load initial data when profile changes
  useEffect(() => {
    if (profiles.length > 0 && !currentProfileId) {
        // This logic is mostly handled in AppContext init now, but as a fallback:
        const defaultId = settings.defaultChannelId;
        const target = (defaultId && profiles.some(p => p.id === defaultId)) ? defaultId : profiles[0].id;
        selectProfile(target);
        setActiveTab('dashboard');
    } else if (profiles.length > 0 && currentProfileId) {
        // If we have a profile selected, ensure we are not on settings unless intentionally
        // (Optional: Logic to switch tab on first load)
        if(activeTab === 'settings' && !isLoading) {
             // setActiveTab('dashboard'); // Removed to avoid forcing dashboard on settings interaction
        }
    } else if (profiles.length === 0) {
        setActiveTab('settings');
    }
  }, [profiles, currentProfileId]);

  // Load User Preferences for Copilot
  useEffect(() => {
      const loadPrefs = async () => {
          try {
              const prefs = await db.getUserPreferences();
              setUserPreferences(prefs);
          } catch (e) {
              console.warn("Failed to load user preferences", e);
          }
      };
      loadPrefs();
  }, []);

  // Listen for Tab Switching Events (e.g. from Copilot)
  useEffect(() => {
      const handleSwitchTab = (e: CustomEvent) => {
          if (e.detail) {
              setActiveTab(e.detail);
          }
      };
      window.addEventListener('SWITCH_TAB', handleSwitchTab as EventListener);
      return () => window.removeEventListener('SWITCH_TAB', handleSwitchTab as EventListener);
  }, []);

  // --- Dragging Logic ---
  useEffect(() => {
      const handleWindowMouseMove = (e: MouseEvent) => {
          if (!isDraggingRef.current) return;
          hasMovedRef.current = true;
          
          let newX = e.clientX - dragStartPosRef.current.x;
          let newY = e.clientY - dragStartPosRef.current.y;

          // Boundaries
          const maxX = window.innerWidth - 70;
          const maxY = window.innerHeight - 70;
          
          newX = Math.max(10, Math.min(newX, maxX));
          newY = Math.max(10, Math.min(newY, maxY));

          setFabPos({ x: newX, y: newY });
      };

      const handleWindowMouseUp = () => {
          isDraggingRef.current = false;
      };

      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
      
      // Update position on resize to keep it on screen
      const handleResize = () => {
          setFabPos(prev => ({
              x: Math.min(prev.x, window.innerWidth - 90),
              y: Math.min(prev.y, window.innerHeight - 100)
          }));
      };
      window.addEventListener('resize', handleResize);

      return () => {
          window.removeEventListener('mousemove', handleWindowMouseMove);
          window.removeEventListener('mouseup', handleWindowMouseUp);
          window.removeEventListener('resize', handleResize);
      };
  }, []);

  const handleFabMouseDown = (e: React.MouseEvent) => {
      isDraggingRef.current = true;
      hasMovedRef.current = false;
      const rect = (e.target as Element).closest('button')?.getBoundingClientRect();
      if (rect) {
          dragStartPosRef.current = {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top
          };
      }
  };

  const handleFabClick = () => {
      if (!hasMovedRef.current) {
          setIsCopilotOpen(true);
      }
  };

  const loadData = async () => {
      if (!currentProfileId) return;
      const profile = profiles.find(c => c.id === currentProfileId);
      if (!profile) return;
      
      setLoadingData(true);
      const stats = await fetchChannelStats(profile.channelId, profile.apiKey);
      if (stats) {
        setChannelStats(stats);
        const { videos: rawVideos, nextPageToken: token } = await fetchRecentVideos(profile.channelId, profile.apiKey, undefined, 50); 
        setNextPageToken(token);
        setRecentVideos(rawVideos);
      } else {
        setChannelStats(null);
      }
      setLoadingData(false);
  };

  useEffect(() => {
    if (!isLoading && currentProfileId) {
        loadData();
    }
  }, [currentProfileId, isLoading]);

  const handleLoadMore = async () => {
    if (!nextPageToken || !currentProfileId) return;
    const profile = profiles.find(c => c.id === currentProfileId);
    if (!profile) return;
    setLoadingMore(true);
    const { videos: newVideos, nextPageToken: newToken } = await fetchRecentVideos(profile.channelId, profile.apiKey, nextPageToken, 50);
    setNextPageToken(newToken);
    setRecentVideos(prev => [...prev, ...newVideos]);
    setLoadingMore(false);
  };

  const currentProfile = profiles.find(c => c.id === currentProfileId) || null;

  // --- Dynamic Context Generation for Copilot ---
  const getCopilotContext = () => {
      const baseContext = {
          channelName: currentProfile?.name || "Unknown",
          activeTab: activeTab,
          timestamp: new Date().toLocaleString(),
          userProfile: userPreferences?.preferences || {} // Inject learned preferences
      };

      switch (activeTab) {
          case 'dashboard':
              return { 
                  type: 'DASHBOARD_OVERVIEW', 
                  ...baseContext,
                  stats: channelStats,
                  recentVideosSample: recentVideos.slice(0, 5).map(v => ({ title: v.title, views: v.viewCount })) 
              };
          case 'videos':
              return { 
                  type: 'VIDEO_LIST_ANALYSIS', 
                  ...baseContext,
                  totalLoaded: recentVideos.length,
                  topVideos: recentVideos.slice(0, 3).map(v => ({ title: v.title, stats: v.viewCount }))
              };
          case 'optimizer':
              return { 
                  type: 'VIDEO_OPTIMIZATION', 
                  ...baseContext,
                  videoBeingOptimized: selectedVideo ? { 
                      title: selectedVideo.title, 
                      desc: selectedVideo.description?.substring(0, 200),
                      tags: selectedVideo.tags,
                      stats: { views: selectedVideo.viewCount, likes: selectedVideo.likeCount }
                  } : "No video selected" 
              };
          case 'ideas':
              return { type: 'IDEA_GENERATION', ...baseContext };
          case 'full_content':
              return { type: 'FULL_CONTENT_CREATION', ...baseContext };
          case 'image_studio':
              return { type: 'IMAGE_GENERATION', ...baseContext };
          case 'visual_scripting':
              return { type: 'VISUAL_SCRIPTING', ...baseContext };
          case 'competitors':
              return { type: 'COMPETITOR_ANALYSIS', ...baseContext, myStats: channelStats };
          default:
              return { type: 'GENERAL', ...baseContext };
      }
  };

  // Render Loading Splash
  if (isLoading) {
      return (
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center text-center p-4">
              <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
              <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">جاري فك تشفير البيانات...</h2>
          </div>
      );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-sans bg-slate-50 dark:bg-slate-950 text-right transition-colors duration-300" dir="rtl">
      {/* Sidebar */}
      <aside className="lg:w-72 bg-slate-900 dark:bg-slate-950 text-white flex-shrink-0 lg:fixed h-full z-20 shadow-xl transition-all flex flex-col justify-between border-l dark:border-slate-800">
        <div>
            <div className="p-8 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg shadow-lg shadow-indigo-900/50">
                        <Layers className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <span className="font-black text-xl tracking-tight block leading-none bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">CreatorNexus</span>
                        <span className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase opacity-80">ULTRA</span>
                    </div>
                </div>
            </div>
            
            <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-200px)] custom-scrollbar">
                {!currentProfile ? (
                     <div className="text-center p-6 bg-slate-800/50 rounded-xl mb-4 border border-slate-700 border-dashed m-2">
                         <p className="text-slate-400 text-sm mb-3 font-bold">ابدأ بإضافة قناتك</p>
                         <button onClick={() => setActiveTab('settings')} className="text-white bg-indigo-600 w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition shadow-lg shadow-indigo-900/50">
                             <PlusCircle size={16}/> إضافة قناة
                         </button>
                     </div>
                ) : (
                    <>
                    <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold text-sm ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <LayoutDashboard size={18} /><span>لوحة التحكم</span>
                    </button>
                    <button onClick={() => setActiveTab('videos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold text-sm ${activeTab === 'videos' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Video size={18} /><span>المحتوى</span>
                    </button>
                    <button onClick={() => { setSelectedVideo(selectedVideo || (recentVideos[0] || null)); setActiveTab('optimizer'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold text-sm ${activeTab === 'optimizer' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Wand2 size={18} /><span>استوديو التحسين</span>
                    </button>                    
                    <button onClick={() => setActiveTab('ideas')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold text-sm ${activeTab === 'ideas' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Lightbulb size={18} className={activeTab === 'ideas' ? "text-yellow-300" : ""} /><span>مولد الأفكار</span>
                    </button>
                    <button onClick={() => setActiveTab('full_content')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold text-sm ${activeTab === 'full_content' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <PenTool size={18} /><span>إنشاء محتوى كامل</span>
                    </button>
                    <button onClick={() => setActiveTab('visual_scripting')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold text-sm ${activeTab === 'visual_scripting' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Layout size={18} /><span>السيناريو المرئي</span>
                    </button>
                    <button onClick={() => setActiveTab('image_studio')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold text-sm ${activeTab === 'image_studio' ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <ImageIcon size={18} /><span>استوديو الصور AI</span>
                    </button>
                    <button onClick={() => setActiveTab('competitors')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold text-sm ${activeTab === 'competitors' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Target size={18} /><span>تحليل المنافسين</span>
                    </button>
                    <button onClick={() => setActiveTab('shorts_ideas')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold text-sm ${activeTab === 'shorts_ideas' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Zap size={18} className={activeTab !== 'shorts_ideas' ? "text-yellow-500" : ""} /><span>أفكار Shorts</span>
                    </button>
                    </>
                )}
            </nav>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
             <div className="flex gap-2 mb-3">
                 <button onClick={() => setActiveTab('settings')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition font-bold text-xs ${activeTab === 'settings' ? 'bg-indigo-600 text-white' : 'text-slate-400 bg-slate-800 hover:text-white'}`}>
                      <SettingsIcon size={16} /><span>الإعدادات</span>
                 </button>
                 <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-yellow-400 hover:bg-slate-700 transition">
                      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                 </button>
             </div>
             
             {currentProfile && (
                 <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 rounded-lg border border-slate-800">
                     <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></div>
                     <span className="text-xs text-slate-300 font-mono truncate max-w-[120px]">{currentProfile.name}</span>
                 </div>
             )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:mr-72 p-4 lg:p-8 overflow-y-auto h-screen custom-scrollbar relative">
        {loadingData && activeTab !== 'settings' ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-400 gap-6">
              <div className="relative">
                  <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
              <p className="animate-pulse font-bold text-lg text-slate-500">جاري الاتصال بقناتك...</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {activeTab === 'settings' && <Settings />}
            
            {activeTab === 'dashboard' && channelStats && <Dashboard stats={channelStats} videos={recentVideos} onRefresh={loadData} loading={loadingData} />}
            
            {activeTab === 'videos' && <VideoList videos={recentVideos} channelStats={channelStats} onLoadMore={handleLoadMore} hasMore={!!nextPageToken} loadingMore={loadingMore} loading={loadingData} onAnalyze={(v) => { setSelectedVideo(v); setActiveTab('optimizer'); }} onRefresh={loadData} />}
            
            {activeTab === 'ideas' && currentProfile && <IdeaGenerator profile={currentProfile} />}

            {activeTab === 'full_content' && currentProfile && <FullContentGenerator profile={currentProfile} />}

            {activeTab === 'image_studio' && <ImageStudio />}

            {activeTab === 'visual_scripting' && <VisualScripting />}

            {activeTab === 'competitors' && channelStats && currentProfile && <CompetitorAnalysis myStats={channelStats} profile={currentProfile} />}

            {activeTab === 'shorts_ideas' && currentProfile && <ShortsIdeas videos={recentVideos} profile={currentProfile} />}
            
            {activeTab === 'analysis' && channelStats && currentProfile && <Analysis stats={channelStats} videos={recentVideos} profile={currentProfile} />}
            
            {activeTab === 'optimizer' && selectedVideo ? (
                <VideoOptimizer video={selectedVideo} profile={currentProfile} allVideos={recentVideos} />
            ) : activeTab === 'optimizer' && !selectedVideo ? (
                 <div className="flex flex-col items-center justify-center py-32 text-gray-400 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-gray-300 dark:border-slate-800 shadow-sm transition-colors">
                     <Wand2 size={40} className="text-indigo-500 mb-4" />
                     <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 mb-2">لم يتم اختيار فيديو للتحليل</h3>
                     <button onClick={() => setActiveTab('videos')} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg mt-4 flex items-center gap-2">
                        <Video size={18}/> الذهاب للمحتوى
                     </button>
                 </div>
            ) : null}
          </div>
        )}

        {/* Copilot Floating Button & Interface */}
        {currentProfile && (
            <>
                <button 
                    onClick={handleFabClick}
                    onMouseDown={handleFabMouseDown}
                    style={{ top: fabPos.y, left: fabPos.x }}
                    className="fixed z-50 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform duration-100 border-4 border-white/20 group cursor-move active:cursor-grabbing"
                    title="مساعد القناة الذكي (اسحب للتحريك)"
                >
                    <BrainCircuit size={28} className="group-hover:animate-pulse pointer-events-none"/>
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-bounce pointer-events-none">AI</span>
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] bg-black/60 text-white px-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">اسحبني</span>
                </button>
                <Copilot isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} contextData={getCopilotContext()} />
            </>
        )}

      </main>
    </div>
  );
};

const App: React.FC = () => {
    const [unlockedKey, setUnlockedKey] = useState<CryptoKey | null>(null);

    // لو مفيش مفتاح، اعرض شاشة القفل
    if (!unlockedKey) {
        return <VaultScreen onUnlock={(key) => setUnlockedKey(key)} />;
    }

    return (
        <AppProvider masterKey={unlockedKey}>
            <ToastProvider>
                <SyncProvider>
                    <AppContent />
                </SyncProvider>
            </ToastProvider>
        </AppProvider>
    );
};

export default App;
