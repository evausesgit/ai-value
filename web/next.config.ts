import type { NextConfig } from "next";

// L'API FastAPI n'est jamais exposée au navigateur : le serveur Next relaie
// /api/* vers elle. Le cookie de session posé par l'API traverse le relais.
// ⚠️ Les rewrites sont figés au build : API_INTERNAL_URL doit être posée avant
// `npm run build` (cf. web/Dockerfile).
const API_INTERNAL = process.env.API_INTERNAL_URL || "http://127.0.0.1:8820";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_INTERNAL}/:path*` }];
  },
};

export default nextConfig;
