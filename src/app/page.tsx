"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Gallery from "@/components/Gallery";
import { GeneratedImage, BatchGroup } from "@/types";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [batchSize, setBatchSize] = useState(20);
  const [batches, setBatches] = useState<BatchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  const batchRef = useRef<string>("");

  const generate = useCallback(async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError("");
    setProgress(0);

    const batchId = `batch-${Date.now()}`;
    batchRef.current = batchId;
    const currentPrompt = prompt.trim();

    // Create the batch immediately so images stream in
    const newBatch: BatchGroup = {
      id: batchId,
      prompt: currentPrompt,
      images: [],
      timestamp: Date.now(),
    };
    setBatches((prev) => [newBatch, ...prev]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt, batchSize }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || "Generation failed.");
        // Remove empty batch
        setBatches((prev) => prev.filter((b) => b.id !== batchId || b.images.length > 0));
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);

            if (msg.type === "image") {
              const taggedImage: GeneratedImage = {
                ...msg.image,
                prompt: currentPrompt,
                batchId,
              };
              // Append image to the batch
              setBatches((prev) =>
                prev.map((b) =>
                  b.id === batchId
                    ? { ...b, images: [...b.images, taggedImage] }
                    : b
                )
              );
              if (msg.progress) {
                setProgress(Math.round(msg.progress * 100));
              }
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      // Check results
      setBatches((prev) => {
        const batch = prev.find((b) => b.id === batchId);
        if (batch) {
          const successCount = batch.images.filter((i) => i.status === "success").length;
          if (successCount === 0) {
            setError("All image generations failed.");
            return prev.filter((b) => b.id !== batchId);
          } else if (successCount < batchSize) {
            setError(`${successCount}/${batchSize} succeeded`);
          }
        }
        return prev;
      });
    } catch {
      setError("Network error. Check connection.");
      setBatches((prev) => prev.filter((b) => b.id !== batchId || b.images.length > 0));
    } finally {
      setLoading(false);
      setProgress(100);
    }
  }, [prompt, batchSize, loading]);

  // Global Cmd+Enter shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        generate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [generate]);

  const totalImages = batches.reduce(
    (sum, b) => sum + b.images.filter((i) => i.status === "success").length,
    0
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* ── Top Bar ── */}
      <header
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "10px 20px",
          background: "var(--bg-raised)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <div
            style={{
              width: "28px", height: "28px", borderRadius: "8px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px", fontWeight: 700,
              background: "var(--accent)", color: "var(--bg)",
            }}
          >
            B
          </div>
          <span style={{ fontSize: "15px", fontWeight: 700, fontFamily: "var(--font-brand)", letterSpacing: "-0.02em" }}>
            BananaBatch
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: "1px", height: "24px", flexShrink: 0, background: "var(--border-light)" }} />

        {/* Prompt input */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") generate(); }}
            placeholder="Describe what you want to generate..."
            disabled={loading}
            style={{
              flex: 1, minWidth: 0,
              padding: "8px 14px", borderRadius: "8px", fontSize: "14px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-light)",
              color: "var(--fg)",
              outline: "none",
              opacity: loading ? 0.5 : 1,
              fontFamily: "var(--font-ui)",
            }}
          />

          {/* Batch size */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
              padding: "6px 8px", borderRadius: "8px",
              background: "var(--bg-surface)", border: "1px solid var(--border-light)",
            }}
          >
            <svg style={{ width: "14px", height: "14px", color: "var(--fg-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <input
              type="number"
              min={1}
              max={50}
              value={batchSize}
              onChange={(e) => setBatchSize(Math.min(50, Math.max(1, Number(e.target.value))))}
              disabled={loading}
              style={{
                width: "36px", textAlign: "center", fontSize: "14px", fontWeight: 500,
                background: "transparent", border: "none", outline: "none",
                color: "var(--fg)", opacity: loading ? 0.5 : 1,
              }}
            />
          </div>

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={loading || !prompt.trim()}
            style={{
              flexShrink: 0,
              display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 18px", borderRadius: "8px",
              fontSize: "14px", fontWeight: 600,
              background: "var(--accent)", color: "var(--bg)",
              border: "none", cursor: loading || !prompt.trim() ? "not-allowed" : "pointer",
              opacity: loading || !prompt.trim() ? 0.3 : 1,
            }}
          >
            {loading ? (
              <>
                <svg style={{ width: "14px", height: "14px" }} className="animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                </svg>
                Generating
              </>
            ) : (
              <>
                Generate
                <kbd style={{ fontSize: "10px", padding: "2px 4px", borderRadius: "4px", fontFamily: "monospace", background: "rgba(0,0,0,0.2)" }}>
                  Enter
                </kbd>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Progress bar ── */}
      {loading && (
        <div style={{ flexShrink: 0, height: "2px", width: "100%", background: "var(--bg-surface)" }}>
          <div
            className="progress-bar"
            style={{
              position: "relative",
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, var(--accent), #f0c040)",
              transition: "width 0.5s ease-out",
            }}
          />
        </div>
      )}

      {/* ── Main content area ── */}
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Empty state */}
        {batches.length === 0 && !loading && !error && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", padding: "24px" }}>
            <div
              style={{
                width: "64px", height: "64px", borderRadius: "16px",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--bg-surface)", border: "1px solid var(--border)",
              }}
            >
              <svg style={{ width: "28px", height: "28px", color: "var(--fg-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--fg-dim)" }}>
                Enter a prompt and hit Generate
              </p>
              <p style={{ fontSize: "14px", marginTop: "4px", color: "var(--fg-muted)" }}>
                Your batch of images will appear here
              </p>
            </div>
          </div>
        )}

        {/* Loading state (first generation) */}
        {loading && batches.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
            <div
              style={{
                width: "48px", height: "48px", borderRadius: "50%",
                border: "2px solid var(--accent)", borderTopColor: "transparent",
              }}
              className="animate-spin"
            />
            <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--fg-dim)" }}>
              Generating {batchSize} images...
            </p>
          </div>
        )}

        {/* Error (no images at all) */}
        {error && totalImages === 0 && !loading && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "24px" }}>
            <div
              style={{
                width: "56px", height: "56px", borderRadius: "16px",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(232, 80, 80, 0.1)", border: "1px solid rgba(232, 80, 80, 0.2)",
              }}
            >
              <svg style={{ width: "24px", height: "24px", color: "var(--danger)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p style={{ fontSize: "14px", textAlign: "center", maxWidth: "380px", color: "var(--danger)" }}>
              {error}
            </p>
          </div>
        )}

        {/* Gallery */}
        {(totalImages > 0 || (loading && batches.length > 0)) && (
          <Gallery batches={batches} loading={loading} />
        )}
      </main>
    </div>
  );
}
