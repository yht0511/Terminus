export default class gate {
  constructor(id) {
    this.id = id;
    this.up_id = id + "_up";
    this.down_id = id + "_down";
    this._up = window.core.getEntity(this.up_id);
    this._down = window.core.getEntity(this.down_id);
    this.toggle_time = 0;
  }

  activate() {
    if (this._down.activated == true) {
      this.status = "down";
      this.down();
      return;
    }
    this.status = "up";
    this.up();
  }

  up() {
    if (this._down.properties.activated) {
      window.core.scene.remove(this.down_id);
      this._down.properties.activated = false;
    }
    window.core.scene.load(this.up_id);
    this._up.properties.activated = true;
    this.status = "up";
  }

  down() {
    if (this._up.properties.activated) {
      window.core.scene.remove(this.up_id);
      this._up.properties.activated = false;
    }
    this._down.properties.activated = true;
    window.core.scene.load(this.down_id);
    this.status = "down";
  }

  toggle() {
    if (this.status == "up") this.down();
    else this.up();
    if (new Date().getTime() - this.toggle_time < 3000) {
      window.achievementSystem.trigger("idiot");
    }
    this.toggle_time = new Date().getTime();
  }
}
