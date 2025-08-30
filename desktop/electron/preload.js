import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('taskmaster', {
    // placeholder for future IPC
})


