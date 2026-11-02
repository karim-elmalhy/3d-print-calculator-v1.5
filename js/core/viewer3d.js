/**
 * ELMALHY.3D Workshop Manager - Advanced 3D Engine & Viewer
 * محرك العرض ثلاثي الأبعاد المتطور بتقنية WebGL / Three.js
 * يدعم OrbitControls متكاملة، تشريح الطبقات، مجسمات STL الحقيقية، وإضاءة الاستوديو
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WorkshopViewer3D = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ألوان الفلمنت القياسية
  const FILAMENT_COLORS = {
    black: { name: 'أسود مطفي', hex: 0x1e293b, roughness: 0.5, metalness: 0.1 },
    white: { name: 'أبيض ناصع', hex: 0xf8fafc, roughness: 0.35, metalness: 0.05 },
    gray: { name: 'رمادي ميكانيكي', hex: 0x64748b, roughness: 0.4, metalness: 0.2 },
    sky: { name: 'أزرق سماوي', hex: 0x0284c7, roughness: 0.3, metalness: 0.15 },
    teal: { name: 'تيل زمردي', hex: 0x0d9488, roughness: 0.3, metalness: 0.2 },
    red: { name: 'أحمر ناري', hex: 0xdc2626, roughness: 0.35, metalness: 0.1 },
    green: { name: 'أخضر عشبي', hex: 0x16a34a, roughness: 0.4, metalness: 0.1 },
    gold: { name: 'ذهبي حريري Silk Gold', hex: 0xeab308, roughness: 0.2, metalness: 0.65 },
    orange: { name: 'برتقالي نيون', hex: 0xf97316, roughness: 0.35, metalness: 0.1 },
    purple: { name: 'بنفسجي ملكي', hex: 0x9333ea, roughness: 0.3, metalness: 0.2 },
    transparent: { name: 'شفاف / زجاجي', hex: 0xe2e8f0, roughness: 0.1, metalness: 0.1, opacity: 0.55, transparent: true }
  };

  /**
   * إنشاء وتحضير عارض 3D تفاعلي
   */
  function createViewer(canvas, container, options = {}) {
    if (typeof THREE === 'undefined') {
      console.warn('Three.js library not loaded');
      return null;
    }

    const bedWidth = options.bedWidth || 225; // Elegoo Neptune 4 Pro
    const bedDepth = options.bedDepth || 225;
    const initialColor = options.color || FILAMENT_COLORS.sky.hex;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 260;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(options.background || 0xf8fafc);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    const defaultCamPos = new THREE.Vector3(140, -190, 150);
    camera.position.copy(defaultCamPos);
    camera.up.set(0, 0, 1);

    // 3. Renderer with clipping support
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.localClippingEnabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // 4. Studio Lighting
    const ambLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(150, -120, 220);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.4);
    dirLight2.position.set(-150, 150, 120);
    scene.add(dirLight2);

    const floorLight = new THREE.DirectionalLight(0xffffff, 0.25);
    floorLight.position.set(0, 0, -150);
    scene.add(floorLight);

    // 5. 3D Print Bed & Grid (Elegoo Neptune 4 Pro PEI Sheet)
    const bedGroup = new THREE.Group();

    // Bed Plate Surface
    const bedGeo = new THREE.PlaneGeometry(bedWidth, bedDepth);
    const bedMat = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      side: THREE.DoubleSide
    });
    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    bedGroup.add(bedMesh);

    // Bed Grid
    const gridHelper = new THREE.GridHelper(bedWidth, 15, 0x0284c7, 0x94a3b8);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = 0.1;
    bedGroup.add(gridHelper);

    // Bed Frame Border
    const borderGeo = new THREE.EdgesGeometry(bedGeo);
    const borderMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2 });
    const borderLines = new THREE.LineSegments(borderGeo, borderMat);
    borderLines.position.z = 0.2;
    bedGroup.add(borderLines);

    scene.add(bedGroup);

    // 6. Mesh Model Container
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // 7. Slicing Clipping Plane
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1000);

    // Model Material
    let currentMaterialConfig = { ...FILAMENT_COLORS.sky };
    let isWireframe = false;

    const modelMaterial = new THREE.MeshStandardMaterial({
      color: initialColor,
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide,
      clippingPlanes: [clipPlane],
      clipShadows: true
    });

    // 8. Custom Smooth Orbit & Touch Controls
    let isDragging = false;
    let isPanning = false;
    let previousPointer = { x: 0, y: 0 };
    let spherical = { radius: 280, theta: -Math.PI / 3, phi: Math.PI / 3.2 };
    let target = new THREE.Vector3(0, 0, 25);
    let autoRotate = options.autoRotate !== false;
    let pinchDist = 0;

    function updateCameraFromSpherical() {
      spherical.radius = Math.max(30, Math.min(800, spherical.radius));
      spherical.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.02, spherical.phi)); // don't go below bed

      const sinPhi = Math.sin(spherical.phi);
      camera.position.x = target.x + spherical.radius * sinPhi * Math.cos(spherical.theta);
      camera.position.y = target.y + spherical.radius * sinPhi * Math.sin(spherical.theta);
      camera.position.z = target.z + spherical.radius * Math.cos(spherical.phi);
      camera.lookAt(target);
    }
    updateCameraFromSpherical();

    // Event Listeners for Controls
    canvas.style.cursor = 'grab';

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      isDragging = e.button === 0;
      isPanning = e.button === 2 || e.shiftKey;
      previousPointer = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
      autoRotate = false;
    });

    canvas.addEventListener('pointermove', e => {
      if (!isDragging && !isPanning) return;
      const dx = e.clientX - previousPointer.x;
      const dy = e.clientY - previousPointer.y;
      previousPointer = { x: e.clientX, y: e.clientY };

      if (isDragging) {
        spherical.theta -= dx * 0.01;
        spherical.phi -= dy * 0.01;
        updateCameraFromSpherical();
      } else if (isPanning) {
        const panFactor = spherical.radius * 0.0018;
        const forward = new THREE.Vector3().subVectors(target, camera.position).normalize();
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        const up = new THREE.Vector3().crossVectors(right, forward).normalize();

        target.addScaledVector(right, -dx * panFactor);
        target.addScaledVector(up, dy * panFactor);
        target.z = Math.max(0, target.z);
        updateCameraFromSpherical();
      }
    });

    function endDrag(e) {
      if (e.pointerId) {
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      isDragging = false;
      isPanning = false;
      canvas.style.cursor = 'grab';
    }

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const zoomFactor = e.deltaY * 0.18;
      spherical.radius += zoomFactor;
      updateCameraFromSpherical();
    }, { passive: false });

    // Touch Pinch Zoom
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDist = Math.hypot(dx, dy);
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const diff = pinchDist - dist;
        pinchDist = dist;
        spherical.radius += diff * 0.8;
        updateCameraFromSpherical();
      }
    }, { passive: true });

    // 9. Bounding Box & Slicing State
    let currentMesh = null;
    let bboxHelper = null;
    let modelBounds = { width: 50, depth: 30, height: 40 };

    function clearModel() {
      while (modelGroup.children.length > 0) {
        const obj = modelGroup.children[0];
        if (obj.geometry) obj.geometry.dispose();
        modelGroup.remove(obj);
      }
      if (bboxHelper) {
        scene.remove(bboxHelper);
        bboxHelper.geometry.dispose();
        bboxHelper = null;
      }
      currentMesh = null;
    }

    function fitModelToBed(geometry) {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Center model on bed (X=0, Y=0) and place bottom at Z=0
      geometry.translate(-center.x, -center.y, -box.min.z);

      modelBounds = {
        width: Math.round(size.x * 10) / 10,
        depth: Math.round(size.y * 10) / 10,
        height: Math.round(size.z * 10) / 10
      };

      // Set target to center of model height
      target.set(0, 0, size.z / 2);
      spherical.radius = Math.max(size.x, size.y, size.z) * 2.2 + 40;
      updateCameraFromSpherical();

      // Reset clipping plane above model height
      clipPlane.constant = size.z + 10;
    }

    // 10. Animation Loop
    let isDestroyed = false;
    function renderLoop() {
      if (isDestroyed) return;
      requestAnimationFrame(renderLoop);

      if (autoRotate && !isDragging && !isPanning) {
        spherical.theta += 0.006;
        updateCameraFromSpherical();
      }

      renderer.render(scene, camera);
    }
    renderLoop();

    // 11. Handle Container Resize
    const resizeObserver = new ResizeObserver(() => {
      if (isDestroyed || !container) return;
      const w = container.clientWidth || 300;
      const h = container.clientHeight || 260;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // ==========================================
    // Public API
    // ==========================================
    return {
      scene,
      camera,
      renderer,
      modelGroup,

      // تحميل مصفوفة الرؤوس الحقيقية لملف STL
      loadSTLPositions(positions, name = '3D Model') {
        clearModel();
        if (!positions || positions.length === 0) return;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.computeVertexNormals();

        fitModelToBed(geometry);

        currentMesh = new THREE.Mesh(geometry, modelMaterial);
        currentMesh.castShadow = true;
        currentMesh.receiveShadow = true;
        modelGroup.add(currentMesh);

        return modelBounds;
      },

      // تحميل النماذج الإجرائية للكتالوج
      loadProceduralModel(type, dims = { width: 60, depth: 60, height: 60 }) {
        clearModel();
        let geometry;

        const w = dims.width || 60;
        const d = dims.depth || 60;
        const h = dims.height || 60;

        switch (type) {
          case 'moon-lamp':
          case 'sphere':
            geometry = new THREE.SphereGeometry(w / 2, 48, 36);
            break;

          case 'phone-stand':
          case 'stand':
            geometry = new THREE.BoxGeometry(w, d, h);
            // Chamfer bottom slope
            break;

          case 'keychain':
            geometry = new THREE.BoxGeometry(w, d, 8);
            break;

          case 'vase':
            const points = [];
            for (let i = 0; i < 20; i++) {
              const r = (w / 2) * (0.6 + 0.4 * Math.sin(i * 0.45));
              points.push(new THREE.Vector2(r, (i / 19) * h));
            }
            geometry = new THREE.LatheGeometry(points, 32);
            break;

          case 'gear':
          case 'mechanical':
            geometry = new THREE.CylinderGeometry(w / 2, w / 2, h, 24);
            break;

          default:
            geometry = new THREE.BoxGeometry(w, d, h);
            break;
        }

        fitModelToBed(geometry);
        currentMesh = new THREE.Mesh(geometry, modelMaterial);
        modelGroup.add(currentMesh);

        return modelBounds;
      },

      // تغيير لون ونوع الخامة
      setColor(colorKeyOrHex) {
        let colorHex = colorKeyOrHex;
        let config = FILAMENT_COLORS.sky;

        if (typeof colorKeyOrHex === 'string' && FILAMENT_COLORS[colorKeyOrHex]) {
          config = FILAMENT_COLORS[colorKeyOrHex];
          colorHex = config.hex;
        }

        modelMaterial.color.setHex(colorHex);
        modelMaterial.roughness = config.roughness !== undefined ? config.roughness : 0.35;
        modelMaterial.metalness = config.metalness !== undefined ? config.metalness : 0.15;
        modelMaterial.transparent = config.transparent || false;
        modelMaterial.opacity = config.opacity || 1.0;
        modelMaterial.needsUpdate = true;
      },

      // تفعيل/إلغاء وضع الشبك الهيكلي
      toggleWireframe(val) {
        isWireframe = val !== undefined ? val : !isWireframe;
        modelMaterial.wireframe = isWireframe;
        modelMaterial.needsUpdate = true;
        return isWireframe;
      },

      // تدوير تلقائي
      toggleAutoRotate(val) {
        autoRotate = val !== undefined ? val : !autoRotate;
        return autoRotate;
      },

      // إظهار صندوق حدود الأبعاد (Bounding Box)
      toggleBoundingBox(show) {
        if (!currentMesh) return;
        if (bboxHelper) {
          scene.remove(bboxHelper);
          bboxHelper.geometry.dispose();
          bboxHelper = null;
        }

        if (show) {
          bboxHelper = new THREE.BoxHelper(currentMesh, 0x0284c7);
          scene.add(bboxHelper);
        }
      },

      // محاكاة تقطيع الطبقات (Slicing Height Simulation)
      setSlicePercent(percent) {
        const pct = Math.max(0, Math.min(100, percent));
        const maxH = modelBounds.height || 100;
        const currentCutZ = (pct / 100) * maxH;
        clipPlane.constant = currentCutZ;
      },

      // إعادة ضبط زاوية الكاميرا
      resetView() {
        target.set(0, 0, (modelBounds.height || 40) / 2);
        spherical = {
          radius: Math.max(modelBounds.width, modelBounds.depth, modelBounds.height) * 2.2 + 40,
          theta: -Math.PI / 3,
          phi: Math.PI / 3.2
        };
        updateCameraFromSpherical();
      },

      // تنظيف الذاكرة
      destroy() {
        isDestroyed = true;
        resizeObserver.disconnect();
        clearModel();
        renderer.dispose();
      }
    };
  }

  return {
    createViewer,
    FILAMENT_COLORS
  };
});
