module.exports = {
  apps: [
    {
      name: 'ttg-api',
      cwd: __dirname,
      script: 'npm',
      args: 'run server:start',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
    },
    {
      name: 'ttg-ui',
      cwd: __dirname,
      script: 'npx',
      args: 'serve -s dist -l 8080',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}

