import * as Alchemy from "alchemy";
import { localState } from "alchemy/State";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";

// API: proxies the INPI trademark search and normalizes its rows.
export const Api = Cloudflare.Worker("Api", {
  main: "./src/worker.ts",
});

export default Alchemy.Stack(
  "InpiMarcas",
  {
    providers: Cloudflare.providers(),
    // State lives in .alchemy/ on this machine. Switch to Cloudflare.state()
    // to share it (e.g. deploys from CI).
    state: localState(),
  },
  Effect.gen(function* () {
    const api = yield* Api;
    const web = yield* Cloudflare.Website.Vite("Web", {
      env: { VITE_API_URL: api.url.as<string>() },
      domain: "marcas.mati.lol",
    });
    return { api: api.url, web: web.url };
  }),
);
