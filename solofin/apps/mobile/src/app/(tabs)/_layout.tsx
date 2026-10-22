import { Tabs } from "expo-router/js-tabs";
import { FloatingTabBar } from "@/components/FloatingTabBar";
import { navy, useTheme } from "@/theme";

export default function TabLayout() {
  const p = useTheme();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        // Ana ekran tasarımı koyu lacivert
        sceneStyle: { backgroundColor: route.name === "index" ? navy.bg : p.bg },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Ana Sayfa" }} />
      <Tabs.Screen name="islemler" options={{ title: "İşlemler" }} />
      <Tabs.Screen name="simulasyon" options={{ title: "Simülasyon" }} />
      <Tabs.Screen name="belgeler" options={{ title: "Belgeler" }} />
      <Tabs.Screen name="profil" options={{ title: "Profil" }} />
    </Tabs>
  );
}
