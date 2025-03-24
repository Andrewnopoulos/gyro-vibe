## Code Quality Keywords

- **"Use descriptive variable names"** - Ensures variables clearly indicate their purpose
- **"Add meaningful comments"** - Requests proper documentation of complex logic
- **"Implement error handling"** - Ensures robust error cases are considered
- **"Follow single responsibility principle"** - Makes functions and classes focused on one task
- **"Apply DRY (Don't Repeat Yourself) principles"** - Reduces code duplication
- **"Use proper encapsulation"** - Keeps implementation details private where appropriate
- **"Apply defensive programming"** - Validates inputs and handles edge cases
- **"Include JSDoc comments"** - Ensures good documentation for functions and classes

## Structure and Organization

- **"Create a modular design"** - Encourages separation of concerns
- **"Implement an extensible architecture"** - Ensures new spells can be easily added
- **"Use consistent naming conventions"** - Maintains code readability
- **"Organize related functionality into classes/modules"** - Improves code organization
- **"Apply clean architecture principles"** - Separates business logic from implementation details
- **"Create abstractions for common operations"** - Reduces complexity

## Specific Techniques

- **"Implement the Observer pattern for events"** - Useful for spell effects and notifications
- **"Use Factory pattern for spell creation"** - Simplifies adding new spells
- **"Apply Strategy pattern for spell behaviors"** - Makes spell effects interchangeable
- **"Implement proper state management"** - Important for tracking current page and spell state

## Testing and Quality Assurance

- **"Include input validation"** - Ensures robust handling of user actions
- **"Add guard clauses for function parameters"** - Prevents invalid operations
- **"Ensure immutability where appropriate"** - Prevents unexpected side effects
- **"Include console.log statements for debugging"** - Helps with troubleshooting

## Performance Considerations

- **"Optimize texture generation"** - Prevents performance issues with many spell pages
- **"Implement resource cleanup"** - Ensures proper disposal of Three.js resources
- **"Use efficient data structures"** - Ensures good performance with many spells
- **"Apply lazy initialization"** - Only generates resources when needed

## Custom Requests
- **"Don't use Git commands"** - I am manually using git to manage the repo. Please don't use any git commands as they may interfere
- **"Don't run NPM on completion"** - I will test things manually myself, running an npm server interferes with my ability to test

Including these specific keywords in your instructions to Claude Code will help ensure the implementation follows good software engineering practices and remains maintainable as the spellbook feature grows.