import handler from "../server/handlers/expert.js";

// Vercel-Einstieg: derselbe Handler wie bei Netlify, nur anders verpackt.
export default { fetch: handler };
