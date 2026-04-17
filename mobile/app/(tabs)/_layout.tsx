import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { OsgbProvider } from '@/store/OsgbContext';
import { useThemeMode } from '@/store/ThemeContext';

export default function TabsLayout() {
  const { theme } = useThemeMode();
  const dark = theme === 'dark';

  return (
    <OsgbProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#0EA5E9',
          tabBarInactiveTintColor: dark ? '#64748B' : '#94A3B8',
          tabBarStyle: {
            backgroundColor: dark ? '#0f172a' : '#ffffff',
            borderTopColor: dark ? '#1e293b' : '#e2e8f0',
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarLabel: 'Genel Bakış',
            tabBarIcon: ({ color, size }) => <Ionicons color={color} name="grid-outline" size={size} />,
          }}
        />
        <Tabs.Screen
          name="firmalar"
          options={{
            title: 'Firmalar',
            tabBarLabel: 'Firmalar',
            tabBarIcon: ({ color, size }) => <Ionicons color={color} name="business-outline" size={size} />,
          }}
        />
        <Tabs.Screen
          name="personel"
          options={{
            title: 'Personel',
            tabBarLabel: 'Personel',
            tabBarIcon: ({ color, size }) => <Ionicons color={color} name="shield-outline" size={size} />,
          }}
        />
        <Tabs.Screen
          name="ziyaretler"
          options={{
            title: 'Ziyaretler',
            tabBarLabel: 'Ziyaretler',
            tabBarIcon: ({ color, size }) => <Ionicons color={color} name="location-outline" size={size} />,
          }}
        />
        <Tabs.Screen
          name="ayarlar"
          options={{
            title: 'Ayarlar',
            tabBarLabel: 'Ayarlar',
            tabBarIcon: ({ color, size }) => <Ionicons color={color} name="settings-outline" size={size} />,
          }}
        />
        <Tabs.Screen
          name="firma-detay/[id]"
          options={{ href: null }}
        />
      </Tabs>
    </OsgbProvider>
  );
}
