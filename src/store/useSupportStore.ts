/**
 * useSupportStore — merkezi support modal state yönetimi
 *
 * Module-level singleton state kullanır — her hook çağrısı aynı state'i paylaşır.
 * Bu sayede SupportButton, ProfileMenu, Sidebar, HekimSidebar, OsgbSidebar
 * hepsi aynı modal state'ini görür ve kontrol eder.
 */

import { useState, useEffect, useCallback } from 'react';

export interface SupportStoreState {
  supportOpen: boolean;
  viewTicketId: string | null;
  openSupport: () => void;
  closeSupport: () => void;
  openTicket: (ticketId: string) => void;
}

// ── Module-level singleton state ──────────────────────────────────────────
let _supportOpen = false;
let _viewTicketId: string | null = null;
const _listeners = new Set<() => void>();

function notifyListeners() {
  _listeners.forEach(fn => fn());
}

// ── Stable action functions (never recreated) ─────────────────────────────
function openSupport() {
  _viewTicketId = null;
  _supportOpen = true;
  notifyListeners();
}

function closeSupport() {
  _supportOpen = false;
  _viewTicketId = null;
  notifyListeners();
}

function openTicket(ticketId: string) {
  _viewTicketId = ticketId;
  _supportOpen = true;
  notifyListeners();
}

// ── Hook ─────────────────────────────────────────────────────────────────
export function useSupportStore(): SupportStoreState {
  // Local state is only used to trigger re-renders when singleton changes
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  // Stable callbacks — always reference module-level functions
  const stableOpenSupport = useCallback(openSupport, []);
  const stableCloseSupport = useCallback(closeSupport, []);
  const stableOpenTicket = useCallback(openTicket, []);

  return {
    supportOpen: _supportOpen,
    viewTicketId: _viewTicketId,
    openSupport: stableOpenSupport,
    closeSupport: stableCloseSupport,
    openTicket: stableOpenTicket,
  };
}
