const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const zustandRoot = path.dirname(require.resolve('zustand/package.json'));
const webNoopDir = path.join(__dirname, 'web-noop');

// Zustand 4 exposes an ESM build that references `import.meta.env`. Metro
// currently emits the web development bundle as a classic script, where
// `import.meta` is a syntax error. Resolve only Zustand to its CommonJS build;
// all other packages keep Expo's platform-specific resolution conditions.
//
// On the web platform, RN 0.81 in __DEV__ tries to resolve
// `react-devtools-core` and `ReactDevToolsSettingsManager` (only .js.flow
// exists, no .js). React DevTools are irrelevant on web, so these requests
// are redirected to an empty stub — otherwise bundling fails with a 500.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const match = moduleName.match(/^zustand(?:\/(.+))?$/);
  if (match) {
    const relativePath = match[1] ? `${match[1]}.js` : 'index.js';
    return {
      type: 'sourceFile',
      filePath: path.join(zustandRoot, relativePath),
    };
  }

  if (platform === 'web' || platform === null) {
    const isDevTools =
      /^react-devtools-core/.test(moduleName) ||
      /rndevtools\/ReactDevToolsSettingsManager/.test(moduleName) ||
      /ReactDevToolsSettingsManager/.test(moduleName);
    if (isDevTools) {
      return {
        type: 'sourceFile',
        filePath: path.join(webNoopDir, 'react-devtools-noop.js'),
      };
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
