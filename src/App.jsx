import { useMemo, useRef, useState } from "react";
import { createUploadUrl, uploadToS3, getResults } from "./api";

function inferContentType(file) {
  return file.type || "application/octet-stream";
}

function inferExt(file) {
  const name = file.name || "";
  const dot = name.lastIndexOf(".");
  if (dot !== -1) return name.slice(dot + 1).toLowerCase();

  const t = file.type || "";
  if (t === "image/jpeg") return "jpg";
  if (t === "image/png") return "png";
  if (t === "image/webp") return "webp";
  return "bin";
}

export default function App() {
  const [userId, setUserId] = useState("u1");
  const [file, setFile] = useState(null);

  const [status, setStatus] = useState("idle");
  // idle | presigning | uploading | processing | done | error

  const [error, setError] = useState("");
  const [imageId, setImageId] = useState("");
  const [key, setKey] = useState("");

  const [results, setResults] = useState([]);

  const pollRef = useRef(null);

  const canStart = useMemo(() => {
    return userId && file && status !== "presigning" && status !== "uploading" && status !== "processing";
  }, [userId, file, status]);

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }

  function beginPolling(userId, imageId) {
    stopPolling();

    pollRef.current = setInterval(async () => {
      try {
        const res = await getResults({ userId, imageId });

        if (res.status === "done") {
          stopPolling();
          setResults(res.items || []);
          setStatus("done");
        } else {
          setStatus("processing");
        }
      } catch (e) {
        // keep polling, but show last error
        setError(e?.message || String(e));
      }
    }, 2000);
  }

  async function start() {
    setError("");
    setResults([]);
    setImageId("");
    setKey("");
    stopPolling();

    try {
      if (!file) return;

      const contentType = inferContentType(file);
      const ext = inferExt(file);

      setStatus("presigning");

      const presign = await createUploadUrl({ userId, ext, contentType });
      // expected: { uploadUrl, imageId, key }
      setImageId(presign.imageId || "");
      setKey(presign.key || "");

      setStatus("uploading");

      await uploadToS3({
        uploadUrl: presign.uploadUrl,
        file,
        contentType,
      });

      // Upload successful -> S3 sends event -> SQS -> resize lambda processes
      setStatus("processing");
      beginPolling(userId, presign.imageId);
    } catch (e) {
      stopPolling();
      setStatus("error");
      setError(e?.message || String(e));
    }
  }

  async function downloadUrl(url, filename) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`download failed: ${resp.status}`);
    const blob = await resp.blob();

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || "image";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 16, fontFamily: "system-ui, Arial" }}>
      <h2>Upload → Resize → Download</h2>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label>
          User ID
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Choose image
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ width: "100%", marginTop: 6 }}
          />
        </label>

        {file && (
          <div style={{ fontSize: 14, opacity: 0.9 }}>
            <div><b>Name:</b> {file.name}</div>
            <div><b>Type:</b> {file.type || "unknown"}</div>
            <div><b>Size:</b> {(file.size / 1024).toFixed(1)} KB</div>
          </div>
        )}

        <button
          onClick={start}
          disabled={!canStart}
          style={{ padding: 12, cursor: canStart ? "pointer" : "not-allowed" }}
        >
          Upload & Resize
        </button>

        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <div><b>Status:</b> {status}</div>

          {imageId && <div style={{ marginTop: 6 }}><b>imageId:</b> {imageId}</div>}
          {key && <div><b>original key:</b> {key}</div>}

          {error && (
            <div style={{ color: "crimson", marginTop: 8 }}>
              <b>Error:</b> {error}
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <h3 style={{ marginTop: 0 }}>Resized Images</h3>

            <div style={{ display: "grid", gap: 10 }}>
              {results.map((it, idx) => (
                <div key={idx} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ width: 120 }}><b>{it.label}</b></span>
                  <a href={it.url} target="_blank" rel="noreferrer">Open</a>
                  <button onClick={() => downloadUrl(it.url, it.label)}>Download</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}