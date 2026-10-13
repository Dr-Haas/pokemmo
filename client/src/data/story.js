// The adventure, Rouge Feu style: the Professor's lab, the rival, trainers on the
// way north, Pierre's gym in Argenta, and the Poké Marts.
// Positions are in tiles (32 px). Inside special buildings (the "hall" room) the
// walkable floor is x 1-8, y 2-8, and the way out is at the bottom (x 4-5).

export const RIVAL_NAME = "Régis";
export const PROFESSOR_NAME = "Prof. Chen";

export const STARTERS = [
    { id: 1, label: "Bulbizarre", kind: "Plante", ball: { x: 5, y: 3 } },
    { id: 4, label: "Salamèche", kind: "Feu", ball: { x: 6, y: 3 } },
    { id: 7, label: "Carapuce", kind: "Eau", ball: { x: 7, y: 3 } }
];

// The rival takes the starter that beats yours.
export const RIVAL_STARTER = { 1: 4, 4: 7, 7: 1 };

// Buildings drawn as a special room instead of a house, by outdoor map and door tile.
export const SPECIAL_INTERIORS = {
    "town@21@15": "lab",
    "viridian@6@5": "gym-closed",
    "viridian@24@13": "mart",
    "pewter@28@7": "gym",
    "pewter@30@17": "mart",
    "pewter@10@8": "museum"
};

export const SHOPS = {
    viridian: ["poke-ball", "potion", "antidote", "paralyze-heal"],
    pewter: ["poke-ball", "potion", "super-potion", "antidote", "burn-heal", "awakening"]
};

export const PRICES = {
    "poke-ball": 200,
    "great-ball": 600,
    potion: 300,
    "super-potion": 700,
    antidote: 100,
    "paralyze-heal": 200,
    "burn-heal": 250,
    awakening: 250
};

/*
 * Trainers. "sight" is the zone (in tiles) where they spot the player and come to battle;
 * without one, the player talks to them (A) to battle.
 */
export const TRAINERS = [
    {
        id: "route1_gamin",
        map: "route1",
        name: "Gamin Théo",
        sprite: "knight",
        tile: { x: 15, y: 18 },
        facing: "left",
        sight: { x: 6, y: 18, w: 9, h: 2 },
        party: [{ id: 19, level: 4 }],
        prize: 64,
        intro: ["Hé ! Tu as un Pokémon ?", "Alors on se bat !"],
        defeatText: "Mon Rattata n'était pas prêt...",
        after: ["Mon Rattata va s'entraîner dans les hautes herbes."]
    },
    {
        id: "route2_fillette",
        map: "route2",
        name: "Fillette Léa",
        sprite: "girl1",
        tile: { x: 15, y: 22 },
        facing: "left",
        sight: { x: 9, y: 22, w: 6, h: 2 },
        party: [{ id: 16, level: 4 }, { id: 19, level: 4 }],
        prize: 64,
        intro: ["Tu vas vers la Forêt de Jade ?", "Montre-moi d'abord ce que tu vaux !"],
        defeatText: "Oh non, tu es trop fort !",
        after: ["Dans la forêt, il y a plein de Scouts.", "Ils adorent les Pokémon Insecte."]
    },
    {
        id: "forest_scout1",
        map: "viridian_forest",
        name: "Scout Rémi",
        sprite: "ninja",
        tile: { x: 16, y: 40 },
        facing: "left",
        sight: { x: 6, y: 40, w: 10, h: 2 },
        party: [{ id: 10, level: 6 }, { id: 13, level: 6 }],
        prize: 96,
        intro: ["Hé ! Tu entres dans MA forêt !", "Mes Pokémon Insecte vont te piquer !"],
        defeatText: "Mes insectes sont tout étourdis...",
        after: ["Chenipan évolue vite, tu sais."]
    },
    {
        id: "forest_scout2",
        map: "viridian_forest",
        name: "Scout Hugo",
        sprite: "ninja",
        tile: { x: 12, y: 30 },
        facing: "front",
        sight: { x: 10, y: 31, w: 6, h: 3 },
        party: [{ id: 13, level: 7 }, { id: 14, level: 7 }, { id: 13, level: 7 }],
        prize: 112,
        intro: ["Je collectionne les Aspicot !", "Tu veux voir ma collection ?"],
        defeatText: "Ma collection... battue !",
        after: ["Un jour, j'aurai un Dardargnan."]
    },
    {
        id: "forest_scout3",
        map: "viridian_forest",
        name: "Scout Sam",
        sprite: "ninja",
        tile: { x: 30, y: 16 },
        facing: "left",
        sight: { x: 18, y: 16, w: 12, h: 2 },
        party: [{ id: 13, level: 9 }],
        prize: 144,
        intro: ["Mon Aspicot est le plus fort de la forêt !"],
        defeatText: "Le plus fort... vraiment ?",
        after: ["La sortie vers Argenta est au nord-est."]
    },
    {
        id: "forest_scout4",
        map: "viridian_forest",
        name: "Scout Noé",
        sprite: "ninja",
        tile: { x: 36, y: 6 },
        facing: "left",
        sight: { x: 26, y: 6, w: 10, h: 2 },
        party: [{ id: 10, level: 7 }, { id: 10, level: 8 }],
        prize: 128,
        intro: ["Tu as presque traversé la forêt !", "Mais il faut d'abord me battre !"],
        defeatText: "Bon, d'accord, tu peux passer.",
        after: ["À Argenta, Pierre utilise des Pokémon Roche.", "Les attaques Plante et Eau marchent bien !"]
    },
    {
        id: "pewter_campeur",
        map: "house@pewter@28@7",
        name: "Campeur Liam",
        sprite: "teamxerogrunt1",
        tile: { x: 6, y: 5 },
        facing: "left",
        sight: { x: 2, y: 5, w: 4, h: 1 },
        party: [{ id: 74, level: 10 }, { id: 27, level: 11 }],
        prize: 220,
        intro: ["Halte ! Tu es à des années-lumière", "de pouvoir défier Pierre !"],
        defeatText: "Des années-lumière... ce n'est pas une durée, c'est une distance !",
        after: ["Va, Pierre t'attend au fond."]
    },
    {
        id: "pewter_pierre",
        map: "house@pewter@28@7",
        name: "Pierre",
        title: "Champion d'Argenta",
        sprite: "omnichannelceo",
        tile: { x: 4, y: 2 },
        facing: "front",
        leader: true,
        badge: 1,
        party: [{ id: 74, level: 12 }, { id: 95, level: 14 }],
        prize: 1400,
        intro: [
            "Alors, tu es venu ici !",
            "Je suis Pierre, le Champion d'Argenta.",
            "Ma confiance en mes Pokémon Roche est aussi solide qu'un roc !",
            "Montre-moi ce que tu as dans le ventre !"
        ],
        defeatText: "Je t'ai sous-estimé...",
        reward: [
            "Voici le Badge Roche, la preuve de ta victoire.",
            "Les Pokémon jusqu'au niveau 20 t'obéiront sans faute.",
            "Bonne route ! La suite de l'aventure t'attend vers l'est."
        ],
        after: ["Le monde est vaste.", "Continue de t'entraîner, et reviens me voir !"]
    }
];

/* Other characters: what they say, by building or map. */
export const PEOPLE = [
    {
        id: "viridian_gym_guard",
        map: "house@viridian@6@5",
        name: "Gardien",
        sprite: "boss",
        tile: { x: 4, y: 3 },
        facing: "front",
        lines: ["L'Arène de Jadielle est fermée.", "Son Champion est absent depuis longtemps...", "Personne ne sait où il est parti."]
    },
    {
        id: "museum_guide",
        map: "house@pewter@10@8",
        name: "Guide",
        sprite: "femaletrainer",
        tile: { x: 7, y: 5 },
        facing: "left",
        lines: [
            "Bienvenue au Musée des Sciences d'Argenta !",
            "Ici, les fossiles de Pokémon disparus : Amonita, Kabuto et Ptéra.",
            "On dit qu'au Mont Sélénite, à l'est, on en trouve encore."
        ]
    }
];
