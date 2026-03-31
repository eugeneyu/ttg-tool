/**
 * local server entry file, for local development
 */
if (!(globalThis as any).File) {
  try {
    const { File } = await import('node:buffer')
    ;(globalThis as any).File = File
  } catch {
    ;(globalThis as any).File = class File {}
  }
}

const [{ default: app }, { initRuntime }] = await Promise.all([import('./app.js'), import('./state.js')])

/**
 * start server with port
 */
await initRuntime();

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
