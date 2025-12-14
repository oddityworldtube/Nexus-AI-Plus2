
import { CopilotPrompt } from '../types';
import { DEFAULT_COPILOT_PROMPTS } from '../data/defaultCopilotPrompts';
import * as db from './dbService';

export class CopilotPromptService {
    
    private static cache: Map<string, CopilotPrompt> = new Map();
    private static initialized = false;

    static async init() {
        if (this.initialized) return;
        
        // 1. Load Defaults into DB if not exist (First Run Logic)
        // Note: In a real app we might verify versions, here we just ensure they exist or rely on memory fallback
        
        const customPrompts = await db.getAllCopilotPrompts();
        
        // Populate Cache: Defaults first
        DEFAULT_COPILOT_PROMPTS.forEach(p => this.cache.set(p.id, p));
        
        // Overwrite/Append Custom from DB
        customPrompts.forEach(p => this.cache.set(p.id, p));
        
        this.initialized = true;
    }

    static async getPromptsByContext(contextType: string): Promise<CopilotPrompt[]> {
        await this.init();
        const all = Array.from(this.cache.values());
        // Return prompts that match the specific context OR 'GENERAL'
        return all.filter(p => p.context.includes(contextType) || p.context.includes('GENERAL'));
    }

    static async getAllPrompts(): Promise<CopilotPrompt[]> {
        await this.init();
        return Array.from(this.cache.values());
    }

    static async savePrompt(prompt: CopilotPrompt): Promise<void> {
        await db.saveCopilotPrompt(prompt);
        this.cache.set(prompt.id, prompt);
    }

    static async deletePrompt(id: string): Promise<void> {
        await db.deleteCopilotPrompt(id);
        this.cache.delete(id);
        // If it was a default prompt, we might want to "hide" it or just reset it from defaults next reload.
        // For simplicity, deleting a default prompt removes it from the current session/db until reset.
    }

    static async resetToDefaults(): Promise<void> {
        const allCustom = await db.getAllCopilotPrompts();
        for (const p of allCustom) {
            await db.deleteCopilotPrompt(p.id);
        }
        this.cache.clear();
        DEFAULT_COPILOT_PROMPTS.forEach(p => this.cache.set(p.id, p));
        // Re-save defaults to DB if we want them persistent as "customizable" base
        for (const p of DEFAULT_COPILOT_PROMPTS) {
            await db.saveCopilotPrompt(p);
        }
    }
}
