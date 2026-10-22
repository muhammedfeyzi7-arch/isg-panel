// Jest için hafif Reanimated taklidi. expo-router'ın test kurulumu "react-native-reanimated/mock"u
// yüklemeye çalışır; Reanimated 4'ün kendi taklidi Jest'te worklets yerel modülü yüzünden yüklenemediği
// için bu dosyaya yönlendirilir (package.json → jest.moduleNameMapper).
const React = require("react");
const { View, Text, ScrollView, Image } = require("react-native");

const chain = () => {
  const b = { delay: () => b, duration: () => b, springify: () => b, damping: () => b, easing: () => b, withCallback: () => b, build: () => () => ({}) };
  return b;
};
const animation = new Proxy({}, { get: () => chain() });

function createAnimatedComponent(Component) {
  return React.forwardRef(function Animated(props, ref) {
    const { entering: _e, exiting: _x, layout: _l, ...rest } = props;
    return React.createElement(Component, { ...rest, ref });
  });
}

const AnimatedNs = {
  View: createAnimatedComponent(View),
  Text: createAnimatedComponent(Text),
  ScrollView: createAnimatedComponent(ScrollView),
  Image: createAnimatedComponent(Image),
  createAnimatedComponent,
  call: () => {},
};

const sharedValue = (init) => {
  const sv = { value: init };
  sv.get = () => sv.value;
  sv.set = (v) => {
    sv.value = typeof v === "function" ? v(sv.value) : v;
  };
  return sv;
};

module.exports = {
  __esModule: true,
  default: AnimatedNs,
  ...AnimatedNs,
  FadeIn: animation.FadeIn,
  FadeInDown: animation.FadeInDown,
  FadeInUp: animation.FadeInUp,
  FadeOut: animation.FadeOut,
  ZoomIn: animation.ZoomIn,
  LinearTransition: animation.LinearTransition,
  useSharedValue: (init) => React.useRef(sharedValue(init)).current,
  useAnimatedStyle: (fn) => fn(),
  useAnimatedProps: (fn) => fn(),
  useDerivedValue: (fn) => ({ value: fn() }),
  useReducedMotion: () => true,
  withSpring: (v) => v,
  withTiming: (v) => v,
  withDelay: (_d, v) => v,
  withSequence: (...v) => v[v.length - 1],
  withRepeat: (v) => v,
  cancelAnimation: () => {},
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  interpolate: (v) => v,
  Easing: new Proxy({}, { get: () => () => (t) => t }),
};
