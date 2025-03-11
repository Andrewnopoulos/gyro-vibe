# CLAUDE.md - Gyro-Vibe Codebase Guidelines

## Build/Run Commands
- `npm start` - Start the server
- `npm run dev` - Start with nodemon for auto-restart
- `npm test` - Currently not implemented

## Code Style Guidelines
- **Module Pattern**: Client uses ES modules, server uses CommonJS
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Documentation**: JSDoc comments for methods and classes
- **Error Handling**: Use try/catch blocks, log errors to console
- **Architecture**: Event-based communication using EventBus
- **File Organization**: Modular structure with feature-based directories

## Project Structure
- `server/` - Express.js backend with Socket.IO
- `client/` - Frontend HTML/JS with module-based organization
- `client/js/` - Organized by feature (3d, communication, game, etc.)

## Patterns & Conventions
- Use arrow functions for callbacks/handlers
- Prefer async/await over callbacks where possible
- Use EventBus for cross-component communication
- Maintain clear separation between UI and business logic