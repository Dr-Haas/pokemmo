/*================================================
| Lets the game be installed on the phone's home screen
| ("Add to Home Screen" on iPhone, "Install app" on Android).
*/
export function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || window.location.hostname === "localhost") {
        return;
    }

    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch((error) => {
            console.log("Service worker registration failed", error);
        });
    });
}
