import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransactionForm, defaultDeductibility } from "@/components/TransactionForm";

describe("TransactionForm", () => {
  it("geçersiz tutarla gönderilmez ve hata gösterir", () => {
    const onSubmit = vi.fn();
    render(<TransactionForm today="2026-10-22" onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Ekle" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Geçerli ve sıfırdan büyük bir tutar/)).toBeInTheDocument();
    expect(screen.getByText("Kategori seç")).toBeInTheDocument();
  });

  it("geçerli girdiyi kuruşa çevirip gönderir; kategori varsayılan vergisel durumu atar", () => {
    const onSubmit = vi.fn();
    render(<TransactionForm today="2026-10-22" onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Tutar (KDV hariç)"), { target: { value: "12.500,75" } });
    fireEvent.change(screen.getByLabelText("Kategori"), { target: { value: "Yazılım / Abonelik" } });
    fireEvent.click(screen.getByRole("button", { name: "Ekle" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0][0];
    expect(input.amount).toBe(1_250_075);
    expect(input.kind).toBe("expense");
    expect(input.deductibility).toBe("assumed_deductible");
    expect(input.date).toBe("2026-10-22");
  });

  it("kişisel harcama varsayılan olarak indirilemez", () => {
    expect(defaultDeductibility("Kişisel")).toBe("non_deductible");
    expect(defaultDeductibility("Eğitim")).toBe("unknown");
  });
});
