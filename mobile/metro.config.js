const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Zustand 4 exposes an ESM build that references `import.meta.env`. Metro
// currently emits the web development bundle as a classic script, where
// `import.meta` is a syntax error. Prefer CommonJS exports while preserving
// Expo's platform-specific conditions (`react-native` on native and `browser`
// on web).
config.resolver.unstable_conditionNames = ['require'];

module.exports = config;