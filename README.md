# apidoc-gen

> **[EN]** Scan JavaScript/TypeScript source files and automatically generate Markdown API documentation from JSDoc comments and Express route definitions.
> **[FR]** Analysez des fichiers JavaScript/TypeScript et générez automatiquement une documentation API en Markdown à partir des commentaires JSDoc et des routes Express.

---

## Features / Fonctionnalités

**[EN]**
- Recursively walks a source directory, skipping `node_modules` and `.git`
- Parses all JSDoc comment blocks (`/** ... */`) into structured objects
- Extracts `@param`, `@returns`, and any arbitrary `@tag` annotations
- Detects Express/Router route declarations (`app.get`, `router.post`, etc.)
- Renders a clean Markdown document with Endpoints and Functions sections
- Outputs to stdout or to a file with `-o`
- Fully programmatic API — integrate into build scripts or CI pipelines

**[FR]**
- Parcourt récursivement un répertoire source en ignorant `node_modules` et `.git`
- Analyse tous les blocs JSDoc (`/** ... */`) en objets structurés
- Extrait les annotations `@param`, `@returns` et toute balise `@tag` arbitraire
- Détecte les déclarations de routes Express/Router (`app.get`, `router.post`, etc.)
- Génère un document Markdown propre avec sections Endpoints et Functions
- Sortie vers stdout ou vers un fichier avec `-o`
- API entièrement programmable — intégrable dans des scripts de build ou CI

---

## Installation

```bash
npm install -g @idirdev/apidoc-gen
```

---

## CLI Usage / Utilisation CLI

```bash
# Scan ./src and print to stdout (scan ./src, affiche sur stdout)
apidoc-gen

# Scan a specific directory (scanner un dossier spécifique)
apidoc-gen ./lib

# Write output to a file (écrire la sortie dans un fichier)
apidoc-gen ./src -o API.md

# Show help (afficher l'aide)
apidoc-gen --help
```

### Example Output / Exemple de sortie

```
# API Documentation

## Endpoints

### GET /users

### POST /users/:id/update

## Functions

### Create a new user account

**Parameters:**
- `name` (string): Full name of the user
- `email` (string): Email address

**Returns:** Promise - Resolves with the created user object

### Validate email format

**Parameters:**
- `email` (string): Email string to validate

**Returns:** boolean - true if valid
```

---

## API (Programmatic) / API (Programmation)

```js
const { parseJSDoc, parseRoutes, generateMarkdown, scanDir } = require('@idirdev/apidoc-gen');

// Parse JSDoc blocks from a source string (parser des blocs JSDoc depuis une chaîne)
const source = `
/**
 * Fetch a user by ID.
 * @param {string} id  The user's unique identifier
 * @returns {Promise} Resolves with the user object
 */
`;
const docs = parseJSDoc(source);
// => [{ description: "Fetch a user by ID.", params: [{type:"string", name:"id", ...}], returns: {...} }]

// Detect Express routes in source code (détecter des routes Express dans du code source)
const routes = parseRoutes(`app.get('/health', handler); router.post('/users', create);`);
// => [{ method: 'GET', path: '/health' }, { method: 'POST', path: '/users' }]

// Render Markdown from parsed data (générer du Markdown depuis les données parsées)
const md = generateMarkdown(docs, routes);

// Scan an entire directory and generate docs (scanner un répertoire entier)
const { docs: allDocs, routes: allRoutes } = scanDir('./src');
const fullDoc = generateMarkdown(allDocs, allRoutes);
require('fs').writeFileSync('API.md', fullDoc);
```

---

## License

MIT © idirdev
