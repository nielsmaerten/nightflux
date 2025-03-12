# Nightflux Developer Guide

## Runtime: Bun

Nightflux uses [Bun](https://bun.sh) as its runtime and package manager. You can install Bun by running:

```bash
curl -fsSL https://bun.sh/install | bash
```

After installation, ensure Bun is available in your terminal by restarting it or sourcing your shell profile.

## Installing Dependencies

Once Bun is installed, install the project dependencies with:

```bash
bun install
```

## Running the Project

For development, you can run the project using the following commands:

- **Start the project**:  
  This command compiles and runs the application.
  ```bash
  bun src/nightflux.ts
  ```

- **Compile the project**:  
  If you need to generate a standalone binary, compile the project:
  ```bash
  bun build --compile src/nightflux.ts
  ```

- **Development Mode**:  
  For a build with source maps and debugging, use:
  ```bash
  tsc && node --inspect dist/nightflux.js
  ```

## Additional Developer Tools

- **Linting**:  
  Check for code style and errors:
  ```bash
  bun lint[:fix]
  ```

- **Type checking**:  
  Check for Typescript errors:
  ```bash
  bun check
  ```

## Further Reading

- [Bun Documentation](https://bun.sh/docs)

