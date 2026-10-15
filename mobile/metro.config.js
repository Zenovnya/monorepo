const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Zustand 4 exposes an ESM build that references `import.meta.env`. Metro
// currently emits the web development bundle as a classic script, where
// `import.meta` is a syntax error. Prefer the React Native/CommonJS export on
// every platform; it has the same public API and works in Expo Web and native.
config.resolver.unstable_conditionNames = ['react-native', 'require'];

module.exports = config;