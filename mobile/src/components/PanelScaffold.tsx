import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { useAuth } from '@/store/AuthContext';

interface PanelScaffoldProps {
  title: string;
  subtitle: string;
}

export function PanelScaffold({ title, subtitle }: PanelScaffoldProps) {
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <View style={{ flex: 1, justifyContent: 'space-between', padding: 20 }}>
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 26, fontWeight: '700' }}>{title}</Text>
          <Text style={{ color: '#94A3B8', fontSize: 14, lineHeight: 20 }}>{subtitle}</Text>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: '#64748B', fontSize: 12 }}>
            Sonraki adım: Bu panele modül ekranlarını ekleyeceğiz.
          </Text>
          <Pressable
            onPress={signOut}
            style={{
              alignItems: 'center',
              backgroundColor: '#1E293B',
              borderColor: '#334155',
              borderRadius: 12,
              borderWidth: 1,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: '#E2E8F0', fontWeight: '600' }}>Çıkış Yap</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
