import { createAIProvider } from "./aiProvider";

export interface ConfigValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  recommendations: string[];
}

export class ConfigValidator {
  async validateConfiguration(): Promise<ConfigValidationResult> {
    const result: ConfigValidationResult = {
      valid: true,
      warnings: [],
      errors: [],
      recommendations: []
    };

    // Check OpenAI API key environment variable
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      result.warnings.push("⚠️  OPENAI_API_KEY environment variable not set");
      result.recommendations.push("💡 Users will need to provide their own OpenAI API key for extractions");
    } else {
      // Test the API key validity
      try {
        const openaiProvider = createAIProvider('openai');
        console.log("✅ OpenAI API key found, testing validity...");
        result.recommendations.push("✅ OPENAI_API_KEY environment variable is configured");
      } catch (error) {
        result.warnings.push("⚠️  OpenAI API key validation failed");
      }
    }

    // Check Gemini API key
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      result.warnings.push("⚠️  GEMINI_API_KEY environment variable not set");
      result.recommendations.push("💡 Users will need to provide their own Gemini API key for Gemini extractions");
    }

    // Check Python OCR service availability
    try {
      const healthResponse = await fetch("http://127.0.0.1:8000/health", {
        signal: AbortSignal.timeout(3000)
      });
      if (healthResponse.ok) {
        console.log("✅ Python OCR service is available");
        result.recommendations.push("✅ Python OCR service is running and available");
      } else {
        result.warnings.push("⚠️  Python OCR service responded with error");
      }
    } catch (error) {
      result.warnings.push("⚠️  Python OCR service not available at http://127.0.0.1:8000");
      result.recommendations.push("💡 Start Python OCR service for enhanced extraction: cd python_ocr && uvicorn advanced_ocr_service:app --host 0.0.0.0 --port 8000");
    }

    // Check if uploads directory exists
    try {
      const fs = await import('fs');
      if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads', { recursive: true });
        result.recommendations.push("✅ Created uploads directory");
      }
    } catch (error) {
      result.errors.push("❌ Failed to create uploads directory");
      result.valid = false;
    }

    // Summary
    if (result.errors.length > 0) {
      result.valid = false;
    }

    return result;
  }

  printValidationReport(result: ConfigValidationResult): void {
    console.log("\n🔧 Document Extraction Configuration Validation");
    console.log("================================================");

    if (result.valid) {
      console.log("✅ Configuration is valid - service ready to start");
    } else {
      console.log("❌ Configuration has critical errors");
    }

    if (result.errors.length > 0) {
      console.log("\n❌ Critical Errors:");
      result.errors.forEach(error => console.log(`   ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log("\n⚠️  Warnings:");
      result.warnings.forEach(warning => console.log(`   ${warning}`));
    }

    if (result.recommendations.length > 0) {
      console.log("\n💡 Recommendations:");
      result.recommendations.forEach(rec => console.log(`   ${rec}`));
    }

    console.log("\n📝 Usage Notes:");
    console.log("   • If no environment API keys are set, users must provide their own API keys");
    console.log("   • Python OCR service provides enhanced extraction (optional)");
    console.log("   • OpenAI fallback will be used if Python OCR is unavailable");
    console.log("================================================\n");
  }
}

export const configValidator = new ConfigValidator();