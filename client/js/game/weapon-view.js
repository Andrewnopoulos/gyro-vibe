import * as THREE from 'three';
import { WEAPON_BOBBING } from '../config.js';
import { getQuaternion } from '../utils/math.js';

// Debug flag - set to false to hide the permanent raycast visualization
const DEBUG_RAYCAST = false;

/**
 * Manages first-person weapon view
 */
export class WeaponView {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {HTMLElement} container - Container element for 3D scene
   */
  constructor(eventBus, container) {
    this.eventBus = eventBus;
    this.container = container;
    this.spellbook = null; // Updated from weaponPhone
    this.weaponScene = null;
    this.weaponCamera = null;
    this.weaponRenderer = null;
    this.weaponContainer = null;
    this.bobbingTime = 0;
    this.lastGyroData = { alpha: 0, beta: 0, gamma: 0 };
    this.isMoving = false;
    this.raycastOrigin = null;
    this.raycastBeam = null;
    this.debugRaycast = null;
    this.showDebugRaycast = DEBUG_RAYCAST;
    // Animation state for page flipping
    this.isFlipping = false;
    this.flipDirection = null;
    this.flipStartTime = 0;
    this.flipDuration = 0.5; // 0.5 seconds for flip animation

    // Define the offset quaternion for correct orientation
    this.offsetQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2
    );

    this.init();
    this.setupEventListeners();
  }

  /**
   * Initialize weapon view
   */
  init() {
    this.weaponContainer = document.createElement('div');
    this.weaponContainer.style.position = 'absolute';
    this.weaponContainer.style.top = '0';
    this.weaponContainer.style.left = '0';
    this.weaponContainer.style.width = '100%';
    this.weaponContainer.style.height = '100%';
    this.weaponContainer.style.pointerEvents = 'none';
    this.weaponContainer.style.display = 'none';
    this.container.appendChild(this.weaponContainer);

    this.weaponScene = new THREE.Scene();

    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.weaponScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 2);
    this.weaponScene.add(directionalLight);

    this.weaponCamera = new THREE.PerspectiveCamera(
      70,
      this.container.clientWidth / this.container.clientHeight,
      0.01,
      10
    );

    this.weaponRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.weaponRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.weaponRenderer.setClearColor(0x000000, 0);
    this.weaponRenderer.setPixelRatio(window.devicePixelRatio);
    this.weaponContainer.appendChild(this.weaponRenderer.domElement);

    this.createSpellbookModel(); // Updated method name

    console.log('Weapon view initialized successfully');
  }

  /**
   * Create spellbook model
   */
  createSpellbookModel() {
    this.spellbook = new THREE.Group();
    this.weaponScene.add(this.spellbook);

    // Apply initial rotation to match phone orientation
    this.spellbook.rotateX(-Math.PI / 2);

    // Create covers (brown leather-like)
    const coverGeometry = new THREE.BoxGeometry(0.4, 0.6, 0.01);
    const coverMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 }); // Brown

    const leftCover = new THREE.Mesh(coverGeometry, coverMaterial);
    leftCover.position.set(-0.225, 0, 0);
    this.spellbook.add(leftCover);

    const rightCover = new THREE.Mesh(coverGeometry, coverMaterial);
    rightCover.position.set(0.225, 0, 0);
    this.spellbook.add(rightCover);

    // Create spine
    const spineGeometry = new THREE.BoxGeometry(0.05, 0.6, 0.01);
    const spineMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
    const spine = new THREE.Mesh(spineGeometry, spineMaterial);
    spine.position.set(0, 0, 0);
    this.spellbook.add(spine);

    // Create static pages
    const pageGeometry = new THREE.PlaneGeometry(0.4, 0.6);
    const pageMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });

    const leftPage = new THREE.Mesh(pageGeometry, pageMaterial);
    leftPage.position.set(-0.225, 0, 0.01);
    this.spellbook.add(leftPage);

    const rightPage = new THREE.Mesh(pageGeometry, pageMaterial);
    rightPage.position.set(0.225, 0, 0.01);
    this.spellbook.add(rightPage);

    // Create pivot for flipping page
    this.flipPivot = new THREE.Object3D();
    this.flipPivot.position.set(0, 0, 0); // At the spine
    this.spellbook.add(this.flipPivot);

    // Create flipping page
    const flippingPageGeometry = new THREE.PlaneGeometry(0.4, 0.6);
    const flippingPageMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
    this.flippingPage = new THREE.Mesh(flippingPageGeometry, flippingPageMaterial);
    this.flippingPage.visible = false;
    this.flipPivot.add(this.flippingPage);

    // Add raycast origin
    this.raycastOrigin = new THREE.Object3D();
    this.raycastOrigin.name = 'raycastOrigin';
    this.raycastOrigin.position.set(0, 0, 0.1); // Slightly in front of pages
    this.spellbook.add(this.raycastOrigin);

    // Position the spellbook in first-person view
    this.spellbook.position.set(0.25, -0.2, -0.8);
  }

  /**
   * Start flipping the page to the left
   */
  startFlipLeft() {
    if (this.isFlipping) return;
    this.isFlipping = true;
    this.flipDirection = 'left';
    this.flipStartTime = Date.now();
    this.flippingPage.visible = true;
    this.flippingPage.position.set(0.225, 0, 0.01); // Start at right page
    this.flipPivot.rotation.y = 0;
  }

  /**
   * Start flipping the page to the right
   */
  startFlipRight() {
    if (this.isFlipping) return;
    this.isFlipping = true;
    this.flipDirection = 'right';
    this.flipStartTime = Date.now();
    this.flippingPage.visible = true;
    this.flippingPage.position.set(-0.225, 0, 0.01); // Start at left page
    this.flipPivot.rotation.y = 0;
  }

  /**
   * Update weapon view
   * @param {number} delta - Time delta in seconds
   * @param {boolean} isMoving - Whether player is moving
   */
  update(delta, isMoving) {
    if (!this.spellbook) return;

    this.isMoving = isMoving;

    this.updateOrientation();
    this.updateBobbing(delta);

    // Handle page flipping animation
    if (this.isFlipping) {
      const elapsed = (Date.now() - this.flipStartTime) / 1000;
      const progress = Math.min(elapsed / this.flipDuration, 1);

      if (this.flipDirection === 'left') {
        this.flipPivot.rotation.y = -Math.PI * progress; // Rotate counterclockwise
      } else if (this.flipDirection === 'right') {
        this.flipPivot.rotation.y = Math.PI * progress; // Rotate clockwise
      }

      if (progress >= 1) {
        this.isFlipping = false;
        this.flippingPage.visible = false;
      }
    }

    this.updateDebugRaycast();

    if (this.weaponRenderer && this.weaponScene && this.weaponCamera) {
      this.weaponRenderer.render(this.weaponScene, this.weaponCamera);
    }
  }

  /**
   * Update orientation based on gyro data
   */
  updateOrientation() {
    if (!this.spellbook || !this.lastGyroData) return;

    const [w, x, y, z] = getQuaternion(
      this.lastGyroData.alpha,
      this.lastGyroData.beta,
      this.lastGyroData.gamma
    );
    const deviceQuaternion = new THREE.Quaternion(x, y, z, w);

    this.spellbook.quaternion.copy(
      this.offsetQuaternion.clone().multiply(deviceQuaternion)
    );
  }

  /**
   * Update weapon bobbing animation
   * @param {number} delta - Time delta in seconds
   */
  updateBobbing(delta) {
    if (!this.spellbook) return;

    const basePosition = { x: 0.25, y: -0.2, z: -0.8 };

    if (this.isMoving) {
      this.bobbingTime += delta * WEAPON_BOBBING.speed;
      const verticalBob = Math.sin(this.bobbingTime * 2) * (WEAPON_BOBBING.intensity * 0.3);
      const horizontalBob = Math.cos(this.bobbingTime) * (WEAPON_BOBBING.intensity * 0.15);

      this.spellbook.position.y = basePosition.y + verticalBob;
      this.spellbook.position.x = basePosition.x + horizontalBob;
      this.spellbook.position.z = basePosition.z;
    } else {
      this.spellbook.position.x = THREE.MathUtils.lerp(
        this.spellbook.position.x,
        basePosition.x,
        delta * 3
      );
      this.spellbook.position.y = THREE.MathUtils.lerp(
        this.spellbook.position.y,
        basePosition.y,
        delta * 3
      );
      this.spellbook.position.z = basePosition.z;
    }
  }

  /**
   * Apply rune effect to the weapon
   * @param {string} shape - The recognized shape
   * @param {number} confidence - Recognition confidence (0-1)
   */
  applyRuneEffect(shape, confidence) {
    if (!this.spellbook) return;

    console.log(`Applying rune effect to spellbook: ${shape} (${Math.round(confidence * 100)}% confidence)`);

    this.clearRuneEffects();

    switch (shape.toLowerCase()) {
      case 'circle':
        this.applyCircleRuneEffect(confidence);
        break;
      case 'triangle':
        this.applyTriangleRuneEffect(confidence);
        break;
      default:
        this.applyGenericRuneEffect(confidence);
    }
  }

  /**
   * Clear all rune effects from the weapon
   */
  clearRuneEffects() {
    this.spellbook.traverse((child) => {
      if (child.userData && child.userData.isRuneEffect) {
        if (child.parent) {
          child.parent.remove(child);
        }
      }
    });

    if (this.runeEffectTimeout) {
      clearTimeout(this.runeEffectTimeout);
      this.runeEffectTimeout = null;
    }
  }

  /**
   * Apply circle rune effect (shield)
   * @param {number} confidence - Recognition confidence (0-1)
   */
  applyCircleRuneEffect(confidence) {
    const radius = 0.5;
    const geometry = new THREE.RingGeometry(radius * 0.8, radius, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00AAFF,
      transparent: true,
      opacity: Math.min(0.7, confidence * 0.9),
      side: THREE.DoubleSide
    });

    const shield = new THREE.Mesh(geometry, material);
    shield.userData.isRuneEffect = true;
    shield.position.set(0, 0, 0.2); // In front of the spellbook
    this.spellbook.add(shield);

    const startTime = Date.now();
    const animate = () => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      const pulse = 1 + Math.sin(elapsedTime * 1.5) * 0.1;
      if (shield.parent) {
        shield.scale.set(pulse, pulse, 1);
        shield.rotation.z += 0.005;
        material.opacity = Math.min(0.7, confidence * 0.9) * (0.8 + Math.sin(elapsedTime * 2) * 0.2);
        requestAnimationFrame(animate);
      }
    };
    animate();

    this.runeEffectTimeout = setTimeout(() => {
      this.clearRuneEffects();
    }, 8000);
  }

  /**
   * Apply triangle rune effect (fireball)
   * @param {number} confidence - Recognition confidence (0-1)
   */
  applyTriangleRuneEffect(confidence) {
    const geometry = new THREE.PlaneGeometry(0.4, 0.6);
    const material = new THREE.MeshBasicMaterial({
      color: 0xFF5500,
      transparent: true,
      opacity: Math.min(0.8, confidence * 0.9)
    });

    const fireScreen = new THREE.Mesh(geometry, material);
    fireScreen.userData.isRuneEffect = true;
    fireScreen.position.set(0, 0, 0.03); // Slightly in front of pages
    this.spellbook.add(fireScreen);

    const startTime = Date.now();
    const animate = () => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      if (fireScreen.parent) {
        const pulse = 1 + Math.sin(elapsedTime * 3) * 0.1;
        fireScreen.scale.set(pulse, pulse, 1);
        const g = 0.3 + Math.sin(elapsedTime * 5) * 0.2;
        material.color.setRGB(1.0, g, 0.1);
        requestAnimationFrame(animate);
      }
    };
    animate();

    this.runeEffectTimeout = setTimeout(() => {
      this.clearRuneEffects();
    }, 8000);
  }

  /**
   * Apply generic rune effect
   * @param {number} confidence - Recognition confidence (0-1)
   */
  applyGenericRuneEffect(confidence) {
    const geometry = new THREE.BoxGeometry(0.45, 0.85, 0.1);
    const material = new THREE.MeshBasicMaterial({
      color: 0xAA88FF,
      transparent: true,
      opacity: Math.min(0.5, confidence * 0.6),
      wireframe: true
    });

    const glowEffect = new THREE.Mesh(geometry, material);
    glowEffect.userData.isRuneEffect = true;
    glowEffect.position.set(0, 0, 0);
    this.spellbook.add(glowEffect);

    const startTime = Date.now();
    const animate = () => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      if (glowEffect.parent) {
        const pulse = 1 + Math.sin(elapsedTime * 2) * 0.1;
        glowEffect.scale.set(pulse, pulse, pulse);
        glowEffect.rotation.z = Math.sin(elapsedTime) * 0.1;
        requestAnimationFrame(animate);
      }
    };
    animate();

    this.runeEffectTimeout = setTimeout(() => {
      this.clearRuneEffects();
    }, 5000);
  }

  // Remaining methods (unchanged or minimally adjusted)
  setupEventListeners() {
    this.eventBus.on('sensor:gyro-updated', (gyroData) => {
      this.lastGyroData = gyroData;
    });
    this.eventBus.on('firstperson:enabled', () => this.show());
    this.eventBus.on('firstperson:disabled', () => this.hide());
    this.eventBus.on('weapon:apply-rune-effect', (data) => {
      this.applyRuneEffect(data.shape, data.confidence);
    });
    this.eventBus.on('gravityGun:pickup', () => this.updateGravityBeam(true));
    this.eventBus.on('gravityGun:drop', () => this.updateGravityBeam(false));
    this.eventBus.on('gravityGun:update-target', (data) => {
      if (data.position) {
        const targetPos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
        this.updateGravityBeam(true, targetPos);
      }
    });
    this.eventBus.on('gravityGun:highlight', (data) => {
      if (this.raycastOrigin) {
        const indicator = this.raycastOrigin.getObjectByName('raycastOriginIndicator');
        if (indicator && indicator.material) {
          indicator.material.visible = true;
          indicator.material.color.set(data.targetFound ? 0x00ff00 : 0xff0000);
          setTimeout(() => {
            if (indicator && indicator.material) indicator.material.visible = false;
          }, 100);
        }
      }
    });
    window.addEventListener('resize', this.onWindowResize.bind(this), false);
  }

  onWindowResize() {
    if (this.weaponCamera && this.weaponRenderer) {
      this.weaponCamera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.weaponCamera.updateProjectionMatrix();
      this.weaponRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
  }

  show() {
    if (this.weaponContainer) this.weaponContainer.style.display = 'block';
  }

  hide() {
    if (this.weaponContainer) this.weaponContainer.style.display = 'none';
  }

  getRaycastData() {
    if (!this.raycastOrigin || !this.spellbook) return null;

    const origin = new THREE.Vector3();
    this.raycastOrigin.getWorldPosition(origin);

    const weaponWorldQuaternion = new THREE.Quaternion();
    this.raycastOrigin.getWorldQuaternion(weaponWorldQuaternion);

    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(weaponWorldQuaternion).normalize();

    const [w, x, y, z] = getQuaternion(this.lastGyroData.alpha, this.lastGyroData.beta, this.lastGyroData.gamma);
    const deviceQuaternion = new THREE.Quaternion(x, y, z, w);

    return {
      origin,
      direction,
      weaponWorldQuaternion,
      deviceQuaternion,
      rawGyroData: this.lastGyroData
    };
  }

  mapToWorldSpace(weaponSpacePoint, mainCamera) {
    const worldPoint = mainCamera.position.clone();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(mainCamera.quaternion);
    worldPoint.addScaledVector(forward, 0.5);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(mainCamera.quaternion);
    worldPoint.addScaledVector(up, -0.2);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(mainCamera.quaternion);
    worldPoint.addScaledVector(right, 0.2);
    return worldPoint;
  }

  getWorldDirectionFromWeapon(cameraQuaternion) {
    if (!this.raycastOrigin || !this.spellbook) {
      return new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuaternion);
    }

    const [w, x, y, z] = getQuaternion(this.lastGyroData.alpha, this.lastGyroData.beta, this.lastGyroData.gamma);
    const deviceQuaternion = new THREE.Quaternion(x, y, z, w);

    const correctedQuaternion = this.offsetQuaternion.clone().multiply(deviceQuaternion);
    const weaponForward = new THREE.Vector3(0, 1, 0).applyQuaternion(correctedQuaternion).applyQuaternion(cameraQuaternion).normalize();

    return weaponForward;
  }

  updateGravityBeam(isActive, targetPosition = null) {
    if (!isActive) {
      if (this.raycastBeam) {
        if (this.raycastBeam.parent) this.raycastBeam.parent.remove(this.raycastBeam);
        if (this.raycastBeam.geometry) this.raycastBeam.geometry.dispose();
        if (this.raycastBeam.material) this.raycastBeam.material.dispose();
        this.raycastBeam = null;
      }
      this.updateDebugRaycast();
      return;
    }

    if (!this.raycastOrigin) return;

    const origin = new THREE.Vector3();
    this.raycastOrigin.getWorldPosition(origin);

    const beamLength = targetPosition ? origin.distanceTo(targetPosition) : 5;

    if (!this.raycastBeam) {
      const beamGeometry = new THREE.CylinderGeometry(0.005, 0.005, beamLength, 8);
      beamGeometry.rotateX(Math.PI / 2);
      beamGeometry.translate(0, 0, -beamLength / 2);
      const beamMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      });
      this.raycastBeam = new THREE.Mesh(beamGeometry, beamMaterial);
      this.raycastOrigin.add(this.raycastBeam);
    } else {
      if (this.raycastBeam.geometry) this.raycastBeam.geometry.dispose();
      const beamGeometry = new THREE.CylinderGeometry(0.005, 0.005, beamLength, 8);
      beamGeometry.rotateX(Math.PI / 2);
      beamGeometry.translate(0, 0, -beamLength / 2);
      this.raycastBeam.geometry = beamGeometry;
    }

    if (targetPosition) {
      const raycastWorldPos = new THREE.Vector3();
      this.raycastOrigin.getWorldPosition(raycastWorldPos);
      const direction = targetPosition.clone().sub(raycastWorldPos).normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
      this.raycastBeam.quaternion.copy(quaternion);
    }

    const pulse = 0.7 + Math.sin(Date.now() / 200) * 0.3;
    if (this.raycastBeam.material) this.raycastBeam.material.opacity = pulse * 0.7;

    this.updateDebugRaycast(targetPosition);
  }

  updateDebugRaycast(targetPosition = null) {
    if (this.debugRaycast && this.debugRaycast.parent) {
      this.debugRaycast.parent.remove(this.debugRaycast);
      if (this.debugRaycast.geometry) this.debugRaycast.geometry.dispose();
      if (this.debugRaycast.material) this.debugRaycast.material.dispose();
      this.debugRaycast = null;
    }
  }

  toggleDebugRaycast(show) {
    this.showDebugRaycast = false;
    this.updateDebugRaycast();
  }

  dispose() {
    if (this.raycastBeam) {
      if (this.raycastBeam.parent) this.raycastBeam.parent.remove(this.raycastBeam);
      if (this.raycastBeam.geometry) this.raycastBeam.geometry.dispose();
      if (this.raycastBeam.material) this.raycastBeam.material.dispose();
      this.raycastBeam = null;
    }
    if (this.debugRaycast) {
      if (this.debugRaycast.parent) this.debugRaycast.parent.remove(this.debugRaycast);
      if (this.debugRaycast.geometry) this.debugRaycast.geometry.dispose();
      if (this.debugRaycast.material) this.debugRaycast.material.dispose();
      this.debugRaycast = null;
    }
    if (this.runeEffectTimeout) {
      clearTimeout(this.runeEffectTimeout);
      this.runeEffectTimeout = null;
    }
    window.removeEventListener('resize', this.onWindowResize.bind(this));
  }
}