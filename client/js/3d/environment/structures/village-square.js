import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Creates the village square with central monument
 */
export class VillageSquare {
  /**
   * @param {THREE.Scene} scene - The scene to add the square to
   * @param {Object} materials - Material definitions
   * @param {PhysicsUtils} physicsUtils - Physics utilities
   */
  constructor(scene, materials, physicsUtils) {
    this.scene = scene;
    this.materials = materials;
    this.physicsUtils = physicsUtils;
  }

  /**
   * Create the central village square with monument
   */
  create() {
    // Create a slightly elevated square in the center
    const squareSize = 10;
    const squareGeometry = new THREE.BoxGeometry(squareSize, 0.2, squareSize);
    const squareMaterial = this.materials.stone.visual;
    const square = new THREE.Mesh(squareGeometry, squareMaterial);
    square.position.set(0, -0.4, 0);
    square.receiveShadow = true;
    this.scene.add(square);
    
    // Add physics if available
    if (this.physicsUtils) {
      this.physicsUtils.addPhysicsBox(square, 0); // Mass 0 for static object
    }
    
    // Add a monument or statue in the center
    this.addCentralMonument();
  }

  /**
   * Add a central monument to the village square
   */
  addCentralMonument() {
    // Base
    const monumentBaseGeometry = new THREE.BoxGeometry(2, 1, 2);
    const monumentBaseMaterial = this.materials.stone.visual;
    const monumentBase = new THREE.Mesh(monumentBaseGeometry, monumentBaseMaterial);
    monumentBase.position.set(0, 0.1, 0);
    monumentBase.castShadow = true;
    monumentBase.receiveShadow = true;
    this.scene.add(monumentBase);
    
    // Column
    const columnGeometry = new THREE.CylinderGeometry(0.3, 0.3, 2.5, 8);
    const columnMaterial = this.materials.stone.visual;
    const column = new THREE.Mesh(columnGeometry, columnMaterial);
    column.position.set(0, 1.35, 0);
    column.castShadow = true;
    column.receiveShadow = true;
    this.scene.add(column);
    
    // Top ornament
    const topGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const topMaterial = this.materials.metal.visual;
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.set(0, 2.85, 0);
    top.castShadow = true;
    top.receiveShadow = true;
    this.scene.add(top);
    
    // Add physics if available
    if (this.physicsUtils) {
      this.physicsUtils.addPhysicsBox(monumentBase, 0);
      this.physicsUtils.addPhysicsShape(column, new CANNON.Cylinder(0.3, 0.3, 2.5, 8), 0);
      this.physicsUtils.addPhysicsShape(top, new CANNON.Sphere(0.5), 0);
    }
  }
}