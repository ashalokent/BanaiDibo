// netlify/functions/requests.js
// Handles: POST /request, GET /requests, PATCH /request/:id, DELETE /request/:id

const { getStore } = require("@netlify/blobs");

const STORE_NAME = "banaidibo-requests";

// ─── Auth helper ───
function isAdmin(event) {
  const token = event.headers["authorization"] || event.headers["Authorization"];
  return token === process.env.ADMIN_TOKEN;
}

// ─── Store helpers ───
async function getStore_() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

async function readRequests() {
  const store = await getStore_();
  try {
    const raw = await store.get("all", { type: "json" });
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function writeRequests(data) {
  const store = await getStore_();
  await store.setJSON("all", data);
}

// ─── Main handler ───
exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path;

  // Extract ID from path e.g. /request/1234567890
  const idMatch = path.match(/\/request\/([^/]+)$/);
  const id = idMatch ? idMatch[1] : null;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  };

  // CORS preflight
  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    // ── POST /request — submit new request ──
    if (method === "POST" && path.endsWith("/request")) {
      const body = JSON.parse(event.body || "{}");
      if (!body.name || !body.service || !body.phone) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing required fields" }) };
      }

      const reqs = await readRequests();
      const newReq = {
        id: Date.now().toString(),
        service: body.service,
        name: body.name,
        phone: body.phone,
        location: body.location || "",
        issue: body.issue || "",
        whatsapp: body.whatsapp || null,
        status: "pending",
        createdAt: new Date().toISOString(),
        notes: "",
      };

      reqs.push(newReq);
      await writeRequests(reqs);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, id: newReq.id }) };
    }

    // ── GET /requests — list all (admin only) ──
    if (method === "GET" && path.endsWith("/requests")) {
      if (!isAdmin(event)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: "Unauthorized" }) };
      }
      const reqs = await readRequests();
      return { statusCode: 200, headers, body: JSON.stringify(reqs.slice().reverse()) };
    }

    // ── PATCH /request/:id — update status (admin only) ──
    if (method === "PATCH" && id) {
      if (!isAdmin(event)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: "Unauthorized" }) };
      }
      const body = JSON.parse(event.body || "{}");
      const { status } = body;

      if (!["pending", "accepted", "rejected"].includes(status)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid status" }) };
      }

      const reqs = await readRequests();
      const idx = reqs.findIndex((r) => r.id === id);
      if (idx === -1) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
      }

      reqs[idx].status = status;
      await writeRequests(reqs);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, request: reqs[idx] }) };
    }

    // ── DELETE /request/:id (admin only) ──
    if (method === "DELETE" && id) {
      if (!isAdmin(event)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: "Unauthorized" }) };
      }

      const reqs = await readRequests();
      const filtered = reqs.filter((r) => r.id !== id);

      if (filtered.length === reqs.length) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
      }

      await writeRequests(filtered);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
  } catch (err) {
    console.error("Function error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
