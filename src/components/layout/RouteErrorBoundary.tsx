import { Link, useRouteError, isRouteErrorResponse } from "react-router-dom";

/** errorElement: catches render/loader errors and offers a route back to the lobby (spec §12.6). */
export function RouteErrorBoundary() {
  const error = useRouteError();

  let message = "Something went wrong.";
  if (isRouteErrorResponse(error)) {
    message = `${error.status} — ${error.statusText}`;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="casino-backdrop flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="font-display text-4xl text-gold">Oops</h1>
      <p className="max-w-md text-white/70">{message}</p>
      <Link
        to="/lobby"
        className="focus-ring rounded-xl bg-gradient-to-b from-gold-400 to-gold-600 px-6 py-3 font-bold text-wine-900"
      >
        Back to Lobby
      </Link>
    </div>
  );
}
