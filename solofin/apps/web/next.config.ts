import path from "node:path";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@solofin/core"],
  poweredByHeader: false,
  // @solofin/core, symlink ile bağlanan kaynak paketidir; bağımlılığı (zod) bu uygulamanın kopyasından çözülür.
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, zod: path.resolve(process.cwd(), "node_modules/zod") };
    return config;
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
