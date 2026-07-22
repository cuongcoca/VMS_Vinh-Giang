import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors, radius } from '../theme/colors';

/** Trượt + mờ dần khi xuất hiện (có thể stagger bằng delay) */
export function FadeInUp({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, delay]);
  return (
    <Animated.View
      style={[
        { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable có hiệu ứng lún + mờ khi chạm */
export function PressScale({
  children,
  onPress,
  style,
  disabled,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start()}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Số đếm tăng dần tới giá trị */
export function CountUp({ value, style }: { value: number; style?: StyleProp<TextStyle> }) {
  const [d, setD] = useState(0);
  useEffect(() => {
    const a = new Animated.Value(0);
    const id = a.addListener(({ value: v }) => setD(Math.round(v)));
    Animated.timing(a, { toValue: value, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => a.removeListener(id);
  }, [value]);
  return <Text style={style}>{d}</Text>;
}

/** Thanh tiến độ chạy mượt tới % */
export function AnimatedBar({ value, color = colors.navy, track = '#eceae3', height = 8 }: { value: number; color?: string; track?: string; height?: number }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: Math.max(0, Math.min(100, value)), duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, w]);
  return (
    <View style={{ height, backgroundColor: track, borderRadius: radius.pill, overflow: 'hidden' }}>
      <Animated.View
        style={{ height: '100%', backgroundColor: color, borderRadius: radius.pill, width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }}
      />
    </View>
  );
}

/** Khối skeleton nhấp nháy khi đang tải */
export function Shimmer({ width = '100%', height = 16, style }: { width?: number | string; height?: number; style?: StyleProp<ViewStyle> }) {
  const o = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, [o]);
  return <Animated.View style={[{ width: width as any, height, borderRadius: radius.sm, backgroundColor: '#e7e4dd', opacity: o }, style]} />;
}
