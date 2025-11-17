/**
 * Voice-to-AI Assistant Worker
 * Handles voice transcription and LLM processing using Cloudflare Workers AI
 */

export interface Env {
	AI: any;
	CONVERSATIONS: DurableObjectNamespace;
}

interface Message {
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: number;
}

/**
 * Durable Object for managing conversation state
 * Provides persistent memory across requests
 */
export class ConversationDO {
	private state: DurableObjectState;
	private messages: Message[] = [];

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// Initialize conversation history from storage
		if (this.messages.length === 0) {
			const stored = await this.state.storage.get<Message[]>('messages');
			if (stored) {
				this.messages = stored;
			}
		}

		switch (url.pathname) {
			case '/add':
				return await this.addMessage(request);
			case '/history':
				return this.getHistory();
			case '/clear':
				return await this.clearHistory();
			default:
				return new Response('Not found', { status: 404 });
		}
	}

	private async addMessage(request: Request): Promise<Response> {
		const message: Message = await request.json();
		this.messages.push(message);
		await this.state.storage.put('messages', this.messages);
		return new Response(JSON.stringify({ success: true }));
	}

	private getHistory(): Response {
		return new Response(JSON.stringify({ messages: this.messages }), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	private async clearHistory(): Promise<Response> {
		this.messages = [];
		await this.state.storage.delete('messages');
		return new Response(JSON.stringify({ success: true }));
	}
}

/**
 * Main Worker handler
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Handle CORS
		if (request.method === 'OPTIONS') {
			return handleCORS();
		}

		const url = new URL(request.url);

		try {
			switch (url.pathname) {
				case '/api/transcribe':
					return await handleTranscribe(request, env);
				case '/api/chat':
					return await handleChat(request, env);
				case '/api/history':
					return await handleHistory(request, env);
				case '/api/clear':
					return await handleClear(request, env);
				default:
					return new Response('Not found', { status: 404 });
			}
		} catch (error) {
			console.error('Error:', error);
			return new Response(JSON.stringify({ 
				error: error instanceof Error ? error.message : 'Internal server error' 
			}), {
				status: 500,
				headers: corsHeaders()
			});
		}
	}
};

/**
 * Transcribe audio using Whisper model on Workers AI
 */
async function handleTranscribe(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method not allowed', { status: 405 });
	}

	const formData = await request.formData();
	const audioBlob = formData.get('audio');

	if (!audioBlob || !(audioBlob instanceof Blob)) {
		return new Response(JSON.stringify({ error: 'No audio file provided' }), {
			status: 400,
			headers: corsHeaders()
		});
	}

	// Convert blob to array buffer for Workers AI
	const audioBuffer = await audioBlob.arrayBuffer();

	// Use Whisper model for transcription
	const transcription = await env.AI.run('@cf/openai/whisper', {
		audio: Array.from(new Uint8Array(audioBuffer))
	});

	return new Response(JSON.stringify({ 
		text: transcription.text || '' 
	}), {
		headers: corsHeaders()
	});
}

/**
 * Process chat messages with Llama 3.3 70B
 */
async function handleChat(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method not allowed', { status: 405 });
	}

	const { message, conversationId } = await request.json();

	if (!message) {
		return new Response(JSON.stringify({ error: 'No message provided' }), {
			status: 400,
			headers: corsHeaders()
		});
	}

	// Get or create conversation
	const id = env.CONVERSATIONS.idFromName(conversationId || 'default');
	const conversation = env.CONVERSATIONS.get(id);

	// Add user message to history
	await conversation.fetch(new Request('http://do/add', {
		method: 'POST',
		body: JSON.stringify({
			role: 'user',
			content: message,
			timestamp: Date.now()
		})
	}));

	// Get conversation history
	const historyResponse = await conversation.fetch(new Request('http://do/history'));
	const { messages } = await historyResponse.json();

	// Prepare messages for LLM (keep system prompt + recent history)
	const systemPrompt = {
		role: 'system',
		content: 'You are a helpful AI assistant. Provide clear, concise, and friendly responses. If the user spoke to you via voice, respond naturally as if in conversation.'
	};

	const llmMessages = [
		systemPrompt,
		...messages.slice(-10) // Keep last 10 messages for context
	];

	// Call Llama 3.3 70B
	const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
		messages: llmMessages,
		stream: false
	});

	const assistantMessage = aiResponse.response || 'I apologize, I could not generate a response.';

	// Save assistant response to history
	await conversation.fetch(new Request('http://do/add', {
		method: 'POST',
		body: JSON.stringify({
			role: 'assistant',
			content: assistantMessage,
			timestamp: Date.now()
		})
	}));

	return new Response(JSON.stringify({ 
		response: assistantMessage,
		conversationId: conversationId || 'default'
	}), {
		headers: corsHeaders()
	});
}

/**
 * Get conversation history
 */
async function handleHistory(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const conversationId = url.searchParams.get('conversationId') || 'default';

	const id = env.CONVERSATIONS.idFromName(conversationId);
	const conversation = env.CONVERSATIONS.get(id);

	const historyResponse = await conversation.fetch(new Request('http://do/history'));
	const data = await historyResponse.json();

	return new Response(JSON.stringify(data), {
		headers: corsHeaders()
	});
}

/**
 * Clear conversation history
 */
async function handleClear(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method not allowed', { status: 405 });
	}

	const { conversationId } = await request.json();
	const id = env.CONVERSATIONS.idFromName(conversationId || 'default');
	const conversation = env.CONVERSATIONS.get(id);

	await conversation.fetch(new Request('http://do/clear'));

	return new Response(JSON.stringify({ success: true }), {
		headers: corsHeaders()
	});
}

/**
 * CORS headers for frontend communication
 */
function corsHeaders() {
	return {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type'
	};
}

function handleCORS(): Response {
	return new Response(null, {
		headers: corsHeaders()
	});
}
