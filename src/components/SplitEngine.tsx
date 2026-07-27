import React, { useState } from "react";
import { ReceiptItem, SplitAssignment } from "../types";
import { formatCurrency } from "../utils";
import { Sparkles, MessageSquare, ToggleLeft, Check, Users, HelpCircle, ChevronRight, CornerDownRight, RefreshCw, AlertCircle, Trash2, Plus, Info } from "lucide-react";

interface SplitEngineProps {
  items: ReceiptItem[];
  people: string[];
  assignments: SplitAssignment[];
  setAssignments: React.Dispatch<React.SetStateAction<SplitAssignment[]>>;
  onNext: () => void;
  onPrev: () => void;
}

export default function SplitEngine({
  items,
  people,
  assignments,
  setAssignments,
  onNext,
  onPrev,
}: SplitEngineProps) {
  const [naturalLanguageInput, setNaturalLanguageInput] = useState("");
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiExplanations, setAiExplanations] = useState<string[]>([]);
  const [manualPersonSelection, setManualPersonSelection] = useState<string>(people[0] || "You");

  // Handle Gemini Natural Language Parsing
  const handleAISplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalLanguageInput.trim()) return;

    setIsProcessingAI(true);
    setAiError(null);
    setAiExplanations([]);

    try {
      const response = await fetch("/api/split-natural-language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          prompt: naturalLanguageInput,
          people,
          currentUser: "You",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to parse splits (HTTP ${response.status})`);
      }

      const result = await response.json();

      // Ensure the return hasassignments
      if (result.assignments && Array.isArray(result.assignments)) {
        const newAssignments: SplitAssignment[] = [];

        result.assignments.forEach((assign: any) => {
          // Find the item matching item name
          const item = items.find((i) => i.name.toLowerCase() === assign.itemName.toLowerCase());
          if (item && Array.isArray(assign.splits)) {
            assign.splits.forEach((split: any) => {
              // Ensure person is in the list (or add them if returned new)
              const personName = split.person;
              if (people.includes(personName) || personName === "You") {
                newAssignments.push({
                  itemId: item.id,
                  person: personName,
                  portion: typeof split.portion === "number" ? split.portion : 1,
                });
              }
            });
          }
        });

        if (newAssignments.length > 0) {
          setAssignments(newAssignments);
          if (result.explanations && Array.isArray(result.explanations)) {
            setAiExplanations(result.explanations);
          }
          setNaturalLanguageInput("");
        } else {
          setAiError("AI couldn't map the instructions to any item name in the list. Try being more specific!");
        }
      } else {
        throw new Error("No valid assignment schema returned.");
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Failed to process natural language. Please split manually.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Toggle person for item (Standard split: divide cost equally among selected people for this item)
  const handleTogglePersonForItem = (itemId: string, person: string) => {
    // Check if person is already assigned to this item
    const existing = assignments.filter((a) => a.itemId === itemId);
    const isAssigned = existing.some((a) => a.person === person);

    let nextAssignments = assignments.filter((a) => !(a.itemId === itemId));

    if (isAssigned) {
      // Remove this person
      const remaining = existing.filter((a) => a.person !== person);
      if (remaining.length > 0) {
        // Recalculate equal portions for the remaining people
        const equalPortion = 1 / remaining.length;
        remaining.forEach((r) => {
          nextAssignments.push({
            itemId,
            person: r.person,
            portion: equalPortion,
          });
        });
      }
    } else {
      // Add this person
      const targetPeople = [...existing.map((e) => e.person), person];
      const equalPortion = 1 / targetPeople.length;
      targetPeople.forEach((p) => {
        nextAssignments.push({
          itemId,
          person: p,
          portion: equalPortion,
        });
      });
    }

    setAssignments(nextAssignments);
  };

  // Set direct portion manually
  const handleSetPortionValue = (itemId: string, person: string, value: number) => {
    const next = assignments.filter((a) => !(a.itemId === itemId && a.person === person));
    if (value > 0) {
      next.push({ itemId, person, portion: value });
    }
    setAssignments(next);
  };

  const handleClearAssignments = () => {
    setAssignments([]);
    setAiExplanations([]);
    setAiError(null);
  };

  const handleSplitAllEqually = () => {
    const equalPortion = 1 / people.length;
    const newAssigns: SplitAssignment[] = [];
    items.forEach((item) => {
      people.forEach((person) => {
        newAssigns.push({
          itemId: item.id,
          person,
          portion: equalPortion,
        });
      });
    });
    setAssignments(newAssigns);
  };

  // Helper to check assignment status of an item
  const getItemAssignmentDetails = (item: ReceiptItem) => {
    const itemAssignments = assignments.filter((a) => a.itemId === item.id);
    const sumPortion = itemAssignments.reduce((sum, a) => sum + a.portion, 0);
    return {
      assignments: itemAssignments,
      sumPortion,
      isFullyAssigned: Math.abs(sumPortion - 1) < 0.01,
      isUnassigned: sumPortion === 0,
      isOverAssigned: sumPortion > 1.01,
    };
  };

  const totalAssignedItemsCount = items.filter((item) => getItemAssignmentDetails(item).isFullyAssigned).length;

  return (
    <div className="space-y-6">
      {/* Method 1: AI Prompt Splitting */}
      <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-neutral-900 text-white rounded-lg">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display text-lg font-medium text-neutral-800">
              AI Natural Language Splitting
            </h3>
            <p className="text-neutral-500 text-xs">
              Describe who ordered what, and Gemini will map everything automatically!
            </p>
          </div>
        </div>

        <form onSubmit={handleAISplit} className="space-y-3">
          <div className="relative">
            <textarea
              value={naturalLanguageInput}
              onChange={(e) => setNaturalLanguageInput(e.target.value)}
              placeholder='e.g., "John had the Wagyu Burger, Sarah and I shared the Truffle Fries, and everyone shared the Pizza."'
              disabled={isProcessingAI}
              rows={3}
              className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-neutral-800 focus:ring-1 focus:ring-neutral-800 disabled:opacity-50"
            />
            <div className="absolute bottom-3 right-3 text-xs text-neutral-400 font-mono">
              Press Split
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
            {/* Quick Helper presets */}
            <div className="text-xs text-neutral-400 flex flex-wrap gap-1.5 items-center">
              <span className="font-medium">Try clicking:</span>
              <button
                type="button"
                onClick={() => setNaturalLanguageInput(`Everyone shared the ${items[0]?.name || "entire bill"}`)}
                className="px-2 py-1 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded text-neutral-600 transition"
              >
                Everyone shared the {items[0]?.name || "bill"}
              </button>
              {people.length > 1 && (
                <button
                  type="button"
                  onClick={() => setNaturalLanguageInput(`I had the ${items[0]?.name || "Burger"}, ${people[1]} had the ${items[1]?.name || "Drinks"}`)}
                  className="px-2 py-1 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded text-neutral-600 transition"
                >
                  I had X, {people[1]} had Y
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isProcessingAI || !naturalLanguageInput.trim()}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-200 text-white rounded-xl text-sm font-semibold transition"
            >
              {isProcessingAI ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analyzing splits...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Apply AI Split
                </>
              )}
            </button>
          </div>
        </form>

        {aiError && (
          <div className="mt-4 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>{aiError}</div>
          </div>
        )}

        {aiExplanations.length > 0 && (
          <div className="mt-4 p-4 bg-neutral-50 border border-neutral-100 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-2">
              <Info className="w-3.5 h-3.5" />
              AI Split Explanation
            </div>
            <ul className="space-y-1">
              {aiExplanations.map((exp, idx) => (
                <li key={idx} className="text-xs text-neutral-600 flex items-start gap-1.5">
                  <CornerDownRight className="w-3.5 h-3.5 mt-0.5 text-neutral-400 flex-shrink-0" />
                  <span>{exp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Method 2: Manual Visual Adjustment Grid */}
      <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4 mb-4">
          <div>
            <h3 className="font-display text-lg font-medium text-neutral-800">
              Interactive Receipt Split Board
            </h3>
            <p className="text-neutral-500 text-xs">
              Click people tags to assign or unassign them to items. They will split the cost equally.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSplitAllEqually}
              className="px-3 py-1.5 border border-neutral-200 hover:border-neutral-300 rounded-lg text-xs font-medium text-neutral-600 transition bg-white"
            >
              Split All Equally
            </button>
            <button
              onClick={handleClearAssignments}
              className="px-3 py-1.5 border border-neutral-200 hover:text-red-600 rounded-lg text-xs font-medium text-neutral-600 transition bg-white"
            >
              Reset All
            </button>
          </div>
        </div>

        {/* List of Receipt Items & interactive assign panels */}
        <div className="space-y-4">
          {items.map((item) => {
            const details = getItemAssignmentDetails(item);

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  details.isFullyAssigned
                    ? "border-neutral-200 bg-neutral-50/20"
                    : details.isOverAssigned
                    ? "border-amber-300 bg-amber-50/10"
                    : "border-red-100 bg-red-50/5"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-800 text-sm">
                        {item.name}
                      </span>
                      <span className="text-xs text-neutral-400 font-mono">
                        x{item.quantity}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500 font-mono mt-0.5">
                      Subtotal: {formatCurrency(item.price * item.quantity)} (${item.price.toFixed(2)} each)
                    </div>
                  </div>

                  {/* Status pills */}
                  <div className="flex items-center gap-2">
                    {details.isFullyAssigned ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                        <Check className="w-3 h-3" />
                        100% Split
                      </span>
                    ) : details.isUnassigned ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100">
                        Unassigned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                        {Math.round(details.sumPortion * 100)}% Split
                      </span>
                    )}
                  </div>
                </div>

                {/* Grid of Friends to Click Toggle */}
                <div className="flex flex-wrap gap-1.5">
                  {people.map((person) => {
                    const assign = details.assignments.find((a) => a.person === person);
                    const isAssigned = !!assign;

                    return (
                      <button
                        key={person}
                        type="button"
                        onClick={() => handleTogglePersonForItem(item.id, person)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition flex items-center gap-1.5 ${
                          isAssigned
                            ? "bg-neutral-900 text-white border-neutral-900"
                            : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
                        }`}
                      >
                        <Users className="w-3.5 h-3.5 opacity-70" />
                        <span>{person}</span>
                        {isAssigned && (
                          <span className="bg-white/20 text-white font-mono px-1 py-0.25 rounded text-[10px]">
                            {Math.round(assign.portion * 100)}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary indicator */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
          <span className="text-xs text-neutral-600 font-mono">
            {totalAssignedItemsCount} of {items.length} items fully split ({( (totalAssignedItemsCount / items.length) * 100 ).toFixed(0)}%)
          </span>
        </div>
        {totalAssignedItemsCount < items.length && (
          <span className="text-xs text-amber-600 flex items-center gap-1 font-semibold">
            <AlertCircle className="w-3.5 h-3.5" />
            Some items are unassigned or partially split. We'll show warnings in the summary.
          </span>
        )}
      </div>

      {/* Navigation footer */}
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
          onClick={onNext}
          className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition shadow-sm flex items-center gap-1"
        >
          View Split Summary
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
