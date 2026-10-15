const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const zustandRoot = path.dirname(require.resolve('zustand/package.json'));

// Zustand 4 exposes an ESM build that references `import.meta.env`. Metro
// currently emits the web development bundle as a classic script, where
// `import.meta` is a syntax error. Resolve only Zustand to its CommonJS build;
// all other packages keep Expo's platform-specific resolution conditions.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const match = moduleName.match(/^zustand(?:\/(.+))?$/);

  if (match) {
    const relativePath = match[1] ? `${match[1]}.js` : 'index.js';
    return {
      type: 'sourceFile',
      filePath: path.join(zustandRoot, relativePath),
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;