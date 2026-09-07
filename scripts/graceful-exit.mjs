// The vinext CLI calls process.exit immediately after prerender HTTP requests.
// On Windows / Node 24 this races libuv async-handle shutdown (nodejs/node#56645).
// Preserve the requested status while allowing handles to drain naturally.
// This is confined to the build command, never loaded by the app or dev server.
if (process.platform === 'win32') {
  process.exit = (code = 0) => {
    process.exitCode = code;
  };
}
