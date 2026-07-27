import React, { useState, useRef } from "react";
import { ReceiptItem } from "../types";
import { generateId, formatCurrency } from "../utils";
import { motion, AnimatePresence } from "motion/react";
import { Upload, Plus, Trash2, Edit2, Check, RefreshCw, FileText, Image as ImageIcon } from "lucide-react";

interface ReceiptFormProps {
  items: ReceiptItem[];
  setItems: React.Dispatch<React.SetStateAction<ReceiptItem[]>>;
  taxRate: number;
  setTaxRate: (rate: number) => void;
  serviceRate: number;
  setServiceRate: (rate: number) => void;
  onNext: () => void;
}

const LOADING_MESSAGES = [
  "Reading image bytes...",
  "Analyzing receipt layout...",
  "Extracting items and pricing with Gemini AI...",
  "Identifying tax and service charge rates...",
  "Double checking calculations...",
  "Almost there, getting things ready...",
];

export default function ReceiptForm({
  items,
  setItems,
  taxRate,
  setTaxRate,
  serviceRate,
  setServiceRate,
  onNext,
}: ReceiptFormProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New manual item inputs
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editQty, setEditQty] = useState("");

  const loadingIntervalRef = useRef<any>(null);

  const startScanningAnimation = () => {
    setIsScanning(true);
    setLoadingMsgIdx(0);
    setError(null);
    loadingIntervalRef.current = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);
  };

  const stopScanningAnimation = () => {
    setIsScanning(false);
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, WEBP).");
      return;
    }

    startScanningAnimation();

    try {
      // Read file as base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data URL prefix (e.g. "data:image/png;base64,")
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      // Send to server-side OCR
      const response = await fetch("/api/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: file.type,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${response.status}`);
      }

      const receiptData = await response.json();

      if (receiptData.items && Array.isArray(receiptData.items)) {
        const formattedItems: ReceiptItem[] = receiptData.items.map((item: any) => ({
          id: generateId(),
          name: item.name || "Unknown Item",
          price: typeof item.price === "number" ? item.price : 0,
          quantity: typeof item.quantity === "number" ? item.quantity : 1,
        }));
        setItems(formattedItems);

        // Update rates if extracted
        if (typeof receiptData.taxRatePercent === "number") {
          setTaxRate(receiptData.taxRatePercent);
        }
        if (typeof receiptData.serviceChargeRatePercent === "number") {
          setServiceRate(receiptData.serviceChargeRatePercent);
        }
      } else {
        throw new Error("No items found in receipt. Try adding them manually.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to parse receipt image. Please try again or type manually.");
    } finally {
      stopScanningAnimation();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice) return;

    const price = parseFloat(newItemPrice);
    const qty = parseInt(newItemQty) || 1;

    if (isNaN(price) || price < 0) {
      setError("Please enter a valid price.");
      return;
    }

    const newItem: ReceiptItem = {
      id: generateId(),
      name: newItemName.trim(),
      price: price,
      quantity: qty,
    };

    setItems((prev) => [...prev, newItem]);
    setNewItemName("");
    setNewItemPrice("");
    setNewItemQty("1");
    setError(null);
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const startEditing = (item: ReceiptItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(item.price.toString());
    setEditQty(item.quantity.toString());
  };

  const saveEdit = (id: string) => {
    const price = parseFloat(editPrice);
    const qty = parseInt(editQty);

    if (!editName.trim() || isNaN(price) || isNaN(qty) || price < 0 || qty < 1) {
      setError("Invalid inputs while editing item.");
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, name: editName.trim(), price, quantity: qty }
          : item
      )
    );
    setEditingId(null);
    setError(null);
  };

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Receipt Image Upload Option */}
      {!isScanning && items.length === 0 && (
        <div
          id="receipt-drop-zone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[300px] ${
            isDragging
              ? "border-neutral-800 bg-neutral-50 shadow-md scale-[1.01]"
              : "border-neutral-200 hover:border-neutral-400 bg-white"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <div className="p-4 rounded-full bg-neutral-50 mb-4 text-neutral-500">
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="font-display text-lg font-medium text-neutral-800 mb-1">
            Upload or Snap your Receipt
          </h3>
          <p className="text-neutral-500 text-sm max-w-sm mb-4">
            Drag and drop your receipt photo here, or click to browse. We'll extract everything automatically using Gemini AI.
          </p>
          <button
            type="button"
            className="px-5 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition"
          >
            Select Receipt Photo
          </button>
        </div>
      )}

      {/* Scanning loading indicator */}
      {isScanning && (
        <div className="border border-neutral-100 bg-white rounded-2xl p-10 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-full border-4 border-neutral-100 border-t-neutral-800 animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
              <FileText className="w-6 h-6 animate-pulse" />
            </div>
          </div>
          <h3 className="font-display text-lg font-medium text-neutral-800 mb-2">
            Analyzing your receipt...
          </h3>
          <AnimatePresence mode="wait">
            <motion.p
              key={loadingMsgIdx}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              className="text-neutral-500 text-sm font-mono max-w-md h-5"
            >
              {LOADING_MESSAGES[loadingMsgIdx]}
            </motion.p>
          </AnimatePresence>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Items List (Displays after upload or during manual input) */}
      {!isScanning && (items.length > 0 || items.length === 0 && !items.length) && (
        <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-100 pb-4 mb-4 gap-4">
            <div>
              <h3 className="font-display text-lg font-medium text-neutral-800">
                Receipt Items List
              </h3>
              <p className="text-neutral-500 text-xs">
                Confirm, edit, or add manual items from your bill.
              </p>
            </div>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 border border-neutral-200 hover:border-neutral-400 rounded-lg text-xs font-medium text-neutral-600 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-upload receipt
              </button>
            )}
          </div>

          {/* Table of items */}
          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-50 text-neutral-400 text-xs font-medium uppercase font-mono tracking-wider">
                    <th className="py-2.5">Item Description</th>
                    <th className="py-2.5 text-right w-20">Price</th>
                    <th className="py-2.5 text-center w-20">Qty</th>
                    <th className="py-2.5 text-right w-24">Total</th>
                    <th className="py-2.5 text-center w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {items.map((item) => (
                    <tr key={item.id} className="group hover:bg-neutral-50/50 transition">
                      <td className="py-3">
                        {editingId === item.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-neutral-800"
                          />
                        ) : (
                          <span className="text-neutral-800 font-medium text-sm">{item.name}</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {editingId === item.id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-300 rounded-md text-sm text-right focus:outline-none focus:ring-1 focus:ring-neutral-800"
                          />
                        ) : (
                          <span className="text-neutral-700 text-sm font-mono">{formatCurrency(item.price)}</span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {editingId === item.id ? (
                          <input
                            type="number"
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            className="w-16 px-2 py-1 border border-neutral-300 rounded-md text-sm text-center focus:outline-none focus:ring-1 focus:ring-neutral-800"
                          />
                        ) : (
                          <span className="text-neutral-600 text-sm font-mono">x{item.quantity}</span>
                        )}
                      </td>
                      <td className="py-3 text-right text-neutral-800 font-semibold font-mono text-sm">
                        {formatCurrency(item.price * item.quantity)}
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {editingId === item.id ? (
                            <button
                              onClick={() => saveEdit(item.id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => startEditing(item)}
                              className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-10 text-center border border-dashed border-neutral-100 rounded-xl">
              <p className="text-neutral-400 text-sm">No items in bill yet. Type items below to add them manually.</p>
            </div>
          )}

          {/* Quick Add Form */}
          <form onSubmit={handleAddManualItem} className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-4 pt-4 border-t border-neutral-100">
            <div className="md:col-span-6">
              <input
                type="text"
                placeholder="Item name (e.g. Truffle Fries)"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-neutral-800"
              />
            </div>
            <div className="md:col-span-3">
              <input
                type="number"
                step="0.01"
                placeholder="Price ($)"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-neutral-800"
              />
            </div>
            <div className="md:col-span-2">
              <input
                type="number"
                min="1"
                placeholder="Qty"
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-neutral-800"
              />
            </div>
            <div className="md:col-span-1">
              <button
                type="submit"
                className="w-full h-full flex items-center justify-center p-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl transition"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </form>

          {/* Tax / Service Rate Summary Row */}
          {items.length > 0 && (
            <div className="mt-6 pt-4 border-t border-neutral-100 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between text-sm text-neutral-500 gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">Service Charge %:</span>
                    <input
                      type="number"
                      value={serviceRate}
                      onChange={(e) => setServiceRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-14 px-1.5 py-0.5 text-center border border-neutral-200 rounded font-mono text-xs focus:outline-none focus:border-neutral-800"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">Tax/GST %:</span>
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-14 px-1.5 py-0.5 text-center border border-neutral-200 rounded font-mono text-xs focus:outline-none focus:border-neutral-800"
                    />
                  </div>
                </div>
                <div className="text-right space-y-1 font-mono">
                  <div className="flex justify-between sm:justify-end gap-10 text-xs">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-neutral-800">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between sm:justify-end gap-10 text-xs text-neutral-400">
                    <span>Estimated Service Charge ({serviceRate}%):</span>
                    <span>{formatCurrency(subtotal * (serviceRate / 100))}</span>
                  </div>
                  <div className="flex justify-between sm:justify-end gap-10 text-xs text-neutral-400">
                    <span>Estimated GST/Tax ({taxRate}%):</span>
                    <span>{formatCurrency((subtotal + subtotal * (serviceRate / 100)) * (taxRate / 100))}</span>
                  </div>
                  <div className="flex justify-between sm:justify-end gap-10 text-sm border-t border-neutral-100 pt-1.5 mt-1">
                    <span className="font-sans font-medium text-neutral-600">Estimated Total:</span>
                    <span className="font-bold text-neutral-900">
                      {formatCurrency(
                        subtotal +
                          subtotal * (serviceRate / 100) +
                          (subtotal + subtotal * (serviceRate / 100)) * (taxRate / 100)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action row */}
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={onNext}
                  className="px-6 py-3 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-800 transition shadow-sm"
                >
                  Continue to People & Split
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
