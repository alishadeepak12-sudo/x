import { ReceiptItem, SplitAssignment, CalculatedShare, DebtTransfer } from "./types";

/**
 * Calculates individual shares for each person based on items, tax, and service charge.
 */
export function calculateShares(
  items: ReceiptItem[],
  people: string[],
  assignments: SplitAssignment[],
  taxRatePercent: number,
  serviceChargeRatePercent: number
): {
  shares: CalculatedShare[];
  unassignedItems: Array<{ item: ReceiptItem; unassignedPortion: number }>;
  grandTotal: number;
} {
  const sharesMap: Record<string, CalculatedShare> = {};

  // Initialize shares for all people
  people.forEach((person) => {
    sharesMap[person] = {
      person,
      subtotal: 0,
      serviceCharge: 0,
      tax: 0,
      total: 0,
      itemsDetails: [],
    };
  });

  const unassignedItems: Array<{ item: ReceiptItem; unassignedPortion: number }> = [];
  let calculatedGrandTotal = 0;

  items.forEach((item) => {
    const itemAssignments = assignments.filter((a) => a.itemId === item.id);
    const assignedPortionSum = itemAssignments.reduce((sum, a) => sum + a.portion, 0);

    // Track unassigned portions (tolerance of 0.01 for rounding)
    if (assignedPortionSum < 0.99) {
      unassignedItems.push({
        item,
        unassignedPortion: 1 - assignedPortionSum,
      });
    }

    const itemTotalCost = item.price * item.quantity;

    itemAssignments.forEach((assignment) => {
      const person = assignment.person;
      if (!sharesMap[person]) {
        // Safe guard in case person is not in list yet
        sharesMap[person] = {
          person,
          subtotal: 0,
          serviceCharge: 0,
          tax: 0,
          total: 0,
          itemsDetails: [],
        };
      }

      // Calculate portion share
      // If the model or user assigned more than 100%, we normalize it relative to assignedPortionSum
      const portionFraction = assignment.portion / Math.max(assignedPortionSum, 1);
      const shareCost = itemTotalCost * portionFraction;

      sharesMap[person].subtotal += shareCost;
      sharesMap[person].itemsDetails.push({
        itemName: item.name,
        itemPrice: item.price,
        quantity: item.quantity,
        portion: assignment.portion,
        shareCost,
      });
    });
  });

  // Calculate taxes, service charges, and grand totals for each person
  const sharesList = Object.values(sharesMap);
  sharesList.forEach((share) => {
    share.serviceCharge = share.subtotal * (serviceChargeRatePercent / 100);
    // Standard rule: Tax (GST) is usually applied on the subtotal + service charge
    share.tax = (share.subtotal + share.serviceCharge) * (taxRatePercent / 100);
    share.total = share.subtotal + share.serviceCharge + share.tax;
    calculatedGrandTotal += share.total;
  });

  return {
    shares: sharesList,
    unassignedItems,
    grandTotal: calculatedGrandTotal,
  };
}

/**
 * Calculates who owes what to whom.
 * Assumes a single person paid the full bill. Everyone else owes their full total to that person.
 */
export function calculateTransfers(
  shares: CalculatedShare[],
  paidBy: string
): DebtTransfer[] {
  const transfers: DebtTransfer[] = [];

  shares.forEach((share) => {
    if (share.person !== paidBy && share.total > 0.01) {
      transfers.push({
        from: share.person,
        to: paidBy,
        amount: share.total,
      });
    }
  });

  return transfers;
}

/**
 * Generates a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
