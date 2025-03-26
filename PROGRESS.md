✓ How to add a start and exit portal:
Make an exit portal in your game they can walk/fly/drive into, you can add a label like Vibeverse Portal. This way players can play and go to the next game like a metaverse webring! Your game will be added if you have a portal.

And if they enter the portal it should redirect the page here:

http://portal.pieter.com

You can send GET query params (like ?username=bla&color=red&speed=0.2&ref=bla.com) that get forwarded like:
- username= (username/name of player)
- color= (color of player in hex or just red/green/yellow)
- speed= (meters per second)
- ref= (url of which game you come from)

You can use the ?ref= param to add a portal BACK to the game they came from

The URL would look like portal.pieter .com/?username=levelsio&color=red&speed=5&ref=fly.pieter. com

Then the game you portal too can use that information to put the player in the new game with full continuity!

If you want also:
-avatar_url=
- team=
-speed_x=  (meters per second)
-speed_y= (meters per second)
-speed_z= (meters per second)
-rotation_x=
-rotation_y=
-rotation_z=

The portal redirector will always add ?portal=true so you can use that to figure out if user comes from a portal and instantly put them in your game coming out of another portal without any start screens

✓ Add a start portal:
(!) IMPORTANT: when receiving a user (with ?portal=true in your URL) and ?ref= make a portal where the user spawns out of and they can return back to the previous game if they go back into that portal. When returning them make sure to send all the ?query parameters again too

✓ IMPORTANT: make sure your game instantly loads (no loading screens, no input screens) so the continuity is nice for players

Implementation Details:
- Added PortalManager class in client/js/game/portal-manager.js
- Created red entry portal that appears only in portal mode
- Created green exit portal that links to the VibeVerse portal
- Added collision detection for both portals
- Set up parameter forwarding for both entry and exit portals
- Entry portal allows returning to the referrer game
- Exit portal sends player to portal.pieter.com with all required parameters
- Removed mobile redirect to allow mobile users to access the main game interface
- Removed /play endpoint completely for a unified interface experience
- Deleted the play.html file as it's no longer needed

SAMPLE CODE: for ThreeJS here's my sample code to make a start and exit portal:


        if (new URLSearchParams(window.location.search).get('portal')) {
            // <create start portal>
                // Create portal group to contain all portal elements
                const startPortalGroup = new THREE.Group();
                startPortalGroup.position.set(SPAWN_POINT_X, SPAWN_POINT_Y, SPAWN_POINT_Z);
                startPortalGroup.rotation.x = 0.35;
                startPortalGroup.rotation.y = 0;

                // Create portal effect
                const startPortalGeometry = new THREE.TorusGeometry(15, 2, 16, 100);
                const startPortalMaterial = new THREE.MeshPhongMaterial({
                    color: 0xff0000,
                    emissive: 0xff0000,
                    transparent: true,
                    opacity: 0.8
                });
                const startPortal = new THREE.Mesh(startPortalGeometry, startPortalMaterial);
                startPortalGroup.add(startPortal);
                                
                // Create portal inner surface
                const startPortalInnerGeometry = new THREE.CircleGeometry(13, 32);
                const startPortalInnerMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff0000,
                    transparent: true,
                    opacity: 0.5,
                    side: THREE.DoubleSide
                });
                const startPortalInner = new THREE.Mesh(startPortalInnerGeometry, startPortalInnerMaterial);
                startPortalGroup.add(startPortalInner);

                // Create particle system for portal effect
                const startPortalParticleCount = 1000;
                const startPortalParticles = new THREE.BufferGeometry();
                const startPortalPositions = new Float32Array(startPortalParticleCount * 3);
                const startPortalColors = new Float32Array(startPortalParticleCount * 3);

                for (let i = 0; i < startPortalParticleCount * 3; i += 3) {
                    // Create particles in a ring around the portal
                    const angle = Math.random() * Math.PI * 2;
                    const radius = 15 + (Math.random() - 0.5) * 4;
                    startPortalPositions[i] = Math.cos(angle) * radius;
                    startPortalPositions[i + 1] = Math.sin(angle) * radius;
                    startPortalPositions[i + 2] = (Math.random() - 0.5) * 4;

                    // Red color with slight variation
                    startPortalColors[i] = 0.8 + Math.random() * 0.2;
                    startPortalColors[i + 1] = 0;
                    startPortalColors[i + 2] = 0;
                }

                startPortalParticles.setAttribute('position', new THREE.BufferAttribute(startPortalPositions, 3));
                startPortalParticles.setAttribute('color', new THREE.BufferAttribute(startPortalColors, 3));

                const startPortalParticleMaterial = new THREE.PointsMaterial({
                    size: 0.2,
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.6
                });

                const startPortalParticleSystem = new THREE.Points(startPortalParticles, startPortalParticleMaterial);
                startPortalGroup.add(startPortalParticleSystem);

                // Add portal group to scene
                scene.add(startPortalGroup);

                // Create portal collision box
                startPortalBox = new THREE.Box3().setFromObject(startPortalGroup);

                // Animate particles and portal and check for collision
                function animateStartPortal() {
                    const positions = startPortalParticles.attributes.position.array;
                    for (let i = 0; i < positions.length; i += 3) {
                        positions[i + 1] += 0.05 * Math.sin(Date.now() * 0.001 + i);
                    }
                    startPortalParticles.attributes.position.needsUpdate = true;
                    // Update portal shader time
                    if (startPortalInnerMaterial.uniforms && startPortalInnerMaterial.uniforms.time) {
                        startPortalInnerMaterial.uniforms.time.value = Date.now() * 0.001;
                    }

                    requestAnimationFrame(animateStartPortal);
                }
                animateStartPortal();
            // </create start portal>
        }
        
        // <create exit portal>
            // Create portal group to contain all portal elements
            const exitPortalGroup = new THREE.Group();
            exitPortalGroup.position.set(-200, 200, -300);
            exitPortalGroup.rotation.x = 0.35;
            exitPortalGroup.rotation.y = 0;

            // Create portal effect
            const exitPortalGeometry = new THREE.TorusGeometry(15, 2, 16, 100);
            const exitPortalMaterial = new THREE.MeshPhongMaterial({
                color: 0x00ff00,
                emissive: 0x00ff00,
                transparent: true,
                opacity: 0.8
            });
            const exitPortal = new THREE.Mesh(exitPortalGeometry, exitPortalMaterial);
            exitPortalGroup.add(exitPortal);

            // Create portal inner surface
            const exitPortalInnerGeometry = new THREE.CircleGeometry(13, 32);
            const exitPortalInnerMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide
            });
            const exitPortalInner = new THREE.Mesh(exitPortalInnerGeometry, exitPortalInnerMaterial);
            exitPortalGroup.add(exitPortalInner);
            
            // Add portal label
            const loader = new THREE.TextureLoader();
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 512; // Increased width
            canvas.height = 64;
            context.fillStyle = '#00ff00';
            context.font = 'bold 32px Arial';
            context.textAlign = 'center';
            context.fillText('VIBEVERSE PORTAL', canvas.width/2, canvas.height/2);
            const texture = new THREE.CanvasTexture(canvas);
            const labelGeometry = new THREE.PlaneGeometry(30, 5); // Increased width
            const labelMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide
            });
            const label = new THREE.Mesh(labelGeometry, labelMaterial);
            label.position.y = 20;
            exitPortalGroup.add(label);

            // Create particle system for portal effect
            const exitPortalParticleCount = 1000;
            const exitPortalParticles = new THREE.BufferGeometry();
            const exitPortalPositions = new Float32Array(exitPortalParticleCount * 3);
            const exitPortalColors = new Float32Array(exitPortalParticleCount * 3);

            for (let i = 0; i < exitPortalParticleCount * 3; i += 3) {
                // Create particles in a ring around the portal
                const angle = Math.random() * Math.PI * 2;
                const radius = 15 + (Math.random() - 0.5) * 4;
                exitPortalPositions[i] = Math.cos(angle) * radius;
                exitPortalPositions[i + 1] = Math.sin(angle) * radius;
                exitPortalPositions[i + 2] = (Math.random() - 0.5) * 4;

                // Green color with slight variation
                exitPortalColors[i] = 0;
                exitPortalColors[i + 1] = 0.8 + Math.random() * 0.2;
                exitPortalColors[i + 2] = 0;
            }

            exitPortalParticles.setAttribute('position', new THREE.BufferAttribute(exitPortalPositions, 3));
            exitPortalParticles.setAttribute('color', new THREE.BufferAttribute(exitPortalColors, 3));

            const exitPortalParticleMaterial = new THREE.PointsMaterial({
                size: 0.2,
                vertexColors: true,
                transparent: true,
                opacity: 0.6
            });

            const exitPortalParticleSystem = new THREE.Points(exitPortalParticles, exitPortalParticleMaterial);
            exitPortalGroup.add(exitPortalParticleSystem);

            // Add full portal group to scene
            scene.add(exitPortalGroup);

            // Create portal collision box
            const exitPortalBox = new THREE.Box3().setFromObject(exitPortalGroup);

            // Animate particles and portal and check for collision
            function animateExitPortal() {
                const positions = exitPortalParticles.attributes.position.array;
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i + 1] += 0.05 * Math.sin(Date.now() * 0.001 + i);
                }
                exitPortalParticles.attributes.position.needsUpdate = true;
                // Update portal shader time
                if (exitPortalInnerMaterial.uniforms && exitPortalInnerMaterial.uniforms.time) {
                    exitPortalInnerMaterial.uniforms.time.value = Date.now() * 0.001;
                }

                requestAnimationFrame(animateExitPortal);
            }
            animateExitPortal();
        // </create exit portal>
        
        
        
        
        
        // <put this in your animate function>
              if (new URLSearchParams(window.location.search).get('portal')) {
                  // <check if player has entered start portal>
                      setTimeout(function() {
                          if (typeof player !== 'undefined' && player) {
                              const playerBox = new THREE.Box3().setFromObject(player);
                              const portalDistance = playerBox.getCenter(new THREE.Vector3()).distanceTo(startPortalBox.getCenter(new THREE.Vector3()));
                              if (portalDistance < 50) {
                                  // Get ref from URL params
                                  const urlParams = new URLSearchParams(window.location.search);
                                  const refUrl = urlParams.get('ref');
                                  if (refUrl) {
                                      // Add https if not present and include query params
                                      let url = refUrl;
                                      if (!url.startsWith('http://') && !url.startsWith('https://')) {
                                          url = 'https://' + url;
                                      }
                                      const currentParams = new URLSearchParams(window.location.search);
                                      const newParams = new URLSearchParams();
                                      for (const [key, value] of currentParams) {
                                          if (key !== 'ref') { // Skip ref param since it's in the base URL
                                              newParams.append(key, value);
                                          }
                                      }
                                      const paramString = newParams.toString();
                                      window.location.href = url + (paramString ? '?' + paramString : '');
                                  }
                              }
                          }
                      },5000);
                  // </check if player has entered start portal>

              }

              // <check if player has entered exit portal>
                  if (typeof player !== 'undefined' && player) {
                      const playerBox = new THREE.Box3().setFromObject(player);
                      // Check if player is within 50 units of the portal
                      const portalDistance = playerBox.getCenter(new THREE.Vector3()).distanceTo(exitPortalBox.getCenter(new THREE.Vector3()));
                      if (portalDistance < 50) {
                          // Start loading the next page in the background
                          const currentParams = new URLSearchParams(window.location.search);
                          const newParams = new URLSearchParams();
                          newParams.append('portal',true);
                          newParams.append('username',selfUsername);
                          newParams.append('color','white');
                          newParams.append('speed',currentSpeed);

                          for (const [key, value] of currentParams) {
                              newParams.append(key, value);
                          }
                          const paramString = newParams.toString();
                          const nextPage = 'https://portal.pieter.com' + (paramString ? '?' + paramString : '');

                          // Create hidden iframe to preload next page
                          if (!document.getElementById('preloadFrame')) {
                              const iframe = document.createElement('iframe');
                              iframe.id = 'preloadFrame';
                              iframe.style.display = 'none';
                              iframe.src = nextPage;
                              document.body.appendChild(iframe);
                          }

                          // Only redirect once actually in the portal
                          if (playerBox.intersectsBox(exitPortalBox)) {
                              window.location.href = nextPage;
                          }
                      }
                  }
              // </check if player has entered exit portal>
        // </put this in your animate function>