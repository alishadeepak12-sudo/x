import React, { useState } from "react";
import { ReceiptItem, SplitAssignment } from "./types";
import ReceiptForm from "./components/ReceiptForm";
import PeopleList from "./components/PeopleList";
import SplitEngine from "./components/SplitEngine";
import SplitSummary from "./components/SplitSummary";
import { generateId } from "./utils";
import { Sparkles, Check, ChevronRight, HelpCircle, FileText, Users, DollarSign, Calculator } from "lucide-react";

enum SplitStep {
  RECEIPT_ITEMS = 1,
  PEOPLE_ROSTER = 2,
  ASSIGNMENT_BOARD = 3,
  FINAL_SUMMARY = 4,
}

const DEMO_ITEMS: ReceiptItem[] = [
  { id: "demo-1", name: "Wagyu Beef Burger", price: 28.0, quantity: 2 },
  { id: "demo-2", name: "Truffle Fries (Shared)", price: 14.0, quantity: 1 },
  { id: "demo-3", name: "Woodfired Margherita Pizza", price: 22.0, quantity: 1 },
  { id: "demo-4", name: "Craft IPA Beer Pint", price: 16.0, quantity: 3 },
  { id: "demo-5", name: "Sparkling Water", price: 7.5, quantity: 2 },
];

export default function App() {
  const [currentStep, setCurrentStep] = useState<SplitStep>(SplitStep.RECEIPT_ITEMS);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [people, setPeople] = useState<string[]>(["You"]);
  const [assignments, setAssignments] = useState<SplitAssignment[]>([]);
  const [taxRate, setTaxRate] = useState<number>(9); // 9% GST/tax
  const [serviceRate, setServiceRate] = useState<number>(10); // 10% Service charge
  const [paidBy, setPaidBy] = useState<string>("You");

  const handleNextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 4) as SplitStep);
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1) as SplitStep);
  };

  const handleReset = () => {
    setItems([]);
    setPeople(["You"]);
    setAssignments([]);
    setTaxRate(9);
    setServiceRate(10);
    setPaidBy("You");
    setCurrentStep(SplitStep.RECEIPT_ITEMS);
  };

  const loadDemoReceipt = () => {
    setItems(DEMO_ITEMS);
    setPeople(["You", "John", "Sarah", "Emily"]);
    setTaxRate(9);
    setServiceRate(10);
    setPaidBy("You");
    setAssignments([]);
    setCurrentStep(SplitStep.RECEIPT_ITEMS);
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 text-neutral-900 selection:bg-neutral-900 selection:text-white flex flex-col">
      {/* Top Brand Navigation */}
      <header className="border-b border-neutral-200/60 bg-white sticky top-0 z-40 backdrop-blur-md bg-white/80">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-neutral-900 flex items-center justify-center text-white font-display font-bold text-lg shadow-sm">
              %
            </div>
            <div>
              <h1 className="font-display font-bold text-base tracking-tight text-neutral-950">
                Meal Cost Splitter
              </h1>
              <p className="text-[10px] text-neutral-400 font-mono">
                ZERO AGONY BILL MAPPING
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {items.length === 0 && (
              <button
                type="button"
                onClick={loadDemoReceipt}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded-lg text-xs font-semibold text-neutral-600 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                Try with Demo Bill
              </button>
            )}
            <span className="text-xs font-mono text-neutral-400">
              v1.1
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Horizontal Step Tracker */}
        <div className="grid grid-cols-4 gap-2 text-center select-none">
          {[
            { step: SplitStep.RECEIPT_ITEMS, label: "Bill Items", icon: FileText },
            { step: SplitStep.PEOPLE_ROSTER, label: "Roster", icon: Users },
            { step: SplitStep.ASSIGNMENT_BOARD, label: "Split Board", icon: DollarSign },
            { step: SplitStep.FINAL_SUMMARY, label: "Settlement", icon: Calculator },
          ].map(({ step, label, icon: Icon }) => {
            const isActive = currentStep === step;
            const isCompleted = currentStep > step;

            return (
              <div
                key={step}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  isActive
                    ? "bg-white border-neutral-300 shadow-sm ring-1 ring-neutral-300/20"
                    : isCompleted
                    ? "bg-neutral-900/5 border-neutral-200 text-neutral-500"
                    : "bg-transparent border-transparent text-neutral-400"
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold font-mono ${
                      isActive
                        ? "bg-neutral-900 text-white"
                        : isCompleted
                        ? "bg-neutral-200 text-neutral-700"
                        : "bg-neutral-100 text-neutral-400"
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : step}
                  </div>
                  <span className="text-[11px] font-medium hidden sm:inline">{label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Step Content Switcher */}
        <div className="transition-all duration-300">
          {currentStep === SplitStep.RECEIPT_ITEMS && (
            <ReceiptForm
              items={items}
              setItems={setItems}
              taxRate={taxRate}
              setTaxRate={setTaxRate}
              serviceRate={serviceRate}
              setServiceRate={setServiceRate}
              onNext={handleNextStep}
            />
          )}

          {currentStep === SplitStep.PEOPLE_ROSTER && (
            <PeopleList
              people={people}
              setPeople={setPeople}
              paidBy={paidBy}
              setPaidBy={setPaidBy}
              onNext={handleNextStep}
              onPrev={handlePrevStep}
            />
          )}

          {currentStep === SplitStep.ASSIGNMENT_BOARD && (
            <SplitEngine
              items={items}
              people={people}
              assignments={assignments}
              setAssignments={setAssignments}
              onNext={handleNextStep}
              onPrev={handlePrevStep}
            />
          )}

          {currentStep === SplitStep.FINAL_SUMMARY && (
            <SplitSummary
              items={items}
              people={people}
              assignments={assignments}
              taxRate={taxRate}
              serviceRate={serviceRate}
              paidBy={paidBy}
              onReset={handleReset}
              onPrev={handlePrevStep}
            />
          )}
        </div>
      </main>

      {/* Humble Footer */}
      <footer className="border-t border-neutral-100 py-6 bg-white/50 text-center text-neutral-400 text-xs font-mono">
        <div>Meal Cost Splitter • Clean math for happy friends</div>
        <div className="text-[10px] mt-1 text-neutral-300">No data stored on external trackers • All local browser calculations</div>
      </footer>
    </div>
  );
}
