// Name tag shown above every player, readable on a small phone screen.
export const NICKNAME_STYLE = {
    fontFamily: "\"Press Start 2P\", monospace",
    fontSize: "8px",
    color: "#ffffff",
    backgroundColor: "rgba(15, 16, 32, 0.7)",
    padding: { x: 3, y: 2 },
    resolution: 2
};

export const OTHER_PLAYER_NICKNAME_STYLE = {
    ...NICKNAME_STYLE,
    color: "#ffe066"
};
