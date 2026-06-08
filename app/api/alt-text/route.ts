import OpenAI from "openai";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALT_TEXT_PROMPT =
  "请为这张图片生成一条中文 alt text。要求：一句话，20-60字，客观描述主体和场景，不要出现“图片中/这是一张”。";

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
            { type: "text", text: ALT_TEXT_PROMPT },
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
