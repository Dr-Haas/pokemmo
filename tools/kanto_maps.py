"""Builds the Kanto maps (Bourg Palette -> Argenta) from the Tuxemon tileset.

    python3 tools/kanto_maps.py

Each map is drawn as ASCII art where one character is a 2x2 block of tiles,
then buildings, signs and warps are placed on top (in tile coordinates).
Writes Tiled JSON files to client/src/assets/tilemaps/.

Block legend:
    T tree      . grass      # path      , tall grass (wild Pokemon)
    ~ water     r red flowers   y yellow flowers   b blue flowers
"""
import copy
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
MAPS_DIR = os.path.join(ROOT, "client", "src", "assets", "tilemaps")
TILE = 32

GRASS, SAND, TALL_GRASS, WATER = 126, 174, 122, 253
FLOWERS = {"r": 32, "y": 200, "b": 128}
TREE = ((169, 170), (193, 194))
SIGN, POST = 355, 356

# Sand/grass borders, chosen from which of a cell's 4 corners touch a path cell.
PATH_EDGES = {
    (0, 0, 0, 0): GRASS, (1, 1, 1, 1): SAND,
    (0, 0, 1, 1): 150, (1, 1, 0, 0): 198, (0, 1, 0, 1): 173, (1, 0, 1, 0): 175,
    (0, 0, 0, 1): 149, (0, 0, 1, 0): 151, (0, 1, 0, 0): 197, (1, 0, 0, 0): 199,
    (1, 1, 1, 0): 171, (1, 1, 0, 1): 172, (1, 0, 1, 1): 195, (0, 1, 1, 1): 196,
    (1, 0, 0, 1): SAND, (0, 1, 1, 0): SAND,
}

# Buildings: a roof row drawn above the player, then three solid rows.
# "door" is the door's column; houses open automatically (HouseInteriorManager),
# the Pokemon Center uses a warp to its own interior.
BUILDINGS = {
    "house": {"roof": [588, 589, 590, 591, 592],
              "rows": [[612, 613, 614, 615, 616], [636, 637, 638, 639, 640], [660, 661, 662, 663, 664]], "door": 3},
    "brick": {"roof": [582, 583, 584, 585, 586, 587],
              "rows": [[606, 607, 608, 609, 610, 611], [630, 631, 632, 633, 634, 635], [654, 655, 656, 657, 658, 659]], "door": 4},
    "lab": {"roof": [471, 472, 473, 474, 475, 479, 480],
            "rows": [[495, 496, 497, 498, 499, 503, 504], [519, 520, 521, 522, 523, 527, 528], [543, 544, 545, 546, 547, 551, 552]], "door": 5},
    "gym": {"roof": [370, 371, 372, 373, 374],
            "rows": [[394, 395, 396, 397, 398], [418, 419, 420, 421, 422], [442, 443, 444, 445, 446]], "door": 2},
    "center": {"roof": [375, 376, 377, 378, 379],
               "rows": [[399, 400, 401, 402, 403], [423, 424, 425, 426, 427], [447, 448, 449, 450, 451]], "door": 2},
    "mart": {"roof": [380, 381, 382, 383, 384],
             "rows": [[404, 405, 406, 407, 408], [428, 429, 430, 431, 432], [452, 453, 454, 455, 456]], "door": 2},
    # Big glass building (the Musee d'Argenta): no separate roof row.
    "museum": {"roof": None,
               "rows": [[409 + i for i in range(9)], [433 + i for i in range(9)], [457 + i for i in range(9)],
                        [481 + i for i in range(9)], [505 + i for i in range(9)], [529 + i for i in range(9)],
                        [553 + i for i in range(9)]], "door": 4},
}


class Map:
    def __init__(self, name, ascii_rows):
        rows = [row.strip() for row in ascii_rows.splitlines() if row.strip()]
        self.name = name
        self.bw, self.bh = len(rows[0]), len(rows)
        bad = [(n, row) for n, row in enumerate(rows) if len(row) != self.bw]
        assert not bad, f"{name}: rows of the wrong width {bad}"
        self.w, self.h = self.bw * 2, self.bh * 2
        size = self.w * self.h
        self.below, self.grass, self.world, self.above = [GRASS] * size, [0] * size, [0] * size, [0] * size
        self.path = [[False] * self.w for _ in range(self.h)]
        self.spawns, self.warps = [], []

        for by, row in enumerate(rows):
            for bx, ch in enumerate(row):
                for dy in range(2):
                    for dx in range(2):
                        self.paint_block_cell(ch, bx * 2 + dx, by * 2 + dy, dx, dy)

    def i(self, x, y):
        return y * self.w + x

    def paint_block_cell(self, ch, x, y, dx, dy):
        if ch == "T":
            self.world[self.i(x, y)] = TREE[dy][dx]
        elif ch == "#":
            self.path[y][x] = True
        elif ch == ",":
            self.grass[self.i(x, y)] = TALL_GRASS
        elif ch == "~":
            self.below[self.i(x, y)] = WATER
        elif ch in FLOWERS:
            self.below[self.i(x, y)] = FLOWERS[ch]
        elif ch != ".":
            raise ValueError(f"{self.name}: unknown block {ch!r}")

    def path_rect(self, x0, y0, x1, y1):
        """Extra path, in tiles (inclusive), e.g. to reach a door."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.path[y][x] = True

    def door_path(self, door):
        """Path from a door down to the nearest path below it."""
        dx, dy = door
        y = dy + 1
        while y < self.h and not (self.path[y][dx] or self.path[y][dx + 1]):
            self.path_rect(dx, y, dx + 1, y)
            y += 1
            assert y - dy < 8, f"{self.name}: no path below the door at {door}"
        self.path_rect(dx, dy + 1, dx + 1, dy + 1)

    def building(self, kind, x, y):
        """Places a building with its roof row at tile (x, y); returns its door tile."""
        spec = BUILDINGS[kind]
        top = y
        if spec["roof"]:
            for dx, gid in enumerate(spec["roof"]):
                self.above[self.i(x + dx, y)] = gid
            top = y + 1
        for dy, row in enumerate(spec["rows"]):
            for dx, gid in enumerate(row):
                assert self.world[self.i(x + dx, top + dy)] == 0, f"{self.name}: {kind} at {x},{y} overlaps"
                self.world[self.i(x + dx, top + dy)] = gid
        door = (x + spec["door"], top + len(spec["rows"]) - 1)
        return door

    def sign(self, x, y, gid=SIGN):
        self.world[self.i(x, y)] = gid

    def spawn(self, name, x, y):
        self.spawns.append((name, x, y))

    def warp(self, target, spawn_point, x, y, width, height, facing):
        self.warps.append((target, spawn_point, x, y, width, height, facing))

    # Map edges -----------------------------------------------------------
    def exit_north(self, target, spawn_point, tile_x, tiles=4):
        self.warp(target, spawn_point, tile_x * TILE, 0, tiles * TILE, 64, "back")

    def exit_south(self, target, spawn_point, tile_x, tiles=4):
        self.warp(target, spawn_point, tile_x * TILE, (self.h - 1) * TILE, tiles * TILE, TILE, "front")

    def arrive_north(self, name, tile_x, tiles=4):
        self.spawn(name, tile_x * TILE + tiles * TILE // 2, 126)

    def arrive_south(self, name, tile_x, tiles=4):
        self.spawn(name, tile_x * TILE + tiles * TILE // 2, (self.h - 3) * TILE - 2)

    def center_door(self, door, interior):
        """Warp into the Pokemon Center, and the spot outside where players come back."""
        # Same zone as house doors: just below the door, where the player's feet are.
        dx, dy = door
        self.warp(interior, "from-exterior", (dx - 1) * TILE, (dy + 1) * TILE, 3 * TILE, 44, "back")
        self.spawn("from-pokemon-center", dx * TILE + 16, (dy + 1) * TILE + 20)

    # Output ----------------------------------------------------------------
    def autotile_paths(self):
        def is_path(x, y):
            return 0 <= x < self.w and 0 <= y < self.h and self.path[y][x]

        def corner(vx, vy):
            return int(any(is_path(vx - dx, vy - dy) for dx in (0, 1) for dy in (0, 1)))

        for y in range(self.h):
            for x in range(self.w):
                if self.below[self.i(x, y)] != GRASS:
                    continue
                key = (corner(x, y), corner(x + 1, y), corner(x, y + 1), corner(x + 1, y + 1))
                self.below[self.i(x, y)] = PATH_EDGES[key]

    def to_tiled(self, tileset, encounter_rate):
        self.autotile_paths()
        # The game falls back to "Spawn Point" (e.g. a saved position stuck in a wall).
        if not any(name == "Spawn Point" for name, _, _ in self.spawns):
            _, x, y = self.spawns[0]
            self.spawns.insert(0, ("Spawn Point", x, y))
        next_id = iter(range(1, 10000))

        def tile_layer(layer_id, name, data, properties=None):
            layer = {"data": data, "height": self.h, "id": layer_id, "name": name, "opacity": 1,
                     "type": "tilelayer", "visible": True, "width": self.w, "x": 0, "y": 0}
            if properties:
                layer["properties"] = properties
            return layer

        def object_layer(layer_id, name, objects):
            return {"draworder": "topdown", "id": layer_id, "name": name, "objects": objects,
                    "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0}

        spawns = [{"height": 0, "id": next(next_id), "name": name, "point": True, "rotation": 0, "type": "",
                   "visible": True, "width": 0, "x": x, "y": y} for name, x, y in self.spawns]
        warps = [{"height": h, "id": next(next_id), "name": target, "rotation": 0, "type": "", "visible": True,
                  "width": w, "x": x, "y": y,
                  "properties": [{"name": "playerTexturePosition", "type": "string", "value": facing},
                                 {"name": "spawnPoint", "type": "string", "value": spawn_point}]}
                 for target, spawn_point, x, y, w, h, facing in self.warps]

        return {
            "compressionlevel": -1, "height": self.h, "infinite": False,
            "layers": [
                tile_layer(1, "Below Player", self.below),
                tile_layer(2, "Grass", self.grass, [
                    {"name": "isTallGrass", "type": "bool", "value": True},
                    {"name": "encounterRate", "type": "float", "value": encounter_rate}]),
                tile_layer(3, "World", self.world),
                tile_layer(4, "Above Player", self.above),
                object_layer(5, "SpawnPoints", spawns),
                object_layer(6, "Doors", []),
                object_layer(7, "Worlds", warps),
                object_layer(8, "IndoorZones", []),
            ],
            "nextlayerid": 9, "nextobjectid": next(next_id), "orientation": "orthogonal",
            "renderorder": "right-down", "tiledversion": "1.10.2", "tileheight": TILE,
            "tilesets": [tileset], "tilewidth": TILE, "type": "map", "version": "1.10", "width": self.w,
        }


def load_tileset():
    """The tileset embedded in the existing maps, with water made solid."""
    with open(os.path.join(MAPS_DIR, "house.json")) as f:
        tileset = copy.deepcopy(json.load(f)["tilesets"][0])
    solid = {gid - 1 for gid in range(249, 257)}
    for tile in tileset["tiles"]:
        if tile["id"] in solid:
            for prop in tile.get("properties", []):
                if prop["name"] == "collides":
                    prop["value"] = True
    return tileset


# ---------------------------------------------------------------------------
# Bourg Palette: the player's house, the rival's house, the Professor's lab.
def pallet_town():
    m = Map("town", """
        TTTTTT##TTTTTT
        TT....##....TT
        TT..........TT
        TT..........TT
        TT..########TT
        TT.....##...TT
        TT.....##...TT
        TT.....##...TT
        TTrr...######T
        TTyyrr.##...TT
        TTrryy.##...TT
        TT~~~~~~~~~~TT
        TT~~~~~~~~~~TT
    """)
    home = m.building("house", 5, 4)
    rival = m.building("house", 17, 4)
    lab = m.building("lab", 16, 12)
    m.door_path(home)
    m.door_path(rival)
    m.door_path(lab)
    m.sign(11, 11)          # BOURG PALETTE
    m.sign(14, 15, POST)    # LABO DU PROF. CHEN
    m.spawn("Spawn Point", home[0] * TILE + 16, (home[1] + 1) * TILE + 20)
    m.arrive_north("from-route1", 12)
    m.exit_north("route1", "from-town", 12)
    return m


def route_1():
    m = Map("route1", """
        TTTTT##TTTTT
        TT,,,##...TT
        TT,,,##.r.TT
        TT...##...TT
        TT...#####TT
        TT,,,,..##TT
        TT,,,,..##TT
        TT......##TT
        TT.######.TT
        TT.##..,,,TT
        TT.##..,,,TT
        TT.##..,,,TT
        TT.####...TT
        TT...##...TT
        TTy..##,,,TT
        TT,,,##,,,TT
        TT,,,##,,,TT
        TT...##...TT
        TT..###.y.TT
        TT..##....TT
        TT..##,,,.TT
        TTTT##TTTTTT
    """)
    m.sign(13, 6)
    m.arrive_north("from-viridian", 10)
    m.exit_north("viridian", "from-route1", 10)
    m.arrive_south("from-town", 8)
    m.exit_south("town", "from-route1", 8)
    return m


def viridian_city():
    m = Map("viridian", """
        TTTTTTTTT##TTTTTTTTT
        TT.......##.......TT
        TT.......##.......TT
        TT.......##.......TT
        TT.##############.TT
        TT..#....##.......TT
        TT..#....##.......TT
        TT..#....##.......TT
        TT..#....##.......TT
        TT~~#############.TT
        TT~~.....##....#..TT
        TT~~.....##....#..TT
        TT~~.....##....#..TT
        TT~~r....##....#..TT
        TT..############..TT
        TT.ry....##.......TT
        TT.......##..yr...TT
        TTTTTTTTT##TTTTTTTTT
    """)
    gym = m.building("gym", 4, 2)
    m.door_path(gym)
    house_a = m.building("brick", 26, 2)
    m.door_path(house_a)
    center = m.building("center", 12, 10)
    m.door_path(center)
    mart = m.building("mart", 22, 10)
    m.door_path(mart)
    house_b = m.building("house", 12, 22)
    m.door_path(house_b)
    house_c = m.building("house", 24, 22)
    m.door_path(house_c)
    m.sign(16, 32)          # JADIELLE
    m.sign(9, 5, POST)      # ARENE DE JADIELLE
    m.center_door(center, "pokemon_center_viridian")
    m.arrive_south("from-route1", 18)
    m.exit_south("route1", "from-viridian", 18)
    m.arrive_north("from-route2", 18)
    m.exit_north("route2", "from-viridian", 18)
    return m


def route_2():
    m = Map("route2", """
        TTTTT##TTTTT
        TT...##...TT
        TT,,,##,,,TT
        TT,,,##,,,TT
        TT...##...TT
        TT...######T
        TT.....,,##T
        TT.....,,##T
        TT,,...,,##T
        TT,,...,,##T
        TT,,.######T
        TT...##....T
        TT...##.,,.T
        TT.y.##.,,.T
        TT...##....T
        TT,,,##..r.T
        TT,,,##....T
        TT...##....T
        TT...##....T
        TTTTT##TTTTT
    """)
    m.sign(8, 3)
    m.arrive_north("from-viridian_forest", 10)
    m.exit_north("viridian_forest", "from-route2", 10)
    m.arrive_south("from-viridian", 10)
    m.exit_south("viridian", "from-route2", 10)
    return m


def viridian_forest():
    m = Map("viridian_forest", """
        TTTTTTTTTTTTTTT##TTT
        T,,,,,,TTTT,,,,##,,T
        T,,,,,,TTTT,,,,##,,T
        T,,######TT,,######T
        T,,#,,,,#TT,,#,,,,,T
        T,,#,,,,#TT,,#,,,,,T
        T,,#,,,,#TT,,#,,TTTT
        T,,#,,TT#TT,,#,,TTTT
        T,,#,,TT##########,T
        T,,#,,TTTTTTTTT,,#,T
        T,,#,,,,,,,,TTT,,#,T
        T,,#########TTT,,#,T
        T,,,,,,,,,,#TTT,,#,T
        TTTTTTT,,,,#TTT,,#,T
        TTTTTTT,,,,#######,T
        T,,,,,,,,,,,,,,,,,,T
        T,,######,,,,,TTTTTT
        T,,#TTTT#,,,,,TTTTTT
        T,,#TTTT##########,T
        T,,#TTTT,,,,,,,,,#,T
        T,,#########,,,,,#,T
        T,,,,,,,,,,#,,,,,#,T
        T,,,,,,,,,,#,,,,,#,T
        TTTTTTTTTTT##TTTTTTT
    """)
    m.arrive_south("from-route2", 22)
    m.exit_south("route2", "from-viridian_forest", 22)
    m.arrive_north("from-pewter", 30)
    m.exit_north("pewter", "from-viridian_forest", 30)
    return m


def pewter_city():
    m = Map("pewter", """
        TTTTTTTTTTTTTTTTTTTT
        TT................TT
        TT................TT
        TT................TT
        TT................TT
        TT################TT
        TT..#.......#.....TT
        TT..#.......#.....TT
        TT..#.......#.....TT
        TT..#.......#.....TT
        TT..##############TT
        TT..#.....#.......TT
        TT..#.....#.......TT
        TT..#.....#.......TT
        TTyr#.....#.....rbTT
        TTry##############TT
        TT............##..TT
        TTTTTTTTTTTTTT##TTTT
    """)
    museum = m.building("museum", 6, 2)
    m.door_path(museum)
    gym = m.building("gym", 26, 4)
    m.door_path(gym)
    center = m.building("center", 12, 14)
    m.door_path(center)
    mart = m.building("mart", 28, 14)
    m.door_path(mart)
    house_a = m.building("house", 6, 22)
    m.door_path(house_a)
    house_b = m.building("brick", 24, 22)
    m.door_path(house_b)
    m.sign(30, 9, POST)     # ARENE D'ARGENTA
    m.sign(26, 31)          # ARGENTA
    m.center_door(center, "pokemon_center_pewter")
    m.arrive_south("from-viridian_forest", 28)
    m.exit_south("viridian_forest", "from-pewter", 28)
    return m


ENCOUNTER_RATES = {"route1": 0.15, "route2": 0.15, "viridian_forest": 0.12}


def center_interior(town):
    """Same room for every Pokemon Center; only the way out changes."""
    with open(os.path.join(MAPS_DIR, "pokemon_center_viridian.json")) as f:
        room = json.load(f)
    for layer in room["layers"]:
        if layer["name"] == "Worlds":
            layer["objects"][0]["name"] = town
    return room


def hall_interior():
    """Empty room for the lab, gyms, marts and museum: same size and exit as a house,
    only the walls are solid (the game draws the decor and places the props)."""
    with open(os.path.join(MAPS_DIR, "house.json")) as f:
        room = json.load(f)
    width = room["width"]
    for layer in room["layers"]:
        if layer["name"] == "World":
            layer["data"] = [
                169 if (y < 2 or x in (0, width - 1)) else 0
                for y in range(room["height"]) for x in range(width)
            ]
    return room


def write(name, data):
    with open(os.path.join(MAPS_DIR, f"{name}.json"), "w") as f:
        json.dump(data, f, separators=(",", ":"))
        f.write("\n")


def main():
    tileset = load_tileset()
    maps = [pallet_town(), route_1(), viridian_city(), route_2(), viridian_forest(), pewter_city()]
    names = {m.name for m in maps}
    for m in maps:
        for target, *_ in m.warps:
            assert target in names or target.startswith("pokemon_center_"), f"{m.name}: unknown warp {target}"
        write(m.name, m.to_tiled(tileset, ENCOUNTER_RATES.get(m.name, 0.15)))
        print(f"{m.name}: {m.w}x{m.h}")
    for town in ("viridian", "pewter"):
        write(f"pokemon_center_{town}", center_interior(town))
    write("hall", hall_interior())


if __name__ == "__main__":
    main()
