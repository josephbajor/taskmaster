import React, { useEffect, useState } from 'react'

export const App: React.FC = () => {
    const [text, setText] = useState('')
    const [notes, setNotes] = useState<string[]>([])
    const [recording, setRecording] = useState(false)
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const saved = localStorage.getItem('notes')
        if (saved) setNotes(JSON.parse(saved))
    }, [])

    useEffect(() => {
        localStorage.setItem('notes', JSON.stringify(notes))
    }, [notes])

    const addNote = (content: string) => {
        if (!content.trim()) return
        setNotes(prev => [content.trim(), ...prev])
        setText('')
    }

    const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            addNote(text)
        }
    }

    const startRecording = async () => {
        setError(null)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mr = new MediaRecorder(stream)
        const chunks: BlobPart[] = []
        mr.ondataavailable = (ev) => {
            if (ev.data.size > 0) chunks.push(ev.data)
        }
        mr.onstop = async () => {
            try {
                setLoading(true)
                const blob = new Blob(chunks, { type: 'audio/webm' })
                const form = new FormData()
                form.append('file', blob, 'note.webm')
                const res = await fetch('http://127.0.0.1:8000/transcribe', {
                    method: 'POST',
                    body: form,
                })
                if (!res.ok) {
                    const errText = await res.text()
                    setError(`Transcription failed (${res.status}): ${errText}`)
                    return
                }
                const data = await res.json()
                addNote(data.text || '')
            } catch (e: any) {
                setError(`Transcription error: ${e?.message || String(e)}`)
            } finally {
                setLoading(false)
            }
        }
        mr.start()
        setMediaRecorder(mr)
        setRecording(true)
    }

    const stopRecording = () => {
        mediaRecorder?.stop()
        setRecording(false)
        setMediaRecorder(null)
    }

    return (
        <div style={{ padding: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>
            <h1>Taskmaster</h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => addNote(text)} disabled={loading}>Add</button>
                {!recording ? (
                    <button onClick={startRecording} disabled={loading}>Start Mic</button>
                ) : (
                    <button onClick={stopRecording} disabled={loading}>Stop Mic</button>
                )}
                {loading && <span>Transcribing…</span>}
            </div>
            {error && (
                <div style={{ color: 'red', marginTop: 8 }}>{error}</div>
            )}
            <textarea
                placeholder="Quick jot... (Cmd/Ctrl+Enter to add)"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ width: '100%', height: 120, marginTop: 8 }}
            />
            <h2>Unstructured Notes</h2>
            <ul>
                {notes.map((n, i) => (
                    <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>{n}</li>
                ))}
            </ul>
        </div>
    )
}


