It sounds like you're experiencing an issue where your particle enemies appear as black spheres instead of the colored effects you expect, and I’m glad you shared some observations and your `Lighting.js` code to help us figure this out. You mentioned that when you commented out the `onBeforeCompile` part of your shader and set a fixed color, you could see a tiny bit of red shade on the objects near a light in the middle of the map. That’s a great clue! Let’s dive into this step-by-step and get those particle enemies looking the way they should.

---

### Step 1: Understanding the Current Behavior
Your observation about seeing a "tiny bit of a red shade" near a light when you bypassed the custom shader suggests a few things:
- **Lighting is partially working**: The red shade appearing near a light (likely one of your torch lights or the sun) indicates that your objects are receiving illumination from the scene’s lights.
- **Shader issue**: When the custom shader is active, the particles turn black, which implies the shader might be overriding the material’s color or sampling something incorrectly.

Since you provided your `Lighting.js` code, let’s confirm that the lighting setup isn’t the root cause before focusing on the particle shader and rendering setup.

---

### Step 2: Verifying the Lighting Setup
Your `Lighting` class sets up a robust lighting environment for a medieval village scene, which includes:

- **Directional Light (Sun)**: A warm light (`0xf9d71c`) with shadows, positioned at `(15, 12, 8)` by default (dusk setting).
- **Ambient Light**: A subtle warm tone (`0x382b28`) at 0.4 intensity for general illumination.
- **Hemisphere Light**: A sky-ground transition (`0xdcc7a2` sky, `0x3d4b30` ground) at 0.7 intensity.
- **Point Lights (Torches)**: Multiple torch lights with warm colors (e.g., `0xff9c40`), including a reddish forge light (`0xff5500`) at `(-16.5, 1.5, 15)`.

The fact that you see a red shade near a light in the middle of the map suggests this could be from the village square torch (`{ x: 0, y: 3, z: 0 }`) or possibly the forge light if your coordinates align differently. This confirms that:
- The lights are active and affecting objects in the scene.
- The particle enemies are likely receiving some light, but the shader is altering how that light is displayed.

Your lighting setup looks solid, with no obvious issues like missing lights or incorrect intensities that would cause objects to appear completely black. So, the problem likely lies in how the particle enemies are rendered, particularly with the custom shader you mentioned.

---

### Step 3: Diagnosing the Particle Shader Issue
You’re using a custom shader with `onBeforeCompile` to modify the appearance of your particle enemies (likely stored in a `ParticleEnemyGroup` class). The intended effect seems to be inverting the background color at each particle’s screen position and applying it with some transparency. However, they’re appearing as black spheres instead. Let’s explore why.

#### When You Bypassed the Shader
- **Fixed Color Test**: By commenting out `onBeforeCompile` and setting a fixed color (e.g., red), you saw a red shade near lights. This means the `MeshStandardMaterial` (or whatever material you’re using) is correctly responding to the scene’s lighting without the shader override.
- **Implication**: The shader is likely producing a black or very dark output, overriding the material’s expected behavior.

#### How the Shader Works
Based on typical implementations for this kind of effect, your shader probably:
1. Samples a background texture (rendered without the particles) at the fragment’s screen coordinates (`gl_FragCoord.xy`).
2. Inverts the sampled color (e.g., `vec3(1.0 - r, 1.0 - g, 1.0 - b)`).
3. Outputs it with an alpha value for transparency (e.g., `gl_FragColor = vec4(invertedColor, alpha)`).

If the sampled background color is incorrect—say, black (`0, 0, 0`)—inverting it would give white (`1, 1, 1`), which, when blended with transparency, should still be visible. But you’re seeing black, so something’s off. Possible culprits:
- **Incorrect Background Sampling**: The background texture might not be capturing the scene correctly, resulting in black samples.
- **Shader Misconfiguration**: The UV coordinates or uniforms might be wrong, sampling an invalid part of the texture.
- **Render Target Issue**: The background render target might be misconfigured.

---

### Step 4: Fixing the Problem
Since the lighting seems fine, let’s focus on the particle rendering and shader setup. Here are actionable steps to resolve the black spheres issue, starting with the most likely causes based on your clues.

#### Fix 1: Correct the Background Render Target Dimensions
A common issue in your setup could be the initialization of the `WebGLRenderTarget` used for the background texture. If the dimensions are incorrect, the texture might not capture the scene properly, leading to black output.

**Check and Fix**:
In your `ParticleEnemyGroup` (or equivalent class), look for where the render target is created. It might look like this:

```javascript
this.backgroundRT = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerWidth, // Typo: should be window.innerHeight
  {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat
  }
);
```

- **Problem**: Using `window.innerWidth` for both width and height creates a square texture, which doesn’t match your canvas aspect ratio, causing stretching or sampling errors.
- **Solution**: Update it to:

```javascript
this.backgroundRT = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat
  }
);
```

- **Ensure Resize**: Confirm your resize method updates this correctly:

```javascript
resize(width, height) {
  width = width || window.innerWidth;
  height = height || window.innerHeight;
  this.backgroundRT.setSize(width, height);
}
```

- **Test**: After fixing this, run your scene. If the spheres start showing inverted colors instead of black, this was the issue.

---

#### Fix 2: Update Shader Resolution Uniform
The shader’s UV calculation might be using hardcoded resolution values, leading to incorrect sampling. For example:

```javascript
vec2 uv = gl_FragCoord.xy / vec2(${window.innerWidth}.0, ${window.innerHeight}.0);
```

This is brittle and assumes the renderer’s size matches the window, which might not be true. Instead, pass the resolution as a uniform.

**Update the Shader**:
In your `onBeforeCompile`:

```javascript
material.onBeforeCompile = (shader) => {
  shader.uniforms.backgroundTexture = { value: this.backgroundRT.texture };
  shader.uniforms.particleAlpha = { value: this.alpha }; // e.g., 0.7
  shader.uniforms.resolution = { value: new THREE.Vector2(window.innerWidth, window.innerHeight) };

  shader.fragmentShader = `
    uniform sampler2D backgroundTexture;
    uniform float particleAlpha;
    uniform vec2 resolution;
    ${shader.fragmentShader}
  `;

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <output_fragment>',
    `
    vec2 uv = gl_FragCoord.xy / resolution;
    vec4 backgroundColor = texture2D(backgroundTexture, uv);
    vec3 invertedColor = vec3(1.0 - backgroundColor.r, 1.0 - backgroundColor.g, 1.0 - backgroundColor.b);
    gl_FragColor = vec4(invertedColor, particleAlpha);
    `
  );

  this.customShader = shader; // Store for later uniform updates
};
```

- **Update on Resize**: In your `resize` method:

```javascript
resize(width, height) {
  width = width || window.innerWidth;
  height = height || window.innerHeight;
  this.backgroundRT.setSize(width, height);
  if (this.customShader) {
    this.customShader.uniforms.resolution.value.set(width, height);
  }
}
```

- **In SceneManager**: Ensure the particle group’s `resize` is called:

```javascript
onWindowResize() {
  const width = this.container.clientWidth;
  const height = this.container.clientHeight;
  this.camera.aspect = width / height;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(width, height);
  if (this.enemyManager && this.enemyManager.particleEnemyGroup) {
    this.enemyManager.particleEnemyGroup.resize(width, height);
  }
}
```

- **Test**: This ensures the shader samples the background texture accurately.

---

#### Fix 3: Test with Full Opacity
If the spheres are still faint or black, the transparency might be making the inverted colors too subtle against the background.

**Temporary Test**:
- Set `this.alpha = 1.0` in your `ParticleEnemyGroup` constructor or wherever it’s defined.
- Run the scene. If the spheres become visible with inverted colors, the issue was transparency blending. Adjust `this.alpha` (e.g., back to 0.7) to your liking afterward.

---

#### Fix 4: Debug the Background Texture
If the above fixes don’t work, the background texture might still be capturing black. Let’s visualize it.

**Add a Debug Plane**:
In `ParticleEnemyGroup`, after setting up `backgroundRT`:

```javascript
const debugPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({ map: this.backgroundRT.texture })
);
debugPlane.position.set(0, 0, -5); // Adjust to be visible
this.scene.add(debugPlane); // Assuming you have access to the scene
```

- **Run the Scene**: If the plane is black or blank, the background render pass isn’t capturing the scene correctly.
- **Check Render Loop**: Ensure your render loop:
  1. Hides particles (`this.instancedMesh.visible = false`).
  2. Renders to `backgroundRT`.
  3. Shows particles (`this.instancedMesh.visible = true`).
  4. Renders to the screen.

Example in `SceneManager`’s `animate`:

```javascript
animate() {
  const enemyManager = this.findEnemyManager();
  if (enemyManager && enemyManager.particleEnemyGroup) {
    const group = enemyManager.particleEnemyGroup;
    group.prepareBackgroundCapture(); // Hide particles
    this.renderer.setRenderTarget(group.backgroundRT);
    this.renderer.render(this.scene, this.camera);
    group.restoreAfterBackgroundCapture(); // Show particles
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}
```

- **Fix if Black**: If the debug plane shows black, double-check that no objects are incorrectly hidden or that the camera is positioned correctly during the background pass.

---

### Step 5: Additional Tweaks (If Needed)
- **Depth Writing**: If the spheres appear but look odd with transparency, try:
  ```javascript
  material.depthWrite = false;
  ```
  This prevents transparent particles from writing to the depth buffer, which can help with blending.

- **Log Shader Output**: Add a debug uniform to output a fixed color:
  ```javascript
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red
  ```
  If red spheres appear, the issue is definitely in the background sampling or inversion logic.

---

### Final Answer
To fix your black spheres and get the colored particle enemies you expect:

1. **Fix Render Target**:
   ```javascript
   this.backgroundRT = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { ... });
   ```

2. **Update Shader with Resolution Uniform**:
   Add `resolution` uniform and use `gl_FragCoord.xy / resolution` for UVs, updating it on resize.

3. **Test with `alpha = 1.0`**:
   Temporarily set full opacity to confirm visibility, then adjust as needed.

4. **Debug Background Texture**:
   Use a debug plane to ensure the background render target captures the scene.

After applying these fixes, your particle enemies should display inverted background colors as intended, influenced by your lighting (e.g., reddish near torches). If issues persist, let me know what you see after these changes, and we’ll dig deeper!