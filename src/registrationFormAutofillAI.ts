import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
    apiKey: '',
});

export const callRegistrationFormAI = async ({
    data,
    loggingEnabled,
}: {
    data: string;
    loggingEnabled: boolean;
}): Promise<string> => {
    try {
        if (loggingEnabled) {
            console.log(
                "AI – Sending data array to model for registration form field classification.",
                data
            );
        }
        const { text } = await generateText({
            // model: openai.chat("gpt-4o-mini"),
            model: openai.chat("gpt-4.1-nano"),
            // model: openai.chat("gpt-4o"),
            system:
                "You are a utility that classifies HTML <input>, <textarea>, and <select> elements into specific types for registration form autofill automation.",
            prompt: `
You are a utility that classifies HTML form elements (<input>, <textarea>, and <select>) based on their intended purpose in registration forms.

I will provide an array of objects. Each object contains:
- outerHTMLInput: the full HTML string of an <input>, <textarea>, or <select> element
- outerHTMLLabel: the label associated with the field
- outerHTMLAria: the ARIA label or accessibility label

Your task is to classify each element into **exactly one** of the following categories:
- "firstname" (first name, given name, forename)
- "lastname" (last name, surname, family name)
- "fullname" (name, full name, display name, complete name)
- "middlename" (middle name, mname)
- "company" (company name, organization, business name)
- "email" (email address, e-mail)
- "phone" (phone number, mobile, telephone, contact number)
- "address" (street address, location, postal address)
- "country" (country, nationality, nation)
- "state" (state, province, region)
- "city" (city, town)
- "gender" (gender, sex, title)
- "username" (username, user id, login id, account name)
- "password" (password, pwd, pass)
- "unknown" (if the field cannot be confidently classified)

**Classification Rules:**
"If keyword rules are not sufficient, use contextual reasoning based on typical registration forms to determine the correct field purpose."
- Use the **index** of the object in the input array as the value for each classification.
- You may assign multiple fields to the same category if appropriate (e.g., multiple name fields).
- Prioritize specific classifications over generic ones (e.g., "firstname" over "name").
- If a field contains words like "first", "given", "forename", classify it as "firstname".
- If a field contains words like "last", "surname", "family", classify it as "lastname".
- Otherwise, if the placeholder or label contains the word ‘name’, use contextual reasoning to decide whether it is a person’s full name, a company name, or a username. If there are no other fields indicating first/last name, company, or username, classify it as fullname.
- If a field contains words like "company", "organization", "business", classify it as "company".
- If a field has type="email" or contains "email"/"e-mail", classify it as "email".
- If a field has type="password" or contains "password"/"pwd", classify it as "password".
- If a field has type="tel" or contains "phone"/"mobile"/"telephone", classify it as "phone".
- If a field contains "address"/"street"/"location", classify it as "address" (unless it's clearly country/state/city).
- If a field contains "country"/"nation"/"nationality", classify it as "country".
- If a field contains "state"/"province"/"region", classify it as "state".
- If a field contains "city"/"town", classify it as "city".
- If a field contains "gender"/"sex"/"title" (in context of personal info), classify it as "gender".
- If a field contains "username"/"user id"/"login"/"account" (and not account number), classify it as "username".
- Exclude search fields, captcha fields, and other non-registration fields.
- If **none** of the fields can be confidently classified, return a failure.

### Output Format:

- If fields are successfully classified:

{
  "success": true,
  "data": {
    "firstname": 0,         // optional - index of first name field
    "lastname": 1,          // optional - index of last name field
    "fullname": 2,          // optional - index of full name field
    "middlename": 3,        // optional - index of middle name field
    "company": 4,           // optional - index of company field
    "email": 5,             // optional - index of email field
    "phone": 6,             // optional - index of phone field
    "address": 7,           // optional - index of address field
    "country": 8,           // optional - index of country field
    "state": 9,             // optional - index of state field
    "city": 10,             // optional - index of city field
    "gender": 11,           // optional - index of gender field
    "username": 12,         // optional - index of username field
    "password": 13          // optional - index of password field
  },
  "error": {}
}

If something is wrong with the input format or no fields can be classified, respond instead with:

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
                "AI – Received result from model for registration form field classification.",
                cleanedText
            );
        }

        return cleanedText;
    } catch (err) {
        if (err instanceof Error) {
            if (loggingEnabled) {
                console.log("AI - Error in callRegistrationFormAI function", err?.message);
            }
            return err?.message;
        } else {
            if (loggingEnabled) {
                console.log("AI - Unknown error in callRegistrationFormAI function");
            }
            return "Error in callRegistrationFormAI function";
        }
    }
};

export const callRegistrationFormAI2 = async ({
    discoveredFields,
    userKeys,
    loggingEnabled,
}: {
    discoveredFields: any[];
    userKeys: string[];
    loggingEnabled: boolean;
}): Promise<string> => {
    console.log("discoveredFields in ai2", discoveredFields);
    console.log("userKeys in ai2", userKeys);
    try {
        if (loggingEnabled) {
            console.log(
                "AI – Sending data array to model for registration form field classification.",
                discoveredFields,
                userKeys
            );
        }
        const { text } = await generateText({
            // model: openai.chat("gpt-4o-mini"),
            model: openai.chat("gpt-5.1"),
            // model: openai.chat("gpt-4o"),
            system:
                "You are a utility that classifies HTML form elements (<input>, <textarea>, <select>, and custom dropdowns like <div role='combobox'>) into specific types for registration form autofill automation and Ignore language differences completely",
            prompt: `
            Priority:Keep the accuracy of the matching as high as possible.
You are a utility that matches HTML form fields to available user info keys for autofill.
**important**:Input labels, placeholders, and surrounding text may be in any language.Do not rely on English keywords only.
**important**:Match fields based on semantic meaning, not language.
**important**:make sure to return the index of inputs to fill correctly. 
**important** : igonore search fields input where "placeholder" or " outerHTMLPlaceholder" contains keyword related to search or any other keyword related to search or varify code.
  You are given:
  1. An array of discovered HTML form fields, each with outerHTML, label, and aria info. This includes:
     - <input> elements (text, email, tel, etc.)
     - <textarea> elements
     - <select> elements (standard dropdowns)
     - Custom dropdown elements like <div role="combobox">, <div role="listbox">, or divs with aria-controls/aria-haspopup attributes
  2. A list of keys representing user info (without sensitive values).
   -Check OuterHTMLPlaceholder if it is not text, then dont include it unnecessarily and igonore search fields.
  - "firstname" (first name, given name, forename) else dont include it unnecessarily.
  - if there is retype email or retype phone number then set email or phone number to that input! "Only one input should be set to email or phone number"
  -"if there is email/phonenumber in one input then set email or phone number to that input! "Only one input should be set to email or phone number"
- "lastname" (last name, surname, family name) else dont include it unnecessarily.
- "fullname" (name, full name, display name, complete name or id="name") else dont include it unnecessarily.
3. if we have dob in usrkeys only then look for date of birth related fields if we have seprate fields like a input or a dropdown for day,month and year then provide the response as dob-day,dob-month,dob,year but if we have only single input for whole then in dob
Task: 
- Pay special attention to avoid matching search fields, product-related fields, or non-user-specific fields to sensitive user info keys (e.g., "account number").
- A search field or product-related input (e.g., "Search by Product Code" or similar) should not be matched to sensitive fields like "account number" or "email."
- **Do not match** fields related to **search**,**otp**, **product**, or **terms** (e.g., "Search for product", "Product code", "Agree to Terms", etc.) to sensitive fields like "email", "phone", or "account number".
  - For each key, find the most appropriate form field in the array.
  - Use label, placeholder, type, and aria info to match.
  - If a field contains words like "first", "given", "forename", classify it as "firstname" else dont include it unnecessarily.
- If a field contains words like "last", "surname", "family", classify it as "lastname" else dont include it unnecessarily.
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
     "firstname": 0,         // optional - index of first name field
    "lastname": 1,          // optional - index of last name field
      "account number": 2,
      "phone": 3,
      "email": 4
    },
    "error": {}
  }`,
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
                "AI – Received result from model for registration form field classification.",
                cleanedText
            );
        }

        return cleanedText;
    } catch (err) {
        if (err instanceof Error) {
            if (loggingEnabled) {
                console.log("AI - Error in callRegistrationFormAI function", err?.message);
            }
            return err?.message;
        } else {
            if (loggingEnabled) {
                console.log("AI - Unknown error in callRegistrationFormAI function");
            }
            return "Error in callRegistrationFormAI function";
        }
    }
};
