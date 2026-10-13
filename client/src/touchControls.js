/*================================================
| On-screen gamepad for phones and tablets.
|
| The whole game reads the keyboard (arrows, Z, X, Enter, Space), so the
| buttons simply emit the same keyboard events Phaser listens to. Nothing
| else in the game needs to know whether a keyboard or a finger is used.
|
|   D-pad  -> arrow keys
|   A      -> Z      (talk, confirm)
|   B      -> X      (cancel, back)
|   START  -> Enter  (open the menu)
*/
const KEYS = {
    up: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
    down: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
    left: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
    right: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
    a: { key: "z", code: "KeyZ", keyCode: 90 },
    b: { key: "x", code: "KeyX", keyCode: 88 },
    start: { key: "Enter", code: "Enter", keyCode: 13 }
};

const DEAD_ZONE = 0.25;

function emit(type, name) {
    const def = KEYS[name];
    const event = new KeyboardEvent(type, { key: def.key, code: def.code, bubbles: true, cancelable: true });
    // keyCode/which cannot be set through the constructor, Phaser reads them.
    Object.defineProperty(event, "keyCode", { get: () => def.keyCode });
    Object.defineProperty(event, "which", { get: () => def.keyCode });
    window.dispatchEvent(event);
}

// A quick tap must last a few frames, otherwise the game sees the key go
// down and up within the same frame and ignores it (menus use "just pressed").
const MIN_HOLD_MS = 90;

const pressed = new Map(); // name -> time it went down
const pendingRelease = new Map(); // name -> timeout id

function press(name) {
    if (pendingRelease.has(name)) {
        // Re-pressed before the delayed release: finish the previous tap first.
        clearTimeout(pendingRelease.get(name));
        pendingRelease.delete(name);
        pressed.delete(name);
        emit("keyup", name);
    }
    if (pressed.has(name)) {
        return;
    }
    pressed.set(name, performance.now());
    emit("keydown", name);
}

function release(name) {
    if (!pressed.has(name) || pendingRelease.has(name)) {
        return;
    }
    const heldFor = performance.now() - pressed.get(name);
    const wait = Math.max(0, MIN_HOLD_MS - heldFor);
    const finish = () => {
        pendingRelease.delete(name);
        pressed.delete(name);
        emit("keyup", name);
    };
    if (wait === 0) {
        finish();
    } else {
        pendingRelease.set(name, setTimeout(finish, wait));
    }
}

function vibrate() {
    if (navigator.vibrate) {
        try { navigator.vibrate(8); } catch (e) { /* not allowed, ignore */ }
    }
}

/*------------------------------------------------
| D-pad: one zone, the direction follows the finger,
| so you can slide from left to up without lifting.
*/
function setupDpad(dpad) {
    let activePointer = null;
    let current = null;

    const directionFor = (event) => {
        const rect = dpad.getBoundingClientRect();
        const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        if (Math.hypot(dx, dy) < DEAD_ZONE) {
            return null;
        }
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx < 0 ? "left" : "right";
        }
        return dy < 0 ? "up" : "down";
    };

    const setDirection = (direction) => {
        if (direction === current) {
            return;
        }
        if (current) {
            release(current);
        }
        current = direction;
        dpad.dataset.dir = direction || "";
        if (direction) {
            press(direction);
            vibrate();
        }
    };

    dpad.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        activePointer = event.pointerId;
        dpad.setPointerCapture(event.pointerId);
        setDirection(directionFor(event));
    });

    dpad.addEventListener("pointermove", (event) => {
        if (event.pointerId !== activePointer) {
            return;
        }
        setDirection(directionFor(event));
    });

    const end = (event) => {
        if (event.pointerId !== activePointer) {
            return;
        }
        activePointer = null;
        setDirection(null);
    };
    dpad.addEventListener("pointerup", end);
    dpad.addEventListener("pointercancel", end);
    dpad.addEventListener("lostpointercapture", end);
}

/*------------------------------------------------
| Action buttons: held while the finger is on them.
*/
function setupButton(button) {
    const names = [button.dataset.key];

    button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        button.classList.add("is-pressed");
        names.forEach(press);
        vibrate();
    });

    const end = () => {
        button.classList.remove("is-pressed");
        names.forEach(release);
    };
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    button.addEventListener("lostpointercapture", end);
}

function isTouchDevice() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("touch")) {
        return params.get("touch") !== "0";
    }
    return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

export function setupTouchControls() {
    const pad = document.getElementById("touch-controls");
    if (!pad || !isTouchDevice()) {
        return;
    }

    document.body.classList.add("has-touch");
    pad.hidden = false;

    setupDpad(pad.querySelector(".dpad"));
    pad.querySelectorAll("[data-key]").forEach(setupButton);

    // If the app goes to the background mid-press, let go of everything.
    const releaseAll = () => [...pressed.keys()].forEach(release);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            releaseAll();
        }
    });

    // No long-press menu, no double-tap zoom on the controls.
    pad.addEventListener("contextmenu", (event) => event.preventDefault());

    // The black band at the top of the screen opens the game menu.
    const menuBar = document.getElementById("menu-bar");
    if (menuBar) {
        menuBar.hidden = false;
        menuBar.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            vibrate();
            window.dispatchEvent(new CustomEvent("pokemmo:menu"));
        });
    }
}
