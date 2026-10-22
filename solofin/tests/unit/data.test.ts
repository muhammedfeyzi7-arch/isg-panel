import { describe, expect, it } from "vitest";
import { AccessDeniedError, emptyDatabase, hydrateDatabase, NotFoundError, Repository } from "@/lib/data/repository";
import { exportTransactionsCsv, importTransactionsCsv, parseCsv } from "@/lib/finance/csv";
import type { TransactionInput } from "@/lib/data/schema";
import { DEFAULT_SETTINGS } from "@/lib/data/demo";

const input: TransactionInput = {
  kind: "expense",
  date: "2026-10-01",
  amount: 120_000,
  currency: "TRY",
  vatRate: 0.2,
  category: "Yazılım / Abonelik",
  counterparty: "Figma",
  description: "Aylık plan",
  status: "paid",
  withholdingRate: 0,
  deductibility: "assumed_deductible",
};

describe("kullanıcı izolasyonu (yerel depo)", () => {
  it("kullanıcı başka kullanıcının kayıtlarını göremez, güncelleyemez, silemez", () => {
    const db = emptyDatabase();
    const alice = new Repository(db, "alice");
    const bob = new Repository(db, "bob");
    const a = alice.createTransaction(input);
    bob.createTransaction({ ...input, amount: 50_000 });

    expect(alice.listTransactions()).toHaveLength(1);
    expect(bob.listTransactions()).toHaveLength(1);
    expect(bob.listTransactions().some((t) => t.id === a.id)).toBe(false);
    expect(() => bob.getTransaction(a.id)).toThrow(AccessDeniedError);
    expect(() => bob.updateTransaction(a.id, { ...input, amount: 1 })).toThrow(AccessDeniedError);
    expect(() => bob.deleteTransaction(a.id)).toThrow(AccessDeniedError);
    expect(alice.getTransaction(a.id).amount).toBe(120_000);
  });

  it("güncelleme userId'yi değiştiremez", () => {
    const db = emptyDatabase();
    const alice = new Repository(db, "alice");
    const a = alice.createTransaction(input);
    const updated = alice.updateTransaction(a.id, { ...input, userId: "bob" } as unknown as TransactionInput);
    expect(updated.userId).toBe("alice");
  });

  it("senaryo ve ayarlar kullanıcıya özeldir", () => {
    const db = emptyDatabase();
    const alice = new Repository(db, "alice");
    const bob = new Repository(db, "bob");
    const sc = alice.saveScenario("Zam", { oneOffPurchase: 0, oneOffPurchaseDeductible: true, priceChange: 0.1, incomeDrop: 0, newClientMonthly: 0, collectionDelayDays: 0, monthlyExpenseIncrease: 0, extraMonthlySavings: 0 });
    expect(bob.listScenarios()).toHaveLength(0);
    expect(() => bob.deleteScenario(sc.id)).toThrow(AccessDeniedError);
    alice.saveSettings({ ...DEFAULT_SETTINGS, cashBalance: 999 });
    expect(bob.getSettings().cashBalance).toBe(DEFAULT_SETTINGS.cashBalance);
  });

  it("hesap silme yalnızca kendi verisini siler", () => {
    const db = emptyDatabase();
    const alice = new Repository(db, "alice");
    const bob = new Repository(db, "bob");
    alice.createTransaction(input);
    bob.createTransaction(input);
    alice.deleteAllData();
    expect(alice.listTransactions()).toHaveLength(0);
    expect(bob.listTransactions()).toHaveLength(1);
  });

  it("oturumsuz depo oluşturulamaz; olmayan kayıt NotFound", () => {
    expect(() => new Repository(emptyDatabase(), "")).toThrow(AccessDeniedError);
    expect(() => new Repository(emptyDatabase(), "x").getTransaction("nope")).toThrow(NotFoundError);
  });

  it("geçersiz girdi reddedilir", () => {
    const repo = new Repository(emptyDatabase(), "alice");
    expect(() => repo.createTransaction({ ...input, amount: -5 })).toThrow();
    expect(() => repo.createTransaction({ ...input, date: "2026-13-45" })).toThrow();
    expect(() => repo.createTransaction({ ...input, category: "" })).toThrow();
  });

  it("bozuk depolama verisi temizlenerek yüklenir", () => {
    const db = hydrateDatabase({ transactions: [{ id: 1 }, null], settings: { a: { bad: true } } });
    expect(db.transactions).toHaveLength(0);
    expect(db.settings).toEqual({});
  });
});

describe("CSV", () => {
  it("tırnaklı alanları ve noktalı virgül ayırıcıyı ayrıştırır", () => {
    expect(parseCsv('a;b\n"x;y";"say ""hi"""\n')).toEqual([["a", "b"], ["x;y", 'say "hi"']]);
  });

  it("geçerli satırları içe aktarır", () => {
    const csv = "tarih,tur,kategori,tutar,kdv_orani,durum\n2026-10-01,gider,Ekipman,\"1.250,50\",20,ödendi\n2026-10-02,gelir,Proje Geliri,10000,0.2,bekliyor\n";
    const r = importTransactionsCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].amount).toBe(125_050);
    expect(r.rows[0].vatRate).toBe(0.2);
    expect(r.rows[1].status).toBe("pending");
  });

  it("geçersiz verileri satır numarasıyla raporlar ve geçerlileri korur", () => {
    const csv = [
      "tarih,tur,kategori,tutar",
      "2026-10-01,gider,Ekipman,100",
      "2026-02-30x,gider,Ekipman,100",
      "2026-10-01,transfer,Ekipman,100",
      "2026-10-01,gider,Ekipman,-50",
      "2026-10-01,gider,,100",
      "2026-10-01,gelir,Danışmanlık,abc",
    ].join("\n");
    const r = importTransactionsCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7]);
  });

  it("zorunlu sütun eksikse tüm dosyayı reddeder", () => {
    const r = importTransactionsCsv("tarih,kategori\n2026-01-01,x");
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0].message).toMatch(/tur/);
  });

  it("dışa aktarma → içe aktarma gidiş-dönüşü korur ve formül enjeksiyonunu engeller", () => {
    const repo = new Repository(emptyDatabase(), "alice");
    repo.createTransaction({ ...input, description: "=HYPERLINK(\"x\")", counterparty: "A, B" });
    const csv = exportTransactionsCsv(repo.listTransactions());
    expect(csv).toContain("'=HYPERLINK");
    const back = importTransactionsCsv(csv);
    expect(back.errors).toEqual([]);
    expect(back.rows[0].amount).toBe(input.amount);
    expect(back.rows[0].counterparty).toBe("A, B");
  });
});
