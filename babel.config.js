module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-worklets/plugin (re-exported via react-native-reanimated/plugin) MUST be listed last.
      'react-native-reanimated/plugin',
    ],
  };
};
