// netlify/functions/requests.js
// Persistent storage via @netlify/blobs  — works on Netlify's hosted platform.
// Required env var: ADMIN_PASS  (set in Netlify → Site config → Environment variables)

const { getStore } = require("@netlify/blobs");

// ─── Auth helper ─────────────────────────────────────────────────────────────
function isAdmin(event) {
  const auth =
    event.headers["authorization"] ||
    event.headers["Authorization"] ||
    "";
  const pw = process.env.ADMIN_PASS;
  if (!pw) return false;
  return auth === `Bearer ${pw}`;
}

// ─── CORS headers (allow your own domain + admin panel) ──────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

// ─── Main handler ────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const method = event.httpMethod;

  // Handle preflight
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const id = event.queryStringParameters?.id || null;

  // getStore works automatically on Netlify hosted — no extra config needed
  let store;
  try {
    store = getStore("banaidibo-requests");
  } catch (err) {
    console.error("Blobs init error:", err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Storage unavailable", detail: err.message }),
    };
  }

  // ── POST — submit a new service request (public) ────────────────────────
  if (method === "POST") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: "Invalid JSON" }),
      };
    }

    const { name, phone, service, location, issue, whatsapp } = body;

    if (!name || !phone || !service || !location || !issue) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    const newReq = {
      id: Date.now().toString(),
      name: name.trim(),
      phone: phone.trim(),
      service,
      location: location.trim(),
      issue: issue.trim(),
      whatsapp: whatsapp ? whatsapp.trim() : null,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    try {
      await store.set(newReq.id, JSON.stringify(newReq));
    } catch (err) {
      console.error("Blobs set error:", err);
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: "Failed to save request", detail: err.message }),
      };
    }

    return {
      statusCode: 201,
      headers: CORS,
      body: JSON.stringify({ success: true }),
    };
  }

  // ── GET all — admin only ────────────────────────────────────────────────
  if (method === "GET" && !id) {
    if (!isAdmin(event)) {
      return {
        statusCode: 403,
        headers: CORS,
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    try {
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
      const sorted = items
        .filter(Boolean)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify(sorted),
      };
    } catch (err) {
      console.error("Blobs list error:", err);
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: "Failed to load requests", detail: err.message }),
      };
    }
  }

  // ── PATCH — update status, admin only ──────────────────────────────────
  if (method === "PATCH" && id) {
    if (!isAdmin(event)) {
      return {
        statusCode: 403,
        headers: CORS,
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: "Invalid JSON" }),
      };
    }

    try {
      const existing = await store.get(id);
      if (!existing) {
        return {
          statusCode: 404,
          headers: CORS,
          body: JSON.stringify({ error: "Request not found" }),
        };
      }
      const req = JSON.parse(existing);
      if (body.status) req.status = body.status;
      req.updatedAt = new Date().toISOString();
      await store.set(id, JSON.stringify(req));

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ success: true, request: req }),
      };
    } catch (err) {
      console.error("Blobs patch error:", err);
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: "Failed to update", detail: err.message }),
      };
    }
  }

  // ── DELETE — admin only ─────────────────────────────────────────────────
  if (method === "DELETE" && id) {
    if (!isAdmin(event)) {
      return {
        statusCode: 403,
        headers: CORS,
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    try {
      await store.delete(id);
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ success: true }),
      };
    } catch (err) {
      console.error("Blobs delete error:", err);
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: "Failed to delete", detail: err.message }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: CORS,
    body: JSON.stringify({ error: "Method not allowed" }),
  };
};
