import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuthStore } from '../store';
import { colors } from '../theme/colors';

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
        options={{ tabBarLabel: 'Учёба', tabBarIcon: () => <Text style={{ fontSize: 22 }}>🎓</Text> }}
      />
      <Tab.Screen
        name="Cases"
        component={CasesScreen}
        options={{ tabBarLabel: 'Кейсы', tabBarIcon: () => <Text style={{ fontSize: 22 }}>⚖️</Text> }}
      />
      <Tab.Screen
        name="Bear"
        component={BearScreen}
        options={{ tabBarLabel: 'Мишка', tabBarIcon: () => <Text style={{ fontSize: 22 }}>🐻</Text> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Профиль', tabBarIcon: () => <Text style={{ fontSize: 22 }}>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Lesson" component={LessonScreen} />
      <Stack.Screen name="CaseDetail" component={CaseDetailScreen} />
      <Stack.Screen name="League" component={LeagueScreen} />
      <Stack.Screen name="Articles" component={ArticlesScreen} />
      <Stack.Screen name="Shop" component={ShopScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Premium" component={PremiumScreen} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { isHydrated, isAuthenticated, user, hydrate } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  // Показываем спиннер, пока идёт гидратация, либо пока по валидному токену
  // ещё догружается профиль пользователя (иначе экраны получат user == null
  // и могут упасть при обращении к его полям).
  if (!isHydrated || (isAuthenticated && !user)) {
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