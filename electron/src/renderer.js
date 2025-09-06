const micBtn = document.getElementById('micBtn')
const statusEl = document.getElementById('status')
const textInput = document.getElementById('textInput')
const generateBtn = document.getElementById('generateBtn')
const refreshBtn = document.getElementById('refreshBtn')
const tasksList = document.getElementById('tasksList')

let mediaRecorder = null
let recordedChunks = []
let stream = null

function setStatus(text) {
    statusEl.textContent = text
}

async function startRecording() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        recordedChunks = []
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data)
            }
        }

        mediaRecorder.onstop = async () => {
            const startTime = Date.now()
            try {
                setStatus('Uploading…')
                const blob = new Blob(recordedChunks, { type: 'audio/webm' })
                const form = new FormData()
                form.append('file', blob, 'audio.webm')

                // Use generated SDK
                // Use bundled SDK for reliable import from file://
                const { TaskmasterTaskmasterClient, TaskmasterTaskmasterEnvironment } = await import('./sdk/index.bundle.js')
                const client = new TaskmasterTaskmasterClient({ environment: TaskmasterTaskmasterEnvironment.Local })
                const data = await client.transcription.createTranscription({ file: blob })
                // Insert transcription at cursor or append
                const insertion = data.text || ''
                const start = textInput.selectionStart
                const end = textInput.selectionEnd
                const before = textInput.value.slice(0, start)
                const after = textInput.value.slice(end)
                textInput.value = `${before}${insertion}${after}`
                textInput.selectionStart = textInput.selectionEnd = start + insertion.length
                const ms = Date.now() - startTime
                console.info(`[renderer] Transcription success in ${ms}ms`)
                setStatus('Idle')
            } catch (err) {
                console.error('[renderer] Transcription error:', err)
                try {
                    // Try to print rich details for SDK errors
                    if (err && typeof err === 'object') {
                        const anyErr = err
                        if (anyErr.statusCode) console.error('statusCode:', anyErr.statusCode)
                        if (anyErr.body) console.error('body:', anyErr.body)
                        if (anyErr.rawResponse) {
                            const raw = anyErr.rawResponse
                            console.error('rawResponse.status:', raw.status)
                            console.error('rawResponse.headers:', raw.headers)
                            const text = await raw.rawResponse.text().catch(() => null)
                            if (text) console.error('rawResponse.bodyText:', text)
                        }
                    }
                } catch { }
                setStatus('Error')
            } finally {
                if (stream) {
                    stream.getTracks().forEach(t => t.stop())
                    stream = null
                }
            }
        }

        mediaRecorder.start()
        setStatus('Recording…')
    } catch (err) {
        console.error(err)
        setStatus('Mic error')
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
    }
}

let isRecording = false
micBtn.addEventListener('click', async () => {
    if (!isRecording) {
        isRecording = true
        micBtn.classList.add('active')
        micBtn.setAttribute('aria-pressed', 'true')
        micBtn.title = 'Stop recording'
        await startRecording()
    } else {
        isRecording = false
        micBtn.classList.remove('active')
        micBtn.setAttribute('aria-pressed', 'false')
        micBtn.title = 'Start recording'
        stopRecording()
    }
})

// Global error visibility in renderer
window.addEventListener('error', (e) => {
    console.error('[renderer] Unhandled error:', e.error || e.message)
    if (e?.error?.stack) console.error(e.error.stack)
})
window.addEventListener('unhandledrejection', (e) => {
    console.error('[renderer] Unhandled rejection:', e.reason)
})

async function getClient() {
    const { TaskmasterTaskmasterClient, TaskmasterTaskmasterEnvironment } = await import('./sdk/index.bundle.js')
    return new TaskmasterTaskmasterClient({ environment: TaskmasterTaskmasterEnvironment.Local })
}

function renderTasks(tasks) {
    tasksList.innerHTML = ''
    if (!Array.isArray(tasks) || tasks.length === 0) {
        tasksList.innerHTML = '<div class="task-item">No tasks yet.</div>'
        return
    }
    for (const t of tasks) {
        const div = document.createElement('div')
        div.className = 'task-item'
        const status = t.status || 'UNKNOWN'
        const priority = typeof t.priority === 'number' ? `P${t.priority}` : ''
        div.textContent = `${t.title} — ${status}${priority ? ` — ${priority}` : ''}`
        tasksList.appendChild(div)
    }
}

async function refreshTasks() {
    try {
        setStatus('Loading tasks…')
        const client = await getClient()
        const data = await client.tasks.getTasks()
        renderTasks(data)
        setStatus('Idle')
    } catch (err) {
        console.error('[renderer] Get tasks error:', err)
        setStatus('Error')
    }
}

async function generateTasks() {
    const transcript = textInput.value || ''
    if (!transcript.trim()) {
        setStatus('Provide transcript text')
        return
    }
    try {
        setStatus('Generating tasks…')
        const client = await getClient()
        await client.tasks.generateTasks({ transcript, existing_tasks: undefined })
        await refreshTasks()
        setStatus('Idle')
    } catch (err) {
        console.error('[renderer] Generate tasks error:', err)
        setStatus('Error')
    }
}

generateBtn.addEventListener('click', generateTasks)
refreshBtn.addEventListener('click', refreshTasks)

// Initial load
refreshTasks().catch(() => { })
