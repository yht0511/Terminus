export class InteractionManager {
    player;
    ui;
    scene;
    triggers = [];
    current;
    constructor(player, ui, scene) {
        this.player = player;
        this.ui = ui;
        this.scene = scene;
        document.addEventListener("keydown", (e) => {
            if (e.code === "KeyE" && this.current) {
                this.current.onInteract();
            }
        });
    }
    addTrigger(t) {
        this.triggers.push(t);
    }
    update(dt) {
        const p = this.player.position;
        this.current = undefined;
        for (const t of this.triggers) {
            const min = t.position.clone().sub(t.size.clone().multiplyScalar(0.5));
            const max = t.position.clone().add(t.size.clone().multiplyScalar(0.5));
            if (p.x >= min.x &&
                p.x <= max.x &&
                p.y >= min.y &&
                p.y <= max.y &&
                p.z >= min.z &&
                p.z <= max.z) {
                this.current = t;
                break;
            }
        }
        if (this.current) {
            this.ui.style.display = "block";
            this.ui.textContent = `按 E 交互: ${this.current.label}`;
        }
        else {
            this.ui.style.display = "none";
        }
    }
}
