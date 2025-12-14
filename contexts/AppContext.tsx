
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ChannelProfile, AppSettings, TranscriptService, BackupCategory } from '../types';
import * as db from '../services/dbService';
import { encryptData, decryptData, isEncryptedString } from '../services/securityService';

interface AppContextType {
  profiles: ChannelProfile[];
  currentProfileId: string | null;
  settings: AppSettings;
  isLoading: boolean;
  theme: 'light' | 'dark';
  masterKey: CryptoKey | null; // EXPOSED FOR BACKUP
  pendingImageForEditor: string | null; // NEW: Holds image URL from Copilot
  pendingContentIdea: string | null; // NEW: Holds content idea text from Idea Generator
  pendingBatchPrompts: string[] | null; // NEW: Holds batch prompts for Image Studio
  pendingScriptForSplitter: string | null; // NEW: Holds script for Visual Scripting
  setPendingImageForEditor: (url: string | null) => void; 
  setPendingContentIdea: (idea: string | null) => void; 
  setPendingBatchPrompts: (prompts: string[] | null) => void; 
  setPendingScriptForSplitter: (script: string | null) => void; // NEW: Setter
  setTheme: (theme: 'light' | 'dark') => void;
  addProfile: (profile: ChannelProfile) => Promise<void>;
  updateProfile: (profile: ChannelProfile) => Promise<void>;
  removeProfile: (id: string) => void;
  reorderProfiles: (newProfiles: ChannelProfile[]) => Promise<void>;
  importProfiles: (profiles: ChannelProfile[]) => Promise<void>;
  selectProfile: (id: string) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};

export const AppProvider: React.FC<{ children: ReactNode; masterKey: CryptoKey }> = ({ children, masterKey }) => {
  const [profiles, setProfiles] = useState<ChannelProfile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ geminiApiKeys: [], customModels: [], theme: 'light' });
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  
  // New State for Cross-Component Data Transfer
  const [pendingImageForEditor, setPendingImageForEditor] = useState<string | null>(null);
  const [pendingContentIdea, setPendingContentIdea] = useState<string | null>(null);
  const [pendingBatchPrompts, setPendingBatchPrompts] = useState<string[] | null>(null);
  const [pendingScriptForSplitter, setPendingScriptForSplitter] = useState<string | null>(null);

  // Helper to sync keys to session storage for Gemini Service
  const syncKeysToSession = (keys: string[]) => {
      if (keys && keys.length > 0) {
          sessionStorage.setItem('GEMINI_KEYS_POOL', JSON.stringify(keys));
      } else {
          sessionStorage.removeItem('GEMINI_KEYS_POOL');
      }
  };

  // Helper to sync non-sensitive config (Models) to public local storage for Gemini Service
  const updatePublicConfig = (s: AppSettings) => {
      try {
          const publicConfig = {
              selectedTextModel: s.selectedTextModel,
              selectedImageModel: s.selectedImageModel
          };
          localStorage.setItem('yt_analyzer_public_config', JSON.stringify(publicConfig));
      } catch (e) {
          console.error("Failed to sync public config", e);
      }
  };

  // Initialize Data ONLY when masterKey is available
  useEffect(() => {
    const init = async () => {
      if (!masterKey) return;
      
      try {
        // --- RESTORE LOGIC (PENDING BACKUP) ---
        const pendingRestore = localStorage.getItem('pending_restore_payload');
        if (pendingRestore) {
            console.log("Found pending backup restore...");
            try {
                const decryptedData = await decryptData<any>(pendingRestore, masterKey);
                const selectionRaw = localStorage.getItem('pending_restore_selection');
                const selection: BackupCategory[] | undefined = selectionRaw ? JSON.parse(selectionRaw) : undefined;

                if (decryptedData && (decryptedData.profiles || decryptedData.settings)) {
                    console.log("Backup decrypted successfully! Restoring DB with selection:", selection);
                    await db.restoreAllData(decryptedData, selection);
                    localStorage.removeItem('pending_restore_payload');
                    localStorage.removeItem('pending_restore_selection');
                } else {
                    console.error("Decryption produced invalid data structure.");
                    localStorage.removeItem('pending_restore_payload');
                    localStorage.removeItem('pending_restore_selection');
                }
            } catch (e) {
                console.error("Failed to decrypt pending backup. Password might be different from backup.", e);
                localStorage.removeItem('pending_restore_payload');
                localStorage.removeItem('pending_restore_selection');
                alert("فشل استعادة النسخة الاحتياطية. كلمة المرور التي أدخلتها لا تتطابق مع ملف النسخة.");
            }
        }
        // --------------------------------------

        // 1. Settings
        let loadedSettings: AppSettings | undefined = undefined;
        const lsSettings = localStorage.getItem('yt_analyzer_settings');
        if (lsSettings && isEncryptedString(lsSettings)) {
             loadedSettings = await decryptData<AppSettings>(lsSettings, masterKey) || undefined;
        }

        if (!loadedSettings) {
             loadedSettings = await db.getSettings();
        }
        
        const defaultTranscriptServices: TranscriptService[] = [
            { id: 'ts_maestra', name: 'Maestra (Auto)', url: 'https://maestra.ai/ar/tools/video-to-text/youtube-transcript-generator', isDefault: true },
            { id: 'ts_downsub', name: 'DownSub (Subtitle)', url: 'https://downsub.com/' }
        ];

        const mergedSettings: AppSettings = {
            geminiApiKeys: [],
            customModels: ['models/gemini-flash-lite-latest','gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'],
            theme: 'light',
            transcriptServices: defaultTranscriptServices,
            defaultTranscriptServiceId: 'ts_maestra',
            ...loadedSettings
        };
        
        if(!mergedSettings.transcriptServices || mergedSettings.transcriptServices.length === 0) {
            mergedSettings.transcriptServices = defaultTranscriptServices;
            mergedSettings.defaultTranscriptServiceId = 'ts_maestra';
        }

        setSettings(mergedSettings);
        setThemeState(mergedSettings.theme);
        applyTheme(mergedSettings.theme);
        syncKeysToSession(mergedSettings.geminiApiKeys);
        updatePublicConfig(mergedSettings);

        // 2. Profiles
        let loadedProfiles: ChannelProfile[] = [];
        const savedProfilesRaw = localStorage.getItem('yt_analyzer_profiles');
        
        if (savedProfilesRaw && isEncryptedString(savedProfilesRaw)) {
            loadedProfiles = await decryptData<ChannelProfile[]>(savedProfilesRaw, masterKey) || [];
        } else {
            const dbProfiles = await db.getProfiles();
            if (dbProfiles && dbProfiles.length > 0) loadedProfiles = dbProfiles;
        }

        setProfiles(loadedProfiles);
        
        if (loadedProfiles.length > 0) {
            if (mergedSettings.defaultChannelId && loadedProfiles.some(p => p.id === mergedSettings.defaultChannelId)) {
                setCurrentProfileId(mergedSettings.defaultChannelId);
            } else {
                setCurrentProfileId(loadedProfiles[0].id);
            }
        }

      } catch (e) {
        console.error("Initialization error", e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [masterKey]);

  const applyTheme = (t: 'light' | 'dark') => {
      const root = window.document.documentElement;
      if (t === 'dark') {
          root.classList.add('dark');
      } else {
          root.classList.remove('dark');
      }
  };

  const setTheme = (t: 'light' | 'dark') => {
      setThemeState(t);
      applyTheme(t);
      updateSettings({ theme: t });
  };

  const updateSettings = async (newPart: Partial<AppSettings>) => {
      const updated = { ...settings, ...newPart };
      setSettings(updated);
      await db.saveSettings(updated);
      
      if (newPart.geminiApiKeys) {
          syncKeysToSession(newPart.geminiApiKeys);
      }
      
      updatePublicConfig(updated);

      const encrypted = await encryptData(updated, masterKey);
      localStorage.setItem('yt_analyzer_settings', encrypted);
  };

  const addProfile = async (profile: ChannelProfile) => {
      const updated = [...profiles, profile];
      setProfiles(updated);
      await db.saveProfile(profile);
      const encrypted = await encryptData(updated, masterKey);
      localStorage.setItem('yt_analyzer_profiles', encrypted);
      if (!currentProfileId) setCurrentProfileId(profile.id);
  };

  const updateProfile = async (profile: ChannelProfile) => {
      const updated = profiles.map(p => p.id === profile.id ? profile : p);
      setProfiles(updated);
      await db.saveProfile(profile);
      const encrypted = await encryptData(updated, masterKey);
      localStorage.setItem('yt_analyzer_profiles', encrypted);
  };

  const reorderProfiles = async (newProfiles: ChannelProfile[]) => {
      setProfiles(newProfiles);
      const encrypted = await encryptData(newProfiles, masterKey);
      localStorage.setItem('yt_analyzer_profiles', encrypted);
  };

  const removeProfile = async (id: string) => {
      const updated = profiles.filter(p => p.id !== id);
      setProfiles(updated);
      await db.deleteProfile(id);
      const encrypted = await encryptData(updated, masterKey);
      localStorage.setItem('yt_analyzer_profiles', encrypted);
      if (currentProfileId === id) setCurrentProfileId(updated.length > 0 ? updated[0].id : null);
  };

  const importProfiles = async (newProfiles: ChannelProfile[]) => {
      const currentMap = new Map<string, ChannelProfile>();
      profiles.forEach(p => currentMap.set(p.id, p));
      
      for (const p of newProfiles) {
          currentMap.set(p.id, p);
          await db.saveProfile(p);
      }
      
      const updatedList = Array.from(currentMap.values());
      setProfiles(updatedList);
      
      const encrypted = await encryptData(updatedList, masterKey);
      localStorage.setItem('yt_analyzer_profiles', encrypted);
      
      if (!currentProfileId && updatedList.length > 0) setCurrentProfileId(updatedList[0].id);
  };

  return (
    <AppContext.Provider value={{
      profiles, currentProfileId, settings, isLoading, theme, masterKey, pendingImageForEditor, pendingContentIdea, pendingBatchPrompts, pendingScriptForSplitter,
      setTheme, addProfile, updateProfile, removeProfile, importProfiles, selectProfile: setCurrentProfileId, updateSettings, 
      setPendingImageForEditor, setPendingContentIdea, setPendingBatchPrompts, setPendingScriptForSplitter,
      reorderProfiles
    }}>
      {children}
    </AppContext.Provider>
  );
};
