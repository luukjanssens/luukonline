import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AsciiEffect } from "three/addons/effects/AsciiEffect.js";

export function AsciiRenderer({ online }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);

    // Lights
    const pointLight1 = new THREE.PointLight(0xffffff, 3, 0, 0);
    pointLight1.position.set(500, 500, 500);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, 1, 0, 0);
    pointLight2.position.set(-500, -500, -500);
    scene.add(pointLight2);

    // Object - tourus knot as placeholder
    const geometry = new THREE.TorusKnotGeometry(1.5, 0.4, 128, 16);
    const material = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 100 });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);

    // ASCII Effect
    const charSet = online === "online"
      ? " .:-+*=%@#"
      : " ░▒▓█";

    const effect = new AsciiEffect(renderer, charSet, { invert: true, resolution: 0.18 });
    effect.setSize(width, height);
    effect.domElement.style.color = online === "online" ? "#00ff88" : "#ff3333";
    effect.domElement.style.backgroundColor = "transparent";
    effect.domElement.style.fontFamily = "monospace";
    effect.domElement.style.fontSize = "10px";
    effect.domElement.style.lineHeight = "1";
    effect.domElement.style.letterSpacing = "0.05em";
    effect.domElement.style.userSelect = "none";
    container.appendChild(effect.domElement);

    // Controls
    const controls = new OrbitControls(camera, effect.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;

    // Animation
    let frameId;
    const clock = new THREE.Clock();

    function animate() {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      mesh.rotation.x = t * 0.3;
      mesh.rotation.y = t * 0.5;
      controls.update();
      effect.render(scene, camera);
    }
    animate();

    // Resize
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      effect.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      controls.dispose();
      effect.domElement.remove();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [online]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
