import React, { useState } from "react";
import { ReceiptItem, SplitAssignment, CalculatedShare, DebtTransfer } from "../types";
import { calculateShares, calculateTransfers, formatCurrency } from "../utils";
import { Check, Copy, Share2, Award, AlertTriangle, ArrowRight, UserCheck, RefreshCw, ChevronDown, ChevronUp, Landmark, ShieldCheck } from "lucide-react";

interface SplitSummaryProps {
  items: ReceiptItem[];
  people: string[];
  assignments: SplitAssignment[];
  taxRate: number;
  serviceRate: number;
  paidBy: string;
  onReset: () => void;
  onPrev: () => void;
}

export default function SplitSummary({
  items,
  people,
  assignments,
  taxRate,
  serviceRate,
  paidBy,
  onReset,
  onPrev,
}: SplitSummaryProps) {
  const [copiedText, setCopiedText] = useState(false);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

  const { shares, unassignedItems, grandTotal } = calculateShares(
    items,
    people,
    assignments,
    taxRate,
    serviceRate
  );

  const transfers = calculateTransfers(shares, paidBy);

  // Generate a beautiful, clean plain-text copy summary for messaging apps
  const generateMessageSummary = () => {
    let text = `🧾 *Meal Cost Split Summary* 🧾\n`;
    text += `Payer: *${paidBy}*\n`;
    text += `--------------------------------\n\n`;

    text += `*Individual Breakdown:*\n`;
    shares.forEach((share) => {
      text += `👤 *${share.person}*: *${formatCurrency(share.total)}*\n`;
      text += `   (Subtotal: ${formatCurrency(share.subtotal)}`;
      if (serviceRate > 0) text += ` + ${serviceRate}% SVC`;
      if (taxRate > 0) text += ` + ${taxRate}% GST`;
      text += `)\n`;
      
      // List items details
      if (share.itemsDetails.length > 0) {
        share.itemsDetails.forEach((detail) => {
          const portionText = detail.portion < 0.99 ? ` (${Math.round(detail.portion * 100)}%)` : "";
          text += `   • ${detail.itemName}${portionText}: ${formatCurrency(detail.shareCost)}\n`;
        });
      }
      text += `\n`;
    });

    if (transfers.length > 0) {
      text += `--------------------------------\n`;
      text += `💸 *Who Owes Who What:* 💸\n`;
      transfers.forEach((t) => {
        text += `👉 *${t.from}* owes *${t.to}*: *${formatCurrency(t.amount)}*\n`;
      });
    }

    text += `\nCreated with Meal Cost Splitter 🚀`;
    return text;
  };

  const handleCopyToClipboard = () => {
    const text = generateMessageSummary();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    });
  };

  const toggleExpand = (person: string) => {
    setExpandedPerson((prev) => (prev === person ? null : person));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-neutral-950 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-neutral-300 font-mono">
            Summary View
          </div>
          <h2 className="font-display text-xl font-bold tracking-tight">
            Final Cost Split Results
          </h2>
          <p className="text-neutral-400 text-xs">
            Calculated successfully including {serviceRate}% service charge and {taxRate}% tax/GST.
          </p>
        </div>
        <div className="text-right font-mono md:border-l md:border-white/10 md:pl-6">
          <div className="text-xs text-neutral-400">Grand Total Amount</div>
          <div className="text-2xl font-bold text-white">{formatCurrency(grandTotal)}</div>
        </div>
      </div>

      {/* Warnings for Unassigned Items */}
      {unassignedItems.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Unassigned Cost Alert</span>
          </div>
          <p className="text-xs text-amber-700">
            The following items were not 100% split. Some parts of their cost were not allocated to anyone:
          </p>
          <ul className="space-y-1 pl-6 list-disc text-xs text-amber-800 font-mono">
            {unassignedItems.map(({ item, unassignedPortion }) => (
              <li key={item.id}>
                <strong>{item.name}</strong>: {Math.round(unassignedPortion * 100)}% left unassigned (~{formatCurrency(item.price * item.quantity * unassignedPortion)})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transfer flow (Who owes who what) */}
      <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-neutral-800" />
            <h3 className="font-display text-base font-semibold text-neutral-800">
              Settlement Transfers
            </h3>
          </div>
          <button
            onClick={handleCopyToClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold transition"
          >
            {copiedText ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600" />
                Copied Summary!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Group Text
              </>
            )}
          </button>
        </div>

        {transfers.length > 0 ? (
          <div className="space-y-3">
            {transfers.map((t, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-50 border border-neutral-150"
              >
                <div className="flex items-center gap-2.5">
                  <div className="font-semibold text-neutral-800 text-sm">{t.from}</div>
                  <ArrowRight className="w-4 h-4 text-neutral-400" />
                  <div className="font-medium text-neutral-600 text-sm">{t.to}</div>
                </div>
                <div className="font-bold text-neutral-900 font-mono text-base">
                  {formatCurrency(t.amount)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center border border-dashed border-neutral-100 rounded-xl">
            <ShieldCheck className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-neutral-500 text-sm font-medium">All settled! No outstanding transfers needed.</p>
          </div>
        )}
      </div>

      {/* Roster detailed Breakdown accordion list */}
      <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-display text-base font-semibold text-neutral-800">
            Individual Share Breakdowns
          </h3>
          <p className="text-neutral-500 text-xs">
            See exactly how each person's total is calculated. Click to expand itemized receipts.
          </p>
        </div>

        <div className="divide-y divide-neutral-100">
          {shares.map((share) => {
            const isExpanded = expandedPerson === share.person;
            const isPayer = share.person === paidBy;

            return (
              <div key={share.person} className="py-3">
                <button
                  type="button"
                  onClick={() => toggleExpand(share.person)}
                  className="w-full flex items-center justify-between text-left focus:outline-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-800 text-sm">{share.person}</span>
                    {isPayer && (
                      <span className="px-2 py-0.5 rounded bg-neutral-900 text-white text-[10px] font-mono">
                        Payer
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-neutral-900 font-mono text-sm">
                      {formatCurrency(share.total)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-3 pl-3 pr-3 py-3 bg-neutral-50 rounded-xl text-xs space-y-2 border border-neutral-100">
                    {share.itemsDetails.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="font-semibold text-neutral-400 uppercase tracking-wide text-[10px] font-mono">
                          Ordered Items
                        </div>
                        {share.itemsDetails.map((detail, dIdx) => (
                          <div key={dIdx} className="flex justify-between items-center text-neutral-700 font-mono">
                            <span>
                              {detail.itemName}{" "}
                              {detail.portion < 0.99 && (
                                <span className="text-neutral-400 text-[10px]">
                                  ({Math.round(detail.portion * 100)}% portion)
                                </span>
                              )}
                            </span>
                            <span>{formatCurrency(detail.shareCost)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-neutral-400 italic">No food items assigned. Only shared tax/service if applicable.</div>
                    )}

                    <div className="border-t border-neutral-200/60 pt-2 space-y-1 font-mono text-neutral-500">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(share.subtotal)}</span>
                      </div>
                      {serviceRate > 0 && (
                        <div className="flex justify-between">
                          <span>Service Charge ({serviceRate}%):</span>
                          <span>{formatCurrency(share.serviceCharge)}</span>
                        </div>
                      )}
                      {taxRate > 0 && (
                        <div className="flex justify-between">
                          <span>Tax/GST ({taxRate}%):</span>
                          <span>{formatCurrency(share.tax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-neutral-800 border-t border-neutral-150 pt-1 mt-1">
                        <span className="font-sans">Total Share:</span>
                        <span>{formatCurrency(share.total)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="flex justify-between items-center pt-4">
        <button
          type="button"
          onClick={onPrev}
          className="px-5 py-2.5 border border-neutral-200 hover:border-neutral-400 rounded-xl text-sm font-medium text-neutral-600 transition"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition shadow-sm flex items-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4" />
          Split New Receipt
        </button>
      </div>
    </div>
  );
}
