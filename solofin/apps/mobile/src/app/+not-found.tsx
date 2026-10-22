import { Link, Stack } from "expo-router";
import { Screen, T } from "@/components/ui";

export default function NotFound() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Bulunamadı" }} />
      <T v="h2">Sayfa bulunamadı</T>
      <Link href="/">
        <T color="primary">Ana sayfaya dön</T>
      </Link>
    </Screen>
  );
}
