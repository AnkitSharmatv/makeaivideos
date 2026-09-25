import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native modules stay outside the bundle.
  serverExternalPackages: ["@libsql/client", "sharp"],
  logging: {
    // Dev logging of server-function calls would print arguments — including
    // passwords and provider keys — to the terminal. Keep it off.
    serverFunctions: false,
  },
};

export default nextConfig;
