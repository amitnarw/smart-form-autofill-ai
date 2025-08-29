import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  apiKey:
    "import.meta.env.VITE_OPENAI_API_KEY",
});

export const callAI = async ({
  data,
  loggingEnabled,
}: {
  data: string;
  loggingEnabled: boolean;
}): Promise<string> => {
  try {
    if (loggingEnabled) {
      console.log(
        "AI – Sending data array to model for role-based input fields.",
        data
      );
    }
    const { text } = await generateText({
      model: openai.chat("gpt-4o-mini"),
      system:
        "You are a utility that classifies HTML <input> or <textarea> elements into specific types for autofill automation.",
      prompt: `
You are a utility that classifies HTML <input> and <textarea> elements based on their intended purpose.

I will provide an array of objects. Each object contains:
- outerHTMLInput: the full HTML string of an <input> or <textarea>
- outerHTMLLabel: the label associated with the field
- outerHTMLAria: the ARIA label or accessibility label

Your task is to classify each input into **exactly one** of the following categories:
- "username"
- "email"
- "password"
- "unknown"

**Rules:**
- Only one input can be assigned to each of: "username", "email", and "password".
- All other inputs must be added under "unknown" (as an array).
- Use outerHTMLInput as the value in your response.
- If a field is ambiguous, default to "unknown".

### ✅ Output Format:

Your response must be valid JSON in the following format:

{
  "success": true,
  "data": {
    "username": "<input ... >",     // if found, otherwise omit
    "email": "<input ... >",        // if found, otherwise omit
    "password": "<input ... >",     // if found, otherwise omit
    "unknown": ["<input ... >", "<textarea ... >"]
  },
  "error": {}
}

If something is wrong with the input format, respond instead with:

{
  "success": false,
  "data": null,
  "error": {
    "message": "Brief description of the issue"
  }
}

### Begin with this input:
${data}
  `,
    });

    let cleanedText = text.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText
        .replace(/^```json/, "")
        .replace(/```$/, "")
        .trim();
    }

    if (loggingEnabled) {
      console.log(
        "AI – Received result from model based on roles.",
        cleanedText
      );
    }

    return cleanedText;
  } catch (err) {
    if (err instanceof Error) {
      if (loggingEnabled) {
        console.log("AI - Error in callAI function", err?.message);
      }
      return err?.message;
    } else {
      if (loggingEnabled) {
        console.log("AI - Unknown error in callAI function");
      }
      return "Error in callAI function";
    }
  }
};

