import { app, BrowserWindow } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import process from 'process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 700,
        frame: false,
        transparent: true,
        titleBarStyle: 'hidden',
        backgroundColor: '#00000000',
        webPreferences: {
            contextIsolation: true,
            preload: join(__dirname, 'preload.js')
        }
    })

    win.loadFile('index.html')

    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
        // Surface renderer console to main process Terminal
        const levels = ['LOG', 'WARN', 'ERROR', 'INFO', 'DEBUG']
        const lvl = levels[level] || String(level)
        console.log(`[webContents:${lvl}] ${message} (${sourceId}:${line})`)
    })
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

// Log unhandled main-process errors
process.on('uncaughtException', (err) => {
    console.error('[main] uncaughtException:', err)
})
process.on('unhandledRejection', (reason) => {
    console.error('[main] unhandledRejection:', reason)
})
