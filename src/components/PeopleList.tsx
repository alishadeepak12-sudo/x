import React, { useState } from "react";
import { User, Users, Plus, X, ShieldAlert } from "lucide-react";

interface PeopleListProps {
  people: string[];
  setPeople: React.Dispatch<React.SetStateAction<string[]>>;
  paidBy: string;
  setPaidBy: (name: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function PeopleList({
  people,
  setPeople,
  paidBy,
  setPaidBy,
  onNext,
  onPrev,
}: PeopleListProps) {
  const [newPerson, setNewPerson] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAddPerson = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPerson.trim();
    if (!name) return;

    // Check duplicates
    if (people.some((p) => p.toLowerCase() === name.toLowerCase())) {
      setError(`"${name}" is already in the list.`);
      return;
    }

    setPeople((prev) => [...prev, name]);
    setNewPerson("");
    setError(null);
  };

  const handleRemovePerson = (nameToRemove: string) => {
    if (nameToRemove === "You") {
      setError("You cannot remove 'You' from the list.");
      return;
    }
    setPeople((prev) => prev.filter((p) => p !== nameToRemove));
    if (paidBy === nameToRemove) {
      setPaidBy("You");
    }
    setError(null);
  };

  return (
    <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm space-y-6">
      <div>
        <h3 className="font-display text-lg font-medium text-neutral-800">
          Who shared this meal?
        </h3>
        <p className="text-neutral-500 text-xs">
          Add the names of everyone who attended, and select who paid the final bill.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleAddPerson} className="flex gap-2">
        <div className="relative flex-1">
          <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Add friend's name (e.g. John, Sarah)"
            value={newPerson}
            onChange={(e) => setNewPerson(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-neutral-800"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </form>

      {/* Roster list */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-neutral-400 uppercase font-mono tracking-wider">
          Friends roster ({people.length})
        </h4>
        <div className="flex flex-wrap gap-2">
          {people.map((person) => (
            <div
              key={person}
              className={`flex items-center gap-1.5 pl-3.5 pr-2.5 py-1.5 rounded-xl border text-sm font-medium transition ${
                person === "You"
                  ? "bg-neutral-50 border-neutral-300 text-neutral-800"
                  : "bg-white border-neutral-200 text-neutral-700"
              }`}
            >
              <User className="w-3.5 h-3.5 text-neutral-400" />
              <span>{person}</span>
              {person !== "You" && (
                <button
                  type="button"
                  onClick={() => handleRemovePerson(person)}
                  className="p-0.5 hover:bg-neutral-100 rounded-md text-neutral-400 hover:text-neutral-600 transition ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Paid By Selector */}
      <div className="space-y-3 pt-4 border-t border-neutral-100">
        <h4 className="text-xs font-medium text-neutral-400 uppercase font-mono tracking-wider">
          Who paid the full bill?
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {people.map((person) => (
            <button
              key={person}
              type="button"
              onClick={() => setPaidBy(person)}
              className={`px-4 py-3 rounded-xl border text-left transition text-sm ${
                paidBy === person
                  ? "border-neutral-900 bg-neutral-900/5 text-neutral-900 font-semibold"
                  : "border-neutral-200 hover:border-neutral-300 text-neutral-600 bg-white"
              }`}
            >
              <div className="text-xs text-neutral-400 font-mono mb-0.5">Payer</div>
              <div className="truncate">{person}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex justify-between items-center pt-6 border-t border-neutral-100">
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
          disabled={people.length === 0}
          className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition shadow-sm"
        >
          Continue to splitting items
        </button>
      </div>
    </div>
  );
}
