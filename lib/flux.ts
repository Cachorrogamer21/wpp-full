import { generateAIResponse } from './ai';

export async function handleFluxWorkflow(
    type: 'generate' | 'edit',
    prompt: string,
    imageBase64?: string
): Promise<string | null> {
    const apiKey = process.env.FIREWORKS_API_KEY;
    if (!apiKey) throw new Error("Missing FIREWORKS_API_KEY");

    const url = "https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-kontext-pro";

    let payload: any = {
        prompt: prompt
    };

    if (type === 'edit') {
        if (!imageBase64) throw new Error("Image required for edit mode");
        payload.input_image = `data:image/jpeg;base64,${imageBase64}`;
    }

    // Step 1: Submit
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();
    const requestId = result.request_id; // Using snake_case from python example but checking response
    // User example: result.get("request_id")

    if (!requestId) {
        console.error("Flux Error: No request ID", result);
        return null;
    }

    console.log(`Flux Request Submitted: ${requestId}`);

    // Step 2: Poll
    const resultEndpoint = `${url}/get_result`;

    for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise(r => setTimeout(r, 1000)); // Sleep 1s

        const pollRes = await fetch(resultEndpoint, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json", // User used image/jpeg in polling accept? 
                // Actually python example for polling headers uses application/json for content-type, 
                // but Accept image/jpeg? 
                // The user code: "Accept": "image/jpeg"
                // But then it does `result_response.json()`. 
                // If accept is image/jpeg, usually it returns binary.
                // However, the code handles `poll_result.get("status")`.
                // So likely the API returns JSON even if Accept is image/jpeg OR the user code meant application/json.
                // I'll stick to application/json for safety unless it fails.
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({ id: requestId })
        });

        if (!pollRes.ok) continue;

        const pollResult = await pollRes.json();
        const status = pollResult.status;

        if (['Ready', 'Complete', 'Finished'].includes(status)) {
            const imageData = pollResult.result?.sample;
            if (imageData) {
                // If it's a URL
                if (typeof imageData === 'string' && imageData.startsWith('http')) {
                    return imageData;
                }
                // If it's base64 (user code handles both)
                // We ideally want a URL to send to Baileys, or a Base64 string.
                // Baileys accepts both.
                return imageData;
            }
        }

        if (['Failed', 'Error'].includes(status)) {
            console.error("Flux Generation Failed:", pollResult.details);
            return null;
        }
    }

    return null;
}
