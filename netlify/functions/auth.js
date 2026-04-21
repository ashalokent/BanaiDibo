// netlify/functions/auth.js
// Set ADMIN_PASSWORD in your Netlify environment variables

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
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

  const { password } = body;
  const correctPassword = process.env.ADMIN_PASSWORD;

  if (!correctPassword) {
    console.error("ADMIN_PASSWORD environment variable is not set!");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server misconfiguration" }),
    };
  }

  if (password === correctPassword) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      // Return the password as the token — frontend stores it and sends as Bearer token
      body: JSON.stringify({ success: true, token: `Bearer ${correctPassword}` }),
    };
  }

  return {
    statusCode: 401,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: false, error: "Invalid password" }),
  };
};
