"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type GenerateResponse = {
  altText?: string;
  error?: string;
};

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  const previewUrl = useMemo(() => {
    if (!selectedFile) return "";
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function handleGenerate() {
    if (!selectedFile || isLoading) return;

    setIsLoading(true);
    setErrorMessage("");
    setAltText("");
    setCopySuccess(false);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const response = await fetch("/api/alt-text", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as GenerateResponse;

      if (!response.ok || !data.altText) {
        setErrorMessage(data.error || "生成失败，请重试");
        return;
      }

      setAltText(data.altText);
    } catch {
      setErrorMessage("生成失败，请重试");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopy() {
    if (!altText) return;

    try {
      await navigator.clipboard.writeText(altText);
      setCopySuccess(true);
      window.setTimeout(() => setCopySuccess(false), 1200);
    } catch {
      setErrorMessage("复制失败，请手动复制");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 font-sans dark:bg-black">
      <main className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Alt Text 生成器
          </h1>

          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
              setAltText("");
              setErrorMessage("");
              setCopySuccess(false);
            }}
            className="block w-full cursor-pointer rounded-lg border border-zinc-300 p-2 text-sm text-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
          />

          {previewUrl ? (
            <div className="relative h-64 w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              <Image
                src={previewUrl}
                alt="上传预览图"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!selectedFile || isLoading}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isLoading ? "生成中..." : "生成 alt text"}
          </button>

          {errorMessage ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
              {errorMessage}
            </p>
          ) : null}

          {altText ? (
            <section className="flex flex-col gap-2">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                生成结果
              </p>
              <textarea
                value={altText}
                readOnly
                className="min-h-24 w-full rounded-lg border border-zinc-300 p-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={handleCopy}
                disabled={!altText}
                className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
              >
                {copySuccess ? "已复制" : "复制 alt text"}
              </button>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
