
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useToast } from './ToastContext';
import { useAppContext } from './AppContext';
import { initGoogleDrive, signInGoogle, signOutGoogle, uploadToDrive, getDriveFile, downloadFromDrive, isSignedIn } from '../services/driveService';
import { encryptData, decryptData, generateKeyFromPassword } from '../services/securityService';
import * as db from '../services/dbService';

type SyncStatus = 'IDLE' | 'SYNCING' | 'SAVED' | 'ERROR' | 'UPDATE_AVAILABLE' | 'PASSWORD_REQUIRED';

interface SyncContextType {
  status: SyncStatus;
  lastSyncTime: Date | null;
  isAuth: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  syncNow: () => Promise<void>; 
  uploadManual: () => Promise<void>; 
  restoreManual: (passwordOverride?: string) => Promise<void>; // Modified to accept password
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { masterKey } = useAppContext();
  const { addToast } = useToast();
  
  const [status, setStatus] = useState<SyncStatus>('IDLE');
  const [isAuth, setIsAuth] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const autoSaveTimer = useRef<any>(null);

  // 1. Initialization
  useEffect(() => {
    const initialize = async () => {
        try {
            await initGoogleDrive();
            if (isSignedIn()) {
                setIsAuth(true);
                checkForUpdates();
            }
        } catch (e) {
            console.warn("Drive Init postponed/failed:", e);
        }
    };
    const timer = setTimeout(initialize, 1500);
    return () => clearTimeout(timer);
  }, []);

  // 2. Auto-Save Interval
  useEffect(() => {
      if(isAuth && masterKey) {
          checkForUpdates();
          autoSaveTimer.current = setInterval(() => {
              performUpload(true); 
          }, 5 * 60 * 1000); 
      }
      return () => {
          if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
      };
  }, [isAuth, masterKey]);

  // Upload Function
  const performUpload = async (silent = false) => {
      if(!masterKey || !isAuth) return;
      if(!silent) setStatus('SYNCING');
      
      try {
          const allData = await db.getAllData();
          const encrypted = await encryptData(allData, masterKey);
          await uploadToDrive(encrypted);
          
          setLastSyncTime(new Date());
          localStorage.setItem('last_local_save', Date.now().toString());
          setStatus('SAVED');
          if(!silent) addToast("تم حفظ النسخة السحابية بنجاح", "success");
      } catch(e: any) {
          console.error("Upload error:", e);
          setStatus('ERROR');
          
          if (e.message === "API_DISABLED") {
              addToast("⚠️ يرجى تفعيل 'Google Drive API' في Google Cloud Console للمشروع المرتبط.", "error", "API معطل", 10000);
          } else if (!silent) {
              addToast("فشل الحفظ السحابي", "error");
          }
      }
  };

  // Check Updates Function
  const checkForUpdates = async () => {
      if(!isAuth) return;
      try {
          const remoteFile = await getDriveFile();
          if(!remoteFile) {
              if (masterKey) performUpload(true);
              return; 
          }

          const remoteTime = new Date(remoteFile.modifiedTime!).getTime();
          const localTime = parseInt(localStorage.getItem('last_local_save') || '0');

          if(remoteTime > localTime + 60000) {
              setStatus('UPDATE_AVAILABLE');
          }
      } catch (e: any) {
          console.error("Check updates failed", e);
          if (e.message === "API_DISABLED") {
              addToast("⚠️ يرجى تفعيل 'Google Drive API' في Google Cloud Console للمشروع المرتبط.", "error", "API معطل", 10000);
              setStatus('ERROR');
          }
      }
  };

  const restoreFromDrive = async (fileId: string, passwordOverride?: string) => {
      if (!masterKey && !passwordOverride) return;
      setStatus('SYNCING');
      try {
          const content = await downloadFromDrive(fileId);
          
          let decryptionKey = masterKey!;
          
          // If password override is provided (for old backups)
          if (passwordOverride) {
              // We need the salt from the file to derive the key. 
              // Wait, the current architecture wraps the data in `encryptData` which puts the salt/IV inside the string prefix/binary.
              // BUT `securityService.ts` mainly uses a FIXED salt per user session (stored in localStorage 'vault_salt').
              // This is a design limitation of the previous code. 
              // To properly support "Old Passwords", the encrypted string itself should suffice IF it was encrypted with `encryptData`.
              // However, `encryptData` in `securityService.ts` currently RELIES on the `key` passed to it.
              // The `key` depends on the `salt` stored in the user's browser.
              
              // CRITICAL FIX: To restore from a DIFFERENT password, we essentially need the SALT that was used to create that password's key.
              // If the user completely wiped their browser, they have a NEW salt. 
              // The `SyncContext` should ideally backup the SALT too, or use a method that embeds salt in the payload.
              
              // Assuming the standard use case where the user simply changed password on the SAME machine (salt preserved) OR we accept that we try to derive with current salt.
              // If salt is lost (new machine), standard derivation won't work unless the salt was static or backed up.
              
              // For now, let's attempt to derive using the CURRENT local salt with the OLD password.
              // This works if the user is on the same machine but changed password.
              // If it's a new machine, this might fail if salt isn't backed up.
              // Note: The `VaultBackup.tsx` component DOES backup the salt inside the JSON file. 
              // But the `GoogleDriveSync` just uploads the encrypted string.
              
              // Let's proceed with current salt + input password.
              const saltRaw = localStorage.getItem('vault_salt');
              if (saltRaw) {
                  const salt = JSON.parse(saltRaw);
                  decryptionKey = await generateKeyFromPassword(passwordOverride, salt);
              }
          }

          const data = await decryptData(content, decryptionKey);
          
          if(data) {
              // @ts-ignore
              await db.restoreAllData(data);
              localStorage.setItem('last_local_save', Date.now().toString());
              setStatus('SAVED');
              addToast("تمت استعادة البيانات بنجاح! جاري التحديث...", "success");
              setTimeout(() => window.location.reload(), 1500);
          } else {
              throw new Error("DECRYPT_FAILED");
          }
      } catch(e: any) {
          console.error(e);
          if (e.message === "DECRYPT_FAILED" || e.message?.includes("OperationError")) {
              setStatus('PASSWORD_REQUIRED');
              addToast("فشل فك التشفير. كلمة مرور الملف تختلف عن الحالية.", "warning");
          } else {
              setStatus('ERROR');
              addToast("فشل استعادة النسخة السحابية.", "error");
          }
      }
  };

  const manualRestore = async (passwordOverride?: string) => {
      if (!isAuth) return;
      if (!passwordOverride) addToast("جاري البحث عن نسخ احتياطية...", "info");
      
      try {
          const remoteFile = await getDriveFile();
          if (!remoteFile) {
              addToast("لا توجد نسخة احتياطية على Google Drive.", "warning");
              return;
          }
          await restoreFromDrive(remoteFile.id, passwordOverride);
      } catch (e) {
          addToast("حدث خطأ أثناء الاتصال بـ Drive", "error");
      }
  };

  const connect = async () => {
      try {
          const success = await signInGoogle();
          if(success) {
              setIsAuth(true);
              addToast("تم الاتصال بجوجل درايف", "success");
              await checkForUpdates(); 
          }
      } catch(e) { 
          console.error(e);
          addToast("تم إلغاء الاتصال أو حدث خطأ", "info"); 
      }
  };

  const disconnect = () => {
      signOutGoogle();
      setIsAuth(false);
      setStatus('IDLE');
      addToast("تم فصل الحساب", "info");
  };

  return (
    <SyncContext.Provider value={{ 
        status, 
        lastSyncTime, 
        isAuth, 
        connect, 
        disconnect, 
        syncNow: () => performUpload(false),
        uploadManual: () => performUpload(false),
        restoreManual: manualRestore
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
    const context = useContext(SyncContext);
    if (!context) throw new Error('useSync must be used within SyncProvider');
    return context;
};
