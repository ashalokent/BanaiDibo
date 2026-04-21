// netlify/functions/requests.js
// Uses @netlify/blobs for persistent storage across serverless invocations.
// Set ADMIN_PASS in your Netlify environment variables (same value as auth.js uses).

const { getStore } = require("@netlify/blobs");

// ─── helpers ────────────────────────────────────────────────────────────────

function isAdmin(event) {
  const auth = event.headers["authorization"] || event.headers["Authorization"] || "";
  const correctPassword = process.env.ADMIN_PASS;
  if (!correctPassword) return false;
  // Token is stored / sent as "Bearer <password>"
  return auth === `Bearer ${correctPassword}`;
}

async function getAllRequests(store) {
  const { blobs } = await store.list();
  const items = await Promise.all(
    blobs.map(async (b) => {
      try {
        const raw = await store.get(b.key);
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
  );
  // Filter nulls and sort newest first
  return items
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ─── handler ────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const method = event.httpMethod;
  const id = event.queryStringParameters?.id || null;

  // Netlify Blobs store — name must be consistent
  const store = getStore("banaidibo-requests");

  // ── GET all (admin only) ──────────────────────────────────────────────────
  if (method === "GET" && !id) {
    if (!isAdmin(event)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    const requests = await getAllRequests(store);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requests),
    };
  }

  // ── POST — create new request (public) ───────────────────────────────────
  if (method === "POST") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid JSON" }),
      };
    }

    const { name, phone, service, location, issue, whatsapp } = body;

    if (!name || !phone || !service || !location || !issue) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    const newReq = {
      id: Date.now().toString(),
      name,
      phone,
      service,
      location,
      issue,
      whatsapp: whatsapp || null,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    await store.set(newReq.id, JSON.stringify(newReq));

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true }),
    };
  }

  // ── PATCH — update status (admin only) ───────────────────────────────────
  if (method === "PATCH" && id) {
    if (!isAdmin(event)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid JSON" }),
      };
    }

    const existing = await store.get(id);
    if (!existing) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Request not found" }),
      };
    }

    const req = JSON.parse(existing);
    if (body.status) req.status = body.status;
    req.updatedAt = new Date().toISOString();

    await store.set(id, JSON.stringify(req));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, request: req }),
    };
  }

  // ── DELETE (admin only) ───────────────────────────────────────────────────
  if (method === "DELETE" && id) {
    if (!isAdmin(event)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    await store.delete(id);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true }),
    };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return {
    statusCode: 405,
    body: JSON.stringify({ error: "Method not allowed" }),
  };
};
