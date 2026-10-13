import { API_BASE_URL } from "../config";

async function readJson(response) {
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.message || "NPC request failed");
    }

    return payload;
}

export async function fetchNpcs(playerId, map) {
    const response = await fetch(`${API_BASE_URL}/npcs?playerId=${encodeURIComponent(playerId)}&map=${encodeURIComponent(map)}`);
    return readJson(response);
}

export async function interactWithNpc(playerId, npcId, choiceId) {
    const response = await fetch(`${API_BASE_URL}/npcs/${encodeURIComponent(npcId)}/interact`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            playerId,
            choiceId
        })
    });

    return readJson(response);
}
