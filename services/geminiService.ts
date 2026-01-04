
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const performConversion = async (
  content: string,
  sourceFormat: string,
  targetFormat: string,
  contentType: 'text' | 'image'
): Promise<string> => {
  try {
    const modelName = 'gemini-3-flash-preview';
    
    if (contentType === 'text') {
      const prompt = `Convert the following content from ${sourceFormat} to ${targetFormat}. 
      Ensure the syntax is correct and maintain all logic/data. 
      Only return the converted content, no explanation.
      
      Content:
      ${content}`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: 0.1, // Low temperature for precise conversions
        },
      });

      return response.text || 'Conversion failed: No response from engine.';
    } else {
      // Image to text/analysis or mock "stylized" image conversion
      // Since we can't do binary conversion easily without specific nodes,
      // we use Gemini to describe the image or "analyze" it.
      // But for this app's "Conversion" feel, we'll handle standard image formats via Canvas in the UI
      // and use Gemini for complex data/text tasks.
      return "Image processing is handled locally for standard formats.";
    }
  } catch (error) {
    console.error("Gemini Conversion Error:", error);
    throw new Error("The Cypher Engine encountered an anomaly during transformation.");
  }
};

export const detectFormat = async (content: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Identify the format of the following code/text snippet. 
      Return only the format name (e.g., 'json', 'python', 'markdown'). 
      If you can't tell, return 'txt'.
      
      Content:
      ${content.substring(0, 500)}`,
      config: { temperature: 0 },
    });
    return response.text?.trim().toLowerCase() || 'txt';
  } catch {
    return 'txt';
  }
};
