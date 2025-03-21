import * as THREE from 'three';

/**
 * Material definitions for the medieval village environment
 * Includes both visual THREE.js materials and physics properties
 */
export const createMaterials = () => {
  return {
    wood: {
      visual: new THREE.MeshStandardMaterial({ 
        color: 0x8B4513, 
        roughness: 0.8, 
        metalness: 0.1 
      }),
      physics: {
        friction: 0.5,
        restitution: 0.2
      }
    },
    stone: {
      visual: new THREE.MeshStandardMaterial({ 
        color: 0x808080, 
        roughness: 0.9, 
        metalness: 0.1 
      }),
      physics: {
        friction: 0.7,
        restitution: 0.1
      }
    },
    soil: {
      visual: new THREE.MeshStandardMaterial({ 
        color: 0x553311, 
        roughness: 1.0, 
        metalness: 0.0 
      }),
      physics: {
        friction: 0.8,
        restitution: 0.1
      }
    },
    grass: {
      visual: new THREE.MeshStandardMaterial({ 
        color: 0x3a8c3a, 
        roughness: 0.8, 
        metalness: 0.0 
      }),
      physics: {
        friction: 0.4,
        restitution: 0.2
      }
    },
    thatch: {
      visual: new THREE.MeshStandardMaterial({ 
        color: 0xddb35b, 
        roughness: 1.0, 
        metalness: 0.0 
      }),
      physics: {
        friction: 0.6,
        restitution: 0.15
      }
    },
    metal: {
      visual: new THREE.MeshStandardMaterial({ 
        color: 0x8c8c9c, 
        roughness: 0.3, 
        metalness: 0.8 
      }),
      physics: {
        friction: 0.3,
        restitution: 0.5
      }
    }
  };
};