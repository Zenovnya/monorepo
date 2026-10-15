import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Expo SecureStore is only available on native platforms. AsyncStorage uses
// localStorage on web and exposes the same async get/set/remove API we need.
const tokenStorage = Platform.OS === 'web'
  ? {
      getItemAsync: AsyncStorage.getItem,
      setItemAsync: AsyncStorage.setItem,
      deleteItemAsync: AsyncStorage.removeItem,
    }
  : SecureStore;

export default tokenStorage;