import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limit for base64 image uploads
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Initialize Google GenAI on the server
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

// Helper to check if AI is configured
const getAIClient = () => {
  if (!ai) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
  }
  return ai;
};

// --- API Endpoints ---

// Parse receipt image using Gemini
app.post("/api/parse-receipt", async (req, res): Promise<any> => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: "Missing imageBase64 or mimeType" });
    }

    const genAI = getAIClient();

    // Prepare image part
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: imageBase64,
      },
    };

    const textPart = {
      text: `Analyze this receipt image. Extract all food and beverage items, their quantities, and their individual subtotal prices before service charge or tax. 
Also attempt to extract:
1. Subtotal of items
2. Sales tax or GST amount
3. Service charge amount
4. Grand total
5. Any apparent tax rate % or service charge % (default to 9% tax and 10% service charge if you can infer them or if they are common, but prioritize whatever is printed on the receipt).

Return the data structured exactly as specified in the schema. Make sure the names of the items are clean and readable.`,
    };

    // Use Gemini 3.5 Flash for image-to-text JSON extraction
    const response = await genAI.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Name of the item" },
                  price: { type: Type.NUMBER, description: "Subtotal cost of this item before tax or service charge" },
                  quantity: { type: Type.INTEGER, description: "Quantity of this item ordered" },
                },
                required: ["name", "price", "quantity"],
              },
            },
            subtotal: { type: Type.NUMBER, description: "Sum of items subtotal" },
            tax: { type: Type.NUMBER, description: "Tax / GST amount" },
            serviceCharge: { type: Type.NUMBER, description: "Service charge amount" },
            total: { type: Type.NUMBER, description: "Grand total" },
            taxRatePercent: { type: Type.NUMBER, description: "Estimated tax percentage rate, e.g. 9" },
            serviceChargeRatePercent: { type: Type.NUMBER, description: "Estimated service charge percentage rate, e.g. 10" },
          },
          required: ["items", "subtotal", "total"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      return res.status(500).json({ error: "Failed to generate text from receipt analysis" });
    }

    const parsedData = JSON.parse(resultText.trim());
    return res.json(parsedData);
  } catch (error: any) {
    console.error("Error parsing receipt:", error);
    return res.status(500).json({ error: error.message || "Failed to analyze receipt" });
  }
});

// Parse natural language splitting rules
app.post("/api/split-natural-language", async (req, res): Promise<any> => {
  try {
    const { items, prompt, people: predefinedPeople, currentUser = "You" } = req.body;
    if (!items || !Array.isArray(items) || !prompt) {
      return res.status(400).json({ error: "Missing items list or split prompt" });
    }

    const genAI = getAIClient();

    const itemsContext = items
      .map((item, index) => `#${index + 1}: "${item.name}" (Price: $${item.price.toFixed(2)}, Qty: ${item.quantity})`)
      .join("\n");

    const systemInstruction = `You are a helpful bill-splitting dining assistant.
Given a list of items on a receipt and a natural language description of who ate what, you must map the people to the items.

CRITICAL INSTRUCTIONS:
1. Normalize names. If anyone mentions "I", "me", "myself", "my", map them to the currentUser name: "${currentUser}".
2. Extract all people mentioned. If a person is in the predefined list [${(predefinedPeople || []).join(", ")}], match them exactly. Otherwise, add them to the people list.
3. Determine portion shares for items. Portions should represent the fraction of the item's total cost a person is responsible for.
   - If John had a whole burger: John gets portion 1.0.
   - If Sarah and You shared the pizza: Sarah gets 0.5, You gets 0.5.
   - If "everyone shared the truffle fries": Divide 1.0 equally among ALL extracted people.
   - If a description says "Sarah had a burger, John had the other burger" for a burger with quantity 2: Map Sarah to 0.5 portion of the burger (equivalent to 1 burger out of 2) or split it accordingly. Wait, to keep it simple, treat the item as a single lump cost (Price * Quantity) and allocate portion fractions of the total cost. If Sarah ate 1 of 2 burgers, her portion is 0.5.
   - If an item is not mentioned, do NOT assign splits for it in the JSON. Leave it blank so the frontend can handle it.
4. Provide a step-by-step reasoning or summary list in the 'explanations' array explaining how you arrived at each decision. E.g. "Shared pizza equally between Sarah and ${currentUser}."

Example Output JSON Structure:
{
  "people": ["John", "Sarah", "${currentUser}"],
  "assignments": [
    {
      "itemName": "Truffle Fries",
      "splits": [
        { "person": "John", "portion": 0.33 },
        { "person": "Sarah", "portion": 0.33 },
        { "person": "You", "portion": 0.33 }
      ]
    }
  ],
  "explanations": ["Shared truffle fries equally among all 3 people."]
}`;

    const promptText = `Here is the list of items from the receipt:
${itemsContext}

Here are the natural language splitting instructions from the user:
"${prompt}"

Please split the items correctly and return a structured JSON response. Ensure the 'itemName' values match the receipt item names EXACTLY.`;

    const response = await genAI.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            people: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of all people participating in the meal. 'I', 'me', etc should be normalized to the current user's name.",
            },
            assignments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemName: { type: Type.STRING, description: "Name of the item matching receipt exactly" },
                  splits: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        person: { type: Type.STRING, description: "Name of the person" },
                        portion: { type: Type.NUMBER, description: "Decimal fraction of the cost assigned to this person (e.g. 0.5 for half)" },
                      },
                      required: ["person", "portion"],
                    },
                  },
                },
                required: ["itemName", "splits"],
              },
            },
            explanations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Short bullets explaining the parsing decisions",
            },
          },
          required: ["people", "assignments"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      return res.status(500).json({ error: "Failed to parse natural language instructions" });
    }

    const parsedData = JSON.parse(resultText.trim());
    return res.json(parsedData);
  } catch (error: any) {
    console.error("Error parsing natural language:", error);
    return res.status(500).json({ error: error.message || "Failed to process instructions" });
  }
});

// Serve frontend assets and start server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
});
