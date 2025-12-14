
// services/driveService.ts

const CLIENT_ID = "29493247182-qp578v0dv9184opl0pi188egqs5qo49h.apps.googleusercontent.com"; 
const SCOPES = "https://www.googleapis.com/auth/drive.appdata";
const FILENAME = "creatornexus_vault.enc";

// Declare globals for TypeScript
declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}

let tokenClient: any;
let accessToken: string | null = null;
let initPromise: Promise<void> | null = null;

// --- Token Persistence Logic ---
const STORAGE_KEY_TOKEN = 'gdrive_access_token';
const STORAGE_KEY_EXPIRY = 'gdrive_token_expiry';

const saveToken = (token: string, expiresInSeconds: number) => {
    const expiryTime = Date.now() + (expiresInSeconds * 1000);
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_EXPIRY, expiryTime.toString());
    accessToken = token;
};

const loadToken = (): string | null => {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const expiry = localStorage.getItem(STORAGE_KEY_EXPIRY);
    
    if (token && expiry) {
        if (Date.now() < parseInt(expiry)) {
            return token;
        } else {
            // Token expired
            clearToken();
        }
    }
    return null;
};

const clearToken = () => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_EXPIRY);
    accessToken = null;
};
// -------------------------------

// Helper: Load GAPI Script if not present
const loadGapiScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (window.gapi) {
            resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = "https://apis.google.com/js/api.js";
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load GAPI script"));
        document.body.appendChild(script);
    });
};

// Main Initialization Function
export const initGoogleDrive = async () => {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            // 1. Ensure GAPI is loaded
            await loadGapiScript();

            // 2. Load GAPI Client
            await new Promise<void>((resolve, reject) => {
                window.gapi.load('client', {
                    callback: resolve,
                    onerror: reject,
                    timeout: 8000,
                    ontimeout: () => reject(new Error("GAPI load timed out"))
                });
            });

            // 3. Initialize Drive API (Discovery)
            if (!window.gapi.client) {
                throw new Error("GAPI client is undefined after load");
            }
            
            await window.gapi.client.init({
                discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
            });
            
            // Check for persisted token
            const savedToken = loadToken();
            if (savedToken) {
                accessToken = savedToken;
                window.gapi.client.setToken({ access_token: savedToken });
            }
            
            // 4. Initialize GIS (Google Identity Services)
            if (typeof window !== 'undefined' && window.google && window.google.accounts) {
                tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: (tokenResponse: any) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            // Save Token Persistently
                            saveToken(tokenResponse.access_token, tokenResponse.expires_in);
                            
                            // Set token for gapi client requests
                            if (window.gapi.client) {
                                window.gapi.client.setToken(tokenResponse);
                            }
                        }
                    },
                });
            } else {
                console.warn("Google Identity Services script not ready yet.");
            }

        } catch (e) {
            console.error("Google Drive Service Initialization Failed:", e);
            initPromise = null; // Reset promise to allow retry
            throw e;
        }
    })();

    return initPromise;
};

// Sign In (Request Token)
export const signInGoogle = async (): Promise<boolean> => {
    try {
        await initGoogleDrive();
        
        // If we already have a valid token from storage, no need to popup
        if (isSignedIn()) return true;

        if (!tokenClient) {
            // Retry init logic for GIS if missing
            if (window.google && window.google.accounts) {
                 tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: (tokenResponse: any) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            saveToken(tokenResponse.access_token, tokenResponse.expires_in);
                            if (window.gapi.client) window.gapi.client.setToken(tokenResponse);
                        }
                    },
                });
            }
        }

        if (!tokenClient) {
            console.error("Token Client not initialized. GIS library might be blocked.");
            return false;
        }

        return new Promise((resolve) => {
            const originalCallback = tokenClient.callback;
            
            tokenClient.callback = (resp: any) => {
                if (resp.error !== undefined) {
                    console.error("Auth Error:", resp);
                    resolve(false);
                    throw resp;
                }
                saveToken(resp.access_token, resp.expires_in);
                if (window.gapi.client) {
                    window.gapi.client.setToken(resp);
                }
                if(originalCallback) tokenClient.callback = originalCallback;
                resolve(true);
            };

            tokenClient.requestAccessToken({ prompt: '' }); // Empty prompt tries silent first, otherwise use 'consent'
        });
    } catch (e) {
        console.error("Sign in exception:", e);
        return false;
    }
};

export const signOutGoogle = () => {
    if (window.gapi && window.gapi.client) {
        const token = window.gapi.client.getToken();
        if (token !== null && window.google && window.google.accounts) {
            window.google.accounts.oauth2.revoke(token.access_token, () => {
                window.gapi.client.setToken(null);
                clearToken();
            });
        } else {
            clearToken();
        }
    } else {
        clearToken();
    }
};

export const isSignedIn = (): boolean => {
    // Check memory or storage
    return !!accessToken || !!loadToken();
}

export const getDriveFile = async () => {
    await initGoogleDrive();
    try {
        const response = await window.gapi.client.drive.files.list({
            spaces: 'appDataFolder',
            q: `name = '${FILENAME}' and trashed = false`,
            fields: 'files(id, name, modifiedTime)',
        });
        return response.result.files?.[0] || null;
    } catch (error: any) {
        console.error("Error finding file:", error);
        
        // Check for 403 Forbidden (API Disabled or Quota)
        if (error.status === 403 || (error.result && error.result.error && error.result.error.code === 403)) {
             const msg = error.result?.error?.message || "";
             if (msg.includes("Google Drive API has not been used") || msg.includes("disabled")) {
                 throw new Error("API_DISABLED");
             }
             throw new Error("DRIVE_ACCESS_DENIED");
        }
        return null;
    }
};

export const uploadToDrive = async (encryptedData: string) => {
    await initGoogleDrive();
    
    // Ensure we have a token (memory or load from storage)
    if (!accessToken) accessToken = loadToken();
    if (!accessToken) throw new Error("No access token");

    const file = new Blob([encryptedData], { type: 'application/json' });
    const metadata: any = {
        name: FILENAME,
        mimeType: 'application/json',
    };

    let existingFile = null;
    try {
        existingFile = await getDriveFile();
    } catch (e: any) {
        if (e.message === "API_DISABLED") throw e; // Propagate critical error
    }

    if (!existingFile) {
        metadata.parents = ['appDataFolder'];
    }

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    if (existingFile) {
        url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
        method = 'PATCH';
    }

    const response = await fetch(url, {
        method: method,
        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
        body: form,
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error("Upload response error:", response.status, errText);
        
        if (response.status === 403) {
            if (errText.includes("Google Drive API has not been used") || errText.includes("disabled")) {
                throw new Error("API_DISABLED");
            }
        }
        throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    return await response.json();
};

export const downloadFromDrive = async (fileId: string) => {
    await initGoogleDrive();
    const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
    });
    return response.body; 
};
