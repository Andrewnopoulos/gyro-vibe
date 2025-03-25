import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Creates village walls and gates
 */
export class VillageWalls {
  /**
   * @param {THREE.Scene} scene - The scene to add walls to
   * @param {Object} materials - Material definitions
   * @param {PhysicsUtils} physicsUtils - Physics utilities
   * @param {Map} objects - Map to store references to created objects
   */
  constructor(scene, materials, physicsUtils, objects) {
    this.scene = scene;
    this.materials = materials;
    this.physicsUtils = physicsUtils;
    this.objects = objects;
  }

  /**
   * Create village walls with gates
   */
  create() {
    const wallThickness = 1;
    const wallHeight = 5;
    const wallOffset = 35;
    
    // Create four walls with gates
    this.createWallSegment({
      start: { x: -wallOffset, z: -wallOffset },
      end: { x: wallOffset, z: -wallOffset },
      height: wallHeight,
      thickness: wallThickness,
      withGate: true
    });
    
    this.createWallSegment({
      start: { x: -wallOffset, z: -wallOffset },
      end: { x: -wallOffset, z: wallOffset },
      height: wallHeight,
      thickness: wallThickness,
      withGate: true
    });
    
    this.createWallSegment({
      start: { x: wallOffset, z: -wallOffset },
      end: { x: wallOffset, z: wallOffset },
      height: wallHeight,
      thickness: wallThickness,
      withGate: false
    });
    
    this.createWallSegment({
      start: { x: -wallOffset, z: wallOffset },
      end: { x: wallOffset, z: wallOffset },
      height: wallHeight,
      thickness: wallThickness,
      withGate: false
    });
  }

  /**
   * Create a wall segment with optional gate
   * @param {Object} options - Wall options
   */
  createWallSegment({ start, end, height, thickness, withGate }) {
    // Calculate wall vector and length
    const wallVector = {
      x: end.x - start.x,
      z: end.z - start.z
    };
    const wallLength = Math.sqrt(wallVector.x * wallVector.x + wallVector.z * wallVector.z);
    
    // If we need a gate, create two wall segments
    if (withGate) {
      const gateWidth = 6;
      const gatePosition = 0.5; // 0 to 1, percentage along the wall
      
      // Calculate gate center position
      const gateCenter = {
        x: start.x + wallVector.x * gatePosition,
        z: start.z + wallVector.z * gatePosition
      };
      
      // Calculate normalized direction vector
      const direction = {
        x: wallVector.x / wallLength,
        z: wallVector.z / wallLength
      };
      
      // Create wall segments on either side of the gate
      this.createWallSegmentGeometry({
        start: start,
        end: {
          x: gateCenter.x - direction.x * gateWidth / 2,
          z: gateCenter.z - direction.z * gateWidth / 2
        },
        height,
        thickness
      });
      
      this.createWallSegmentGeometry({
        start: {
          x: gateCenter.x + direction.x * gateWidth / 2,
          z: gateCenter.z + direction.z * gateWidth / 2
        },
        end: end,
        height,
        thickness
      });
      
      // Create gate arch
      this.createGateArch({
        position: gateCenter,
        width: gateWidth,
        height: height,
        depth: thickness,
        rotation: Math.atan2(direction.z, direction.x) + Math.PI/2
      });
    } else {
      // Create a single wall segment
      this.createWallSegmentGeometry({
        start,
        end,
        height,
        thickness
      });
    }
  }

  /**
   * Create the geometry for a wall segment
   * @param {Object} options - Wall geometry options
   */
  createWallSegmentGeometry({ start, end, height, thickness }) {
    // Calculate wall vector and length
    const wallVector = {
      x: end.x - start.x,
      z: end.z - start.z
    };
    const wallLength = Math.sqrt(wallVector.x * wallVector.x + wallVector.z * wallVector.z);
    
    // Create wall geometry
    const wallGeometry = new THREE.BoxGeometry(wallLength, height, thickness);
    const wallMaterial = this.materials.stone.visual;
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    
    // Position at midpoint
    wall.position.set(
      start.x + wallVector.x/2,
      height/2,
      start.z + wallVector.z/2
    );
    
    // Calculate rotation angle from direction vector
    const angle = Math.atan2(wallVector.z, wallVector.x);
    wall.rotation.y = angle;
    
    wall.castShadow = true;
    wall.receiveShadow = true;
    wall.userData.isVillageWall = true;
    this.scene.add(wall);
    
    // Track wall in objects map for proper cleanup/recreation
    if (this.objects) {
      const wallId = `wall_${start.x}_${start.z}_${end.x}_${end.z}`;
      this.objects.set(wallId, wall);
    }
    
    // Add crenellations on top of the wall
    this.addCrenellations(wall, wallLength, height, thickness);
    
    // Add physics if available
    if (this.physicsUtils) {
      // Create a box shape for the wall
      const wallShape = new CANNON.Box(new CANNON.Vec3(wallLength/2, height/2, thickness/2));
      this.physicsUtils.addPhysicsShape(wall, wallShape, 0);
    }
    
    return wall;
  }

  /**
   * Add crenellations to a wall
   * @param {THREE.Mesh} wall - The wall to add crenellations to
   * @param {number} wallLength - Length of the wall
   * @param {number} wallHeight - Height of the wall
   * @param {number} wallThickness - Thickness of the wall
   */
  addCrenellations(wall, wallLength, wallHeight, wallThickness) {
    const crenel = {
      width: 0.5,
      height: 0.7,
      spacing: 1.2
    };
    
    // Calculate number of crenels based on wall length
    const numCrenels = Math.floor(wallLength / crenel.spacing) - 1;
    const group = new THREE.Group();
    
    // Create crenels
    for (let i = 0; i < numCrenels; i++) {
      const position = -wallLength/2 + (i + 1) * crenel.spacing;
      
      const crenelGeometry = new THREE.BoxGeometry(crenel.width, crenel.height, wallThickness);
      const crenelMesh = new THREE.Mesh(crenelGeometry, this.materials.stone.visual);
      
      crenelMesh.position.set(position, wallHeight/2 + crenel.height/2, 0);
      crenelMesh.castShadow = true;
      crenelMesh.receiveShadow = true;
      crenelMesh.userData.isWallCrenel = true;
      
      group.add(crenelMesh);
    }
    
    wall.add(group);
  }

  /**
   * Create a gate arch
   * @param {Object} options - Gate options
   */
  createGateArch({ position, width, height, depth, rotation }) {
    // Base columns
    const columnWidth = 1;
    const columnGeometry = new THREE.BoxGeometry(columnWidth, height, depth);
    const columnMaterial = this.materials.stone.visual;
    
    // Left column
    const leftColumn = new THREE.Mesh(columnGeometry, columnMaterial);
    leftColumn.position.set(
      position.x - Math.cos(rotation) * width/2,
      height/2,
      position.z - Math.sin(rotation) * width/2
    );
    leftColumn.rotation.y = rotation;
    leftColumn.castShadow = true;
    leftColumn.receiveShadow = true;
    this.scene.add(leftColumn);
    
    // Right column
    const rightColumn = new THREE.Mesh(columnGeometry, columnMaterial);
    rightColumn.position.set(
      position.x + Math.cos(rotation) * width/2,
      height/2,
      position.z + Math.sin(rotation) * width/2
    );
    rightColumn.rotation.y = rotation;
    rightColumn.castShadow = true;
    rightColumn.receiveShadow = true;
    this.scene.add(rightColumn);
    
    // Arch
    const archHeight = 1.5;
    const archSegments = 8;
    const archShape = new THREE.Shape();
    
    // Create arch shape (semi-circle)
    archShape.moveTo(-width/2, 0);
    archShape.lineTo(-width/2, height - archHeight);
    
    // Create arch curve
    const archCurve = new THREE.EllipseCurve(
      0, height - archHeight,             // Center x, y
      width/2, archHeight,                // X radius, Y radius
      0, Math.PI,                         // Start angle, end angle
      false                               // Clockwise
    );
    
    // Add curve points to shape
    const archPoints = archCurve.getPoints(archSegments);
    archPoints.forEach(point => {
      archShape.lineTo(point.x, point.y);
    });
    
    archShape.lineTo(width/2, 0);
    archShape.lineTo(-width/2, 0);
    
    // Create arch geometry
    const extrudeSettings = {
      steps: 1,
      depth: depth,
      bevelEnabled: false
    };
    
    const archGeometry = new THREE.ExtrudeGeometry(archShape, extrudeSettings);
    const arch = new THREE.Mesh(archGeometry, columnMaterial);
    
    // Position and rotate arch
    arch.position.set(position.x, 0, position.z);
    arch.rotation.y = rotation;
    arch.rotation.x = Math.PI / 2;
    arch.rotation.z = Math.PI;
    
    // Adjust position to account for rotation
    arch.position.y = 0;
    
    arch.castShadow = true;
    arch.receiveShadow = true;
    this.scene.add(arch);
    
    // Add physics if available
    if (this.physicsUtils) {
      // Create columns physics
      this.physicsUtils.addPhysicsBox(leftColumn, 0);
      this.physicsUtils.addPhysicsBox(rightColumn, 0);
      
      // Create a compound shape for the arch
      const archTopShape = new CANNON.Box(new CANNON.Vec3(width/2, archHeight/2, depth/2));
      
      // Create body for arch
      const archBody = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(
          position.x,
          height - archHeight/2,
          position.z
        )
      });
      
      // Apply rotation
      const q = new CANNON.Quaternion();
      q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotation);
      archBody.quaternion.copy(q);
      
      // Add shape to body
      archBody.addShape(archTopShape);
      
      // Add to physics world if physics manager is available
      if (this.physicsUtils && this.physicsUtils.physicsManager && this.physicsUtils.physicsManager.world) {
        this.physicsUtils.physicsManager.world.addBody(archBody);
        
        // Register with physics system
        const id = `arch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        arch.userData.physicsId = id;
        
        if (this.physicsUtils.physicsManager.physicsBodies) {
          this.physicsUtils.physicsManager.physicsBodies.set(id, {
            body: archBody,
            mesh: arch,
            properties: {
              size: { x: width, y: archHeight, z: depth },
              mass: 0,
              color: this.materials.stone.visual.color.getHex(),
              shape: 'box',
              metallic: false,
              restitution: this.materials.stone.physics.restitution,
              friction: this.materials.stone.physics.friction
            }
          });
        }
      }
    }
  }
}