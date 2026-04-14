// PM2 ecosystem configuration for running API + Admin Web in a single container.
// Used by pm2-runtime inside the Docker container.

module.exports = {
  apps: [
    {
      name: 'open-story-api',
      script: 'apps/api/dist/main.js',
      interpreter: 'node',
      interpreter_args: '--experimental-strip-types',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'open-story-admin',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: './apps/admin-web',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
