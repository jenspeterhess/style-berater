import handler from "../server/handlers/suggest.js";

// Vercel-Einstieg: derselbe Handler wie bei Netlify, nur anders verpackt.
export default { fetch: handler };
