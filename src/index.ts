import { app } from "./app";
import { db } from "./database/db";

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

/**
 * Enhancement (F): graceful shutdown — close the HTTP server and the SQLite
 * connection cleanly on SIGTERM (container stop) and SIGINT (Ctrl-C) to
 * prevent in-flight requests from being dropped and avoid DB file corruption.
 */
function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    db.close();
    console.log("Server and database closed.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
