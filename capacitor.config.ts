import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.anteandfriends.app',
  appName: 'Ante & Friends',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#071914',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#071914',
      overlaysWebView: false,
    },
  },
};

export default config;
