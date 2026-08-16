// Ships live browser errors to the backend so they land in logs/frontend-error.log
// alongside backend-error.log / db-error.log for one-place troubleshooting.
function send(message, stack) {
  fetch('/api/logs/client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, stack, url: window.location.href, userAgent: navigator.userAgent }),
  }).catch(() => {});
}

window.addEventListener('error', (e) => {
  send(e.message || 'Unknown error', e.error?.stack);
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  send(
    typeof reason === 'string' ? reason : (reason?.message || 'Unhandled promise rejection'),
    reason?.stack
  );
});
