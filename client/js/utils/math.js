import { DEG_TO_RAD } from '../config.js';

/**
 * Converts Euler angles to quaternion
 * @param {number} alpha - Alpha angle in degrees
 * @param {number} beta - Beta angle in degrees
 * @param {number} gamma - Gamma angle in degrees
 * @returns {Array} Array containing [w, x, y, z] quaternion components
 */
export function getQuaternion(alpha, beta, gamma) {
  const _x = beta ? beta * DEG_TO_RAD : 0;
  const _y = gamma ? gamma * DEG_TO_RAD : 0;
  const _z = alpha ? alpha * DEG_TO_RAD : 0;

  const cX = Math.cos(_x/2);
  const cY = Math.cos(_y/2);
  const cZ = Math.cos(_z/2);
  const sX = Math.sin(_x/2);
  const sY = Math.sin(_y/2);
  const sZ = Math.sin(_z/2);

  // ZXY quaternion construction
  const w = cX * cY * cZ - sX * sY * sZ;
  const x = sX * cY * cZ - cX * sY * sZ;
  const y = cX * sY * cZ + sX * cY * sZ;
  const z = cX * cY * sZ + sX * sY * cZ;

  return [w, x, y, z];
}

/**
 * Creates a cubic ease-out function for smooth animations
 * @param {number} progress - Value between 0 and 1
 * @returns {number} Eased value
 */
export function easeOutCubic(progress) {
  return 1 - Math.pow(1 - progress, 3);
}