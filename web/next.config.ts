import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.0.113', '192.168.0.117', '192.168.1.10', 'localhost', '127.0.0.1', '172.31.128.1'],
};

export default nextConfig;
