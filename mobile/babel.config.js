module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4 вынес ворклеты в отдельный пакет react-native-worklets.
      // Его babel-плагин заменяет прежний react-native-reanimated/plugin и
      // должен быть ПОСЛЕДНИМ в массиве.
      'react-native-worklets/plugin',
    ],
  };
};