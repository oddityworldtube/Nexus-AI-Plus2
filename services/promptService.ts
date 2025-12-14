
import { PromptTemplate } from '../types';
import { DEFAULT_PROMPTS } from '../data/defaultPrompts';
import * as db from './dbService';

export class PromptService {
    
    // Cache prompts in memory to reduce DB hits
    private static cache: Map<string, PromptTemplate> = new Map();
    private static initialized = false;

    static async init() {
        if (this.initialized) return;
        const customPrompts = await db.getAllPrompts();
        
        // Load Defaults
        DEFAULT_PROMPTS.forEach(p => this.cache.set(p.id, p));
        
        // Overwrite with Custom
        customPrompts.forEach(p => this.cache.set(p.id, p));
        
        this.initialized = true;
    }

    static async getPrompt(id: string): Promise<PromptTemplate> {
        await this.init();
        const p = this.cache.get(id);
        if (!p) {
            // Fallback if not found in cache (shouldn't happen for defaults)
            const def = DEFAULT_PROMPTS.find(d => d.id === id);
            if (def) return def;
            throw new Error(`Prompt ID not found: ${id}`);
        }
        return p;
    }

    static async savePrompt(prompt: PromptTemplate): Promise<void> {
        await db.savePrompt(prompt);
        this.cache.set(prompt.id, prompt);
    }

    static async resetPrompt(id: string): Promise<void> {
        const def = DEFAULT_PROMPTS.find(d => d.id === id);
        if (!def) throw new Error("Default prompt not found");
        
        await db.deletePrompt(id); // Remove custom version
        this.cache.set(id, def); // Revert cache
    }

    static async resetAll(): Promise<void> {
        const allCustom = await db.getAllPrompts();
        for (const p of allCustom) {
            await db.deletePrompt(p.id);
        }
        this.cache.clear();
        DEFAULT_PROMPTS.forEach(p => this.cache.set(p.id, p));
    }

    static async buildPrompt(id: string, variables: Record<string, any>): Promise<string> {
        const templateObj = await this.getPrompt(id);
        let text = templateObj.template;

        // Interpolate variables {varName}
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{${key}}`, 'g');
            let strValue = '';
            if (typeof value === 'object') {
                strValue = JSON.stringify(value);
            } else {
                strValue = String(value);
            }
            text = text.replace(regex, strValue);
        }
        
        return text;
    }
    
    static getAllDefaults(): PromptTemplate[] {
        return DEFAULT_PROMPTS;
    }
}
