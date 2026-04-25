// netlify/functions/professionals.js
// Handles professional registration, listing, approval, and reviews
// Required env var: ADMIN_PASS

const { getStore } = require("@netlify/blobs");

function isAdmin(event) {
  const auth = event.headers["authorization"] || event.headers["Authorization"] || "";
  const pw = process.env.ADMIN_PASS;
  if (!pw) return false;
  return auth === `Bearer ${pw}`;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  const method = event.httpMethod;
  if (method === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  const params = event.queryStringParameters || {};
  const id = params.id || null;
  const action = params.action || null;

  let store;
  try {
    store = getStore({
      name: "banaidibo-professionals",
      siteID: "0b9b6f1e-ba5f-4d41-bd89-64fd1c0adf65",
      token: process.env.NETLIFY_AUTH_TOKEN,
    });
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Storage unavailable", detail: err.message }) };
  }

  // ── GET all approved professionals (public) ──
  if (method === "GET" && !id) {
    try {
      const { blobs } = await store.list();
      const items = await Promise.all(
        blobs.map(async (b) => {
          try { return JSON.parse(await store.get(b.key)); } catch { return null; }
        })
      );
      const approved = items
        .filter(Boolean)
        .filter(p => p.status === "approved")
        .map(p => ({
          id: p.id,
          name: p.name,
          profession: p.profession,
          experience: p.experience,
          bio: p.bio,
          address: p.address,
          readiness: p.readiness,
          ownTools: p.ownTools,
          photoUrl: p.photoUrl,
          phone: p.phone,
          reviews: p.reviews || [],
          status: p.status,
        }))
        .sort((a, b) => {
          const avgA = a.reviews.length ? a.reviews.reduce((s, r) => s + r.rating, 0) / a.reviews.length : 0;
          const avgB = b.reviews.length ? b.reviews.reduce((s, r) => s + r.rating, 0) / b.reviews.length : 0;
          return avgB - avgA;
        });

      return { statusCode: 200, headers: CORS, body: JSON.stringify(approved) };
    } catch (err) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to load professionals", detail: err.message }) };
    }
  }

  // ── GET all (admin) ──
  if (method === "GET" && params.all === "true") {
    if (!isAdmin(event)) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Forbidden" }) };
    try {
      const { blobs } = await store.list();
      const items = await Promise.all(
        blobs.map(async (b) => {
          try { return JSON.parse(await store.get(b.key)); } catch { return null; }
        })
      );
      const sorted = items.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { statusCode: 200, headers: CORS, body: JSON.stringify(sorted) };
    } catch (err) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to load", detail: err.message }) };
    }
  }

  // ── POST — new professional registration (public) ──
  if (method === "POST" && !action) {
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    const { name, phone, address, idProof, profession, readiness, ownTools } = body;
    if (!name || !phone || !address || !idProof || !profession || !readiness || !ownTools) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing required fields" }) };
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid phone number" }) };
    }

    const prof = {
      id: Date.now().toString(),
      name: name.trim(),
      phone: cleanPhone,
      address: address.trim(),
      idProof,
      idNumber: body.idNumber || null,
      profession,
      experience: body.experience || null,
      bio: body.bio || null,
      readiness,
      ownTools,
      photoUrl: body.photoUrl || null,
      signatureUrl: body.signatureUrl || null,
      filledDate: body.filledDate || null,
      status: "pending",
      reviews: [],
      createdAt: new Date().toISOString(),
    };

    try {
      await store.set(prof.id, JSON.stringify(prof));
      return { statusCode: 201, headers: CORS, body: JSON.stringify({ success: true }) };
    } catch (err) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to save", detail: err.message }) };
    }
  }

  // ── POST review — action=review&id=<profId> ──
  if (method === "POST" && action === "review" && id) {
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    const { reviewer, rating, text } = body;
    if (!reviewer || !rating || !text) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing fields" }) };
    }
    if (rating < 1 || rating > 5) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Rating must be 1–5" }) };
    }

    try {
      const existing = await store.get(id);
      if (!existing) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Professional not found" }) };

      const prof = JSON.parse(existing);
      if (!prof.reviews) prof.reviews = [];
      prof.reviews.push({
        id: Date.now().toString(),
        reviewer: reviewer.trim(),
        rating: Number(rating),
        text: text.trim(),
        createdAt: new Date().toISOString(),
      });
      await store.set(id, JSON.stringify(prof));
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, reviews: prof.reviews }) };
    } catch (err) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to save review", detail: err.message }) };
    }
  }

  // ── PATCH — update status (admin only) ──
  if (method === "PATCH" && id) {
    if (!isAdmin(event)) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Forbidden" }) };

    let body;
    try { body = JSON.parse(event.body || "{}"); } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    const allowed = ["pending", "approved", "rejected"];
    if (body.status && !allowed.includes(body.status)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid status" }) };
    }

    try {
      const existing = await store.get(id);
      if (!existing) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Not found" }) };
      const prof = JSON.parse(existing);
      if (body.status) prof.status = body.status;
      if (body.notes !== undefined) prof.adminNotes = body.notes;
      prof.updatedAt = new Date().toISOString();
      await store.set(id, JSON.stringify(prof));
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, professional: prof }) };
    } catch (err) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to update", detail: err.message }) };
    }
  }

  // ── DELETE — admin only ──
  if (method === "DELETE" && id) {
    if (!isAdmin(event)) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Forbidden" }) };
    try {
      await store.delete(id);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
    } catch (err) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to delete", detail: err.message }) };
    }
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
};
