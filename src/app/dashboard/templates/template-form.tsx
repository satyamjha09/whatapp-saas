"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bold, Code2, Italic, Plus, Smile, Strikethrough } from "lucide-react";
import { actionButtonClass, fieldClass, helperTextClass } from "@/app/dashboard/dashboard-ui";

type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
type TemplateType = "STANDARD" | "CAROUSEL" | "MEDIA" | "CATALOG";

type CarouselCard = {
  id: string;
  headerType: "IMAGE" | "VIDEO";
  body: string;
};

type CreateTemplateResponse = {
  message: string;
  errors?: {
    name?: string[];
    language?: string[];
    category?: string[];
    body?: string[];
  };
};

const templateTypes: Array<{ label: string; value: TemplateType; category: TemplateCategory }> = [
  { label: "Standard", value: "STANDARD", category: "UTILITY" },
  { label: "Carousel", value: "CAROUSEL", category: "MARKETING" },
  { label: "Media", value: "MEDIA", category: "MARKETING" },
  { label: "Catalog", value: "CATALOG", category: "MARKETING" },
];

const languages = [
  { label: "English", value: "en" },
  { label: "English (US)", value: "en_US" },
  { label: "Hindi", value: "hi" },
];

function cleanTemplateName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_");
}

export default function TemplateForm() {
  const router = useRouter();
  const [templateType, setTemplateType] = useState<TemplateType>("CAROUSEL");
  const [category, setCategory] = useState<TemplateCategory>("MARKETING");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [body, setBody] = useState("");
  const [cards, setCards] = useState<CarouselCard[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTypeLabel =
    templateTypes.find((item) => item.value === templateType)?.label ?? "Carousel";

  const previewCards = useMemo(() => cards.slice(0, 3), [cards]);

  function chooseTemplateType(nextType: TemplateType) {
    const next = templateTypes.find((item) => item.value === nextType);
    setTemplateType(nextType);
    setCategory(next?.category ?? "UTILITY");
  }

  function addVariable() {
    const variableNumber = (body.match(/{{\d+}}/g)?.length ?? 0) + 1;
    setBody((current) => `${current}${current ? " " : ""}{{${variableNumber}}}`);
  }

  function wrapBody(prefix: string, suffix = prefix) {
    setBody((current) => (current ? `${prefix}${current}${suffix}` : current));
  }

  function addCard() {
    if (cards.length >= 10) return;

    setCards((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        headerType: "IMAGE",
        body: "",
      },
    ]);
  }

  function updateCard(cardId: string, patch: Partial<CarouselCard>) {
    setCards((current) =>
      current.map((card) => (card.id === cardId ? { ...card, ...patch } : card)),
    );
  }

  function removeCard(cardId: string) {
    setCards((current) => current.filter((card) => card.id !== cardId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (templateType === "CAROUSEL" && cards.length < 2) {
      setError("Carousel templates need at least 2 cards.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          language,
          category,
          templateType,
          body,
          components: {
            templateType,
            body,
            cards: cards.map((card, index) => ({
              index,
              headerType: card.headerType,
              body: card.body,
            })),
          },
        }),
      });

      const data = (await response.json()) as CreateTemplateResponse;

      if (!response.ok) {
        const firstError =
          data.errors?.name?.[0] ??
          data.errors?.language?.[0] ??
          data.errors?.category?.[0] ??
          data.errors?.body?.[0] ??
          data.message;
        setError(firstError);
        return;
      }

      router.push("/dashboard/templates");
      router.refresh();
    } catch {
      setError("Unable to create template. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_438px]">
      <div className="space-y-8">
        <section className="overflow-hidden rounded-xl border border-[#D8E6F3] bg-white">
          <h2 className="border-b border-[#D8E6F3] px-4 py-4 text-lg font-bold text-[#081B3A]">
            Template Configuration
          </h2>
          <div className="grid gap-5 p-4 md:grid-cols-2">
            <div>
              <label htmlFor="templateType" className="mb-2 block font-semibold text-[#081B3A]">
                Template Type <span className="ml-1 text-sm font-normal text-[#526173]">(Required)</span>
              </label>
              <select
                id="templateType"
                value={templateType}
                onChange={(event) => chooseTemplateType(event.target.value as TemplateType)}
                className={fieldClass}
              >
                {templateTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="category" className="mb-2 block font-semibold text-[#081B3A]">
                Template Category <span className="ml-1 text-sm font-normal text-[#526173]">(Auto-selected)</span>
              </label>
              <select id="category" value={category} disabled className={fieldClass}>
                <option value={category}>{category[0] + category.slice(1).toLowerCase()}</option>
              </select>
            </div>

            <div>
              <label htmlFor="name" className="mb-2 block font-semibold text-[#081B3A]">
                Template Name <span className="ml-1 text-sm font-normal text-[#526173]">(Required)</span>
              </label>
              <div className="relative">
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(cleanTemplateName(event.target.value).slice(0, 512))}
                  placeholder="Enter template name (e.g., welcome_message)"
                  required
                  className={`${fieldClass} pr-20`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#526173]">
                  {name.length} / 512
                </span>
              </div>
              <p className={helperTextClass}>
                Names can only contain lowercase letters, numbers, and underscores
              </p>
            </div>

            <div>
              <label htmlFor="language" className="mb-2 block font-semibold text-[#081B3A]">
                Language <span className="ml-1 text-sm font-normal text-[#526173]">(Required)</span>
              </label>
              <select
                id="language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className={fieldClass}
              >
                {languages.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#D8E6F3] bg-white">
          <h2 className="border-b border-[#D8E6F3] px-4 py-4 text-lg font-bold text-[#081B3A]">
            Template Content
          </h2>

          <div className="space-y-5 p-4">
            <div className="overflow-hidden rounded-xl border border-[#D8E6F3]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8E6F3] px-4 py-3">
                <p className="font-bold text-[#081B3A]">
                  {selectedTypeLabel} Message <span className="text-rose-500">*</span>
                </p>
                <p className="text-sm text-[#526173]">
                  Main message above carousel cards (required)
                </p>
              </div>

              <div className="p-4">
                <h3 className="text-lg font-bold text-[#081B3A]">
                  Message Content with Formatting
                </h3>
                <p className="mt-3 text-sm text-[#526173]">
                  Use formatting buttons for bold, italic, strikethrough, and code. Variables like {"{{1}}"} will be highlighted.
                </p>

                <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={addVariable}
                    className="inline-flex items-center rounded-lg border border-[#D8E6F3] bg-white px-3 py-2 text-sm font-semibold text-[#081B3A] hover:bg-[#F0F8FF]"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Variable
                  </button>
                  <div className="flex gap-2">
                    <button type="button" className="rounded-md border border-[#D8E6F3] p-2 text-[#081B3A]">
                      <Smile className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => wrapBody("*")} className="rounded-md border border-[#D8E6F3] p-2 text-[#081B3A]">
                      <Bold className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => wrapBody("_")} className="rounded-md border border-[#D8E6F3] p-2 text-[#081B3A]">
                      <Italic className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => wrapBody("~")} className="rounded-md border border-[#D8E6F3] p-2 text-[#081B3A]">
                      <Strikethrough className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => wrapBody("```")} className="rounded-md border border-[#D8E6F3] p-2 text-[#081B3A]">
                      <Code2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value.slice(0, 1024))}
                  rows={7}
                  required
                  placeholder="Type your message with formatting..."
                  className={`${fieldClass} mt-3`}
                />
                <p className="mt-2 text-right text-sm text-[#526173]">
                  {body.length} / 1024
                </p>
              </div>
            </div>

            {templateType === "CAROUSEL" ? (
              <div className="overflow-hidden rounded-xl border border-[#D8E6F3]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8E6F3] px-4 py-3">
                  <p className="font-bold text-[#081B3A]">
                    Carousel Cards <span className="text-rose-500">*</span>
                  </p>
                  <p className="text-sm text-[#526173]">
                    Individual cards in the carousel (minimum 2 required)
                  </p>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#081B3A]">
                        Carousel Cards <span className="font-normal text-[#526173]">- {cards.length} of 10 cards</span>
                      </p>
                      <p className="mt-4 text-sm text-[#526173]">
                        Create multiple cards that customers can swipe through. Each card can have its own header type (image or video) and body text.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addCard}
                      disabled={cards.length >= 10}
                      className="inline-flex items-center rounded-lg border border-[#D8E6F3] bg-white px-4 py-2 font-semibold text-[#081B3A] hover:bg-[#F0F8FF] disabled:opacity-60"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add card
                    </button>
                  </div>

                  {cards.length === 0 ? (
                    <div className="mt-5 rounded-xl border border-dashed border-[#D8E6F3] bg-[#F0F8FF] p-6 text-sm text-[#526173]">
                      No cards created yet. Carousel templates need at least 2 cards. Click &quot;Add card&quot; to get started.
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-4">
                      {cards.map((card, index) => (
                        <div key={card.id} className="rounded-xl border border-[#D8E6F3] bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="font-bold text-[#081B3A]">Card {index + 1}</p>
                            <button
                              type="button"
                              onClick={() => removeCard(card.id)}
                              className="text-sm font-semibold text-rose-600 hover:text-rose-700"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
                            <select
                              value={card.headerType}
                              onChange={(event) =>
                                updateCard(card.id, {
                                  headerType: event.target.value as CarouselCard["headerType"],
                                })
                              }
                              className={fieldClass}
                            >
                              <option value="IMAGE">Image header</option>
                              <option value="VIDEO">Video header</option>
                            </select>
                            <input
                              value={card.body}
                              onChange={(event) => updateCard(card.id, { body: event.target.value })}
                              placeholder="Card body text"
                              className={fieldClass}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <section className="overflow-hidden rounded-xl border border-[#D8E6F3] bg-white">
          <h2 className="border-b border-[#D8E6F3] px-8 py-7 text-xl font-bold text-[#081B3A]">
            Preview
          </h2>
          <div className="min-h-[440px] bg-[#eee7dd] bg-[radial-gradient(circle_at_12px_12px,rgba(120,110,100,0.13)_1px,transparent_1.5px),radial-gradient(circle_at_34px_28px,rgba(120,110,100,0.09)_1px,transparent_1.5px)] bg-[length:44px_44px] p-4">
            <div className="mx-auto mb-3 w-fit rounded-full bg-white px-3 py-2 text-xs text-[#526173] shadow-sm">
              Today
            </div>
            <div className="rounded-lg bg-white p-4 text-sm text-[#081B3A] shadow-sm">
              <p className="whitespace-pre-wrap break-words leading-6">
                {body || ""}
              </p>
              {previewCards.length ? (
                <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                  {previewCards.map((card, index) => (
                    <div key={card.id} className="min-w-44 rounded-lg border border-[#D8E6F3] bg-[#F0F8FF] p-3">
                      <div className="grid h-20 place-items-center rounded-md bg-white text-xs font-semibold text-[#526173]">
                        {card.headerType}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-[#081B3A]">
                        {card.body || `Carousel card ${index + 1}`}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="mt-2 text-right text-xs text-[#526173]">10:12 PM</p>
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`${actionButtonClass()} mt-5 w-full rounded-xl py-4 text-base`}
        >
          {isSubmitting ? "Creating..." : "Create Template"}
        </button>
      </aside>
    </form>
  );
}
