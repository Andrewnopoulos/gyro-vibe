
### Implementation ✅

If the user accesses with ?portal=true I'd like the game to:
- ✅ set the player's name based on the username query param (if present)
- ✅ if there's no username param, just use a random name
- ✅ check for existing multiplayer lobbies
- ✅ if there's a lobby running that isn't full, join it immediately
- ✅ if there are no lobbies or if they're all full, create a new lobby

Implemented in app.js:
- Added username query parameter support with random fallback
- Added automatic lobby joining logic
- Added automatic lobby creation if no joinable lobbies exist
- Ensured proper phone orientation simulation in portal mode
- Integrated with existing debugging and enemy management