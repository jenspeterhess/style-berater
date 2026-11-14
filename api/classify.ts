import handler from "../server/handlers/classify.js";

// Vercel-Einstieg: derselbe Handler wie bei Netlify, nur anders verpackt.
export default { fetch: handler };
