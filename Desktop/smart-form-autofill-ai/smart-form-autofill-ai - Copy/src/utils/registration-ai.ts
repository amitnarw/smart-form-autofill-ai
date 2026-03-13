import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export const callRegistrationFormAI2 = async ({
  discoveredFields,
  userKeys,
  loggingEnabled,
}: {
  discoveredFields: any[];
  userKeys: string[];
  loggingEnabled: boolean;
}): Promise<string> => {
  try {
    if (loggingEnabled) {
      console.log(
        "AI – Sending data array to model for registration form field classification.",
        discoveredFields,
        userKeys
      );
    }
    const { text } = await generateText({
      model: openai.chat("gpt-4.1-nano"),
      system:
        "You are a utility that classifies HTML form elements (<input>, <textarea>, <select>, and custom dropdowns like <div role='combobox'>) into specific types for registration form autofill automation and Ignore language differences completely",
      prompt: `
Priority: Keep the accuracy of the matching as high as possible.
You are a utility that matches HTML form fields to available user info keys for autofill.
Important: Input labels, placeholders, and surrounding text may be in any language. Do not rely on English keywords only.
Important: Match fields based on semantic meaning, not language.
Important: make sure to return the index of inputs to fill correctly.
Important: ignore search fields where "placeholder" or "outerHTMLPlaceholder" contains keyword related to search or verify code.

You are given:
1. An array of discovered HTML form fields, each with outerHTML, label, and aria info. This includes:
   - <input> elements (text, email, tel, etc.)
   - <textarea> elements
   - <select> elements (standard dropdowns)
   - Custom dropdown elements like <div role="combobox">, <div role="listbox">, or divs with aria-controls/aria-haspopup attributes
2. A list of keys representing user info (without sensitive values).

Rules:
- If there is retype email or retype phone number then set email or phone number to that input. Only one input should be set to email or phone number.
- If there is email/phone number in one input then set email or phone number to that input. Only one input should be set to email or phone number.
- If we have dob in userKeys only then look for date of birth related fields. If we have separate fields like an input or a dropdown for day, month and year then provide the response as dob-day, dob-month, dob-year. If only a single input exists, use dob.
- Do not match fields related to search, otp, product, or terms (e.g., "Search for product", "Product code", "Agree to Terms") to sensitive fields like "email", "phone", or "account number".
- For each key, find the most appropriate form field in the array.
- Use label, placeholder, type, and aria info to match.
- Return a JSON mapping: key -> index of matched field.
- If a key cannot be matched, omit it.
- Only return the JSON object as shown below.

Discovered fields:
${JSON.stringify(discoveredFields, null, 2)}

User info keys:
${JSON.stringify(userKeys, null, 2)}

Expected output format:
{
  "success": true,
  "data": {
    "firstname": 0,
    "lastname": 1,
    "account number": 2,
    "phone": 3,
    "email": 4
  },
  "error": {}
}`,
    });

    let cleanedText = text.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/^```json/, "").replace(/```$/, "").trim();
    }

    if (loggingEnabled) {
      console.log(
        "AI – Received result from model for registration form field classification.",
        cleanedText
      );
    }

    return cleanedText;
  } catch (err) {
    if (err instanceof Error) {
      if (loggingEnabled) {
        console.log("AI - Error in callRegistrationFormAI2 function", err?.message);
      }
      return err?.message;
    } else {
      if (loggingEnabled) {
        console.log("AI - Unknown error in callRegistrationFormAI2 function");
      }
      return "Error in callRegistrationFormAI2 function";
    }
  }
};
