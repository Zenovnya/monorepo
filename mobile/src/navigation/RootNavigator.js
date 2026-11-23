import React, { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuthStore } from '../store';
import { colors } from '../theme/colors';
import { TabBarIcon } from './TabBarIcon';
import { TAB_BAR_BASE_HEIGHT } from './tabBar';

import LoginScreen from '../screens/LoginScreen';
import SplashScreen from '../screens/SplashScreen';
import RegisterScreen from '../screens/RegisterScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LearnScreen from '../screens/LearnScreen';
import AdaptiveLearningScreen from '../screens/AdaptiveLearningScreen';
import BearScreen from '../screens/BearScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LessonScreen from '../screens/LessonScreen';
import ApplicationsScreen from '../screens/ApplicationsScreen';
import LeagueScreen from '../screens/LeagueScreen';
import ShopScreen from '../screens/ShopScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PremiumScreen from '../screens/PremiumScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import PaymentReturnScreen from '../screens/PaymentReturnScreen';
import DeleteAccountScreen from '../screens/DeleteAccountScreen';
import NoLivesScreen from '../screens/NoLivesScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.error,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          height: TAB_BAR_BASE_HEIGHT + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 4,
          shadowColor: 'transparent',
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '900' },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tab.Screen
        name="Learn"
        component={LearnScreen}
        options={{ tabBarLabel: 'Учёба', tabBarIcon: ({ focused }) => <TabBarIcon glyph="🎓" focused={focused} /> }}
      />
      <Tab.Screen
        name="Adaptive"
        component={AdaptiveLearningScreen}
        options={{ tabBarLabel: 'Адаптивное', tabBarIcon: ({ focused }) => <TabBarIcon glyph="⚖️" focused={focused} /> }}
      />
      <Tab.Screen
        name="Bear"
        component={BearScreen}
        options={{ tabBarLabel: 'Мишка', tabBarIcon: ({ focused }) => <TabBarIcon glyph="🐻" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Профиль', tabBarIcon: ({ focused }) => <TabBarIcon glyph="👤" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        // Плавный cross-fade вместо резкого «слайда»: переход между
        // входом и регистрацией не должен выглядеть как смена экрана целиком.
        animation: 'fade',
        animationDuration: 260,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
      />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        // Плавный переход вместо резкой смены экрана. Первый экран (табы)
        // не анимируем: он должен появляться сразу после сплэша.
        animation: 'slide_from_right',
        animationDuration: 280,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Lesson" component={LessonScreen} />
      <Stack.Screen name="League" component={LeagueScreen} />
      <Stack.Screen name="Shop" component={ShopScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Premium" component={PremiumScreen} />
      <Stack.Screen name="PaymentReturn" component={PaymentReturnScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="NoLives" component={NoLivesScreen} />
      <Stack.Screen name="Applications" component={ApplicationsScreen} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { isHydrated, isAuthenticated, user, hydrate } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  // Гидратация токенов — локальное чтение из хранилища (доли миллисекунды),
  // но первое впечатление важнее скорости: пока идет загрузка показываем
  // запускную анимацию маскота (он выходит и дает пять), а не спиннер.
  // Экран анимации держится минимальное время, чтобы приветствие было
  // видно, и уходит, когда навигация уже готова.
  const [splashDone, setSplashDone] = React.useState(false);

  if (!isHydrated || !splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }

  // Пользователь ещё не прошёл онбординг — показываем его.
  if (isAuthenticated && user && !user.onboarded) {
    return <OnboardingScreen />;
  }

  return isAuthenticated ? <MainStack /> : <AuthStack />;
}