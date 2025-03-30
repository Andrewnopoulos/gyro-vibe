# CLAUDE.md - Gyro-Vibe Codebase Guidelines

## Build/Run Commands
- `npm start` - Start the server
- `npm run dev` - Start with nodemon for auto-restart
- `npm test` - Currently not implemented

## Code Style Guidelines
- **Module Pattern**: Client uses ES modules (import/export), server uses CommonJS (require)
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Documentation**: JSDoc comments for methods and classes
- **Error Handling**: Use try/catch blocks, log errors to console
- **Architecture**: Event-based communication using EventBus
- **File Organization**: Modular structure with feature-based directories

## Project Structure
- `server/` - Express.js backend with Socket.IO and WebRTC signaling
- `client/` - Frontend HTML/JS with module-based organization
- `client/js/` - Organized by feature (3d, communication, game, etc.)

## Patterns & Conventions
- Use arrow functions for callbacks/handlers
- Prefer async/await over callbacks where possible
- Use EventBus for cross-component communication
- Maintain clear separation between UI and business logic
- 4-space indentation in all code files
- Mobile detection using comprehensive pattern matching

## Custom Requests
- **"Don't use Git commands"** - I am manually using git to manage the repo. Please don't use any git commands as they may interfere
- **"Don't run NPM on completion"** - I will test things manually myself, running an npm server interferes with my ability to test