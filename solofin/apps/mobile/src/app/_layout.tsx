import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StoreProvider, useStore } from "@/store/StoreProvider";
import { navy, useTheme } from "@/theme";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { ready } = useStore();
  const p = useTheme();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: navy.bg }}>
        <ActivityIndicator color="#FFFFFF" accessibilityLabel="Yükleniyor" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={p.dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: p.surface },
          headerTintColor: p.text,
          headerTitleStyle: { fontWeight: "600" },
          headerShadowVisible: false,
          headerBackTitle: "Geri",
          contentStyle: { backgroundColor: p.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "SOLOFIN" }} />
        <Stack.Screen name="islem" options={{ presentation: "modal", title: "İşlem" }} />
        <Stack.Screen name="senaryo" options={{ title: "Senaryo Karşılaştırma" }} />
        <Stack.Screen name="belge" options={{ title: "Fatura Tara" }} />
        <Stack.Screen name="nakit-akisi" options={{ title: "Nakit Akışı" }} />
        <Stack.Screen name="emeklilik" options={{ title: "Emeklilik" }} />
        <Stack.Screen name="raporlar" options={{ title: "Raporlar" }} />
        <Stack.Screen name="ayarlar" options={{ title: "Ayarlar" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <RootNavigator />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
