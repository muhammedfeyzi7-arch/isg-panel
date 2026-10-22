import AsyncStorage from "@react-native-async-storage/async-storage";
import { cleanup, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import path from "path";

const appDir = path.resolve(__dirname, "../src/app");
// Stack geçiş animasyonları test ortamında tamamlanmadığından itilen ekranlar erişilebilirlik
// ağacında "gizli" görünür; sorgular bu öğeleri de kapsamalı.
const all = { includeHiddenElements: true } as const;

beforeEach(async () => {
  await AsyncStorage.clear();
});
afterEach(() => cleanup());

async function ready() {
  await waitFor(() => expect(screen.queryByLabelText("Yükleniyor", all)).toBeNull(), { timeout: 5000 });
}

describe("SOLOFIN mobil", () => {
  it("ana ekran demo verisiyle güvenle kullanılabilir tutarı gösterir", async () => {
    await renderRouter(appDir, { initialUrl: "/" });
    await ready();
    expect(await screen.findByText("BUGÜN GÜVENLE KULLANABİLECEĞİN", all)).toBeTruthy();
    expect(screen.getByTestId("safe-amount", all).props.children).toMatch(/₺/);
    expect(screen.getAllByText("Demo", all).length).toBeGreaterThan(0);
  });

  it("işlem formu geçersiz girdiyi reddeder, geçerli gideri kaydeder ve kalıcı yazar", async () => {
    await renderRouter(appDir, { initialUrl: "/islem?kind=expense" });
    await ready();
    await fireEvent.press(await screen.findByTestId("tx-save", all));
    expect(await screen.findByText(/Geçerli ve sıfırdan büyük bir tutar/, all)).toBeTruthy();
    expect(screen.getByText("Kategori seç", all)).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("tx-amount", all), "7.777,50");
    await fireEvent.changeText(screen.getByTestId("tx-description", all), "Jest test kursu");
    await fireEvent.press(screen.getByLabelText("Kategori Eğitim", all));
    await fireEvent.press(screen.getByTestId("tx-save", all));

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem("solofin:db:demo:v1");
      expect(raw).toContain("Jest test kursu");
      const db = JSON.parse(raw!);
      const tx = db.transactions.find((t: { description: string }) => t.description === "Jest test kursu");
      expect(tx.amount).toBe(777750);
      expect(tx.deductibility).toBe("unknown");
    });
  });

  it("tuş takımı tutarı TR biçiminde oluşturur", async () => {
    await renderRouter(appDir, { initialUrl: "/islem?kind=expense" });
    await ready();
    await screen.findByLabelText("Virgül", all);
    for (const k of ["1", "2", "5", "0", "0", "Virgül", "7", "5", "9"]) await fireEvent.press(await screen.findByLabelText(k, all));
    expect(screen.getByTestId("tx-amount", all).props.value).toBe("12.500,75");
    await fireEvent.press(screen.getByLabelText("Sil", all));
    expect(screen.getByTestId("tx-amount", all).props.value).toBe("12.500,7");
  });

  it("senaryo ekranı motor sonucunu gösterir ve senaryoyu kaydeder", async () => {
    await renderRouter(appDir, { initialUrl: "/senaryo?preset=raise" });
    await ready();
    expect((await screen.findByTestId("scenario-insight", all)).props.children).toMatch(/net kazancın .* artar/);
    expect(screen.getByTestId("scenario-diff", all).props.children).toMatch(/^\+/);
    await fireEvent.changeText(screen.getByTestId("scenario-name", all), "Jest zam");
    await fireEvent.press(screen.getByTestId("scenario-save", all));
    await waitFor(async () => expect(await AsyncStorage.getItem("solofin:db:demo:v1")).toContain("Jest zam"));
  });

  it("kendi veri moduna geçince demo işlemleri görünmez", async () => {
    await AsyncStorage.setItem("solofin:mode", "local");
    await renderRouter(appDir, { initialUrl: "/islemler" });
    await ready();
    expect(await screen.findByText("Henüz işlem yok", all)).toBeTruthy();
  });
});
