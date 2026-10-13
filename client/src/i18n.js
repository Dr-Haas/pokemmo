// French labels for values the game keeps in English internally (types feed the
// type chart and the server, status codes and bag categories are save-file keys).

const TYPE_LABELS = {
    Normal: "Normal",
    Fire: "Feu",
    Water: "Eau",
    Grass: "Plante",
    Electric: "Électrik",
    Ice: "Glace",
    Fighting: "Combat",
    Poison: "Poison",
    Ground: "Sol",
    Flying: "Vol",
    Psychic: "Psy",
    Bug: "Insecte",
    Rock: "Roche",
    Ghost: "Spectre",
    Dragon: "Dragon",
    Dark: "Ténèbres",
    Steel: "Acier",
    Fairy: "Fée"
};

const STATUS_LABELS = {
    PSN: "PSN",
    BRN: "BRL",
    FRZ: "GEL",
    PAR: "PAR",
    SLP: "SOM",
    FNT: "K.O."
};

const NATURE_LABELS = {
    Hardy: "Hardi",
    Bold: "Assuré",
    Modest: "Modeste",
    Calm: "Calme",
    Timid: "Timide",
    Adamant: "Rigide",
    Jolly: "Jovial",
    Brave: "Brave",
    Relaxed: "Relax",
    Naive: "Naïf"
};

const MOVE_CATEGORY_LABELS = {
    physical: "Physique",
    special: "Spéciale",
    status: "Statut"
};

const BAG_CATEGORY_LABELS = {
    "Items": "Objets",
    "Poké Balls": "Poké Balls",
    "TM/HM": "CT/CS",
    "Berries": "Baies",
    "Key Items": "Rares"
};

const MAP_LABELS = {
    town: "Bourg Palette",
    route1: "Route 1",
    viridian: "Jadielle",
    route2: "Route 2",
    viridian_forest: "Forêt de Jade",
    pewter: "Argenta",
    pokemon_center_viridian: "Centre Pokémon",
    pokemon_center_pewter: "Centre Pokémon"
};

export function typeLabel(type) {
    return TYPE_LABELS[type] || type || "";
}

export function typesLabel(types) {
    return (types || []).map(typeLabel).join(" / ");
}

export function statusLabel(status) {
    return STATUS_LABELS[status] || status || "";
}

export function natureLabel(nature) {
    return NATURE_LABELS[nature] || nature || "";
}

export function moveCategoryLabel(category) {
    return MOVE_CATEGORY_LABELS[category] || category || "";
}

export function bagCategoryLabel(category) {
    return BAG_CATEGORY_LABELS[category] || category || "";
}

// NPC emotions come from the emotion engine (or the local fallback) as English words.
const EMOTION_LABELS = {
    neutral: "NEUTRE",
    trust: "CONFIANCE",
    relief: "SOULAGEMENT",
    curiosity: "CURIOSITÉ",
    interest: "INTÉRÊT",
    fear: "PEUR",
    anxiety: "ANXIÉTÉ",
    joy: "JOIE",
    calm: "CALME",
    hope: "ESPOIR",
    gratitude: "GRATITUDE",
    love: "AFFECTION",
    pride: "FIERTÉ",
    anger: "COLÈRE",
    contempt: "MÉPRIS",
    disgust: "DÉGOÛT",
    sadness: "TRISTESSE",
    grief: "CHAGRIN",
    shame: "HONTE",
    guilt: "CULPABILITÉ",
    surprise: "SURPRISE",
    anticipation: "ATTENTE",
    offline: "HORS LIGNE"
};

export function emotionLabel(emotion) {
    const key = String(emotion || "neutral").toLowerCase();
    return EMOTION_LABELS[key] || key.toUpperCase();
}

export function mapLabel(mapId) {
    if (!mapId) {
        return "Inconnu";
    }
    return MAP_LABELS[mapId] || (mapId.startsWith("house") ? "Maison" : mapId);
}
