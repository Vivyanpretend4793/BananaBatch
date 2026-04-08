"use client";

import { useState, useCallback } from "react";
import { GeneratedImage, BatchGroup } from "@/types";

interface Props {
  batches: BatchGroup[];
  loading: boolean;
}

export default function Gallery({ batches, loading }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<GeneratedImage | null>(null);
  const [collapsedBatches, setCollapsedBatches] = useState<Set<string>>(new Set());

  const allSuccessImages = batches.flatMap((b) =>
    b.images.filter((img) => img.status === "success")
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = () => {
    if (selected.size === allSuccessImages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allSuccessImages.map((img) => img.id)));
    }
  };

  const toggleCollapse = (batchId: string) => {
    setCollapsedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const downloadImage = async (img: GeneratedImage) => {
    try {
      const response = await fetch(img.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${img.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(img.imageUrl, "_blank");
    }
  };

  const downloadSelected = async () => {
    const toDownload = allSuccessImages.filter((img) => selected.has(img.id));
    for (const img of toDownload) {
      await downloadImage(img);
      await new Promise((r) => setTimeout(r, 200));
    }
  };

  if (allSuccessImages.length === 0 && !loading) return null;

  return (
    <>
      {/* Gallery toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-raised)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "var(--fg-dim)", fontWeight: 500 }}>
            {allSuccessImages.length} images &middot; {batches.length} batch{batches.length !== 1 ? "es" : ""}
          </span>
          <button
            onClick={selectAll}
            style={{
              fontSize: "13px",
              color: "var(--fg-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--accent)";
              e.currentTarget.style.background = "var(--accent-dim)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--fg-muted)";
              e.currentTarget.style.background = "none";
            }}
          >
            {selected.size === allSuccessImages.length ? "Deselect all" : "Select all"}
          </button>
        </div>
        {selected.size > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "13px", color: "var(--accent)", fontWeight: 500 }}>
              {selected.size} selected
            </span>
            <button
              onClick={downloadSelected}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 14px", borderRadius: "8px",
                fontSize: "13px", fontWeight: 600,
                background: "var(--accent)", color: "var(--bg)",
                border: "none", cursor: "pointer",
              }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          </div>
        )}
      </div>

      {/* Scrollable batch list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
        {/* Loading indicator for new batch */}
        {loading && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "12px 16px", marginBottom: "8px",
              borderRadius: "10px", background: "var(--bg-surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                width: "16px", height: "16px", borderRadius: "50%",
                border: "2px solid var(--accent)", borderTopColor: "transparent",
              }}
              className="animate-spin"
            />
            <span style={{ fontSize: "13px", color: "var(--fg-dim)" }}>Generating new batch...</span>
          </div>
        )}

        {batches.map((batch) => {
          const successImages = batch.images.filter((img) => img.status === "success");
          if (successImages.length === 0) return null;
          const isCollapsed = collapsedBatches.has(batch.id);

          return (
            <div key={batch.id} style={{ marginBottom: "12px" }}>
              {/* Batch header with prompt */}
              <button
                onClick={() => toggleCollapse(batch.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  width: "100%", padding: "8px 12px",
                  background: "none", border: "none",
                  cursor: "pointer", borderRadius: "8px",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                <svg
                  width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  style={{
                    color: "var(--fg-muted)", flexShrink: 0,
                    transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                <span
                  style={{
                    fontSize: "13px", fontWeight: 500, color: "var(--fg)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    flex: 1,
                  }}
                  title={batch.prompt}
                >
                  {batch.prompt}
                </span>
                <span style={{ fontSize: "12px", color: "var(--fg-muted)", flexShrink: 0 }}>
                  {successImages.length} img
                </span>
              </button>

              {/* Image grid */}
              {!isCollapsed && (
                <div
                  className="anim-fade-up"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: "6px",
                    padding: "4px 4px 0",
                    alignContent: "start",
                  }}
                >
                  {successImages.map((img, index) => {
                    const isSelected = selected.has(img.id);
                    return (
                      <div
                        key={img.id}
                        className={`img-card ${isSelected ? "selected" : ""}`}
                        style={{
                          position: "relative",
                          borderRadius: "8px",
                          overflow: "hidden",
                          cursor: "pointer",
                          background: "var(--bg-surface)",
                        }}
                        onClick={() => toggleSelect(img.id)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.imageUrl}
                          alt={`Generated ${index + 1}`}
                          style={{
                            width: "100%",
                            aspectRatio: "1",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />

                        {isSelected && (
                          <div
                            style={{
                              position: "absolute", top: "6px", left: "6px",
                              width: "22px", height: "22px", borderRadius: "6px",
                              background: "var(--accent)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#0a0a0c" strokeWidth={3.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}

                        <button
                          onClick={(e) => { e.stopPropagation(); setPreview(img); }}
                          className="expand-btn"
                          style={{
                            position: "absolute", bottom: "6px", right: "6px",
                            width: "28px", height: "28px", borderRadius: "6px",
                            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", opacity: 0, transition: "opacity 0.15s",
                          }}
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); downloadImage(img); }}
                          className="download-btn"
                          style={{
                            position: "absolute", bottom: "6px", left: "6px",
                            width: "28px", height: "28px", borderRadius: "6px",
                            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", opacity: 0, transition: "opacity 0.15s",
                          }}
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {preview && (
        <div
          className="anim-fade-in"
          onClick={() => setPreview(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
            padding: "40px",
          }}
        >
          <div
            className="anim-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative", maxWidth: "720px", width: "100%",
              borderRadius: "12px", overflow: "hidden",
              background: "var(--bg-raised)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
            }}
          >
            {/* Prompt label */}
            <div style={{
              padding: "10px 16px",
              fontSize: "12px", color: "var(--fg-muted)",
              borderBottom: "1px solid var(--border)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              Prompt: <span style={{ color: "var(--fg-dim)" }}>{preview.prompt}</span>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.imageUrl}
              alt="Preview"
              style={{
                width: "100%", maxHeight: "60vh",
                objectFit: "contain", display: "block",
                background: "var(--bg-surface)",
              }}
            />
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderTop: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => toggleSelect(preview.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "6px 14px", borderRadius: "8px",
                    fontSize: "13px", fontWeight: 500, cursor: "pointer",
                    background: selected.has(preview.id) ? "var(--accent)" : "var(--bg-surface)",
                    color: selected.has(preview.id) ? "var(--bg)" : "var(--fg)",
                    border: selected.has(preview.id) ? "1px solid var(--accent)" : "1px solid var(--border-light)",
                  }}
                >
                  {selected.has(preview.id) ? (
                    <>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Selected
                    </>
                  ) : "Select"}
                </button>
                <button
                  onClick={() => downloadImage(preview)}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "6px 14px", borderRadius: "8px",
                    fontSize: "13px", fontWeight: 500, cursor: "pointer",
                    background: "var(--bg-surface)", color: "var(--fg)",
                    border: "1px solid var(--border-light)",
                  }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
              </div>
              <button
                onClick={() => setPreview(null)}
                style={{
                  width: "32px", height: "32px", borderRadius: "8px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "transparent", border: "none",
                  color: "var(--fg-muted)", cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
