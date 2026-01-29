import OpenAI from "openai";
import { handleFluxWorkflow } from './flux';
import { ChatCompletionTool } from "openai/resources/index.mjs";

const apiKey = process.env.FIREWORKS_API_KEY;

const client = new OpenAI({
    apiKey: apiKey || 'dummy',
    baseURL: "https://api.fireworks.ai/inference/v1",
});

export type AIResponse = {
    type: 'text';
    content: string;
} | {
    type: 'image';
    urlOrBase64: string;
    caption?: string;
};

export async function generateAIResponse(
    userMessage: string,
    systemPrompt: string,
    imageBase64?: string // Optional context image
): Promise<AIResponse | null> {
    try {
        // console.log("Generating AI response with Key:", apiKey ? "Present" : "Missing");
        console.log("Calling Fireworks AI...");
        const tools: ChatCompletionTool[] = [
            {
                type: "function",
                function: {
                    name: "generate_image",
                    description: "Generate a new image based on a prompt. Use this when the user asks to create, draw, or generate a picture.",
                    parameters: {
                        type: "object",
                        properties: {
                            prompt: {
                                type: "string",
                                description: "The detailed, improved prompt for the image generation model."
                            }
                        },
                        required: ["prompt"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "edit_image",
                    description: "Edit the provided image based on a prompt. Use this ONLY when the user asks to edit, change, or modify the image they sent.",
                    parameters: {
                        type: "object",
                        properties: {
                            prompt: {
                                type: "string",
                                description: "The detailed, improved prompt describing the desired edit."
                            }
                        },
                        required: ["prompt"]
                    }
                }
            }
        ];

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            {
                role: "system",
                content: systemPrompt,
            }
        ];

        // Construct User Message (Multimodal if image exists)
        if (imageBase64) {
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: userMessage },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${imageBase64}`
                        }
                    }
                ]
            });
        } else {
            messages.push({
                role: "user",
                content: userMessage,
            });
        }

        const model = "accounts/fireworks/models/kimi-k2p5"; // User requested Multimodal model

        console.log(`[${new Date().toISOString()}] Sending request to ${model}...`);
        const startTime = Date.now();

        const response = await client.chat.completions.create({
            model: model,
            messages: messages,
            tools: tools,
            tool_choice: "auto",
            temperature: 0.6,
            max_tokens: 512,
        }, { timeout: 30000 }); // 30s timeout

        console.log(`[${new Date().toISOString()}] Response received in ${(Date.now() - startTime) / 1000}s`);

        const choice = response.choices[0];
        const message = choice.message;

        // Check for Tool Calls
        if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0] as any;
            const args = JSON.parse(toolCall.function.arguments);

            if (toolCall.function.name === 'generate_image') {
                console.log("Tool Triggered: Generate Image", args.prompt);
                const imageUrl = await handleFluxWorkflow('generate', args.prompt);
                if (imageUrl) {
                    return {
                        type: 'image',
                        urlOrBase64: imageUrl,
                        caption: `🎨 Imagem gerada: ${args.prompt}`
                    };
                }
                return { type: 'text', content: "Desculpe, falhei ao gerar a imagem." };
            }

            if (toolCall.function.name === 'edit_image') {
                if (!imageBase64) {
                    return { type: 'text', content: "Desculpe, preciso de uma imagem para editar." };
                }
                console.log("Tool Triggered: Edit Image", args.prompt);
                const imageUrl = await handleFluxWorkflow('edit', args.prompt, imageBase64);
                if (imageUrl) {
                    return {
                        type: 'image',
                        urlOrBase64: imageUrl,
                        caption: `🖌️ Edição realizada: ${args.prompt}`
                    };
                }
                return { type: 'text', content: "Desculpe, falhei ao editar a imagem." };
            }
        }

        // Default Text Response
        return { type: 'text', content: message.content || "" };

    } catch (error) {
        console.error("Error generating AI response:", error);
        return null;
    }
}
