# 🛠️ BanaiDibo — Complete Developer Guide
### Everything from scratch, explained for beginners

---

## 📌 Table of Contents
1. [What is BanaiDibo?](#what-is-banaidibo)
2. [How the whole system fits together](#how-the-whole-system-fits-together)
3. [index.html — The Public Website](#indexhtml--the-public-website)
4. [admin.html — The Admin Dashboard](#adminhtml--the-admin-dashboard)
5. [auth.js — Login & Security](#authjs--login--security)
6. [professionals.js — Managing Professionals](#professionalsjs--managing-professionals)
7. [requests.js — Managing Service Requests](#requestsjs--managing-service-requests)
8. [How Data Flows — Full Journey](#how-data-flows--full-journey)
9. [Key Concepts for Beginners](#key-concepts-for-beginners)

---

## What is BanaiDibo?

BanaiDibo is a **local service marketplace** based in Kohima, Nagaland. Think of it like this:

- A **customer** needs an electrician or plumber → they go to the website → fill a form → BanaiDibo admin connects them to a pro.
- A **professional** (electrician, plumber, etc.) wants to get more work → they register on the website → BanaiDibo admin approves them → they appear in the listing.

The website has **no traditional database** like MySQL or MongoDB. Instead it uses **Netlify Blobs** — a simple cloud key-value store that Netlify provides for free with hosting.

---

## How the Whole System Fits Together

```
USERS (Browser)
     │
     ├── index.html        ← What the public sees (customers + professionals)
     └── admin.html        ← What only the admin sees (password protected)
          │
          │  HTTP requests (fetch API)
          ▼
NETLIFY SERVERLESS FUNCTIONS  (run on Netlify's servers, not your computer)
     │
     ├── auth.js           ← Handles admin login / password check
     ├── professionals.js  ← CRUD for professional profiles
     └── requests.js       ← CRUD for customer service requests
          │
          │  Read / Write
          ▼
NETLIFY BLOBS (Cloud Storage)
     ├── "banaidibo-professionals"  ← stores pro registrations
     └── "banaidibo-requests"       ← stores customer requests
```

**CRUD** means Create, Read, Update, Delete — the four basic things you do with data.

**Serverless functions** are small pieces of backend code that run only when called. You don't need to manage a server — Netlify handles it.

---

## index.html — The Public Website

This is the **single file** that customers and professionals see. It is a **Single Page Application (SPA)** — meaning it looks like multiple pages, but is actually ONE HTML file. Pages are shown/hidden using JavaScript.

### The 6 "Pages" Inside index.html

| Page ID | What it is | Who uses it |
|---|---|---|
| `#pageHome` | Landing page with hero, services, how it works, about | Everyone |
| `#pageRequest` | Service request form | Customers |
| `#pagePros` | Browse approved professionals | Customers |
| `#pageRegister` | Multi-step registration form for pros | Professionals |
| `#pagePro` | Pro personal dashboard (login by phone) | Professionals |
| Review Modal | Pop-up to leave/read reviews | Customers |

### How Page Switching Works

```javascript
function showPage(p) {
  // p = 'home', 'request', 'register', 'pros', or 'pro'
  ['home','request','register','pros','pro'].forEach(pg => {
    const el = document.getElementById('page' + pg.charAt(0).toUpperCase() + pg.slice(1));
    if (el) el.classList.toggle('hidden', p !== pg);
    // If p === pg → remove 'hidden' (show it)
    // If p !== pg → add 'hidden' (hide it)
  });
  window.scrollTo(0, 0); // Scroll to top when switching pages
}
```

The class `.hidden` is defined in CSS as `display: none !important` — so adding it makes any element invisible.

---

### CSS Design System

At the top of the `<style>` block there are **CSS variables** (`:root { ... }`). These are like named colours you can reuse everywhere:

```css
:root {
  --bg: #0d0f14;        /* very dark background */
  --surface: #13161e;   /* slightly lighter surface */
  --card: #1a1d27;      /* card backgrounds */
  --border: #252836;    /* border colour */
  --accent: #f97316;    /* orange — the brand colour */
  --green: #22c55e;     /* for success messages */
  --red: #ef4444;       /* for errors */
  --text: #f1f5f9;      /* main text */
  --muted: #94a3b8;     /* secondary/grey text */
}
```

To use them: `color: var(--accent)` — no need to repeat `#f97316` everywhere.

---

### The Services Grid

The 7 services are defined as a JavaScript array and **built dynamically** into the HTML:

```javascript
const SERVICES = [
  { icon: '⚡', name: 'Electrician', desc: 'Wiring, short circuits...' },
  { icon: '🔧', name: 'Plumber', desc: 'Leaks, pipe fitting...' },
  { icon: '🏠', name: 'House Painting', desc: 'Interior & exterior...' },
  // ... and so on
];
```

When the page loads, `loadServiceAvailability()` is called:
1. It fetches the approved professionals from the backend.
2. It counts how many pros are available per service.
3. It builds each service card HTML and injects it into `<div id="serviceGrid">`.
4. Each card shows a badge: **Available**, **Limited**, or **Unavailable** based on count.

When a customer clicks a service card → `pickService(name)` runs → it calls `showPage('request')` and pre-fills the service dropdown in the request form.

---

### The Request Form (Customer)

Located in `#pageRequest`. Fields:
- Service (pre-filled if coming from a service card)
- Full name
- Phone number (validated: must start with 6-9, exactly 10 digits — Indian mobile)
- Location / address
- Issue description (min 10 characters)
- Preferred date (optional)
- WhatsApp number (optional)

**Validation happens twice** — once in JavaScript before sending (client-side) and again in `requests.js` on the server (server-side). This is best practice because:
- Client-side = fast feedback for the user
- Server-side = security (someone can bypass the browser and send raw requests)

**On submit:**
1. `submitRequest()` is called.
2. Fields are validated.
3. A `POST` request is sent to `/.netlify/functions/requests` with all the data as JSON.
4. If successful → form hides, success banner shows, resets after 5 seconds.
5. If no professional is available for that service → auto-opens WhatsApp with a "no availability" message to notify the customer.

---

### Professional Registration (5-Step Wizard)

Located in `#pageRegister`. It's a **multi-step form** — one step shows at a time. Progress is tracked with `currentStep` variable.

**Step 1 — Personal Info:** Name, phone, address  
**Step 2 — ID Proof:** Choose ID type (Aadhaar, PAN, Voter ID, etc.) + optional ID number  
**Step 3 — Profession:** Select profession, years of experience, bio  
**Step 4 — Availability & Tools:** When they're available, whether they bring tools  
**Step 5 — Declaration:** Upload passport photo, upload signature image, agree to declaration

Each `Next` button calls `regNext(step)` which:
1. Runs `validateRegStep(step)` — checks required fields for that step only
2. If valid → calls `updateStepUI(step+1)` to show the next panel

**Photo and Signature uploads:**
Both work the same way. When the user picks a file:
```javascript
function handlePhotoUpload(e) {
  const file = e.target.files[0];  // Get the selected file
  const reader = new FileReader(); // Built-in browser tool to read files
  reader.onload = (ev) => {
    photoDataUrl = ev.target.result; // Stores as base64 string (e.g. "data:image/jpeg;base64,/9j/...")
    // Show preview image
  };
  reader.readAsDataURL(file); // Converts file to base64
}
```

The image is stored as a **base64 string** — a text representation of the image. This gets sent as part of the JSON payload to the server and stored in Netlify Blobs.

**On final submit:** `submitRegistration()` collects all data from all 5 steps and sends one `POST` to `/.netlify/functions/professionals`.

---

### Find a Pro Page

Located in `#pagePros`. When this page opens, `loadPros()` is called:
1. Fetches all **approved** professionals from the backend.
2. Renders cards for each one with their photo, name, profession, location, rating, and reviews.
3. Customers can filter by profession or search by name/location.
4. Clicking **"Request This Pro"** pre-fills the request form with that pro's details.
5. Clicking **"Reviews"** opens the review modal.

**Review modal:** Shows existing reviews and lets customers submit new ones (name + star rating + text). The review is sent to `/.netlify/functions/professionals?action=review&id=<profId>`.

---

### Pro Dashboard

Located in `#pagePro`. Professionals can see their own stats and reviews. Login is by phone number (no password — just matched against approved pros list).

```javascript
async function proDashLogin() {
  const phone = document.getElementById('pd_phone').value.trim();
  // Fetch approved pros, find one matching this phone
  const pro = pros.find(p => p.phone === phone && p.status === 'approved');
  if (!pro) { /* show error */ return; }
  // Show their dashboard
  renderProDash(pro);
}
```

The dashboard shows: average rating, total reviews, 5-star count, low-rating count, rating breakdown bars, and all individual reviews.

---

### Toast Notifications

A "toast" is a small popup message at the bottom-right corner. Used throughout the app:

```javascript
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + (type === 'error' ? 'error' : 'success');
  setTimeout(() => { t.className = ''; }, 3500); // Auto-hide after 3.5 seconds
}
```

---

## admin.html — The Admin Dashboard

This is the **control panel** for BanaiDibo owners. It's password-protected. **Nobody else should access this page.**

### What the Admin Can Do

| Tab | Actions |
|---|---|
| 📋 Requests | View all requests, Accept/Reject/Complete them, Contact customers via WhatsApp, Track commission |
| 👷 Professionals | View all registrations (including pending), Approve/Reject, See photos & signatures, Delete |
| 🔧 Service Status | See live availability per service type |

### Login Flow

```
1. Admin opens admin.html
2. Enters password → clicks "Log In"
3. doLogin() sends POST to /.netlify/functions/auth
4. auth.js checks password against ADMIN_PASS env variable
5. If correct → returns { success: true, token: "Bearer <password>" }
6. Token stored in localStorage.adminToken
7. Dashboard shown, data loaded
```

On every page reload, `window.onload` checks if `adminToken` already exists in localStorage → skips login if found. This is **auto-login**.

On logout → token removed from localStorage → login screen shown again.

---

### How the Admin Loads Data

Every API call adds the token in the `Authorization` header:

```javascript
const token = localStorage.getItem("adminToken");

fetch('/.netlify/functions/requests', {
  headers: { "Authorization": token }
  // token = "Bearer <password>"
  // The backend checks: auth === `Bearer ${ADMIN_PASS}`
});
```

---

### Request Management

Each request card shows: customer name, service, phone, location, WhatsApp, issue, preferred date, status.

Actions:
- **Accept** → sends PATCH to backend with `{ status: 'accepted' }` → auto-opens WhatsApp to notify customer
- **Reject** → same but `{ status: 'rejected' }` → WhatsApp notification
- **Mark Complete** → opens a modal to enter the assigned pro's name and commission amount → sends PATCH with `{ status: 'completed', commission, assignedProName }`
- **Request Review** → opens WhatsApp with a message asking customer to leave a review
- **Delete** → sends DELETE request (cannot be undone)

---

### Professional Management

Each pro card shows photo (if uploaded), name, profession, phone, ID type, availability, tools, bio.

Actions:
- **Approve** → `PATCH ?id=<id>` with `{ status: 'approved' }` → WhatsApp congratulations message
- **Reject** → `PATCH ?id=<id>` with `{ status: 'rejected' }` → WhatsApp regret message
- **Details** → opens a modal showing everything including passport photo and signature image
- **WhatsApp** → opens chat with the pro
- **Delete** → removes them permanently

---

### Service Status Tab

Uses the already-loaded `allPros` array to count how many approved pros exist per service. Shows names and phone numbers. Purely informational — helps admin know where there are gaps.

---

## auth.js — Login & Security

This is the simplest of the three backend functions. It lives at `netlify/functions/auth.js`.

### What it does

Checks if the submitted password matches the `ADMIN_PASS` **environment variable** set in Netlify's dashboard (not stored in code — that would be a security risk).

```javascript
exports.handler = async (event) => {
  // Only allow POST method
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const { password } = JSON.parse(event.body); // Get password from request body

  const correctPassword = process.env.ADMIN_PASS; // Read from Netlify env variable

  if (password === correctPassword) {
    // Return a token = "Bearer <password>"
    // Admin stores this and uses it in future API calls
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, token: `Bearer ${correctPassword}` })
    };
  }

  return { statusCode: 401, body: JSON.stringify({ success: false, error: "Invalid password" }) };
};
```

### Why environment variables?

If you wrote `const password = "mysecret123"` in your code, anyone who looks at your GitHub repo would see it. Environment variables are stored separately in Netlify's servers — safe and not visible in code.

### HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | OK — success |
| 201 | Created — new item saved |
| 400 | Bad Request — missing or invalid data |
| 401 | Unauthorized — wrong password |
| 403 | Forbidden — you're not allowed |
| 404 | Not Found — item doesn't exist |
| 405 | Method Not Allowed — wrong HTTP method |
| 500 | Server Error — something crashed on the server |

---

## professionals.js — Managing Professionals

This is the **most complex** backend function. It handles everything about professionals.

### How it decides what to do

It looks at the **HTTP method** and **query parameters** in the URL:

| Method | URL | Who can | What it does |
|---|---|---|---|
| GET | `/professionals` | Public | Returns all **approved** pros |
| GET | `/professionals?all=true` | Admin only | Returns **all** pros (pending, approved, rejected) |
| POST | `/professionals` | Public | Register a new professional |
| POST | `/professionals?action=review&id=123` | Public | Add a review to a pro |
| PATCH | `/professionals?id=123` | Admin only | Update pro's status or notes |
| DELETE | `/professionals?id=123` | Admin only | Delete a pro permanently |

### The isAdmin() function

```javascript
function isAdmin(event) {
  // Read the Authorization header from the incoming request
  const auth = event.headers["authorization"] || event.headers["Authorization"] || "";
  const pw = process.env.ADMIN_PASS;
  if (!pw) return false;
  // Compare: does header say "Bearer <correct-password>"?
  return auth === `Bearer ${pw}`;
}
```

Any route that starts with `if (!isAdmin(event)) return { statusCode: 403 ... }` is **admin-only**.

### IMPORTANT: Route Order Matters

The GET routes are checked in this order:
```javascript
// 1. Admin GET (checked FIRST — because ?all=true needs to be caught before the public route)
if (method === "GET" && params.all === "true") { ... }

// 2. Public GET (catches all other GET requests with no id)
if (method === "GET" && !id) { ... }
```

If these were reversed, `?all=true` would never be reached — the public route would catch it first. This was a bug in the original code that was fixed.

### How Netlify Blobs works

Think of Blobs as a giant dictionary (key-value store):
- **Key** = the professional's unique ID (a timestamp like `"1714123456789"`)
- **Value** = their full data as a JSON string

```javascript
// Save a professional
await store.set("1714123456789", JSON.stringify({ name: "Ravi", profession: "Electrician", ... }));

// Read a professional
const raw = await store.get("1714123456789");
const prof = JSON.parse(raw); // Convert JSON string back to object

// List all professionals
const { blobs } = await store.list(); // Returns array of { key: "..." } objects

// Delete a professional
await store.delete("1714123456789");
```

### Registering a new Professional (POST)

1. Parse the request body (JSON).
2. Validate required fields: name, phone, address, idProof, profession, readiness, ownTools.
3. Validate the phone number (must be valid Indian mobile).
4. Create a professional object with `status: "pending"`.
5. Save to Blobs using `Date.now().toString()` as the unique ID.
6. Return `{ success: true }` with status 201 (Created).

### Public GET — what data is returned

When customers browse professionals, only **safe** fields are returned. Private info like `idNumber` is **not** included:

```javascript
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
  phone: p.phone,       // ← phone is shown so customers can call
  reviews: p.reviews,
  status: p.status,
  // idProof, idNumber, signatureUrl are NOT included — private
}))
```

Results are sorted by **average review rating** — highest rated pros appear first.

### Adding a Review

```javascript
if (method === "POST" && action === "review" && id) {
  // Get existing pro from storage
  const prof = JSON.parse(await store.get(id));
  // Add the new review to their reviews array
  prof.reviews.push({
    id: Date.now().toString(),
    reviewer: reviewer.trim(),
    rating: Number(rating),   // 1-5
    text: text.trim(),
    createdAt: new Date().toISOString(),
  });
  // Save back
  await store.set(id, JSON.stringify(prof));
}
```

---

## requests.js — Managing Service Requests

Similar structure to professionals.js but simpler — only 4 routes.

| Method | URL | Who can | What it does |
|---|---|---|---|
| POST | `/requests` | Public | Submit a new service request |
| GET | `/requests` | Admin only | List all requests |
| PATCH | `/requests?id=123` | Admin only | Update status, commission, assigned pro |
| DELETE | `/requests?id=123` | Admin only | Delete a request |

### Submitting a Request (POST)

Required fields: `name`, `phone`, `service`, `location`, `issue`  
Optional fields: `whatsapp`, `preferredDate`, `preferredProId`, `preferredProName`

A request object looks like:
```javascript
{
  id: "1714123456789",         // unique ID
  name: "Arun Kumar",
  phone: "9876543210",
  service: "Electrician",
  location: "Ward 1, Kohima",
  issue: "No power in bedroom since yesterday",
  whatsapp: "9876543210",      // may differ from phone
  preferredDate: "2026-05-01",
  preferredProId: null,        // if customer requested a specific pro
  preferredProName: null,
  status: "pending",           // pending → accepted → completed / rejected
  commission: null,            // filled by admin when completing
  completedAt: null,
  createdAt: "2026-04-26T10:00:00.000Z",
}
```

### Status Flow

```
pending  →  accepted  →  completed
   └──────→  rejected
```

- **pending**: Just submitted, not yet reviewed by admin
- **accepted**: Admin confirmed it and notified the customer
- **completed**: Job is done, commission may be recorded
- **rejected**: Could not be fulfilled

### PATCH — Updating a Request

The admin can update multiple fields at once:
```javascript
if (body.status) req.status = body.status;
if (body.status === "completed" && !req.completedAt) req.completedAt = new Date().toISOString();
if (body.commission !== undefined) req.commission = body.commission;
if (body.assignedProId !== undefined) req.assignedProId = body.assignedProId;
if (body.assignedProName !== undefined) req.assignedProName = body.assignedProName;
req.updatedAt = new Date().toISOString(); // Always update timestamp
```

---

## How Data Flows — Full Journey

### Journey 1: Customer requests a service

```
Customer fills form in index.html
        ↓
submitRequest() validates fields in browser
        ↓
fetch POST → /.netlify/functions/requests
        ↓
requests.js validates again on server
        ↓
Saves to Netlify Blobs (banaidibo-requests store)
        ↓
Returns { success: true }
        ↓
Browser shows success message
        ↓ (if no pro available)
Browser auto-opens WhatsApp to notify customer
        ↓
Admin logs in to admin.html
        ↓
Admin sees request in Requests tab
        ↓
Admin clicks Accept → PATCH sent to requests.js
        ↓
Status updated to "accepted"
        ↓
WhatsApp opens to notify customer
        ↓
Admin arranges the professional
        ↓
Admin marks Complete → enters commission
        ↓
Status updated to "completed"
```

### Journey 2: Professional registers

```
Professional fills 5-step form in index.html
        ↓
submitRegistration() collects all data
        ↓
Photos converted to base64 strings
        ↓
fetch POST → /.netlify/functions/professionals
        ↓
professionals.js validates and saves to Blobs
        ↓
Status = "pending"
        ↓
Admin logs in → sees pro in Professionals tab (pending badge on tab)
        ↓
Admin clicks Details → sees photo, signature, all info
        ↓
Admin clicks Approve → PATCH sent
        ↓
Status = "approved"
        ↓
WhatsApp congratulations message opens
        ↓
Pro now appears on Find a Pro page for customers
        ↓
After completing a job, customer can leave a review
        ↓
Pro can log in to Pro Dashboard to see their rating
```

---

## Key Concepts for Beginners

### What is `async` / `await`?

When your code needs to wait for something (like a network request), you use `async`/`await`:

```javascript
// Without async/await (old way — confusing)
fetch('/api').then(res => res.json()).then(data => console.log(data));

// With async/await (cleaner — reads like normal code)
async function loadData() {
  const res = await fetch('/api');   // Wait for the network
  const data = await res.json();    // Wait for JSON parsing
  console.log(data);
}
```

Every function in this project that talks to the backend uses `async/await`.

### What is JSON?

JSON (JavaScript Object Notation) is how data is sent between the browser and server. It's just text that looks like a JavaScript object:

```json
{
  "name": "Ravi Kumar",
  "profession": "Electrician",
  "phone": "9876543210",
  "status": "pending"
}
```

- `JSON.stringify(obj)` → converts a JavaScript object to a JSON string (to send)
- `JSON.parse(str)` → converts a JSON string back to a JavaScript object (on receiving)

### What is `fetch()`?

`fetch()` is the browser's built-in way to make HTTP requests to a server:

```javascript
const res = await fetch('/url', {
  method: 'POST',                          // GET, POST, PATCH, DELETE
  headers: { 'Content-Type': 'application/json' },  // Tell server it's JSON
  body: JSON.stringify({ name: 'Ravi' })   // The data to send
});
const data = await res.json();  // Parse the server's response
```

### What is `try/catch`?

When something might fail (network request, JSON parsing, etc.), wrap it in try/catch:

```javascript
try {
  const data = await fetch(...); // Try this
  // If it works, continue here
} catch (err) {
  // If ANYTHING goes wrong, come here
  showToast('Something failed', 'error');
}
```

### What is `event.httpMethod` in the backend?

When a request arrives at a Netlify function, the `event` object tells you everything about it:

```javascript
event.httpMethod          // "GET", "POST", "PATCH", "DELETE"
event.body                // The request body as a string (for POST/PATCH)
event.queryStringParameters  // URL params: /professionals?id=123 → { id: "123" }
event.headers             // Request headers: { authorization: "Bearer xxx" }
```

### What does `exports.handler` mean?

In Node.js (the server-side JavaScript runtime), `exports.handler` is how you tell Netlify "this is the function to run when someone calls this endpoint":

```javascript
exports.handler = async (event) => {
  // event = info about the incoming HTTP request
  // Return an HTTP response object
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true })
  };
};
```

### What is CORS?

CORS (Cross-Origin Resource Sharing) is a browser security rule. When your HTML page (on one domain) tries to call an API (on another domain), the browser blocks it by default. The `CORS` headers in the backend functions tell the browser "it's OK, allow these requests":

```javascript
const CORS = {
  "Access-Control-Allow-Origin": "*",          // Allow any website
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};
```

The `OPTIONS` method check at the top of each function is called a **preflight request** — browsers automatically send this first to ask "can I make this request?" before sending the real one.

### What is `localStorage`?

`localStorage` is a small storage space in the user's browser. Data survives page refreshes but stays on that device only:

```javascript
localStorage.setItem("adminToken", "Bearer abc123");  // Save
localStorage.getItem("adminToken");                    // Read → "Bearer abc123"
localStorage.removeItem("adminToken");                 // Delete (on logout)
```

In this project, the admin token is stored here so the admin doesn't have to re-enter the password on every page refresh.

---

## Summary Table — All Files at a Glance

| File | Type | Runs on | Purpose |
|---|---|---|---|
| `index.html` | HTML + CSS + JS | Browser | Public-facing website (all user interactions) |
| `admin.html` | HTML + CSS + JS | Browser | Admin-only control panel |
| `auth.js` | Node.js | Netlify server | Admin login — validates password |
| `professionals.js` | Node.js | Netlify server | All professional data operations |
| `requests.js` | Node.js | Netlify server | All service request data operations |

---

*Built with ❤️ in Kohima, Nagaland. © 2026 BanaiDibo*


