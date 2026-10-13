export const ENTITY_SIZE = {
    width: 32,
    height: 64,
    hitboxWidth: 32,
    hitboxHeight: 40,
    hitboxOffsetY: 24
};

// Character sprites come in different frame sizes: keep the same on-screen size and
// hitbox for all of them (the physics body is scaled along with the sprite).
export function applyEntitySize(sprite) {
    sprite.setDisplaySize(ENTITY_SIZE.width, ENTITY_SIZE.height);
    if (!sprite.body) {
        return;
    }
    const scaleX = Math.abs(sprite.scaleX) || 1;
    const scaleY = Math.abs(sprite.scaleY) || 1;
    sprite.body.setSize(ENTITY_SIZE.hitboxWidth / scaleX, ENTITY_SIZE.hitboxHeight / scaleY, false);
    sprite.body.setOffset(0, ENTITY_SIZE.hitboxOffsetY / scaleY);
}
