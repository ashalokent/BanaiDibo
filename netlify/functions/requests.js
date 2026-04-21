let requests = []; // temporary memory

exports.handler = async (event) => {
  const method = event.httpMethod;
  const id = event.queryStringParameters?.id || null;

  // GET all (admin)
  if (method === "GET" && !id) {
    return {
      statusCode: 200,
      body: JSON.stringify(requests),
    };
  }

  // POST create
  if (method === "POST") {
    const body = JSON.parse(event.body || "{}");

    const { name, phone, service, location, issue, whatsapp } = body;

    if (!name || !phone || !service || !location || !issue) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing fields" }),
      };
    }

    const newReq = {
      id: Date.now().toString(),
      ...body,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    requests.push(newReq);

    return {
      statusCode: 201,
      body: JSON.stringify({ success: true }),
    };
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ error: "Method not allowed" }),
  };
};