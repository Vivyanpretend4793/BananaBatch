import { GeneratedImage } from "@/types";

type RawImage = Omit<GeneratedImage, "prompt" | "batchId">;

const BASE_URL = process.env.BASE_URL!;
const API_KEY = process.env.API_KEY!;
const MODEL = process.env.MODEL!;

export async function generateImages(
  prompt: string,
  batchSize: number
): Promise<RawImage[]> {
  const results: RawImage[] = [];
  const concurrency = 3; // Process 3 at a time to avoid rate limits

  for (let i = 0; i < batchSize; i += concurrency) {
    const chunk = Array.from(
      { length: Math.min(concurrency, batchSize - i) },
      (_, j) => generateSingleImage(prompt, i + j)
    );
    const settled = await Promise.allSettled(chunk);

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j];
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          id: `img-${i + j}`,
          imageUrl: "",
          status: "error" as const,
        });
      }
    }
  }

  return results;
}

async function generateSingleImage(
  prompt: string,
  index: number
): Promise<RawImage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status}: ${errText}`);
  }

  const data = await res.json();

  // Extract image from response - Gemini image preview returns base64 image in parts
  const message = data.choices?.[0]?.message;
  let imageUrl = "";

  if (message?.content) {
    if (typeof message.content === "string") {
      const text = message.content.trim();

      // Plain URL
      if (text.startsWith("http")) {
        imageUrl = text;
      }

      // Extract data URL from markdown or inline text
      if (!imageUrl) {
        const dataIdx = text.indexOf("data:image/");
        if (dataIdx !== -1) {
          let end = text.indexOf(")", dataIdx);
          if (end === -1) {
            const ws = text.slice(dataIdx).search(/\s/);
            end = ws === -1 ? text.length : dataIdx + ws;
          }
          imageUrl = text.slice(dataIdx, end);
        }
      }

      // Extract http(s) URL from markdown
      if (!imageUrl) {
        const httpIdx = text.indexOf("http");
        if (httpIdx !== -1) {
          let end = text.indexOf(")", httpIdx);
          if (end === -1) {
            const ws = text.slice(httpIdx).search(/\s/);
            end = ws === -1 ? text.length : httpIdx + ws;
          }
          imageUrl = text.slice(httpIdx, end);
        }
      }
    }
    // Array content (multimodal response)
    if (!imageUrl && Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === "image_url") {
          imageUrl = part.image_url?.url || "";
          break;
        }
        if (part.type === "image" && part.image?.url) {
          imageUrl = part.image.url;
          break;
        }
        if (part.type === "image" && part.source?.data) {
          imageUrl = `data:${part.source.media_type || "image/png"};base64,${part.source.data}`;
          break;
        }
        if (part.inline_data) {
          imageUrl = `data:${part.inline_data.mime_type || "image/png"};base64,${part.inline_data.data}`;
          break;
        }
      }
    }
  }

  if (!imageUrl) {
    throw new Error("No image found in API response");
  }

  return {
    id: `img-${Date.now()}-${index}`,
    imageUrl,
    status: "success",
  };
  } finally {
    clearTimeout(timeout);
  }
}
