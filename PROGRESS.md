1. Centralize Event Handling
Pick one place to handle the multiplayer:room-joined event—ideally mobile-game-manager.js, since it seems to be the core logic for managing the game. Remove the event listener from play.html (or its associated script) to eliminate duplication. This way, there’s no chance of two components fighting over the same event.

2. Control Initialization
Make sure MobileGameManager is initialized only once and in a controlled way. You can use a flag or a singleton pattern to prevent multiple initializations. This avoids the race condition where play.html might be trying to set things up while mobile-game-manager.js is still processing.

3. Handle Asynchronous Operations Properly
If joining a room or initializing the game involves asynchronous tasks (e.g., network requests), use async/await or promises to ensure everything happens in the right order.

4. Keep Responsibilities Clear
Let mobile-game-manager.js own all game-related logic, including event handling and initialization. play.html (or its script) can focus on UI setup or other concerns, delegating game management to MobileGameManager.