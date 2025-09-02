const micBtn = document.getElementById('micBtn')
const statusEl = document.getElementById('status')
const textInput = document.getElementById('textInput')

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
            try {
                setStatus('Uploading…')
                const blob = new Blob(recordedChunks, { type: 'audio/webm' })
                const form = new FormData()
                form.append('file', blob, 'audio.webm')

                const res = await fetch('http://127.0.0.1:8000/api/transcriptions', {
                    method: 'POST',
                    body: form
                })
                if (!res.ok) {
                    const msg = await res.text()
                    throw new Error(`Transcription failed: ${msg}`)
                }
                const data = await res.json()
                // Insert transcription at cursor or append
                const insertion = data.text || ''
                const start = textInput.selectionStart
                const end = textInput.selectionEnd
                const before = textInput.value.slice(0, start)
                const after = textInput.value.slice(end)
                textInput.value = `${before}${insertion}${after}`
                textInput.selectionStart = textInput.selectionEnd = start + insertion.length
                setStatus('Idle')
            } catch (err) {
                console.error(err)
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
        micBtn.textContent = '⏹ Stop Recording'
        await startRecording()
    } else {
        isRecording = false
        micBtn.textContent = '🎤 Start Recording'
        stopRecording()
    }
})
