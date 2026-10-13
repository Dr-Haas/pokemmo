/*================================================
| Where the multiplayer server lives.
|
| Priority:
|  1. ?server=https://... in the page URL (handy for quick tests)
|  2. SERVER_URL given at build time (SERVER_URL=https://... npm run build)
|  3. Local development (webpack dev server on :8080): same machine, port 3000
|  4. Otherwise: the same address as the page. This is the normal case once
|     deployed, because the server also serves the game files.
*/
function resolveServerHttpUrl() {
    const fromQuery = new URLSearchParams(window.location.search).get("server");
    if (fromQuery) {
        return fromQuery;
    }

    // Replaced by webpack DefinePlugin at build time.
    if (typeof __SERVER_URL__ !== "undefined" && __SERVER_URL__) {
        return __SERVER_URL__;
    }

    const { protocol, hostname, port, origin } = window.location;
    if (port === "8080" || port === "8081") {
        return `${protocol}//${hostname}:3000`;
    }

    return origin;
}

const httpUrl = resolveServerHttpUrl().replace(/\/+$/, "").replace(/^ws(s?):/, "http$1:");

// http(s)://host  ->  ws(s)://host  for the realtime connection
export const SERVER_URL = httpUrl.replace(/^http(s?):/, "ws$1:");
export const API_BASE_URL = `${httpUrl}/api`;
