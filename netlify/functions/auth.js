// netlify/functions/auth.js
// Handles: POST /admin/login

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const ADMIN_USER = process.env.ADMIN_USER || "admin";
  const ADMIN_PASS = process.env.ADMIN_PASS;
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

  if (!ADMIN_PASS || !ADMIN_TOKEN) {
    console.error("ADMIN_PASS and ADMIN_TOKEN env vars are not set.");
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server misconfigured" }) };
  }

  try {
    const { username, password } = JSON.parse(event.body || "{}");

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, token: ADMIN_TOKEN }),
      };
    }

    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Invalid credentials" }),
    };
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Bad request" }) };
  }
};
