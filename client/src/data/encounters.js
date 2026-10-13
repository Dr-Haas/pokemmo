// Wild Pokémon in the tall grass, as in Kanto (Rouge Feu / Vert Feuille).
export const ROUTE_ENCOUNTERS = {
    route1: {
        encounterRate: 0.15,
        pokemonPool: [
            { pokemonId: 16, minLevel: 2, maxLevel: 5, weight: 50 },  // Roucool
            { pokemonId: 19, minLevel: 2, maxLevel: 4, weight: 50 }   // Rattata
        ]
    },
    route2: {
        encounterRate: 0.15,
        pokemonPool: [
            { pokemonId: 16, minLevel: 3, maxLevel: 5, weight: 35 },  // Roucool
            { pokemonId: 19, minLevel: 2, maxLevel: 5, weight: 35 },  // Rattata
            { pokemonId: 10, minLevel: 4, maxLevel: 5, weight: 15 },  // Chenipan
            { pokemonId: 13, minLevel: 4, maxLevel: 5, weight: 15 }   // Aspicot
        ]
    },
    viridian_forest: {
        encounterRate: 0.12,
        pokemonPool: [
            { pokemonId: 10, minLevel: 3, maxLevel: 5, weight: 30 },  // Chenipan
            { pokemonId: 13, minLevel: 3, maxLevel: 5, weight: 30 },  // Aspicot
            { pokemonId: 11, minLevel: 4, maxLevel: 6, weight: 15 },  // Chrysacier
            { pokemonId: 14, minLevel: 4, maxLevel: 6, weight: 15 },  // Coconfort
            { pokemonId: 25, minLevel: 3, maxLevel: 5, weight: 10 }   // Pikachu
        ]
    }
};
