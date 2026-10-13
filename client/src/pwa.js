/*================================================
| Makes the game an installable app (PWA):
|  - service worker (fast start, works as an app)
|  - "Installer l'app" button on Android / Chrome
|  - how-to hint on iPhone (Safari has no install button)
*/
let deferredInstallPrompt = null;

function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches
        || window.matchMedia("(display-mode: fullscreen)").matches
        || window.navigator.standalone === true;
}

function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function setupInstallHelp() {
    const hint = document.getElementById("install-hint");
    const button = document.getElementById("install-button");
    if (!hint || !button || isStandalone()) {
        return;
    }

    if (isIos()) {
        hint.textContent = "Pour l'avoir en app : bouton Partager, puis « Sur l'écran d'accueil ».";
        hint.hidden = false;
    }

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        button.hidden = false;
    });

    button.addEventListener("click", async () => {
        if (!deferredInstallPrompt) {
            return;
        }
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice.catch(() => null);
        deferredInstallPrompt = null;
        button.hidden = true;
    });

    window.addEventListener("appinstalled", () => {
        button.hidden = true;
        hint.hidden = true;
    });
}

export function registerServiceWorker() {
    setupInstallHelp();

    // Not with the webpack dev server (8080), it would cache dev builds.
    if (!("serviceWorker" in navigator) || ["8080", "8081"].includes(window.location.port)) {
        return;
    }

    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch((error) => {
            console.log("Service worker registration failed", error);
        });
    });
}
