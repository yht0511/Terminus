/**
 * 音乐播放管理
 */

export class SoundManager{
    constructor() {
        this.bgm = document.getElementById("bgm");
        this.soundEffect = document.getElementById("soundEffect");
    }
    /**
     * 设置BGM
     * @param {string} src 
     */
    setBGM(src) {
        this.bgm.src = src;
    }
    /**
     * 设置音效
     * @param {string} src 
     */
    setSoundEffect(src) {
        this.soundEffect.src = src;
    }

    setBGMVolume(volume) {
        this.bgm.volume = volume;
    }
    setSoundEffectVolume(volume) {
        this.soundEffect.volume = volume;
    }

    playBGM() {
        this.bgm.play()
            .catch((err) => {
                console.warn("播放BGM时出现问题：",err);
            });
    }
    pauseBGM() {
        this.bgm.pause();
    }

    playSoundEffect() {
        this.soundEffect.play()
            .catch((err) => {
                console.warn("播放音效时出现问题：",err);
            });
    }
    pauseSoundEffect() {
        this.soundEffect.pause();
    }
}

window.SoundManager = SoundManager;