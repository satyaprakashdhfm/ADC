'use client';
import { useState, useEffect } from 'react';
import {
  adminGetWarehouses, adminGetStoreReadiness,
  type Warehouse, type WarehouseInput, type StoreReadinessReport,
} from '@/lib/api';

/**
 * Warehouses, pickup requests and the shipment views.
 *
 * Deliberately does NOT own `orders`/`trackResult` — those come from useAdminOrders, because
 * booking or cancelling a shipment here has to show up in an order-detail modal that may be open
 * on the same order. A second copy would silently go stale.
 */
export function useAdminDelivery(enabled: boolean) {
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [whForm, setWhForm] = useState<{ id?: number; data: WarehouseInput } | null>(null);
  const [purDate, setPurDate] = useState('');
  const [purTime, setPurTime] = useState('10:00');
  const [purCount, setPurCount] = useState('1');
  const [purResult, setPurResult] = useState<string>('');
  const [shipmentBusy, setShipmentBusy] = useState<number | null>(null);
  const [shipmentWeights, setShipmentWeights] = useState<Record<number, string>>({});
  const [delivSub, setDelivSub] = useState<'main' | 'sameday' | 'delhivery'>('main');
  const [storeReadiness, setStoreReadiness] = useState<StoreReadinessReport | null>(null);
  const [sfxStatesOpen, setSfxStatesOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (warehouses === null) adminGetWarehouses().then(setWarehouses).catch(() => setWarehouses([]));
    if (storeReadiness === null) adminGetStoreReadiness().then(setStoreReadiness).catch(() => setStoreReadiness(null));
  }, [enabled, warehouses, storeReadiness]);

  return {
    warehouses, setWarehouses, whForm, setWhForm,
    purDate, setPurDate, purTime, setPurTime, purCount, setPurCount, purResult, setPurResult,
    shipmentBusy, setShipmentBusy, shipmentWeights, setShipmentWeights,
    delivSub, setDelivSub, storeReadiness, setStoreReadiness, sfxStatesOpen, setSfxStatesOpen,
  };
}
