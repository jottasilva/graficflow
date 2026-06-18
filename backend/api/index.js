import { app } from "../dist/server.js";

let readyPromise;

export default async function handler(request, response) {
  readyPromise ??= app.ready();
  await readyPromise;
  app.server.emit("request", request, response);
}
