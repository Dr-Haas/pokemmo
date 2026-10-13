// The Kanto region as shown on the Town Map (menu > Carte).
// Positions are in map grid cells; "map" is the playable map, if it exists yet.

export const KANTO_GRID = { columns: 22, rows: 16 };

export const KANTO_PLACES = [
    { id: "pallet", label: "Bourg Palette", x: 4, y: 12, kind: "city", map: "town",
      text: "Un petit bourg paisible au bord de la mer. C'est ici que commence ton aventure." },
    { id: "route1", label: "Route 1", x: 4, y: 10, kind: "route", map: "route1",
      text: "Un chemin herbeux entre Bourg Palette et Jadielle. Roucool et Rattata s'y cachent." },
    { id: "viridian", label: "Jadielle", x: 4, y: 8, kind: "city", map: "viridian",
      text: "Une ville verdoyante avec son Centre Pokémon, sa Boutique et une Arène." },
    { id: "route2", label: "Route 2", x: 4, y: 6.6, kind: "route", map: "route2",
      text: "La route qui monte vers le nord, jusqu'à l'entrée de la Forêt de Jade." },
    { id: "viridian_forest", label: "Forêt de Jade", x: 4, y: 5.3, kind: "area", map: "viridian_forest",
      text: "Une forêt dense et sombre, pleine de Pokémon Insecte. On dit qu'un Pikachu y vit." },
    { id: "pewter", label: "Argenta", x: 4, y: 4, kind: "city", map: "pewter",
      text: "Une ville de pierre grise, avec son Musée et l'Arène de Pierre." },

    { id: "cerulean", label: "Azuria", x: 14, y: 3, kind: "city" },
    { id: "saffron", label: "Safrania", x: 14, y: 7, kind: "city" },
    { id: "celadon", label: "Céladopole", x: 10, y: 7, kind: "city" },
    { id: "lavender", label: "Lavanville", x: 19, y: 7, kind: "city" },
    { id: "vermilion", label: "Carmin sur Mer", x: 14, y: 11, kind: "city" },
    { id: "fuchsia", label: "Parmanie", x: 11, y: 14, kind: "city" },
    { id: "cinnabar", label: "Cramois'Île", x: 4, y: 15, kind: "city" },
    { id: "indigo", label: "Plateau Indigo", x: 1.5, y: 2, kind: "city" }
];

// Roads between places, drawn as lines. A road is lit when both ends are playable.
export const KANTO_ROADS = [
    ["pallet", "viridian"], ["viridian", "pewter"],
    ["pewter", "cerulean"], ["cerulean", "saffron"], ["saffron", "vermilion"],
    ["celadon", "saffron"], ["saffron", "lavender"], ["cerulean", "lavender"],
    ["lavender", "vermilion", [19, 11]], ["lavender", "fuchsia", [19, 14]],
    ["celadon", "fuchsia", [10, 14]], ["fuchsia", "cinnabar", [7, 15]],
    ["pallet", "cinnabar"], ["viridian", "indigo", [1.5, 8]]
];

// Land masses as rectangles of grid cells (the rest is sea).
export const KANTO_LAND = [
    [1, 1, 20, 12],
    [8, 12, 13, 3],
    [17, 12, 3, 3],
    [3, 14, 2, 2]
];

export function placeForMap(mapName) {
    // Houses ("house@viridian@..."), Pokémon Centers ("pokemon_center_viridian") belong to their town.
    let name = String(mapName || "");
    if (name.startsWith("house@")) {
        name = name.split("@")[1];
    } else if (name.startsWith("pokemon_center_")) {
        name = name.slice("pokemon_center_".length);
    }
    return KANTO_PLACES.find((place) => place.map === name) || null;
}
