// netlify/functions/requests.js
// Uses @netlify/blobs for persistent storage
// Set ADMIN_PASSWORD in your Netlify environment variables

const { getStore } = require("@netlify/blobs");

function isAdmin(event) {
  // Frontend sends the full "Bearer <password>" string as the token
  const auth = event.headers["authorization"] || "";
  const expected = `Bearer ${process.env.ADMIN_PASS}`;
  return auth === expected;
}

exports.handler = async (event) => {
  const store = getStore("service-requests");
  const method = event.httpMethod;
  const id = event.queryStringParameters?.id || null;

  // ── GET /requests → list all (admin only) ──
  if (method === "GET" && !id) {
    if (!isAdmin(event)) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }
    const { blobs } = await store.list();
    const all = await Promise.all(
      blobs.map(async ({ key }) => {
        const val = await store.get(key, { type: "json" });
        return val;
      })
    );
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(all),
    };
  }

  // ── GET /request/:id → get single ──
  if (method === "GET" && id) {
    const item = await store.get(id, { type: "json" });
    if (!item) return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    };
  }

  // ── POST → create new service request (public) ──
  if (method === "POST") {
    let body;
    try { body = JSON.parse(event.body || "{}"); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }

    const { name, phone, service, location, issue, whatsapp } = body;
    if (!name || !phone || !service || !location || !issue) {
      return { statusCode: 400, body: JSON.stringify({ error: "name, phone, service, location, and issue are required" }) };
    }

    const newId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      id: newId, name, phone, service, location, issue,
      whatsapp: whatsapp || null,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    await store.setJSON(newId, record);
    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, id: newId }),
    };
  }

  // ── PATCH /request/:id → update status (admin only) ──
  if (method === "PATCH" && id) {
    if (!isAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

    let body;
    try { body = JSON.parse(event.body || "{}"); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }

    const existing = await store.get(id, { type: "json" });
    if (!existing) return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };

    const updated = { ...existing, status: body.status };
    await store.setJSON(id, updated);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, request: updated }),
    };
  }

  // ── DELETE /request/:id → admin only ──
  if (method === "DELETE" && id) {
    if (!isAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    await store.delete(id);
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
};
