export const FREE_AI_PROVIDERS = {
  google: {
    name: "Google AI Studio",
    models:[
      { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite Preview", context: "1M+", maxRpm: 15, maxRpd: 1500, recBatch: 5, description: "Latest lightweight model. Massive context, highly efficient for bulk PDF processing." },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", context: "1M", maxRpm: 15, maxRpd: 1500, recBatch: 4, description: "Workhorse model. Can comfortably read 500+ page judgments in a single prompt." },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", context: "2M", maxRpm: 2, maxRpd: 50, recBatch: 1, description: "Highest reasoning. Strict rate limits. Use ONLY for highly complex, single PDF extractions." }
    ]
  },
  groq: {
    name: "Groq (Ultra-Fast LPU)",
    models:[
      { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B", context: "128k", maxRpm: 30, maxRpd: 14400, recBatch: 2, description: "Blistering fast inference. Good for mid-length RERA orders (approx 100 pages)." },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", context: "32k", maxRpm: 30, maxRpd: 14400, recBatch: 3, description: "Fast MoE model. Good for short 10-20 page documents." }
    ]
  },
  chinese_openrouter: {
    name: "Chinese Powerhouses (via OpenRouter Free)",
    models:[
      { id: "deepseek/deepseek-chat:free", name: "DeepSeek V3/Chat (Free)", context: "64k", maxRpm: 10, maxRpd: 200, recBatch: 1, description: "Exceptional reasoning, rivals GPT-4. Great for complex legal logic extraction." },
      { id: "qwen/qwen-2.5-72b-instruct:free", name: "Qwen 2.5 72B (Free)", context: "128k", maxRpm: 10, maxRpd: 200, recBatch: 2, description: "Alibaba's flagship. Extremely strong at multilingual and tabular data inside PDFs." },
      { id: "01-ai/yi-large:free", name: "Yi-Large (Free)", context: "32k", maxRpm: 10, maxRpd: 200, recBatch: 1, description: "Strong alternative for mid-length document summarization." }
    ]
  },
  cohere: {
    name: "Cohere (Trial API)",
    models:[
      { id: "command-r", name: "Command-R", context: "128k", maxRpm: 10, maxRpd: 1000, recBatch: 2, description: "Specifically trained for RAG and pulling specific entities (like Lawyer Names) from messy text." },
      { id: "command-r-plus", name: "Command-R Plus", context: "128k", maxRpm: 10, maxRpd: 1000, recBatch: 1, description: "Heavier, more accurate extraction with lower safe throughput." }
    ]
  },
  openrouter_western: {
    name: "Western OSS (via OpenRouter Free)",
    models:[
      { id: "meta-llama/llama-3-8b-instruct:free", name: "Llama 3 8B (Free)", context: "8k", maxRpm: 20, maxRpd: 200, recBatch: 2, description: "Basic structured JSON extraction for very short 1-3 page texts." },
      { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B (Free)", context: "8k", maxRpm: 20, maxRpd: 200, recBatch: 2, description: "Alternative fast endpoint for basic parsing." },
      { id: "google/gemma-2-9b-it:free", name: "Gemma 2 9B (Free)", context: "8k", maxRpm: 20, maxRpd: 200, recBatch: 2, description: "Highly efficient 9B model for precise formatting." }
    ]
  },
  cerebras: {
    name: "Cerebras (Fast Inference)",
    models:[
      { id: "llama3.1-70b", name: "Llama 3.1 70B (Cerebras)", context: "8k", maxRpm: 30, maxRpd: 10000, recBatch: 3, description: "Instant generation. Strictly limited to short context. Do not use for full judgments." }
    ]
  }
};

