// Configuration
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8787' 
    : window.location.origin;

const CONVERSATION_ID = 'user-' + Math.random().toString(36).substr(2, 9);

// State management
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let stream = null;

// DOM elements
const chatContainer = document.getElementById('chatContainer');
const textInput = document.getElementById('textInput');
const recordBtn = document.getElementById('recordBtn');
const statusDiv = document.getElementById('status');
const errorContainer = document.getElementById('errorContainer');

/**
 * Add message to chat UI
 */
function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Show error message
 */
function showError(message) {
    errorContainer.innerHTML = `<div class="error">${message}</div>`;
    setTimeout(() => {
        errorContainer.innerHTML = '';
    }, 5000);
}

/**
 * Update status message
 */
function updateStatus(message, className = '') {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + className;
}

/**
 * Send text message to AI
 */
async function sendTextMessage() {
    const message = textInput.value.trim();
    if (!message) return;

    textInput.value = '';
    textInput.disabled = true;

    addMessage('user', message);
    updateStatus('AI is thinking...', 'processing');

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                conversationId: CONVERSATION_ID
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        addMessage('assistant', data.response);
        updateStatus('Click the microphone to start voice recording');
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to get AI response. Please try again.');
        updateStatus('Error occurred');
    } finally {
        textInput.disabled = false;
        textInput.focus();
    }
}

/**
 * Toggle voice recording
 */
async function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
}

/**
 * Start voice recording
 */
async function startRecording() {
    try {
        // Request microphone access
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Create MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
            ? 'audio/webm' 
            : 'audio/mp4';
        
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            await processRecording();
        };

        mediaRecorder.start();
        isRecording = true;
        recordBtn.classList.add('recording');
        recordBtn.textContent = '⏹️';
        updateStatus('Recording... Click to stop', 'recording');
        textInput.disabled = true;

    } catch (error) {
        console.error('Error starting recording:', error);
        showError('Could not access microphone. Please check permissions.');
        updateStatus('Microphone access denied');
    }
}

/**
 * Stop voice recording
 */
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
    }
    
    isRecording = false;
    recordBtn.classList.remove('recording');
    recordBtn.textContent = '🎤';
    updateStatus('Processing audio...', 'processing');
}

/**
 * Process recorded audio
 */
async function processRecording() {
    const audioBlob = new Blob(audioChunks, { type: audioChunks[0].type });
    
    // Convert to proper audio format if needed
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
        // Step 1: Transcribe audio
        updateStatus('Transcribing audio...', 'processing');
        
        const transcribeResponse = await fetch(`${API_BASE_URL}/api/transcribe`, {
            method: 'POST',
            body: formData
        });

        if (!transcribeResponse.ok) {
            throw new Error('Transcription failed');
        }

        const { text } = await transcribeResponse.json();
        
        if (!text || text.trim() === '') {
            throw new Error('No speech detected');
        }

        addMessage('user', text);

        // Step 2: Send to AI
        updateStatus('AI is thinking...', 'processing');
        
        const chatResponse = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: text,
                conversationId: CONVERSATION_ID
            })
        });

        if (!chatResponse.ok) {
            throw new Error('AI response failed');
        }

        const { response } = await chatResponse.json();
        addMessage('assistant', response);
        
        updateStatus('Click the microphone to start voice recording');
        textInput.disabled = false;

    } catch (error) {
        console.error('Error processing recording:', error);
        showError('Failed to process audio. Please try again.');
        updateStatus('Error occurred');
        textInput.disabled = false;
    }
}

/**
 * Clear conversation history
 */
async function clearConversation() {
    if (!confirm('Clear conversation history?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/clear`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                conversationId: CONVERSATION_ID
            })
        });

        if (response.ok) {
            chatContainer.innerHTML = `
                <div class="message system">
                    <div class="message-content">
                        Conversation cleared. Start a new conversation!
                    </div>
                </div>
            `;
            updateStatus('Click the microphone to start voice recording');
        }
    } catch (error) {
        console.error('Error clearing conversation:', error);
        showError('Failed to clear conversation.');
    }
}

/**
 * Load conversation history on page load
 */
async function loadHistory() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/history?conversationId=${CONVERSATION_ID}`
        );
        
        if (response.ok) {
            const { messages } = await response.json();
            messages.forEach(msg => {
                if (msg.role !== 'system') {
                    addMessage(msg.role, msg.content);
                }
            });
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    textInput.focus();
});
