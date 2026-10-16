import OpenAI from "openai";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const LANGUAGE_VALUES = new Set(["zh", "en"]);
const SCENARIO_VALUES = new Set(["a11y", "seo", "ecommerce", "social"]);
const LENGTH_VALUES = new Set(["concise", "standard", "detailed"]);

function readSetting(
  formData: FormData,
  key: string,
  allowed: Set<string>,
  fallback: string
) {
  const value = formData.get(key);
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}

function buildAltTextPrompt(
  language: string,
  scenario: string,
  length: string
) {
  const languageInstruction =
    language === "en"
      ? "Write the alt text in English."
      : "请用中文撰写 alt text。";

  const scenarioInstruction = {
    a11y:
      "场景：无障碍。客观描述画面主体、关键动作与必要上下文，便于屏幕阅读器用户理解。",
    seo: "场景：SEO。突出可检索的核心对象与场景信息，表达清晰自然，避免堆砌关键词。",
    ecommerce:
      "场景：电商。突出商品外观、材质、颜色、用途等购物决策相关信息。",
    social:
      "场景：社媒。简洁生动地概括画面重点，适合信息流快速阅读。",
  }[scenario];

  const lengthInstruction = {
    concise: "长度：简洁，约 15-30 字或等效英文。",
    standard: "长度：标准，约 20-60 字或等效英文。",
    detailed: "长度：详细，约 60-120 字或等效英文，可补充必要细节。",
  }[length];

  return [
    "请为这张图片生成一条 alt text。",
    languageInstruction,
    scenarioInstruction,
    lengthInstruction,
    "要求：客观描述主体和场景，不要出现“图片中/这是一张/This is an image”等套话。",
  ].join(" ");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL =
    process.env.OPENAI_BASE_URL ?? process.env.BASE_URL ?? undefined;
  const model =
    process.env.OPENAI_MODEL ?? process.env.MODEL_NAME ?? "gpt-5.4";

  if (!apiKey) {
    return NextResponse.json(
      { error: "服务未配置 OpenAI 密钥，请稍后再试。" },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const language = readSetting(formData, "language", LANGUAGE_VALUES, "zh");
    const scenario = readSetting(
      formData,
      "scenario",
      SCENARIO_VALUES,
      "a11y"
    );
    const length = readSetting(
      formData,
      "length",
      LENGTH_VALUES,
      "standard"
    );
    const altTextPrompt = buildAltTextPrompt(language, scenario, length);

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "请先上传图片。" }, { status: 400 });
    }

    if (!image.type.startsWith("image/")) {
      return NextResponse.json({ error: "仅支持图片文件。" }, { status: 400 });
    }

    if (image.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "图片过大，请上传 10MB 以内图片。" },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const imageBase64 = imageBuffer.toString("base64");
    const imageDataUrl = `data:${image.type};base64,${imageBase64}`;

    const openai = new OpenAI({ apiKey, baseURL });

    // TokenHub always responds with SSE (text/event-stream), even when stream: false.
    const stream = await openai.chat.completions.create({
      model,
      stream: true,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: altTextPrompt },
            {
              type: "image_url",
              image_url: { url: imageDataUrl },
            },
          ],
        },
      ],
    });

    let altText = "";

    for await (const chunk of stream) {
      altText += chunk.choices[0]?.delta?.content ?? "";
    }

    altText = altText.trim();

    if (!altText) {
      return NextResponse.json(
        { error: "生成失败，请重试。" },
        { status: 502 }
      );
    }

    return NextResponse.json({ altText });
  } catch (error) {
    console.error("Alt text generation failed:", error);
    return NextResponse.json({ error: "生成失败，请重试。" }, { status: 500 });
  }
}
