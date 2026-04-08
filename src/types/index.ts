export interface GeneratedImage {
  id: string;
  imageUrl: string;
  status: "success" | "error";
  prompt: string;
  batchId: string;
}

export interface BatchGroup {
  id: string;
  prompt: string;
  images: GeneratedImage[];
  timestamp: number;
}

export interface GenerateRequest {
  prompt: string;
  batchSize: number;
}

export interface GenerateResponse {
  images: Omit<GeneratedImage, "prompt" | "batchId">[];
  requestId: string;
  status: "success" | "partial" | "error";
  error?: string;
}
