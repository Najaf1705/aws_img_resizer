const API_BASE = import.meta.env.VITE_API_BASE;

// POST /presign  -> { uploadUrl, imageId, key }
export async function createUploadUrl({ userId, ext, contentType }) {
  const res = await fetch(`${API_BASE}/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ext, contentType }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`presign failed: ${res.status} ${text}`);
  }
  return JSON.parse(text);
}

// PUT to S3 presigned URL
export async function uploadToS3({ uploadUrl, file, contentType }) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`S3 upload failed: ${res.status} ${errText}`);
  }

  return true;
}

// GET /results?userId=u1&imageId=<id>
// -> { status: "done", items: [{label,url}, ...] }
// or { status: "processing" }
export async function getResults({ userId, imageId }) {
  const res = await fetch(
    `${API_BASE}/results?userId=${encodeURIComponent(userId)}&imageId=${encodeURIComponent(imageId)}`
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`results failed: ${res.status} ${text}`);
  }

  return JSON.parse(text);
}