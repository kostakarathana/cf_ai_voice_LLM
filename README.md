# cf_ai_voice_assistant

An AI-powered voice assistant application built on Cloudflare's infrastructure, featuring real-time voice transcription and natural language processing with Llama 3.3.

## 🚀 Features

- **Voice Input**: Browser-based voice recording using Web Speech API
- **AI Transcription**: Automatic speech-to-text using Whisper model on Workers AI
- **Natural Language Processing**: Powered by Llama 3.3 70B Instruct model
- **Persistent Memory**: Conversation history stored in Durable Objects
- **Text & Voice**: Support for both text and voice input
- **Real-time Responses**: Fast processing on Cloudflare's edge network

## 🏗️ Architecture

This application demonstrates all four required components:

1. **LLM**: Llama 3.3 70B Instruct (via Workers AI)
2. **Workflow/Coordination**: Cloudflare Workers with Durable Objects
3. **User Input**: Voice recording (Web Audio API) and text chat interface
4. **Memory/State**: Durable Objects for persistent conversation history

## 📋 Prerequisites

- Node.js 18+ and npm
- Cloudflare account (free tier works)
- Wrangler CLI installed globally: `npm install -g wrangler`

## 🛠️ Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Run Worker in Development Mode

```bash
npm run dev
```

This starts the Worker API on `http://localhost:8787`

### 4. Serve Frontend Locally

In a separate terminal:

```bash
npm run pages:dev
```

This serves the frontend on `http://localhost:8788`

### 5. Test the Application

1. Open `http://localhost:8788` in your browser
2. Click the microphone button to record voice input
3. Or type a message and click "Send"
4. The AI will respond using Llama 3.3

## 🌐 Deployment

### Deploy the Worker (API)

```bash
npm run deploy
```

This deploys your Worker to Cloudflare's edge network. Note the deployed URL.

### Deploy the Frontend (Pages)

```bash
npm run pages:deploy
```

### Update API URL in Frontend

After deploying the Worker, update the `API_BASE_URL` in `public/app.js` to point to your deployed Worker URL.

## 🔧 Configuration

### Worker Configuration (`wrangler.toml`)

- **AI Binding**: Provides access to Workers AI models
- **Durable Objects**: Persistent storage for conversation history
- **CORS**: Configured for frontend communication

### Models Used

- **Whisper**: `@cf/openai/whisper` - Speech-to-text transcription
- **Llama 3.3**: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` - Natural language understanding

## 📁 Project Structure

```
cf_ai_voice_assistant/
├── src/
│   └── index.ts           # Worker with LLM integration & Durable Objects
├── public/
│   ├── index.html         # Frontend UI
│   └── app.js             # Voice recording & API client
├── wrangler.toml          # Cloudflare Worker configuration
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── PROMPTS.md             # AI prompts used during development
└── README.md              # This file
```

## 🎯 Key Components

### Cloudflare Worker (`src/index.ts`)

- **`/api/transcribe`**: Converts audio to text using Whisper
- **`/api/chat`**: Processes messages with Llama 3.3
- **`/api/history`**: Retrieves conversation history
- **`/api/clear`**: Clears conversation memory

### Durable Object (`ConversationDO`)

- Manages conversation state across requests
- Persists message history in durable storage
- Provides isolation per user/conversation

### Frontend (`public/`)

- Voice recording interface using MediaRecorder API
- Real-time chat UI with message history
- Automatic audio transcription and AI responses

## 🧪 Testing

### Test Voice Recording

1. Click the microphone button
2. Speak clearly (e.g., "What is artificial intelligence?")
3. Click the stop button
4. Watch as your speech is transcribed and processed

### Test Text Input

1. Type a message in the input field
2. Press Enter or click "Send"
3. Receive AI response

### Test Conversation Memory

1. Ask multiple related questions
2. The AI maintains context across messages
3. Click "Clear" to reset conversation

## 🔒 Security Notes

- Microphone access requires HTTPS in production
- CORS is configured for cross-origin requests
- Durable Objects provide isolated storage per conversation

## 📚 Documentation Links

- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

## 🐛 Troubleshooting

### "Cannot access microphone"
- Grant microphone permissions in browser settings
- Ensure you're using HTTPS (required for microphone access)

### "Worker not found"
- Run `npm run deploy` to deploy the Worker
- Check that the API URL in `app.js` is correct

### "AI model error"
- Verify your Cloudflare account has Workers AI enabled
- Check Wrangler authentication: `wrangler whoami`

## 📝 License

MIT

## 👤 Author

Built for Cloudflare AI Assignment

---

**Note**: This application requires a Cloudflare account with Workers AI access. The free tier includes generous limits for testing and development.