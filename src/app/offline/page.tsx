export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <h1 className="page-title text-3xl text-white">Offline</h1>
        <p className="mt-3 text-slate-400">
          You are offline. Cached controller pages may still work. Reconnect to
          sync projects and logs.
        </p>
      </div>
    </div>
  );
}
