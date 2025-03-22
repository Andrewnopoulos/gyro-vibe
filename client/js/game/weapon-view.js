import * as THREE from 'three';
import { WEAPON_BOBBING } from '../config.js';
import { getQuaternion } from '../utils/math.js';
import { SpellRegistry } from './spells/spell-registry.js';

// Debug flag - set to false to hide the permanent raycast visualization
const DEBUG_RAYCAST = false;

/**
 * Manages first-person weapon view with spellbook
 */
export class WeaponView {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {HTMLElement} container - Container element for 3D scene
   */
  constructor(eventBus, container) {
    this.eventBus = eventBus;
    this.container = container;
    this.spellbook = null;
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
    
    // Spellbook features
    this.spellRegistry = new SpellRegistry(eventBus);
    this.currentPage = 0; // Start with instruction page (0)
    this.totalPages = this.spellRegistry.getTotalPages();
    
    // Book page rendering
    this.pageTextures = {
      left: null,
      right: null
    };
    this.leftPage = null;
    this.rightPage = null;
    
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

    this.createSpellbookModel();

    // Generate initial page textures
    this.generatePageTextures();

    // Create page number indicator UI
    this.createPageIndicator();

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
    const coverMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x8B4513,
      map: this.createCoverTexture()
    });

    const leftCover = new THREE.Mesh(coverGeometry, coverMaterial);
    leftCover.position.set(-0.225, 0, 0);
    this.spellbook.add(leftCover);

    const rightCover = new THREE.Mesh(coverGeometry, coverMaterial);
    rightCover.position.set(0.225, 0, 0);
    this.spellbook.add(rightCover);

    // Create spine
    const spineGeometry = new THREE.BoxGeometry(0.05, 0.6, 0.01);
    const spineMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x8B4513,
      map: this.createSpineTexture()
    });
    const spine = new THREE.Mesh(spineGeometry, spineMaterial);
    spine.position.set(0, 0, 0);
    this.spellbook.add(spine);

    // Create static pages with textures
    const pageGeometry = new THREE.PlaneGeometry(0.4, 0.6);
    const leftPageMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xFFFFFF, 
      side: THREE.DoubleSide 
    });
    
    const rightPageMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xFFFFFF, 
      side: THREE.DoubleSide 
    });

    this.leftPage = new THREE.Mesh(pageGeometry, leftPageMaterial);
    this.leftPage.position.set(-0.225, 0, 0.01);
    this.spellbook.add(this.leftPage);

    this.rightPage = new THREE.Mesh(pageGeometry, rightPageMaterial);
    this.rightPage.position.set(0.225, 0, 0.01);
    this.spellbook.add(this.rightPage);

    // Create pivot for flipping page
    this.flipPivot = new THREE.Object3D();
    this.flipPivot.position.set(0, 0, 0); // At the spine
    this.spellbook.add(this.flipPivot);

    // Create flipping page
    const flippingPageGeometry = new THREE.PlaneGeometry(0.4, 0.6);
    const flippingPageMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xFFFFFF, 
      side: THREE.DoubleSide 
    });
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
   * Create texture for book cover
   * @returns {THREE.Texture} Book cover texture
   */
  createCoverTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 768;
    const ctx = canvas.getContext('2d');

    // Brown leather background
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Create a leather-like texture with darker spots
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = 2 + Math.random() * 10;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add some leather grain lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 100; i++) {
      const x1 = Math.random() * canvas.width;
      const y1 = Math.random() * canvas.height;
      const length = 20 + Math.random() * 40;
      const angle = Math.random() * Math.PI;
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(
        x1 + Math.cos(angle) * length,
        y1 + Math.sin(angle) * length
      );
      ctx.stroke();
    }

    // Add decorative border
    ctx.strokeStyle = '#4E2700';
    ctx.lineWidth = 10;
    ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

    // Add magical symbol in the center
    ctx.fillStyle = '#FFD700'; // Gold
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const symbolRadius = 80;

    // Draw a magic circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, symbolRadius, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw a pentagram inside the circle
    ctx.beginPath();
    const points = 5;
    const innerRadius = symbolRadius * 0.4;
    const outerRadius = symbolRadius * 0.8;
    
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / points;
      const x = centerX + radius * Math.sin(angle);
      const y = centerY + radius * Math.cos(angle);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * Create texture for book spine
   * @returns {THREE.Texture} Book spine texture
   */
  createSpineTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 768;
    const ctx = canvas.getContext('2d');

    // Brown leather background
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Create a leather-like texture with darker spots
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = 1 + Math.random() * 5;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add spine title
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    
    ctx.font = '24px serif';
    ctx.fillStyle = '#FFD700'; // Gold
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Book of Spells', 0, 0);
    
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * Create UI indicator for current page
   */
  createPageIndicator() {
    this.pageIndicator = document.createElement('div');
    this.pageIndicator.style.position = 'absolute';
    this.pageIndicator.style.bottom = '30px';
    this.pageIndicator.style.left = '50%';
    this.pageIndicator.style.transform = 'translateX(-50%)';
    this.pageIndicator.style.backgroundColor = 'rgba(139, 69, 19, 0.85)';
    this.pageIndicator.style.color = '#FFD700';
    this.pageIndicator.style.padding = '8px 20px';
    this.pageIndicator.style.borderRadius = '20px';
    this.pageIndicator.style.fontFamily = 'serif';
    this.pageIndicator.style.fontSize = '22px';
    this.pageIndicator.style.fontWeight = 'bold';
    this.pageIndicator.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.6)';
    this.pageIndicator.style.zIndex = '100';
    this.pageIndicator.style.display = 'none'; // Will be shown when spellbook is visible
    
    // Add key hint text
    this.pageIndicator.innerHTML = 'Page 0 - Instructions <span style="font-size:16px">(Q/E to flip)</span>';
    
    // Append to container
    this.container.appendChild(this.pageIndicator);
  }

  /**
   * Generate textures for the current page spread
   */
  generatePageTextures() {
    // Create canvas for left page
    const leftCanvas = document.createElement('canvas');
    leftCanvas.width = 512;
    leftCanvas.height = 768;
    const leftCtx = leftCanvas.getContext('2d');

    // Create canvas for right page
    const rightCanvas = document.createElement('canvas');
    rightCanvas.width = 512;
    rightCanvas.height = 768;
    const rightCtx = rightCanvas.getContext('2d');

    if (this.currentPage === 0) {
      // Generate instruction page
      this.spellRegistry.generateInstructionPageTexture(leftCtx, true);
      this.spellRegistry.generateInstructionPageTexture(rightCtx, false);
    } else {
      // Get spell for current page
      const spell = this.spellRegistry.getSpellByPage(this.currentPage);
      
      if (spell) {
        // Generate spell page
        spell.generatePageTexture(leftCtx, true);
        spell.generatePageTexture(rightCtx, false);
      } else {
        // Empty page if no spell found
        this.generateEmptyPageTexture(leftCtx);
        this.generateEmptyPageTexture(rightCtx);
      }
    }

    // Create textures from canvases
    if (this.pageTextures.left) {
      this.pageTextures.left.dispose();
    }
    if (this.pageTextures.right) {
      this.pageTextures.right.dispose();
    }

    this.pageTextures.left = new THREE.CanvasTexture(leftCanvas);
    this.pageTextures.right = new THREE.CanvasTexture(rightCanvas);

    // Apply textures to pages
    if (this.leftPage && this.leftPage.material) {
      this.leftPage.material.map = this.pageTextures.left;
      this.leftPage.material.needsUpdate = true;
    }
    
    if (this.rightPage && this.rightPage.material) {
      this.rightPage.material.map = this.pageTextures.right;
      this.rightPage.material.needsUpdate = true;
    }

    // Update page indicator
    this.updatePageIndicator();
  }

  /**
   * Generate texture for an empty page
   * @param {CanvasRenderingContext2D} context - Canvas context
   */
  generateEmptyPageTexture(context) {
    const width = context.canvas.width;
    const height = context.canvas.height;
    
    // Fill with parchment color
    context.fillStyle = '#f5f5dc';
    context.fillRect(0, 0, width, height);
    
    // Add subtle texture
    context.fillStyle = 'rgba(0, 0, 0, 0.03)';
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = 1 + Math.random();
      context.fillRect(x, y, size, size);
    }
    
    // Add "Empty Page" text
    context.font = 'italic 24px serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#8B4513';
    context.fillText('Empty Page', width / 2, height / 2);
  }

  /**
   * Update the page indicator UI
   */
  updatePageIndicator() {
    if (!this.pageIndicator) return;
    
    let pageText = '';
    
    if (this.currentPage === 0) {
      pageText = 'Instructions';
    } else {
      const spell = this.spellRegistry.getSpellByPage(this.currentPage);
      pageText = spell ? spell.name : 'Empty Page';
    }
    
    this.pageIndicator.innerHTML = `Page ${this.currentPage} - ${pageText} <span style="font-size:12px">(Q/E to flip)</span>`;
  }

  /**
   * Start flipping the page to the left
   */
  startFlipRight() {
    if (this.isFlipping) return;
    
    // Check if we're already at the first page
    if (this.currentPage <= 0) {
      console.log('Already at the first page');
      this.playFlipFailSound();
      return;
    }
    
    this.isFlipping = true;
    this.flipDirection = 'left';
    this.flipStartTime = Date.now();
    
    // Prepare flipping page texture (take texture from right page)
    if (this.flippingPage.material && this.pageTextures.right) {
      this.flippingPage.material.map = this.pageTextures.right;
      this.flippingPage.material.needsUpdate = true;
    }
    
    this.flippingPage.visible = true;
    this.flippingPage.position.set(0.225, 0, 0.01); // Start at right page
    this.flipPivot.rotation.y = 0;
    
    // Decrement page number before generating new textures
    this.currentPage--;
    
    // Play flip sound
    this.playFlipSound();
  }

  /**
   * Start flipping the page to the right
   */
  startFlipLeft() {
    if (this.isFlipping) return;
    
    // Check if we're already at the last page
    if (this.currentPage >= this.totalPages - 1) {
      console.log('Already at the last page');
      this.playFlipFailSound();
      return;
    }
    
    this.isFlipping = true;
    this.flipDirection = 'right';
    this.flipStartTime = Date.now();
    
    // Prepare flipping page texture (take texture from left page)
    if (this.flippingPage.material && this.pageTextures.left) {
      this.flippingPage.material.map = this.pageTextures.left;
      this.flippingPage.material.needsUpdate = true;
    }
    
    this.flippingPage.visible = true;
    this.flippingPage.position.set(-0.225, 0, 0.01); // Start at left page
    this.flipPivot.rotation.y = 0;
    
    // Increment page number before generating new textures
    this.currentPage++;
    
    // Play flip sound
    this.playFlipSound();
  }

  /**
   * Play page flip sound
   */
  playFlipSound() {
    // Use console log for now since audio files may not exist
    console.log('Playing page flip sound');
    
    // In a real implementation, you would use:
    // const sound = new Audio('/assets/sounds/page-flip.mp3');
    // sound.volume = 0.5;
    // sound.play().catch(e => console.log('Could not play page flip sound', e));
  }

  /**
   * Play sound for failed flip attempt
   */
  playFlipFailSound() {
    // Use console log for now since audio files may not exist
    console.log('Playing page flip fail sound');
    
    // In a real implementation, you would use:
    // const sound = new Audio('/assets/sounds/page-flip-fail.mp3');
    // sound.volume = 0.3;
    // sound.play().catch(e => console.log('Could not play fail sound', e));
  }

  /**
   * Update page content after flip animation completes
   */
  updatePageContent() {
    // Generate new textures for current page spread
    this.generatePageTextures();
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
        
        // Update page content after flip completes
        this.updatePageContent();
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
   * Apply rune effect to the weapon based on the current page
   * @param {string} shape - The recognized shape
   * @param {number} confidence - Recognition confidence (0-1)
   */
  applyRuneEffect(shape, confidence) {
    if (!this.spellbook) return;

    console.log(`Applying rune effect to spellbook: ${shape} (${Math.round(confidence * 100)}% confidence)`);

    // Clear any existing effects
    this.clearRuneEffects();
    
    // Check if we're on the instruction page - no casting allowed
    if (this.currentPage === 0) {
      console.log('Cannot cast on instruction page');
      this.showCastingError('Cannot cast on instruction page!');
      return;
    }
    
    // Get the spell for the current page
    const spell = this.spellRegistry.getSpellByPage(this.currentPage);
    
    if (!spell) {
      console.log('No spell on current page');
      this.showCastingError('No spell on this page!');
      return;
    }
    
    // Check if the shape matches the spell
    if (spell.shape.toLowerCase() !== shape.toLowerCase()) {
      console.log(`Wrong shape! Expected ${spell.shape}, got ${shape}`);
      this.showCastingError(`Wrong shape! Draw a ${spell.shape}!`);
      return;
    }
    
    // Check if the spell is on cooldown
    if (!spell.isReady()) {
      console.log('Spell on cooldown');
      this.showCastingError('Spell still recharging!');
      return;
    }
    
    // All checks passed, cast the spell!
    console.log(`Casting ${spell.name}`);
    spell.cast({
      camera: this.weaponCamera,
      scene: this.weaponScene,
      spellbook: this.spellbook
    });
    
    // Apply the visual effect based on the spell shape
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
   * Show casting error message
   * @param {string} message - Error message to display
   */
  showCastingError(message) {
    // Create a notification element
    const notification = document.createElement('div');
    notification.style.position = 'absolute';
    notification.style.top = '50%';
    notification.style.left = '50%';
    notification.style.transform = 'translate(-50%, -50%)';
    notification.style.padding = '20px 30px';
    notification.style.borderRadius = '12px';
    notification.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    notification.style.color = 'white';
    notification.style.fontSize = '26px';
    notification.style.fontWeight = 'bold';
    notification.style.textAlign = 'center';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s, transform 0.3s';
    notification.style.zIndex = '2000';
    notification.style.pointerEvents = 'none';
    notification.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.4)';
    notification.style.textShadow = '0 0 5px rgba(0, 0, 0, 0.5)';
    notification.textContent = message;
    
    // Add to container
    this.container.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translate(-50%, -60%)';
      
      // Remove from DOM after animation
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 2500);
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

  /**
   * Get current page number
   * @returns {number} Current page number
   */
  getCurrentPage() {
    return this.currentPage;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    this.eventBus.on('sensor:gyro-updated', (gyroData) => {
      this.lastGyroData = gyroData;
    });
    
    this.eventBus.on('firstperson:enabled', () => {
      this.show();
      // Show page indicator when weapon view is shown
      if (this.pageIndicator) {
        this.pageIndicator.style.display = 'block';
      }
    });
    
    this.eventBus.on('firstperson:disabled', () => {
      this.hide();
      // Hide page indicator when weapon view is hidden
      if (this.pageIndicator) {
        this.pageIndicator.style.display = 'none';
      }
    });
    
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
    
    // Add event listeners for page flipping animations
    this.eventBus.on('weapon:flip-left', () => this.startFlipLeft());
    this.eventBus.on('weapon:flip-right', () => this.startFlipRight());
    
    // Listen for key presses for page flipping (Q/E keys)
    document.addEventListener('keydown', (event) => {
      if (!this.isFlipping) {
        if (event.code === 'KeyQ') {
          this.startFlipLeft();
        } else if (event.code === 'KeyE') {
          this.startFlipRight();
        }
      }
    });
    
    window.addEventListener('resize', this.onWindowResize.bind(this), false);
  }

  /**
   * Handle window resize
   */
  onWindowResize() {
    if (this.weaponCamera && this.weaponRenderer) {
      this.weaponCamera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.weaponCamera.updateProjectionMatrix();
      this.weaponRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
  }

  /**
   * Show weapon view
   */
  show() {
    if (this.weaponContainer) {
      this.weaponContainer.style.display = 'block';
    }
    
    if (this.pageIndicator) {
      this.pageIndicator.style.display = 'block';
    }
  }

  /**
   * Hide weapon view
   */
  hide() {
    if (this.weaponContainer) {
      this.weaponContainer.style.display = 'none';
    }
    
    if (this.pageIndicator) {
      this.pageIndicator.style.display = 'none';
    }
  }

  /**
   * Get raycast data for the gravity gun
   * @returns {Object|null} Raycast data or null if no raycast origin
   */
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

  /**
   * Map a point from weapon space to world space
   * @param {THREE.Vector3} weaponSpacePoint - Point in weapon space
   * @param {THREE.Camera} mainCamera - Main camera
   * @returns {THREE.Vector3} Point in world space
   */
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

  /**
   * Get world direction from weapon orientation
   * @param {THREE.Quaternion} cameraQuaternion - Camera quaternion
   * @returns {THREE.Vector3} Direction vector
   */
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

  /**
   * Update gravity beam visualization
   * @param {boolean} isActive - Whether beam is active
   * @param {THREE.Vector3} [targetPosition=null] - Target position for beam
   */
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

  /**
   * Update debug raycast visualization
   * @param {THREE.Vector3} [targetPosition=null] - Target position
   */
  updateDebugRaycast(targetPosition = null) {
    if (this.debugRaycast && this.debugRaycast.parent) {
      this.debugRaycast.parent.remove(this.debugRaycast);
      if (this.debugRaycast.geometry) this.debugRaycast.geometry.dispose();
      if (this.debugRaycast.material) this.debugRaycast.material.dispose();
      this.debugRaycast = null;
    }
  }

  /**
   * Toggle debug raycast visualization
   * @param {boolean} show - Whether to show debug raycast
   */
  toggleDebugRaycast(show) {
    this.showDebugRaycast = false;
    this.updateDebugRaycast();
  }

  /**
   * Clean up resources
   */
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
    
    // Clean up page textures
    if (this.pageTextures.left) {
      this.pageTextures.left.dispose();
    }
    
    if (this.pageTextures.right) {
      this.pageTextures.right.dispose();
    }
    
    // Remove UI elements
    if (this.pageIndicator && this.pageIndicator.parentNode) {
      this.pageIndicator.parentNode.removeChild(this.pageIndicator);
    }
    
    window.removeEventListener('resize', this.onWindowResize.bind(this));
  }
}