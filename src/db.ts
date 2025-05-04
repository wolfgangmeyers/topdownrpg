const DB_NAME = 'TopdownGameDB';
const DB_VERSION = 1;
const SCENE_STORE_NAME = 'scenes';

// Interface for the scene state we expect to store/retrieve
// (Duplicate or import from scene.ts - let's keep it simple for now)
interface SavedSceneState {
    objects: { 
        type: string; 
        x: number; 
        y: number;
        id?: string; // House objects store an ID property
    }[]; // Simplified for DB structure
    // Adjacent scene references
    northSceneId?: string | null;
    eastSceneId?: string | null;
    southSceneId?: string | null;
    westSceneId?: string | null;
    // Add other scene-specific persistent data here later
}

/**
 * Opens the IndexedDB database and ensures the object store exists.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', request.error);
            reject(new Error(`IndexedDB error: ${request.error}`));
        };

        request.onsuccess = (event) => {
            // Type assertion needed as event.target might be null initially
            const db = (event.target as IDBOpenDBRequest).result;
            resolve(db);
        };

        // This event only executes if the version number changes
        // or if the database is created for the first time.
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            console.log(`Upgrading database to version ${DB_VERSION}...`);
            if (!db.objectStoreNames.contains(SCENE_STORE_NAME)) {
                console.log(`Creating object store: ${SCENE_STORE_NAME}`);
                db.createObjectStore(SCENE_STORE_NAME, { keyPath: 'id' }); // Scene ID will be the key path
                // Could also use autoIncrementing key and store sceneId within the object
            } else {
                // Handle potential upgrades for future versions here
            }
        };
    });
}

/**
 * Saves the state of a scene to IndexedDB.
 * @param {string} sceneId The ID of the scene to save.
 * @param {SavedSceneState} sceneState The scene state object to save.
 * @returns {Promise<void>} A promise that resolves when saving is complete.
 */
export async function saveSceneState(sceneId: string, sceneState: SavedSceneState): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(SCENE_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SCENE_STORE_NAME);
        
        // Add the sceneId to the object itself, as it's the keyPath
        const stateToStore = { ...sceneState, id: sceneId }; 

        const request = store.put(stateToStore); 

        request.onsuccess = () => {
            console.log(`Scene [${sceneId}] state saved successfully.`);
            resolve();
        };

        request.onerror = () => {
            console.error(`Error saving scene [${sceneId}] state:`, request.error);
            reject(new Error(`Error saving scene state: ${request.error}`));
        };

        transaction.oncomplete = () => {
            db.close();
        };
         transaction.onerror = () => {
             console.error(`Transaction error saving scene [${sceneId}]:`, transaction.error);
             db.close(); // Ensure DB is closed even on transaction error
             reject(new Error(`Transaction error saving scene state: ${transaction.error}`));
        }
    });
}

/**
 * Loads the state of a scene from IndexedDB.
 * @param {string} sceneId The ID of the scene to load.
 * @returns {Promise<SavedSceneState | undefined>} A promise resolving with the loaded state or undefined if not found.
 */
export async function loadSceneState(sceneId: string): Promise<SavedSceneState | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(SCENE_STORE_NAME, 'readonly');
        const store = transaction.objectStore(SCENE_STORE_NAME);
        const request = store.get(sceneId);

        request.onsuccess = () => {
            // request.result will be undefined if the key is not found
            resolve(request.result as SavedSceneState | undefined);
        };

        request.onerror = () => {
            console.error(`Error loading scene [${sceneId}] state:`, request.error);
            reject(new Error(`Error loading scene state: ${request.error}`));
        };

        transaction.oncomplete = () => {
            db.close();
        };
         transaction.onerror = () => {
             console.error(`Transaction error loading scene [${sceneId}]:`, transaction.error);
             db.close();
             reject(new Error(`Transaction error loading scene state: ${transaction.error}`));
        }
    });
}

/**
 * Deletes the state of a scene from IndexedDB.
 * @param {string} sceneId The ID of the scene to delete.
 * @returns {Promise<void>} A promise that resolves when deletion is complete.
 */
export async function deleteSceneState(sceneId: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(SCENE_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SCENE_STORE_NAME);
        const request = store.delete(sceneId);

        request.onsuccess = () => {
            console.log(`Scene [${sceneId}] state deleted successfully.`);
            resolve();
        };

        request.onerror = () => {
            console.error(`Error deleting scene [${sceneId}] state:`, request.error);
            reject(new Error(`Error deleting scene state: ${request.error}`));
        };

        transaction.oncomplete = () => {
            db.close();
        };
        transaction.onerror = () => {
            console.error(`Transaction error deleting scene [${sceneId}]:`, transaction.error);
            db.close();
            reject(new Error(`Transaction error deleting scene state: ${transaction.error}`));
        }
    });
}

/**
 * Retrieves all scene IDs from the database.
 * @returns {Promise<string[]>} A promise resolving with an array of all scene IDs.
 */
export async function getAllSceneIds(): Promise<string[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(SCENE_STORE_NAME, 'readonly');
        const store = transaction.objectStore(SCENE_STORE_NAME);
        const request = store.getAllKeys();

        request.onsuccess = () => {
            // Convert IDBValidKey array to string array
            const sceneIds = Array.from(request.result).map(key => String(key));
            console.log(`Retrieved ${sceneIds.length} scene IDs from database.`);
            resolve(sceneIds);
        };

        request.onerror = () => {
            console.error(`Error retrieving scene IDs:`, request.error);
            reject(new Error(`Error retrieving scene IDs: ${request.error}`));
        };

        transaction.oncomplete = () => {
            db.close();
        };
        transaction.onerror = () => {
            console.error(`Transaction error retrieving scene IDs:`, transaction.error);
            db.close();
            reject(new Error(`Transaction error retrieving scene IDs: ${transaction.error}`));
        }
    });
}

/**
 * Deletes all scenes from the database except for the specified scene and its linked interior scenes.
 * First loads each scene to be deleted, cleans up all entities within it, then deletes it.
 * @param {string} exceptSceneId The ID of the scene to keep.
 * @returns {Promise<string[]>} A promise resolving with an array of deleted scene IDs.
 */
export async function deleteAllScenesExcept(exceptSceneId: string): Promise<string[]> {
    // Get all scene IDs first
    const allSceneIds = await getAllSceneIds();
    
    // Create a set of scene IDs to preserve
    const sceneIdsToPreserve = new Set<string>([exceptSceneId]);
    
    // Load the scene we want to keep to check for houses with interior scenes
    try {
        const sceneState = await loadSceneState(exceptSceneId);
        if (sceneState && sceneState.objects) {
            // Look for House objects and preserve their interior scenes
            sceneState.objects.forEach(obj => {
                // Houses store their ID which is used to create interior scene IDs
                if (obj.type === 'House' && obj.id) {
                    const interiorSceneId = `interior-${obj.id}`;
                    sceneIdsToPreserve.add(interiorSceneId);
                    console.log(`Preserving interior scene: ${interiorSceneId}`);
                }
            });
        }
    } catch (error) {
        console.error(`Error loading scene ${exceptSceneId} to check for interior scenes:`, error);
    }
    
    // Filter out the scenes to preserve
    const sceneIdsToDelete = allSceneIds.filter(id => !sceneIdsToPreserve.has(id));
    
    if (sceneIdsToDelete.length === 0) {
        console.log(`No scenes to delete (only found scenes to preserve: ${Array.from(sceneIdsToPreserve).join(', ')})`);
        return [];
    }
    
    console.log(`Preserving ${sceneIdsToPreserve.size} scenes, deleting ${sceneIdsToDelete.length} scenes...`);
    
    // Delete each scene not in the preserve list
    const deletedScenes: string[] = [];
    for (const sceneId of sceneIdsToDelete) {
        try {
            // First, load the scene state
            const sceneState = await loadSceneState(sceneId);
            
            if (sceneState) {
                // Clear all objects from the scene to properly handle House deletions
                // This prevents orphaned interior scenes
                if (sceneState.objects && Array.isArray(sceneState.objects)) {
                    // Create a new state with empty objects array
                    const cleanedState = {
                        ...sceneState,
                        objects: [], // Clear all objects
                        droppedItems: [] // Clear all items
                    };
                    
                    // Save the cleaned state back to the database
                    await saveSceneState(sceneId, cleanedState);
                    console.log(`Cleaned objects from scene ${sceneId} before deletion`);
                }
            }
            
            // Now delete the scene
            await deleteSceneState(sceneId);
            deletedScenes.push(sceneId);
            
        } catch (error) {
            console.error(`Failed to delete scene ${sceneId}:`, error);
        }
    }
    
    console.log(`Deleted ${deletedScenes.length} scenes successfully.`);
    return deletedScenes;
} 