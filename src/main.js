import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PlayerController } from "./player/PlayerController";
import { LiDARSystem } from "./scanner/LiDARSystem";
import { InteractionManager } from "./interaction/InteractionManager";
const hud = document.getElementById("hud");
const overlay = document.getElementById("overlay");
const interactionUI = document.getElementById("interactionBox");
const modeTag = document.getElementById("modeTag");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 500);
// 灯光收集（便于 LiDAR 模式统一关闭）
const lights = [];
const hemi = new THREE.HemisphereLight(0xffffff, 0x334455, 0.9);
scene.add(hemi);
lights.push(hemi);
const dl = new THREE.DirectionalLight(0xffffff, 1.1);
dl.position.set(40, 70, 25);
scene.add(dl);
lights.push(dl);
const worldRoots = [];
const player = new PlayerController(camera, worldRoots);
const interactions = new InteractionManager(player, interactionUI, scene);
interactions.addTrigger({
    id: "door1",
    position: new THREE.Vector3(111.27, 39.22, -87.16),
    size: new THREE.Vector3(2, 2, 2),
    label: "设施大门",
    onInteract: () => console.log("你打开了设施大门!"),
});
const lidar = new LiDARSystem({
    scene,
    player,
    worldRoots,
    manual: true,
    fade: true,
    pointLifetime: 10,
    pointSize: 0.05,
    baseColor: 0x55ff99,
    minIntensity: 1,
});
let lidarMode = true; // 默认启动 LiDAR，可按 L 切换回 NORMAL（开灯）
let worldReady = false;
// LiDAR 模式隐藏场景材质：不写颜色不写深度，视觉上彻底黑暗
const lidarStealthMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
lidarStealthMaterial.colorWrite = false; // 强制关闭颜色写入
lidarStealthMaterial.depthWrite = false;
function applyLidarVisual(on) {
    // 灯光显示/隐藏
    lights.forEach((l) => (l.visible = !on));
    // 网格材质切换
    for (const root of worldRoots) {
        root.traverse((o) => {
            if (o.isMesh) {
                const mesh = o;
                if (on) {
                    if (!mesh.userData.__origMat)
                        mesh.userData.__origMat = mesh.material;
                    mesh.material = lidarStealthMaterial;
                }
                else if (mesh.userData.__origMat) {
                    mesh.material = mesh.userData.__origMat;
                }
            }
        });
    }
}
function toggleLidar() {
    lidarMode = !lidarMode;
    lidar.setEnabled(lidarMode);
    applyLidarVisual(lidarMode);
    modeTag.textContent = lidarMode
        ? "MODE: LIDAR (L 普通)"
        : "MODE: NORMAL (L LiDAR)";
}
// 立即应用默认 LiDAR 状态（模型加载后会再次遍历材质）
lidar.setEnabled(true);
applyLidarVisual(true);
modeTag.textContent = "MODE: LIDAR (L 普通)";
document.addEventListener("keydown", (e) => {
    if (e.code === "KeyL" && worldReady)
        toggleLidar();
    if (e.code === "KeyC" && lidarMode)
        lidar.clear();
});
document.addEventListener("mousedown", (e) => {
    if (e.button === 0 && lidarMode && worldReady) {
        // 0.5 秒内从上到下逐行扫描并显示红色激光线
        lidar.startVerticalSweep(90, 60, 0.5);
    }
});
overlay.textContent = "加载场景中...";
new GLTFLoader().load("./scene.gltf", (gltf) => {
    const root = gltf.scene;
    root.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = false;
            o.receiveShadow = false;
        }
    });
    scene.add(root);
    worldRoots.push(root);
    lidar.rebuild();
    // 收集碰撞网格并传给玩家控制器（只做一次）
    const collisionMeshes = [];
    root.traverse((o) => {
        if (o.isMesh)
            collisionMeshes.push(o);
    });
    player.setCollisionMeshes(collisionMeshes);
    const box = new THREE.Box3().setFromObject(root);
    if (!box.isEmpty()) {
        const size = box.getSize(new THREE.Vector3());
        const largest = Math.max(size.x, size.y, size.z);
        if (largest < 40) {
            const scale = 40 / largest;
            root.scale.setScalar(scale);
            box.setFromObject(root);
        }
        const center = box.getCenter(new THREE.Vector3());
        player.position.set(0, 0, 0);
        camera.position.copy(player.position);
    }
    worldReady = true;
    overlay.textContent = "点击开始 / 锁定鼠标";
});
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
overlay.addEventListener("click", () => {
    if (!worldReady)
        return;
    overlay.style.display = "none";
    player.requestPointerLock();
});
let last = performance.now();
// 坐标 HUD（永久显示）
let coordHud = document.getElementById("coord-hud");
if (!coordHud) {
    coordHud = document.createElement("div");
    coordHud.id = "coord-hud";
    Object.assign(coordHud.style, {
        position: "fixed",
        top: "6px",
        left: "8px",
        padding: "4px 6px",
        font: "12px/1.2 monospace",
        color: "#00ffc8",
        background: "rgba(0,0,0,0.4)",
        borderRadius: "4px",
        zIndex: "9999",
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "pre",
    });
    document.body.appendChild(coordHud);
}
function loop() {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    if (worldReady)
        player.update(dt);
    interactions.update(dt);
    if (lidarMode)
        lidar.update(dt);
    hud.textContent = `FPS: ${(1 / dt).toFixed(0)}`;
    // 坐标更新（使用玩家位置或摄像机位置）
    const p = player.position || camera.position;
    coordHud.textContent = `X: ${p.x.toFixed(2)}\nY: ${p.y.toFixed(2)}\nZ: ${p.z.toFixed(2)}\nMODE: ${lidarMode ? "LiDAR" : "Normal"}`;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
}
loop();
