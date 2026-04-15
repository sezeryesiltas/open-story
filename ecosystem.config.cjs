// PM2 ecosystem configuration for running API + Admin Web in a single container.
// Used by pm2-runtime inside the Docker container.

module.exports = {
  apps: [
    {
      name: 'open-story-api',
      script: '/usr/local/bin/tsx',
      args: '--tsconfig apps/api/tsconfig.json apps/api/src/main.ts',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'open-story-admin',
      script: './apps/admin-web/node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: './apps/admin-web',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
