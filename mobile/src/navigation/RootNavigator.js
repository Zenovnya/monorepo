import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuthStore } from '../store';
import { colors } from '../theme/colors';
import { TabBarIcon } from './TabBarIcon';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LearnScreen from '../screens/LearnScreen';
import CasesScreen from '../screens/CasesScreen';
import BearScreen from '../screens/BearScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LessonScreen from '../screens/LessonScreen';
import CaseDetailScreen from '../screens/CaseDetailScreen';
import LeagueScreen from '../screens/LeagueScreen';
import ArticlesScreen from '../screens/ArticlesScreen';
import ShopScreen from '../screens/ShopScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PremiumScreen from '../screens/PremiumScreen';
import AdaptiveLearningScreen from '../screens/AdaptiveLearningScreen';
import AssessmentScreen from '../screens/AssessmentScreen';
import LearningProgressScreen from '../screens/LearningProgressScreen';
import ReviewsScreen from '../screens/ReviewsScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import PaymentReturnScreen from '../screens/PaymentReturnScreen';
import DeleteAccountScreen from '../screens/DeleteAccountScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 3,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800' },
      }}
    >
      <Tab.Screen
        name="Learn"
        component={LearnScreen}
        options={{ tabBarLabel: 'Учёба', tabBarIcon: ({ focused }) => <TabBarIcon glyph="🎓" focused={focused} /> }}
      />
      <Tab.Screen
        name="Cases"
        component={CasesScreen}
        options={{ tabBarLabel: 'Кейсы', tabBarIcon: ({ focused }) => <TabBarIcon glyph="⚖️" focused={focused} /> }}
      />
      <Tab.Screen
        name="Bear"
        component={BearScreen}
        options={{ tabBarLabel: 'Мишка', tabBarIcon: () => <Text style={{ fontSize: 22 }}>🐻</Text> }}
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
      <Stack.Screen name="CaseDetail" component={CaseDetailScreen} />
      <Stack.Screen name="League" component={LeagueScreen} />
      <Stack.Screen name="Articles" component={ArticlesScreen} />
      <Stack.Screen name="Shop" component={ShopScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Premium" component={PremiumScreen} />
      <Stack.Screen name="PaymentReturn" component={PaymentReturnScreen} />
      <Stack.Screen name="AdaptiveLearning" component={AdaptiveLearningScreen} />
      <Stack.Screen name="Assessment" component={AssessmentScreen} />
      <Stack.Screen name="LearningProgress" component={LearningProgressScreen} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { isHydrated, isAuthenticated, user, hydrate } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  // Спиннер держим только на гидратации токенов из хранилища — это локальное
  // чтение, доли миллисекунды. Раньше здесь ждали ещё и загрузку профиля
  // (/auth/me), то есть приложение не показывало ничего до ответа сети: на
  // медленном соединении это секунды пустого экрана на каждом холодном старте.
  // Экраны умеют жить с user == null (все обращения идут через user?.), профиль
  // догружается в фоне и подставляется сам.
  if (!isHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Пользователь ещё не прошёл онбординг — показываем его.
  if (isAuthenticated && user && !user.onboarded) {
    return <OnboardingScreen />;
  }

  return isAuthenticated ? <MainStack /> : <AuthStack />;
}