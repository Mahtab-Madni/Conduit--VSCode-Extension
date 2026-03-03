import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Predict payload based on route information
 * POST /api/ai/predict-payload
 */
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

    // Build prompt for Groq
    let prompt = `Based on this API route information, generate a realistic JSON payload:\n\n`;
    prompt += `Route: ${routeInfo.method} ${routeInfo.path}\n`;

    if (routeInfo.description) {
      prompt += `Description: ${routeInfo.description}\n`;
    }

    if (routeInfo.parameters && routeInfo.parameters.length > 0) {
      prompt += `Parameters: ${JSON.stringify(routeInfo.parameters, null, 2)}\n`;
    }

    if (mongoData && mongoData.length > 0) {
      prompt += `\nExample data from MongoDB:\n${JSON.stringify(mongoData, null, 2)}\n`;
    }

    prompt += `\nGenerate a realistic JSON payload for this ${routeInfo.method} request. Only respond with valid JSON, no explanations.`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an API payload expert. Generate realistic JSON payloads based on route information. Only respond with valid JSON.",
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

/**
 * Suggest error fix based on error message
 * POST /api/ai/suggest-error-fix
 */
export const suggestErrorFix = async (req, res) => {
  try {
    const { errorMessage, code, context } = req.body;

    if (!errorMessage) {
      return res.status(400).json({ error: "Error message is required" });
    }

    let prompt = `You are a helpful developer assistant. Analyze this error and suggest fixes:\n\n`;
    prompt += `Error: ${errorMessage}\n`;

    if (code) {
      prompt += `\nCode:\n${code}\n`;
    }

    if (context) {
      prompt += `\nContext: ${context}\n`;
    }

    prompt += `\nProvide a brief, actionable suggestion to fix this error.`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful developer assistant who provides clear, actionable solutions to coding problems.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "openai/gpt-oss-120b",
      temperature: 0.5,
      max_tokens: 500,
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
