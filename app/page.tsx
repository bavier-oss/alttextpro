"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type GenerateResponse = {
  altText?: string;
  error?: string;
};

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  function handleFileSelect(file: File | null) {
    setSelectedFile(file);
    setAltText("");
    setErrorMessage("");
    setCopySuccess(false);
  }

  function handleClearFile(event: React.MouseEvent) {
    event.stopPropagation();
    handleFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

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

  const isGenerateEnabled = Boolean(selectedFile) && !isLoading;

  return (
    <div className="home-gradient-bg flex min-h-screen items-center justify-center px-4 py-10 font-sans">
      <main className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Alt Text Pro —— Free AI Alt Text Generator!
          </h1>

          <div
            role={previewUrl ? undefined : "button"}
            tabIndex={previewUrl ? undefined : 0}
            onClick={previewUrl ? undefined : () => fileInputRef.current?.click()}
            onKeyDown={
              previewUrl
                ? undefined
                : (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }
            }
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              const file = event.dataTransfer.files?.[0] ?? null;
              if (file?.type.startsWith("image/")) {
                handleFileSelect(file);
              }
            }}
            className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-center transition-colors ${
              previewUrl
                ? "border-zinc-200 p-2 dark:border-zinc-800"
                : `cursor-pointer px-4 py-8 ${
                    isDragging
                      ? "border-theme bg-theme/5"
                      : "border-zinc-300 hover:border-theme hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  }`
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                handleFileSelect(file);
              }}
            />
            {previewUrl ? (
              <>
                <button
                  type="button"
                  onClick={handleClearFile}
                  aria-label="删除图片"
                  className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900/70 text-sm text-white transition-colors hover:bg-zinc-900 dark:bg-zinc-100/80 dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  ×
                </button>
                <div className="relative h-64 w-full overflow-hidden rounded-md">
                  <Image
                    src={previewUrl}
                    alt="上传预览图"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  点击或拖拽图片到此处上传
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  支持JPG、PNG、Webp等格式，建议单张 5MB 以内
                </p>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!selectedFile || isLoading}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
              isGenerateEnabled
                ? "bg-theme text-white hover:bg-theme-hover"
                : "bg-zinc-300 text-zinc-500 opacity-70 dark:bg-zinc-700 dark:text-zinc-400"
            }`}
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
