import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { optimizePackageImports: ["motion", "three"] },
  // El nivel del juego genérico ahora es Punk Cowboy.
  async redirects() {
    return [{ source: "/proyectos/unity", destination: "/proyectos/punk-cowboy", permanent: true }];
  },
  // Mike pide el micrófono; el resto del sitio no lo necesita.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" }] }];
  },
};

export default nextConfig;
