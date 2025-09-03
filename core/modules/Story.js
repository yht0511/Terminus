/**
 * 根据各种信息更新故事走向
 * 包括情节推进判断和文字音乐播报
 * 也可以写成就之类的
 */

import * as THREE from "three";

export class StoryTeller{
    constructor(core) {
        this.core = core;
        this.distancePass = 5; //若使用距离检测，检测距离范围。
        this.initialPoint = new THREE.Vector3(0,0,0);
        this.keyHelpPoint = new THREE.Vector3(7.62,-1.09,-0.09);
        this.playerPosition = new THREE.Vector3(-1,-1,-1);
    }
    /**
     * 主更新
     */
    updateAll() {
        this.updatePlayerPosition();
        this.update_initial();
        this.update_keyhelp(1);
    }
    updatePlayerPosition() {
        const pos = this.core.scene.player.getPosition();
        this.playerPosition.set(pos.x, pos.y, pos.z);
    }
    /**
     * 判定是否是新游戏
     * @param {number} distance 自定义距离
     */
    update_initial(distance = null) {
        distance = distance ? distance : this.distancePass;
        if(this.playerPosition.distanceTo(this.initialPoint)<distance
            && this.core.script.storyStatus.initial_staged == 0) {

            this.core.script.storyStatus.initial_staged = 1;
            console.log("剧情推进：新的开始");
            const text = window.lyric['initial'];
            window.speaker.speak(text.text, text.duration);
        }
    }
    /**
     * 判定键位帮助的逻辑
     * @param {number} distance 自定义距离
     */
    update_keyhelp(distance = null) {
        distance = distance ? distance : this.distancePass;
        if(this.playerPosition.distanceTo(this.keyHelpPoint)<distance
            && this.core.script.storyStatus.keyhelp_staged == 0) {

            this.core.script.storyStatus.keyHelp_staged=1;
            console.log("剧情推进：键位帮助");
            const text = window.lyric['keyhelp'];
            window.speaker.speak(text.text, text.duration);
        }
    }
}