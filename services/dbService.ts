
import { openDB, DBSchema } from 'idb';
import { ChannelProfile, AppSettings, SavedCompetitor, IdeaSession, CanvasTemplate, PromptTemplate, CopilotSession, CopilotPrompt, UserPreferences, FullDatabaseDump, BackupCategory } from '../types';

interface CreatorMindDB extends DBSchema {
  profiles: {
    key: string;
    value: ChannelProfile;
  };
  settings: {
    key: string;
    value: AppSettings;
  };
  competitors: {
    key: string;
    value: SavedCompetitor;
  };
  ideaHistory: {
    key: string;
    value: IdeaSession;
  };
  templates: {
    key: string;
    value: CanvasTemplate;
  };
  prompts: {
    key: string;
    value: PromptTemplate;
  };
  copilotHistory: {
    key: string;
    value: CopilotSession;
  };
  copilotPrompts: {
    key: string;
    value: CopilotPrompt;
  };
  userPreferences: {
    key: string;
    value: UserPreferences;
  };
}

const DB_NAME = 'creatormind_db';
const DB_VERSION = 5; // Bumped to 5 to force creation of userPreferences if missing

export const initDB = async () => {
  return openDB<CreatorMindDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('competitors')) {
        db.createObjectStore('competitors', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('ideaHistory')) {
        db.createObjectStore('ideaHistory', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('templates')) {
        db.createObjectStore('templates', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('prompts')) {
        db.createObjectStore('prompts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('copilotHistory')) {
        db.createObjectStore('copilotHistory', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('copilotPrompts')) {
        db.createObjectStore('copilotPrompts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('userPreferences')) {
        db.createObjectStore('userPreferences', { keyPath: 'id' });
      }
    },
  });
};

// --- Profiles ---
export const saveProfile = async (profile: ChannelProfile) => {
  const db = await initDB();
  await db.put('profiles', profile);
};

export const getProfiles = async (): Promise<ChannelProfile[]> => {
  const db = await initDB();
  return db.getAll('profiles');
};

export const deleteProfile = async (id: string) => {
  const db = await initDB();
  await db.delete('profiles', id);
};

// --- Settings ---
export const saveSettings = async (settings: AppSettings) => {
  const db = await initDB();
  await db.put('settings', { ...settings, id: 'global' } as any);
};

export const getSettings = async (): Promise<AppSettings | undefined> => {
  const db = await initDB();
  const res = await db.get('settings', 'global');
  return res ? { ...res } : undefined;
};

// --- Templates ---
export const saveTemplate = async (template: CanvasTemplate) => {
  const db = await initDB();
  await db.put('templates', template);
};

export const getTemplates = async (): Promise<CanvasTemplate[]> => {
  const db = await initDB();
  return db.getAll('templates');
};

export const deleteTemplate = async (id: string) => {
  const db = await initDB();
  await db.delete('templates', id);
};

// --- Competitors ---
export const saveCompetitor = async (competitor: SavedCompetitor) => {
    const db = await initDB();
    await db.put('competitors', competitor);
};

export const getCompetitors = async (): Promise<SavedCompetitor[]> => {
    const db = await initDB();
    return db.getAll('competitors');
};

export const deleteCompetitor = async (id: string) => {
    const db = await initDB();
    await db.delete('competitors', id);
};

// --- Idea History ---
export const saveIdeaSession = async (session: IdeaSession) => {
    const db = await initDB();
    await db.put('ideaHistory', session);
};

export const getIdeaHistory = async (): Promise<IdeaSession[]> => {
    const db = await initDB();
    const all = await db.getAll('ideaHistory');
    return all.sort((a, b) => Number(b.id) - Number(a.id));
};

export const deleteIdeaSession = async (id: string | number) => {
    const db = await initDB();
    await db.delete('ideaHistory', id.toString());
};

export const clearIdeaHistory = async () => {
    const db = await initDB();
    await db.clear('ideaHistory');
};

// --- Prompts (Legacy/System) ---
export const savePrompt = async (prompt: PromptTemplate) => {
    const db = await initDB();
    await db.put('prompts', prompt);
};

export const getPrompt = async (id: string): Promise<PromptTemplate | undefined> => {
    const db = await initDB();
    return db.get('prompts', id);
};

export const getAllPrompts = async (): Promise<PromptTemplate[]> => {
    const db = await initDB();
    return db.getAll('prompts');
};

export const deletePrompt = async (id: string) => {
    const db = await initDB();
    await db.delete('prompts', id);
};

// --- Copilot History ---
export const saveCopilotSession = async (session: CopilotSession) => {
    const db = await initDB();
    await db.put('copilotHistory', session);
};

export const getCopilotSessions = async (): Promise<CopilotSession[]> => {
    const db = await initDB();
    const all = await db.getAll('copilotHistory');
    return all.sort((a, b) => Number(b.id) - Number(a.id));
};

export const deleteCopilotSession = async (id: string) => {
    const db = await initDB();
    await db.delete('copilotHistory', id);
};

// --- Copilot Prompts ---
export const saveCopilotPrompt = async (prompt: CopilotPrompt) => {
    const db = await initDB();
    await db.put('copilotPrompts', prompt);
};

export const getAllCopilotPrompts = async (): Promise<CopilotPrompt[]> => {
    const db = await initDB();
    return db.getAll('copilotPrompts');
};

export const getCopilotPrompt = async (id: string): Promise<CopilotPrompt | undefined> => {
    const db = await initDB();
    return db.get('copilotPrompts', id);
};

export const deleteCopilotPrompt = async (id: string) => {
    const db = await initDB();
    await db.delete('copilotPrompts', id);
};

// --- User Preferences ---
export const saveUserPreferences = async (prefs: UserPreferences) => {
    const db = await initDB();
    await db.put('userPreferences', prefs);
};

export const getUserPreferences = async (): Promise<UserPreferences | undefined> => {
    const db = await initDB();
    return db.get('userPreferences', 'default');
};

// --- FULL BACKUP & RESTORE ---

export const getAllData = async (categories?: BackupCategory[]): Promise<FullDatabaseDump> => {
    const db = await initDB();
    const shouldInclude = (cat: BackupCategory) => !categories || categories.includes(cat);

    return {
        profiles: shouldInclude('profiles') ? await db.getAll('profiles') : [],
        settings: shouldInclude('settings') ? (await db.get('settings', 'global') as AppSettings) || { geminiApiKeys: [], customModels: [], theme: 'light' } : { geminiApiKeys: [], customModels: [], theme: 'light' },
        competitors: shouldInclude('competitors') ? await db.getAll('competitors') : [],
        ideaHistory: shouldInclude('ideaHistory') ? await db.getAll('ideaHistory') : [],
        templates: shouldInclude('templates') ? await db.getAll('templates') : [],
        prompts: shouldInclude('prompts') ? await db.getAll('prompts') : [],
        copilotHistory: shouldInclude('copilotHistory') ? await db.getAll('copilotHistory') : [],
        copilotPrompts: shouldInclude('copilotPrompts') ? await db.getAll('copilotPrompts') : [],
        userPreferences: shouldInclude('userPreferences') ? await db.getAll('userPreferences') : [],
    };
};

export const restoreAllData = async (dump: FullDatabaseDump, categories?: BackupCategory[]) => {
    const db = await initDB();
    const tx = db.transaction([
        'profiles', 'settings', 'competitors', 'ideaHistory', 
        'templates', 'prompts', 'copilotHistory', 'copilotPrompts', 'userPreferences'
    ], 'readwrite');

    const shouldRestore = (cat: BackupCategory) => !categories || categories.includes(cat);

    const promises = [];

    // Clear and Restore Profiles
    if (shouldRestore('profiles')) {
        await tx.objectStore('profiles').clear();
        if(dump.profiles) dump.profiles.forEach(i => promises.push(tx.objectStore('profiles').put(i)));
    }

    // Clear and Restore Settings (Merge technically safer, but overwrite requested)
    if (shouldRestore('settings')) {
        await tx.objectStore('settings').clear();
        if(dump.settings) promises.push(tx.objectStore('settings').put({ ...dump.settings, id: 'global' } as any));
    }

    // Competitors
    if (shouldRestore('competitors')) {
        await tx.objectStore('competitors').clear();
        if(dump.competitors) dump.competitors.forEach(i => promises.push(tx.objectStore('competitors').put(i)));
    }

    // Idea History
    if (shouldRestore('ideaHistory')) {
        await tx.objectStore('ideaHistory').clear();
        if(dump.ideaHistory) dump.ideaHistory.forEach(i => promises.push(tx.objectStore('ideaHistory').put(i)));
    }

    // Templates
    if (shouldRestore('templates')) {
        await tx.objectStore('templates').clear();
        if(dump.templates) dump.templates.forEach(i => promises.push(tx.objectStore('templates').put(i)));
    }

    // Prompts
    if (shouldRestore('prompts')) {
        await tx.objectStore('prompts').clear();
        if(dump.prompts) dump.prompts.forEach(i => promises.push(tx.objectStore('prompts').put(i)));
    }

    // Copilot History
    if (shouldRestore('copilotHistory')) {
        await tx.objectStore('copilotHistory').clear();
        if(dump.copilotHistory) dump.copilotHistory.forEach(i => promises.push(tx.objectStore('copilotHistory').put(i)));
    }

    // Copilot Prompts
    if (shouldRestore('copilotPrompts')) {
        await tx.objectStore('copilotPrompts').clear();
        if(dump.copilotPrompts) dump.copilotPrompts.forEach(i => promises.push(tx.objectStore('copilotPrompts').put(i)));
    }

    // User Preferences
    if (shouldRestore('userPreferences')) {
        await tx.objectStore('userPreferences').clear();
        if(dump.userPreferences) dump.userPreferences.forEach(i => promises.push(tx.objectStore('userPreferences').put(i)));
    }

    await Promise.all(promises);
    await tx.done;
};
