
import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

export async function* generateAIResponseStream(messages: Message[], signal?: AbortSignal) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  
  // Format messages for Gemini
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: contents as any,
      config: {
        systemInstruction: "You are G9 AI, a premium senior AI developer assistant. You provide concise, high-quality code and architectural advice. Your tone is professional, sophisticated, and helpful. Format your code blocks cleanly.",
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
      },
    });

    for await (const chunk of responseStream) {
      if (signal?.aborted) {
        break;
      }
      const text = chunk.text;
      if (text) {
        yield text;
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || signal?.aborted) {
      return;
    }
    console.error("Gemini API Error:", error);
    throw new Error("Failed to communicate with G9 AI.");
  }
}
