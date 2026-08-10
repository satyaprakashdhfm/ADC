'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  adminGetOrders, adminUpdateOrderStatus, adminRebookShipment, adminRetryPosRelay,
  type Order,
} from '@/lib/api';

interface Deps {
  onError: (s: string) => void;
  onNotice: (s: string) => void;
  refreshStats: () => void;
  refreshAttention: () => void;
}

/**
 * Orders, the two modals driven by them, and the fix-it actions.
 *
 * rebookShipment/retryPosRelay are Delivery- and POS-domain actions but live here because what they
 * mutate is the order list and the open order modal. The Delivery tab reads `orders`/`trackResult`
 * from this hook rather than keeping its own copy — booking a shipment there has to be visible in
 * an order modal that happens to be open on the same order.
 */
export function useAdminOrders(enabled: boolean, { onError, onNotice, refreshStats, refreshAttention }: Deps) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  // Outcome of a cancel — shown as a modal rather than a banner, because a REFUSED cancel means a
  // rider is still coming and must not be something you can scroll past.
  const [cancelInfo, setCancelInfo] = useState<{ orderNumber: string; ok: boolean; message: string } | null>(null);
  const [fixing, setFixing] = useState<number | null>(null);   // order id currently being re-booked/re-relayed
  const [trackResult, setTrackResult] = useState<Record<number, unknown>>({});

  useEffect(() => {
    if (enabled && orders === null) adminGetOrders().then(setOrders).catch(() => setOrders([]));
  }, [enabled, orders]);

  const refreshOrders = useCallback(() => { adminGetOrders().then(setOrders).catch(() => {}); }, []);

  const changeOrderStatus = async (id: number, status: string) => {
    const updated = await adminUpdateOrderStatus(id, status).catch(() => null);
    if (!updated) return;
    setOrders(o => (o || []).map(x => x.id === id ? updated : x));
    refreshStats();
    refreshAttention();
    // Cancelling also cancels the POS ticket and the courier booking. If either refused, say so
    // loudly — otherwise the operator assumes the rider was called off when they were not.
    if (updated.cancelWarnings?.length) {
      setCancelInfo({ orderNumber: updated.orderNumber, ok: false, message: updated.cancelWarnings.join(String.fromCharCode(10, 10)) });
    }
  };

  // Refresh the open modal too, or it keeps showing the failure that was just fixed.
  const reloadOrdersAndModal = () => {
    adminGetOrders().then(list => { setOrders(list); setViewOrder(v => (v ? list.find(x => x.id === v.id) ?? v : v)); }).catch(() => {});
  };

  /** Retry the automatic courier booking for a paid order that never got one. */
  const rebookShipment = async (id: number) => {
    setFixing(id); onError(''); onNotice('');
    try {
      const r = await adminRebookShipment(id);
      onNotice(`Courier booked — ${r.carrier} ${r.waybill}`);
      reloadOrdersAndModal();
      refreshAttention();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Could not book a courier');
    } finally { setFixing(null); }
  };

  /** Push a paid order to the Petpooja POS again — after fixing an item mapping, typically. */
  const retryPosRelay = async (id: number) => {
    setFixing(id); onError(''); onNotice('');
    try {
      const r = await adminRetryPosRelay(id);
      if (r.ok) onNotice(r.skipped ? 'Already on the POS.' : 'Sent to the Petpooja POS.');
      else onError(`POS refused it: ${r.reason}`);
      reloadOrdersAndModal();
      refreshAttention();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Could not reach the POS');
    } finally { setFixing(null); }
  };

  return {
    orders, setOrders, refreshOrders,
    search, setSearch, statusFilter, setStatusFilter, carrierFilter, setCarrierFilter, paymentFilter, setPaymentFilter,
    viewOrder, setViewOrder, cancelInfo, setCancelInfo, fixing,
    trackResult, setTrackResult,
    changeOrderStatus, rebookShipment, retryPosRelay,
  };
}
