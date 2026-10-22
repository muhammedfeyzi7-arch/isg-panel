import { Tabs } from "expo-router/js-tabs";
import { ArrowLeftRight, FileText, FlaskConical, House, UserRound } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { navy, useTheme } from "@/theme";

export default function TabLayout() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={({ route }) => {
        // Ana ekran tasarımı koyu lacivert; sekme çubuğu da ona uyar.
        const t = route.name === "index" ? navy : p;
        return {
          headerShown: false,
          tabBarActiveTintColor: t.primary,
          tabBarInactiveTintColor: t.subtle,
          tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border, height: 68 + insets.bottom, paddingBottom: insets.bottom },
          tabBarItemStyle: { paddingTop: 6, paddingBottom: 8 },
          tabBarLabelStyle: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
          sceneStyle: { backgroundColor: t.bg },
        };
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Ana Sayfa", tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="islemler" options={{ title: "Gelir/Gider", tabBarIcon: ({ color, size }) => <ArrowLeftRight color={color} size={size} /> }} />
      <Tabs.Screen name="simulasyon" options={{ title: "Simülasyon", tabBarIcon: ({ color, size }) => <FlaskConical color={color} size={size} /> }} />
      <Tabs.Screen name="belgeler" options={{ title: "Belgeler", tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }} />
      <Tabs.Screen name="profil" options={{ title: "Profil", tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
    </Tabs>
  );
}
