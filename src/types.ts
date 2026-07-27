export interface ReceiptItem {
  id: string;
  name: string;
  price: number; // Price per unit
  quantity: number; // Number of units
}

export interface SplitAssignment {
  itemId: string; // References ReceiptItem.id
  person: string; // Name of the person
  portion: number; // Decimal fraction (e.g. 0.5 for half)
}

export interface CalculatedShare {
  person: string;
  subtotal: number;
  serviceCharge: number;
  tax: number;
  total: number;
  itemsDetails: Array<{
    itemName: string;
    itemPrice: number; // Price per unit
    quantity: number;
    portion: number;
    shareCost: number; // portion * price * quantity
  }>;
}

export interface DebtTransfer {
  from: string;
  to: string;
  amount: number;
}

export interface SavedBill {
  id: string;
  date: string;
  restaurantName: string;
  items: ReceiptItem[];
  people: string[];
  assignments: SplitAssignment[];
  taxRatePercent: number;
  serviceChargeRatePercent: number;
  paidBy: string;
  total: number;
}
