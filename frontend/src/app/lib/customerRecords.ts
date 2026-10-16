import { customersApi } from '../api';
import type { CustomerDto } from '../api/types';

/** Plates compare by their characters alone; screens space them differently. */
export const normalizePlate = (s: string) => s.replace(/\s+/g, '').replace(/ایران/g, '').replace(/-/g, '');

/**
 * Finds or creates the customer behind a phone number, and the car behind a plate.
 *
 * Both ways of starting an order go through here. They used to differ: booking from the bay
 * board created the customer, while the new-order form left anyone not picked from its search
 * box as an anonymous guest — so the same person got a loyalty record from one screen and
 * none from the other, and was a stranger at the bay the next time they came.
 *
 * Nothing here blocks an order. If the lookup or the save fails, the order still goes ahead
 * as a guest order and the failure is left for the caller to ignore.
 */
export async function ensureCustomerAndVehicle(input: {
  phone?: string | null;
  name?: string | null;
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  /** A customer already chosen on screen, if any. */
  known?: CustomerDto | null;
}): Promise<{ customer: CustomerDto | null; vehicleId: string | null }> {
  const phone = input.phone?.trim() || '';
  const name = input.name?.trim() || '';
  const plate = input.plate?.trim() || '';

  let customer: CustomerDto | null = input.known ?? null;

  if (!customer && phone) {
    const found = await customersApi.search({ search: phone, pageSize: 5 });
    customer = found.items.find(c => c.phone === phone) ?? null;
  }
  if (!customer && phone) {
    customer = await customersApi.create({ fullName: name || 'مشتری', phone });
  }
  if (!customer || !plate) return { customer, vehicleId: null };

  // The search result may be a summary; read the customer to see every car they own.
  const full = customer.vehicles ? customer : await customersApi.get(customer.id);
  const same = (full.vehicles ?? []).find(v => normalizePlate(v.plate) === normalizePlate(plate));
  if (same) return { customer: full, vehicleId: same.id };

  const added = await customersApi.addVehicle(customer.id, {
    plate,
    brand: input.brand?.trim() || '',
    model: input.model?.trim() || '',
  });
  return { customer: full, vehicleId: added.id };
}
