"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type GenerateResponse = {
  altText?: string;
  error?: string;
};

type UploadErrorKind = "unsupported" | "tooLarge" | "unreadable";

type UploadError = {
  kind: UploadErrorKind;
  title: string;
  recovery: string;
};

type Language = "zh" | "en";
type Scenario = "a11y" | "seo" | "ecommerce" | "social";
type DescriptionLength = "concise" | "standard" | "detailed";

type SettingOption<T extends string> = {
  value: T;
  label: string;
};

const LANGUAGE_OPTIONS: SettingOption<Language>[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

const SCENARIO_OPTIONS: SettingOption<Scenario>[] = [
  { value: "a11y", label: "无障碍" },
  { value: "seo", label: "SEO" },
  { value: "ecommerce", label: "电商" },
  { value: "social", label: "社媒" },
];

const LENGTH_OPTIONS: SettingOption<DescriptionLength>[] = [
  { value: "concise", label: "简洁" },
  { value: "standard", label: "标准" },
  { value: "detailed", label: "详细" },
];

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ACCEPTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const UPLOAD_ERRORS: Record<UploadErrorKind, Omit<UploadError, "kind">> = {
  unsupported: {
    title: "不支持的文件格式",
    recovery: "请选择 JPG、JPEG、PNG 或 WebP 图片后重新上传。",
  },
  tooLarge: {
    title: "文件超过 50MB",
    recovery: "请压缩图片，或更换较小的文件后再试。",
  },
  unreadable: {
    title: "图片读取失败",
    recovery: "请重新选择文件，或换一张未损坏的图片再试。",
  },
};

function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function SegmentedControl<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: T;
  options: SettingOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const labelId = `${id}-label`;

  return (
    <div className="min-w-0">
      <p
        id={labelId}
        className="mb-1.5 font-mono text-[11px] font-medium tracking-wide text-muted uppercase"
      >
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex w-full min-w-0 flex-wrap gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--control-bg)] p-1"
      >
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs sm:text-sm ${
                selected
                  ? "border border-[var(--border-strong)] bg-surface font-semibold text-foreground"
                  : "border border-transparent font-normal text-muted hover:bg-surface/60"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span
                aria-hidden="true"
                className={`font-mono text-[10px] leading-none ${
                  selected ? "opacity-100" : "opacity-0"
                }`}
              >
                ✓
              </span>
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function isAcceptedImageFile(file: File) {
  if (ACCEPTED_MIME_TYPES.has(file.type)) return true;
  const dotIndex = file.name.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const extension = file.name.slice(dotIndex).toLowerCase();
  return ACCEPTED_EXTENSIONS.has(extension);
}

function canReadImageFile(file: File) {
  return new Promise<boolean>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(true);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(false);
    };

    image.src = objectUrl;
  });
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const dragDepthRef = useRef(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [language, setLanguage] = useState<Language>("zh");
  const [scenario, setScenario] = useState<Scenario>("a11y");
  const [descriptionLength, setDescriptionLength] =
    useState<DescriptionLength>("standard");
  const [uploadScanToken, setUploadScanToken] = useState(0);
  const [showUploadScan, setShowUploadScan] = useState(false);
  const [resultRevealKey, setResultRevealKey] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  function resetFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setAltText("");
    setErrorMessage("");
    setUploadError(null);
    setCopySuccess(false);
    setShowUploadScan(false);
    setUploadScanToken(0);
    resetFileInput();
  }

  function rejectUpload(kind: UploadErrorKind) {
    const message = UPLOAD_ERRORS[kind];
    setUploadError({ kind, ...message });
    resetFileInput();
  }

  async function applySelectedFile(file: File | null) {
    if (isLoading) return;

    if (!file) {
      clearSelectedFile();
      return;
    }

    if (!isAcceptedImageFile(file)) {
      rejectUpload("unsupported");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      rejectUpload("tooLarge");
      return;
    }

    const readable = await canReadImageFile(file);
    if (!readable) {
      rejectUpload("unreadable");
      return;
    }

    setSelectedFile(file);
    setAltText("");
    setErrorMessage("");
    setUploadError(null);
    setCopySuccess(false);
    if (!prefersReducedMotion) {
      setUploadScanToken((token) => token + 1);
    }
  }

  function handleClearFile(event: React.MouseEvent) {
    event.stopPropagation();
    if (isLoading) return;
    clearSelectedFile();
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

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    if (uploadScanToken === 0 || prefersReducedMotion) {
      setShowUploadScan(false);
      return;
    }

    setShowUploadScan(true);
    const timer = window.setTimeout(() => {
      setShowUploadScan(false);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [uploadScanToken, prefersReducedMotion]);

  async function handleGenerate() {
    if (!selectedFile || isLoading) return;

    setIsLoading(true);
    setErrorMessage("");
    setUploadError(null);
    setAltText("");
    setCopySuccess(false);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("language", language);
      formData.append("scenario", scenario);
      formData.append("length", descriptionLength);

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
      setResultRevealKey((current) => current + 1);
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
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopySuccess(false);
        copyResetTimerRef.current = null;
      }, 2000);
    } catch {
      setErrorMessage("复制失败，请手动复制");
    }
  }

  function handleUploadNext() {
    if (isLoading) return;
    clearSelectedFile();
  }

  const canOpenFilePicker = !previewUrl && !isLoading;
  const isGenerateEnabled = Boolean(selectedFile) && !isLoading;
  const charCount = altText.length;
  const isTooLong = charCount > 125;

  const secondaryButtonClassName =
    "rounded-lg border border-[var(--border-subtle)] bg-transparent px-3 py-1.5 text-sm text-foreground transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--control-bg)] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="home-gradient-bg min-h-screen overflow-x-hidden px-4 py-8 font-sans text-foreground sm:px-6 sm:py-10">
      <main className="mx-auto w-full max-w-[1200px]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[2fr_3fr] md:items-start md:gap-8 lg:gap-10">
          <aside className="lab-panel min-w-0 md:pt-2">
            <div className="lab-panel__decor" aria-hidden="true">
              <div className="lab-panel__grid" />
              <div className="lab-panel__frame" />
              <div className="lab-panel__corners">
                <span />
                <span />
              </div>
              <p className="absolute top-3 right-4 font-mono text-[10px] tracking-[0.18em] text-theme/50 uppercase">
                SCAN // 40.12 N
              </p>
              <p className="absolute bottom-3 left-4 font-mono text-[10px] tracking-[0.16em] text-accent/45 uppercase">
                GRID 28px · LAB-01
              </p>
            </div>

            <div className="lab-panel__content">
              <p className="font-mono text-xs font-medium tracking-[0.2em] text-theme uppercase">
                Alt Text Pro
              </p>
              <h1 className="mt-3 text-[2rem] leading-[1.15] font-semibold text-foreground md:text-[3.25rem] lg:text-[4rem]">
                让每一张图片，都能被理解
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted md:text-lg">
                AI 生成清晰、准确、可编辑的图片替代文本。
              </p>
              <ul className="mt-6 flex flex-col gap-3">
                {["快速生成", "结果可编辑", "适用于无障碍与 SEO"].map(
                  (point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2 text-base text-foreground"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-theme"
                      />
                      <span>{point}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </aside>

          <section className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-surface p-4 sm:p-6">
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-foreground sm:text-xl">
                Alt Text Pro —— Free AI Alt Text Generator!
              </h2>

              <div
                role={canOpenFilePicker ? "button" : undefined}
                tabIndex={canOpenFilePicker ? 0 : undefined}
                aria-disabled={isLoading || undefined}
                onClick={
                  canOpenFilePicker
                    ? () => fileInputRef.current?.click()
                    : undefined
                }
                onKeyDown={
                  canOpenFilePicker
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }
                    : undefined
                }
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (isLoading) return;
                  dragDepthRef.current += 1;
                  setIsDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (isLoading) return;
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
                  if (dragDepthRef.current === 0) {
                    setIsDragging(false);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  dragDepthRef.current = 0;
                  setIsDragging(false);
                  if (isLoading) return;
                  const file = event.dataTransfer.files?.[0];
                  if (file) {
                    void applySelectedFile(file);
                  }
                }}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-center transition-colors ${
                  isDragging && !isLoading
                    ? `border-theme bg-theme/10 ${previewUrl ? "p-2" : "px-4 py-8"}`
                    : previewUrl
                      ? "border-[var(--border-subtle)] p-2"
                      : isLoading
                        ? "cursor-not-allowed border-[var(--border-subtle)] px-4 py-8 opacity-70"
                        : "cursor-pointer border-[var(--border-subtle)] px-4 py-8 hover:border-theme hover:bg-[var(--control-bg)]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={isLoading}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void applySelectedFile(file);
                  }}
                />
                {previewUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={handleClearFile}
                      disabled={isLoading}
                      aria-label="删除图片"
                      className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--control-bg)] text-sm text-foreground transition-colors hover:border-theme disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ×
                    </button>
                    <div className="relative h-48 w-full overflow-hidden rounded-md sm:h-64">
                      <Image
                        src={previewUrl}
                        alt="上传预览图"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                      <div className="preview-effects absolute inset-0" aria-hidden="true">
                        {showUploadScan ? (
                          <div
                            key={uploadScanToken}
                            className="preview-scan-line"
                          />
                        ) : null}
                        {isLoading && !prefersReducedMotion ? (
                          <svg
                            className="preview-tracking h-full w-full"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                          >
                            <rect
                              className="preview-tracking__stroke"
                              x="1.2"
                              y="1.2"
                              width="97.6"
                              height="97.6"
                              rx="1.5"
                              pathLength="148"
                            />
                          </svg>
                        ) : null}
                      </div>
                    </div>
                    {isDragging && !isLoading ? (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-theme/10">
                        <p className="rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-1.5 text-sm font-medium text-foreground">
                          松开以替换图片
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-base font-medium text-foreground">
                      {isDragging
                        ? "松开鼠标以上传图片"
                        : "点击或拖拽图片到此处上传"}
                    </p>
                    <p className="font-mono text-xs tracking-wide text-muted">
                      JPG / JPEG / PNG / WEBP · MAX 50MB
                    </p>
                  </>
                )}
              </div>

              {uploadError ? (
                <div
                  role="alert"
                  className="flex gap-3 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent font-mono text-xs font-semibold text-accent"
                  >
                    !
                  </span>
                  <div className="flex min-w-0 flex-col gap-1 text-sm">
                    <p className="font-medium text-foreground">
                      {uploadError.title}
                    </p>
                    <p className="text-muted">{uploadError.recovery}</p>
                  </div>
                </div>
              ) : null}

              <div className="flex min-w-0 flex-col gap-3">
                <SegmentedControl
                  id="language"
                  label="语言"
                  value={language}
                  options={LANGUAGE_OPTIONS}
                  onChange={setLanguage}
                  disabled={isLoading}
                />
                <SegmentedControl
                  id="scenario"
                  label="使用场景"
                  value={scenario}
                  options={SCENARIO_OPTIONS}
                  onChange={setScenario}
                  disabled={isLoading}
                />
                <SegmentedControl
                  id="length"
                  label="描述长度"
                  value={descriptionLength}
                  options={LENGTH_OPTIONS}
                  onChange={setDescriptionLength}
                  disabled={isLoading}
                />
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!selectedFile || isLoading}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-base font-semibold transition-colors disabled:cursor-not-allowed ${
                  isGenerateEnabled
                    ? "bg-theme text-theme-ink hover:bg-theme-hover"
                    : "bg-[var(--control-bg)] text-muted opacity-70"
                }`}
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner />
                    <span className="font-mono text-sm tracking-wide">
                      正在分析图像…
                    </span>
                  </>
                ) : (
                  "生成 alt text"
                )}
              </button>

              {errorMessage ? (
                <div className="flex flex-col gap-2">
                  <p className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-foreground">
                    <span className="font-mono text-xs text-accent uppercase">
                      Error
                    </span>
                    <span className="mt-1 block">{errorMessage}</span>
                  </p>
                  {selectedFile && !isLoading && !altText ? (
                    <button
                      type="button"
                      onClick={handleGenerate}
                      className={secondaryButtonClassName}
                    >
                      重新尝试
                    </button>
                  ) : null}
                </div>
              ) : null}

              {altText ? (
                <section
                  key={resultRevealKey}
                  className={`flex flex-col gap-2 ${
                    prefersReducedMotion ? "" : "result-reveal"
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">
                    生成结果
                  </p>
                  <textarea
                    value={altText}
                    onChange={(event) => {
                      setAltText(event.target.value);
                      setCopySuccess(false);
                    }}
                    className="min-h-24 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--control-bg)] p-3 text-base text-foreground"
                  />
                  <p className="font-mono text-xs tracking-wide text-muted">
                    {charCount} CHARS ·{" "}
                    {isTooLong ? "描述可能过长" : "长度适中"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      disabled={!altText}
                      className={secondaryButtonClassName}
                    >
                      {copySuccess ? "已复制" : "复制结果"}
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={!selectedFile || isLoading}
                      className={secondaryButtonClassName}
                    >
                      重新生成
                    </button>
                    <button
                      type="button"
                      onClick={handleUploadNext}
                      disabled={isLoading}
                      className={secondaryButtonClassName}
                    >
                      上传下一张
                    </button>
                  </div>
                  <p aria-live="polite" className="sr-only">
                    {copySuccess ? "已复制" : ""}
                  </p>
                </section>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
