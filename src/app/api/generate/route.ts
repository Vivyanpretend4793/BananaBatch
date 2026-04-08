import { NextRequest } from "next/server";

// Allow up to 5 minutes for large batches
export const maxDuration = 300;

const BASE_URL = process.env.BASE_URL!;
const API_KEY = process.env.API_KEY!;
const MODEL = process.env.MODEL!;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.API_KEY) {
      return Response.json(
        { type: "error", error: "API key not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const prompt = body.prompt?.trim();
    const batchSize = Math.min(Math.max(body.batchSize || 20, 1), 50);

    if (!prompt) {
      return Response.json(
        { type: "error", error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Stream results as they come in using Server-Sent Events style NDJSON
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const concurrency = 3;
        let completed = 0;

        for (let i = 0; i < batchSize; i += concurrency) {
          const chunkSize = Math.min(concurrency, batchSize - i);
          const chunk = Array.from({ length: chunkSize }, (_, j) =>
            generateSingleImage(prompt, i + j)
          );
          const settled = await Promise.allSettled(chunk);

          for (let j = 0; j < settled.length; j++) {
            completed++;
            const result = settled[j];
            if (result.status === "fulfilled") {
              const line = JSON.stringify({
                type: "image",
                image: result.value,
                progress: completed / batchSize,
              }) + "\n";
              controller.enqueue(encoder.encode(line));
            } else {
              const line = JSON.stringify({
                type: "image",
                image: { id: `img-${i + j}`, imageUrl: "", status: "error" },
                progress: completed / batchSize,
              }) + "\n";
              controller.enqueue(encoder.encode(line));
            }
          }
        }

        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "done" }) + "\n")
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return Response.json(
      {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function generateSingleImage(prompt: string, index: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const message = data.choices?.[0]?.message;
    let imageUrl = "";

    if (message?.content && typeof message.content === "string") {
      const text = message.content.trim();

      if (text.startsWith("http")) {
        imageUrl = text;
      }

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

    if (!imageUrl && message?.content && Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === "image_url") {
          imageUrl = part.image_url?.url || "";
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

    if (!imageUrl) {
      throw new Error("No image found in API response");
    }

    return { id: `img-${Date.now()}-${index}`, imageUrl, status: "success" as const };
  } finally {
    clearTimeout(timeout);
  }
}
