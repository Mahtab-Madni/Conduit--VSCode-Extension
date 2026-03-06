import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const predictions = async (req, res) => {
  console.log(
    "[AI] Received payload prediction request from:",
    req.headers.origin || "No Origin",
  );
  console.log("[AI] Request body keys:", Object.keys(req.body));

  try {
    const { routeInfo, mongoData } = req.body;

    if (!routeInfo) {
      return res.status(400).json({ error: "Route information is required" });
    }

    // Build prompt for Groq - PRIORITIZE CONTROLLER CODE
    let prompt = `Generate a JSON payload for this API endpoint based on the ACTUAL controller code.\n\n`;
    prompt += `Route: ${routeInfo.method} ${routeInfo.path}\n`;

    // PRIORITY 1: Use controller code and extracted fields
    if (routeInfo.reqBodyFields && routeInfo.reqBodyFields.length > 0) {
      prompt += `\n⚠️ IMPORTANT - The controller expects EXACTLY these fields from req.body:\n`;
      prompt += `${JSON.stringify(routeInfo.reqBodyFields)}\n`;
      prompt += `\nYou MUST generate a payload with ONLY these fields. Do not add extra fields.\n`;
    }

    if (routeInfo.controllerCode) {
      prompt += `\nController implementation:\n\`\`\`javascript\n${routeInfo.controllerCode}\n\`\`\`\n`;
      prompt += `\nAnalyze this code to understand what fields are required and their expected format.\n`;
    }

    // PRIORITY 2: Use MongoDB data to provide realistic values for the required fields
    if (mongoData && mongoData.length > 0) {
      prompt += `\nReal data from MongoDB (use these as example values for the fields above):\n${JSON.stringify(mongoData, null, 2)}\n`;
    }

    if (routeInfo.description) {
      prompt += `\nDescription: ${routeInfo.description}\n`;
    }

    if (routeInfo.parameters && routeInfo.parameters.length > 0) {
      prompt += `Parameters: ${JSON.stringify(routeInfo.parameters, null, 2)}\n`;
    }

    prompt += `\n📋 INSTRUCTIONS:\n`;
    prompt += `1. Use ONLY the fields extracted from the controller code (reqBodyFields)\n`;
    prompt += `2. If MongoDB data is provided, use realistic values from that data\n`;
    prompt += `3. If no MongoDB data, generate realistic example values\n`;
    prompt += `4. Do NOT add fields like "confirmPassword", "firstName", "lastName", "phone", "address", "agreeToTerms", "captchaToken" unless they appear in reqBodyFields\n`;
    prompt += `5. Keep the payload minimal and match exactly what the controller expects\n`;
    prompt += `\nRespond with ONLY valid JSON, no explanations.`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an API payload expert. Generate JSON payloads that EXACTLY match what the controller code expects. " +
            "If reqBodyFields are provided, use ONLY those fields. " +
            "If MongoDB data is provided, use realistic values from that data. " +
            "Never add extra fields that aren't in the controller code. " +
            "Only respond with valid JSON, no explanations or extra text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "openai/gpt-oss-120b",
      temperature: 0.7,
      max_tokens: 1000,
    });

    const generatedContent = completion.choices[0]?.message?.content;

    if (!generatedContent) {
      throw new Error("No response from AI");
    }

    // Try to parse as JSON to validate
    let payload;
    try {
      payload = JSON.parse(generatedContent);
    } catch (parseError) {
      // If parsing fails, try to extract JSON from the response
      const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        payload = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("AI did not return valid JSON");
      }
    }

    res.json({
      success: true,
      payload,
      metadata: {
        model: "openai/gpt-oss-120b",
        usedMongoData: !!(mongoData && mongoData.length > 0),
      },
    });
  } catch (error) {
    console.error("AI Payload Prediction Error:", error);
    res.status(500).json({
      error: "Failed to generate payload prediction",
      details: error.message,
    });
  }
};

export const suggestErrorFix = async (req, res) => {
  try {
    const {
      errorMessage, // The HTTP error response (can be string or object)
      requestBody, // The actual payload sent
      requestUrl, // The API endpoint that was called
      requestMethod = "POST", // HTTP method
      expectedSchema, // What the API expects
      code, // Optional: controller code
      context, // Optional: additional context
    } = req.body;

    if (!errorMessage) {
      return res.status(400).json({ error: "Error message is required" });
    }

    // Parse error response - handle both string and structured object formats
    let errorMessageText = "";
    let errorFields = [];

    if (typeof errorMessage === "string") {
      errorMessageText = errorMessage;
    } else if (typeof errorMessage === "object") {
      // Handle structured error response
      if (errorMessage.message) {
        errorMessageText = errorMessage.message;
      }
      if (errorMessage.error) {
        errorMessageText = errorMessage.error;
      }
      // Extract field-level errors
      if (errorMessage.errors && Array.isArray(errorMessage.errors)) {
        errorFields = errorMessage.errors.map(
          (err) => `${err.field}: ${err.message}`,
        );
      }
    } else {
      errorMessageText = JSON.stringify(errorMessage);
    }

    // Build a focused prompt for concise correction
    let prompt = `You are an API debugging assistant. Provide a BRIEF, PRACTICAL fix for this request error.\n\n`;

    prompt += `=== REQUEST INFORMATION ===\n`;
    prompt += `URL: ${requestUrl || "Unknown"}\n`;
    prompt += `Method: ${requestMethod}\n`;

    if (requestBody) {
      prompt += `\nRequest Body Sent:\n\`\`\`json\n${JSON.stringify(requestBody, null, 2)}\n\`\`\`\n`;
    }

    prompt += `\n=== ERROR RESPONSE ===\n`;
    prompt += `${errorMessageText}\n`;

    // Add field-level errors if available
    if (errorFields && errorFields.length > 0) {
      prompt += `\nField Errors:\n`;
      errorFields.forEach((field) => {
        prompt += `- ${field}\n`;
      });
    }

    if (expectedSchema) {
      prompt += `\n=== EXPECTED SCHEMA ===\n`;
      prompt += `${typeof expectedSchema === "string" ? expectedSchema : JSON.stringify(expectedSchema, null, 2)}\n`;
    }

    if (code) {
      prompt += `\n=== CONTROLLER CODE ===\n\`\`\`javascript\n${code}\n\`\`\`\n`;
    }

    if (context) {
      prompt += `\nContext: ${context}\n`;
    }

    prompt += `\n=== TASK ===
ANALYZE THE REQUEST:
1. Look at the "Field Errors" section - these are the SPECIFIC fields that failed validation
2. Compare each failing field against the "Request Body Sent" - identify if the field is MISSING or has WRONG VALUE
3. Include ALL fields from the request body in your corrected version, plus add any MISSING fields

OUTPUT ONLY 2 SECTIONS:

1. **PROBLEM SUMMARY** (3-4 lines): 
   - Which field(s) are missing or have wrong values
   - Why the validation failed
   
2. **CORRECTED REQUEST BODY** (complete valid JSON):
   - Include ALL original fields
   - Add any missing required fields with example values
   - Fix any incorrect values based on the validation errors

Be precise about MISSING vs WRONG VALUE.`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an API debugging expert. Your job is to identify MISSING fields vs WRONG values. " +
            "When you see field errors, check if those fields exist in the request body. " +
            "If missing, the corrected body must include them. If wrong values, show correct values. " +
            "Always provide the complete corrected JSON payload with ALL fields. " +
            "BE EXPLICIT: say 'field X is MISSING' or 'field Y has WRONG VALUE'. " +
            "Output ONLY: Problem Summary (3-4 lines) + Corrected Request Body (JSON). " +
            "No extra text, no explanations beyond the summary.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "openai/gpt-oss-120b",
      temperature: 0.2,
      max_tokens: 800,
    });

    const suggestion = completion.choices[0]?.message?.content;

    if (!suggestion) {
      throw new Error("No response from AI");
    }

    res.json({
      success: true,
      suggestion,
      metadata: {
        model: "openai/gpt-oss-120b",
        analysisType: "detailed_request_response_analysis",
      },
    });
  } catch (error) {
    console.error("AI Error Fix Suggestion Error:", error);
    res.status(500).json({
      error: "Failed to generate error fix suggestion",
      details: error.message,
    });
  }
};
