"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Image as ImageIcon,
  Plus,
  Send,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";
import {
  buildMetaExamples,
  buildVariableMetadata,
  renderPreview,
  validateSampleValues,
  validateVariableSequence,
  type TemplateVariable,
} from "@/lib/whatsapp-template/template-variable-engine";

type HeaderType = "IMAGE" | "VIDEO";
type CardButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER";

type TemplateMediaAsset = {
  id: string;
  fileName: string;
  mediaType: "IMAGE" | "VIDEO" | "DOCUMENT";
  mimeType: string;
  sizeBytes: number;
  publicUrl: string;
  metaHandle?: string | null;
};

type CarouselButton = {
  id: string;
  text: string;
  type: CardButtonType;
  url: string;
  phoneNumber: string;
};

type CarouselCard = {
  id: string;
  body: string;
  buttons: CarouselButton[];
  headerType: HeaderType;
  mediaAsset: TemplateMediaAsset | null;
  sampleValues: Record<string, string>;
};

const languages = [
  { label: "English (US)", value: "en_US" },
  { label: "English", value: "en" },
  { label: "Hindi", value: "hi" },
];

function cleanTemplateName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function newButton(): CarouselButton {
  return {
    id: crypto.randomUUID(),
    phoneNumber: "",
    text: "Shop now",
    type: "URL",
    url: "https://metawhat.in",
  };
}

function newCard(index: number): CarouselCard {
  return {
    body: `Carousel card ${index + 1} for {{1}}`,
    buttons: [newButton()],
    headerType: "IMAGE",
    id: crypto.randomUUID(),
    mediaAsset: null,
    sampleValues: {
      "1": "Customer",
      BODY_1: "Customer",
    },
  };
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function variableKey(variable: TemplateVariable) {
  return variable.component === "BUTTON"
    ? `BUTTON_${variable.buttonIndex ?? 0}_${variable.key}`
    : `${variable.component}_${variable.key}`;
}

function buildCarouselComponents(cards: CarouselCard[], body: string) {
  return {
    cards: cards.map((card, cardIndex) => {
      const metadata = buildVariableMetadata({
        body: card.body,
        buttons: card.buttons,
        sampleValues: card.sampleValues,
      });
      const bodyExample = buildMetaExamples(
        metadata.variables,
        card.sampleValues,
        "BODY",
      );

      return {
        body: card.body.trim(),
        buttons: card.buttons.map((button) => ({
          ...(button.phoneNumber ? { phoneNumber: button.phoneNumber } : {}),
          ...(button.url ? { url: button.url } : {}),
          text: button.text.trim(),
          type: button.type,
        })),
        cardIndex,
        components: [
          {
            ...(card.mediaAsset?.metaHandle
              ? { example: { header_handle: [card.mediaAsset.metaHandle] } }
              : {}),
            fileName: card.mediaAsset?.fileName,
            format: card.headerType,
            mediaAssetId: card.mediaAsset?.id,
            mediaUrl: card.mediaAsset?.publicUrl,
            metaHandle: card.mediaAsset?.metaHandle,
            mimeType: card.mediaAsset?.mimeType,
            publicUrl: card.mediaAsset?.publicUrl,
            sizeBytes: card.mediaAsset?.sizeBytes,
            type: "HEADER",
          },
          {
            ...(bodyExample ? { example: bodyExample } : {}),
            text: card.body.trim(),
            type: "BODY",
          },
          {
            buttons: card.buttons.map((button) => ({
              ...(button.phoneNumber ? { phoneNumber: button.phoneNumber } : {}),
              ...(button.url ? { url: button.url } : {}),
              text: button.text.trim(),
              type: button.type,
            })),
            type: "BUTTONS",
          },
        ],
        headerType: card.headerType,
        mediaAssetId: card.mediaAsset?.id,
      };
    }),
    components: [
      {
        text: body.trim(),
        type: "BODY",
      },
      {
        cards: cards.map((card) => ({
          components: [
            {
              ...(card.mediaAsset?.metaHandle
                ? { example: { header_handle: [card.mediaAsset.metaHandle] } }
                : {}),
              format: card.headerType,
              type: "HEADER",
            },
            {
              text: card.body.trim(),
              type: "BODY",
            },
            {
              buttons: card.buttons.map((button) => ({
                ...(button.phoneNumber ? { phoneNumber: button.phoneNumber } : {}),
                ...(button.url ? { url: button.url } : {}),
                text: button.text.trim(),
                type: button.type,
              })),
              type: "BUTTONS",
            },
          ],
        })),
        type: "CAROUSEL",
      },
    ],
    templateType: "CAROUSEL",
  };
}

export default function CarouselTemplateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en_US");
  const [body, setBody] = useState("Explore our latest offers below.");
  const [cards, setCards] = useState<CarouselCard[]>([newCard(0), newCard(1)]);
  const [activeCardId, setActiveCardId] = useState(cards[0]?.id ?? "");
  const [uploadingCardId, setUploadingCardId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeCard = cards.find((card) => card.id === activeCardId) ?? cards[0];
  const cardButtonPattern = cards[0]?.buttons.map((button) => button.type).join("|") ?? "";

  const validationError = useMemo(() => {
    if (cards.length < 2) return "Carousel needs at least 2 cards.";
    if (cards.length > 10) return "Carousel cannot have more than 10 cards.";

    for (const card of cards) {
      if (!card.mediaAsset) return "Each carousel card needs an image or video sample.";
      if (!card.mediaAsset.metaHandle) {
        return "Each carousel media sample must have a Meta review handle.";
      }
      if (!card.body.trim()) return "Each carousel card needs body text.";
      if (card.buttons.length > 2) return "Each carousel card can have at most 2 buttons.";
      if (card.buttons.length === 0) return "Each carousel card needs at least 1 button.";
      if (card.buttons.map((button) => button.type).join("|") !== cardButtonPattern) {
        return "All carousel cards must use the same button pattern.";
      }

      const metadata = buildVariableMetadata({
        body: card.body,
        buttons: card.buttons,
        sampleValues: card.sampleValues,
      });
      const variableIssues = [
        ...validateVariableSequence(metadata.variables),
        ...validateSampleValues(metadata.variables, card.sampleValues),
      ];
      if (variableIssues.length > 0) {
        return variableIssues[0]?.message ?? "Carousel variable samples are invalid.";
      }
    }

    return "";
  }, [cardButtonPattern, cards]);

  function updateCard(cardId: string, patch: Partial<CarouselCard>) {
    setCards((current) =>
      current.map((card) => (card.id === cardId ? { ...card, ...patch } : card)),
    );
  }

  function addCard() {
    if (cards.length >= 10) return;
    const card = newCard(cards.length);
    const firstButtons = cards[0]?.buttons ?? [newButton()];
    card.buttons = firstButtons.map((button) => ({
      ...button,
      id: crypto.randomUUID(),
    }));
    setCards((current) => [...current, card]);
    setActiveCardId(card.id);
  }

  function duplicateCard(cardId: string) {
    if (cards.length >= 10) return;
    const source = cards.find((card) => card.id === cardId);
    if (!source) return;
    const duplicate = {
      ...source,
      buttons: source.buttons.map((button) => ({
        ...button,
        id: crypto.randomUUID(),
      })),
      id: crypto.randomUUID(),
    };
    setCards((current) => [...current, duplicate]);
    setActiveCardId(duplicate.id);
  }

  function removeCard(cardId: string) {
    if (cards.length <= 2) return;
    setCards((current) => current.filter((card) => card.id !== cardId));
    if (activeCardId === cardId) {
      setActiveCardId(cards.find((card) => card.id !== cardId)?.id ?? "");
    }
  }

  function moveCard(cardId: string, direction: "UP" | "DOWN") {
    const index = cards.findIndex((card) => card.id === cardId);
    const target = direction === "UP" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= cards.length) return;

    const next = [...cards];
    const [card] = next.splice(index, 1);
    if (!card) return;
    next.splice(target, 0, card);
    setCards(next);
  }

  function updateButton(
    cardId: string,
    buttonId: string,
    patch: Partial<CarouselButton>,
  ) {
    setCards((current) =>
      current.map((card) =>
        card.id === cardId
          ? {
              ...card,
              buttons: card.buttons.map((button) =>
                button.id === buttonId ? { ...button, ...patch } : button,
              ),
            }
          : card,
      ),
    );
  }

  function addButton(cardId: string) {
    setCards((current) =>
      current.map((card) =>
        card.id === cardId && card.buttons.length < 2
          ? { ...card, buttons: [...card.buttons, newButton()] }
          : card,
      ),
    );
  }

  function removeButton(cardId: string, buttonId: string) {
    setCards((current) =>
      current.map((card) =>
        card.id === cardId && card.buttons.length > 1
          ? {
              ...card,
              buttons: card.buttons.filter((button) => button.id !== buttonId),
            }
          : card,
      ),
    );
  }

  function updateSample(cardId: string, variable: TemplateVariable, value: string) {
    const key = variableKey(variable);
    setCards((current) =>
      current.map((card) =>
        card.id === cardId
          ? {
              ...card,
              sampleValues: {
                ...card.sampleValues,
                [key]: value,
                [variable.key]: value,
              },
            }
          : card,
      ),
    );
  }

  function uploadCardMedia(card: CarouselCard, file: File) {
    setError("");
    setUploadingCardId(card.id);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mediaType", card.headerType);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/templates/media-assets");
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      setUploadProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      setUploadingCardId(null);
      try {
        const data = JSON.parse(request.responseText) as {
          asset?: TemplateMediaAsset;
          message?: string;
        };
        if (request.status < 200 || request.status >= 300 || !data.asset) {
          setError(data.message ?? "Unable to upload card media.");
          return;
        }
        updateCard(card.id, { mediaAsset: data.asset });
        setUploadProgress(100);
      } catch {
        setError("Unable to read media upload response.");
      }
    };
    request.onerror = () => {
      setUploadingCardId(null);
      setError("Media upload failed. Please try again.");
    };
    request.send(formData);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }

    if (!body.trim()) {
      setError("Carousel message body is required.");
      return;
    }

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/templates", {
        body: JSON.stringify({
          body,
          category: "MARKETING",
          components: buildCarouselComponents(cards, body),
          language,
          name,
          templateType: "CAROUSEL",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as {
        errors?: Record<string, string[]>;
        message?: string;
      };

      if (!response.ok) {
        setError(
          data.errors?.name?.[0] ??
            data.errors?.components?.[0] ??
            data.message ??
            "Unable to create carousel template.",
        );
        return;
      }

      router.push("/dashboard/templates");
      router.refresh();
    } catch {
      setError("Unable to create carousel template. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeVariables = activeCard
    ? buildVariableMetadata({
        body: activeCard.body,
        buttons: activeCard.buttons,
        sampleValues: activeCard.sampleValues,
      }).variables
    : [];

  return (
    <form
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]"
      onSubmit={handleSubmit}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
              Carousel Message
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
              Template configuration
            </h2>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <label className="block">
              <span className={labelClass}>Name</span>
              <input
                className={fieldClass}
                maxLength={80}
                onChange={(event) =>
                  setName(cleanTemplateName(event.target.value).slice(0, 80))
                }
                placeholder="summer_carousel"
                required
                value={name}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Language</span>
              <select
                className={fieldClass}
                onChange={(event) => setLanguage(event.target.value)}
                value={language}
              >
                {languages.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Category</span>
              <input className={`${fieldClass} bg-[#F8FCFA]`} readOnly value="Marketing" />
            </label>
          </div>
          <div className="px-5 pb-5">
            <label className="block">
              <span className={labelClass}>Carousel message</span>
              <textarea
                className={`${fieldClass} min-h-28 resize-y leading-6`}
                onChange={(event) => setBody(event.target.value)}
                value={body}
              />
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#BFE9D0] px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
                Cards
              </p>
              <h2 className="mt-1 text-lg font-bold text-[#081B3A]">
                {cards.length} of 10 cards
              </h2>
            </div>
            <button
              className="inline-flex items-center rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-sm font-bold text-[#128C7E] hover:bg-[#E7F8EF] disabled:opacity-50"
              disabled={cards.length >= 10}
              onClick={addCard}
              type="button"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Card
            </button>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-2">
              {cards.map((card, index) => (
                <button
                  className={[
                    "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition",
                    activeCard?.id === card.id
                      ? "border-[#128C7E] bg-[#E7F8EF] text-[#081B3A]"
                      : "border-[#BFE9D0] bg-white text-[#526173] hover:bg-[#F8FCFA]",
                  ].join(" ")}
                  key={card.id}
                  onClick={() => setActiveCardId(card.id)}
                  type="button"
                >
                  <span>
                    <span className="block font-bold">Card {index + 1}</span>
                    <span className="mt-1 block truncate text-xs">
                      {card.mediaAsset?.fileName ?? "Media required"}
                    </span>
                  </span>
                  {card.headerType === "VIDEO" ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                </button>
              ))}
            </div>

            {activeCard ? (
              <div className="space-y-5 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-[#081B3A]">
                    Edit card {cards.findIndex((card) => card.id === activeCard.id) + 1}
                  </h3>
                  <div className="flex gap-1">
                    <button
                      className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#526173]"
                      onClick={() => moveCard(activeCard.id, "UP")}
                      type="button"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#526173]"
                      onClick={() => moveCard(activeCard.id, "DOWN")}
                      type="button"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#128C7E]"
                      onClick={() => duplicateCard(activeCard.id)}
                      type="button"
                    >
                      <CopyPlus className="h-4 w-4" />
                    </button>
                    <button
                      className="grid h-8 w-8 place-items-center rounded-lg bg-white text-rose-600 disabled:opacity-50"
                      disabled={cards.length <= 2}
                      onClick={() => removeCard(activeCard.id)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Header media type</span>
                    <select
                      className={fieldClass}
                      onChange={(event) =>
                        updateCard(activeCard.id, {
                          headerType: event.target.value as HeaderType,
                          mediaAsset: null,
                        })
                      }
                      value={activeCard.headerType}
                    >
                      <option value="IMAGE">Image</option>
                      <option value="VIDEO">Video</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClass}>Upload media</span>
                    <span className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-[#BFE9D0] bg-white px-4 py-3 text-sm font-bold text-[#128C7E] hover:bg-[#E7F8EF]">
                      <UploadCloud className="mr-2 h-4 w-4" />
                      {uploadingCardId === activeCard.id ? "Uploading..." : "Choose file"}
                      <input
                        accept={
                          activeCard.headerType === "IMAGE"
                            ? "image/jpeg,image/png"
                            : "video/mp4,video/3gpp"
                        }
                        className="sr-only"
                        disabled={Boolean(uploadingCardId)}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) uploadCardMedia(activeCard, file);
                        }}
                        type="file"
                      />
                    </span>
                  </label>
                </div>

                {uploadingCardId === activeCard.id ? (
                  <div>
                    <div className="h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-[#128C7E]"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className={helperTextClass}>{uploadProgress}% uploaded</p>
                  </div>
                ) : null}

                {activeCard.mediaAsset ? (
                  <div className="rounded-xl border border-[#BFE9D0] bg-white p-3">
                    <p className="truncate text-sm font-bold text-[#081B3A]">
                      {activeCard.mediaAsset.fileName}
                    </p>
                    <p className="mt-1 text-xs text-[#526173]">
                      {activeCard.mediaAsset.mimeType} ·{" "}
                      {formatBytes(activeCard.mediaAsset.sizeBytes)}
                    </p>
                  </div>
                ) : null}

                <label className="block">
                  <span className={labelClass}>Card body</span>
                  <textarea
                    className={`${fieldClass} min-h-32 resize-y leading-6`}
                    onChange={(event) =>
                      updateCard(activeCard.id, { body: event.target.value })
                    }
                    value={activeCard.body}
                  />
                </label>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className={labelClass}>Buttons</span>
                    <button
                      className="inline-flex items-center rounded-lg border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-bold text-[#128C7E] disabled:opacity-50"
                      disabled={activeCard.buttons.length >= 2}
                      onClick={() => addButton(activeCard.id)}
                      type="button"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                  <div className="space-y-3">
                    {activeCard.buttons.map((button) => (
                      <div
                        className="rounded-xl border border-[#BFE9D0] bg-white p-3"
                        key={button.id}
                      >
                        <div className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)_32px]">
                          <select
                            className={fieldClass}
                            onChange={(event) =>
                              updateButton(activeCard.id, button.id, {
                                type: event.target.value as CardButtonType,
                              })
                            }
                            value={button.type}
                          >
                            <option value="QUICK_REPLY">Quick reply</option>
                            <option value="URL">Website URL</option>
                            <option value="PHONE_NUMBER">Phone</option>
                          </select>
                          <input
                            className={fieldClass}
                            maxLength={25}
                            onChange={(event) =>
                              updateButton(activeCard.id, button.id, {
                                text: event.target.value,
                              })
                            }
                            value={button.text}
                          />
                          <button
                            className="grid h-10 w-10 place-items-center rounded-lg bg-rose-50 text-rose-600 disabled:opacity-50"
                            disabled={activeCard.buttons.length <= 1}
                            onClick={() => removeButton(activeCard.id, button.id)}
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {button.type === "URL" ? (
                          <input
                            className={`${fieldClass} mt-3`}
                            onChange={(event) =>
                              updateButton(activeCard.id, button.id, {
                                url: event.target.value,
                              })
                            }
                            placeholder="https://metawhat.in/product"
                            value={button.url}
                          />
                        ) : null}
                        {button.type === "PHONE_NUMBER" ? (
                          <input
                            className={`${fieldClass} mt-3`}
                            onChange={(event) =>
                              updateButton(activeCard.id, button.id, {
                                phoneNumber: event.target.value,
                              })
                            }
                            placeholder="+918810386013"
                            value={button.phoneNumber}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                {activeVariables.length > 0 ? (
                  <div>
                    <span className={labelClass}>Sample values</span>
                    <div className="space-y-3">
                      {activeVariables.map((variable) => (
                        <label
                          className="grid gap-2 rounded-xl border border-[#BFE9D0] bg-white p-3 md:grid-cols-[120px_minmax(0,1fr)] md:items-center"
                          key={`${variable.component}-${variable.buttonIndex ?? "x"}-${variable.key}`}
                        >
                          <span className="text-sm font-bold text-[#081B3A]">
                            {variable.token}
                          </span>
                          <input
                            className={fieldClass}
                            onChange={(event) =>
                              updateSample(activeCard.id, variable, event.target.value)
                            }
                            value={
                              activeCard.sampleValues[variableKey(variable)] ??
                              activeCard.sampleValues[variable.key] ??
                              ""
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {(error || validationError) ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error || validationError}
          </div>
        ) : null}

        <button
          className={actionButtonClass()}
          disabled={isSubmitting}
          type="submit"
        >
          <Send className="mr-2 h-4 w-4" />
          {isSubmitting ? "Saving..." : "Save Carousel Draft"}
        </button>
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <section className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
          <div className="border-b border-[#BFE9D0] px-5 py-4">
            <p className="text-sm font-bold text-[#081B3A]">Mobile swipe preview</p>
          </div>
          <div className="bg-[#eee7dd] bg-[radial-gradient(circle_at_12px_12px,rgba(120,110,100,0.13)_1px,transparent_1.5px),radial-gradient(circle_at_34px_28px,rgba(120,110,100,0.09)_1px,transparent_1.5px)] bg-[length:44px_44px] p-4">
            <div className="rounded-lg bg-white p-4 text-sm text-[#081B3A] shadow-sm">
              <p className="mb-3 whitespace-pre-wrap leading-6">{body}</p>
              <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                {cards.map((card, index) => (
                  <div
                    className="w-[220px] shrink-0 snap-center overflow-hidden rounded-lg border border-[#DCEFE4] bg-white"
                    key={card.id}
                  >
                    {card.headerType === "IMAGE" && card.mediaAsset?.publicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={card.mediaAsset.fileName}
                        className="aspect-[1.3/1] w-full object-cover"
                        src={card.mediaAsset.publicUrl}
                      />
                    ) : card.headerType === "VIDEO" && card.mediaAsset?.publicUrl ? (
                      <video
                        className="aspect-[1.3/1] w-full bg-black object-cover"
                        src={card.mediaAsset.publicUrl}
                      />
                    ) : (
                      <div className="grid aspect-[1.3/1] place-items-center bg-[#E7F8EF] text-[#128C7E]">
                        {card.headerType === "VIDEO" ? (
                          <Video className="h-7 w-7" />
                        ) : (
                          <ImageIcon className="h-7 w-7" />
                        )}
                      </div>
                    )}
                    <div className="p-3">
                      <p className="whitespace-pre-wrap text-xs leading-5">
                        {renderPreview(card.body, card.sampleValues)}
                      </p>
                      <div className="mt-3 divide-y divide-[#E7F8EF] border-t border-[#E7F8EF]">
                        {card.buttons.map((button) => (
                          <p
                            className="py-2 text-center text-xs font-semibold text-[#128C7E]"
                            key={button.id}
                          >
                            {button.text || button.type}
                          </p>
                        ))}
                      </div>
                      <p className="mt-2 text-right text-[10px] text-[#526173]">
                        Card {index + 1}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </aside>
    </form>
  );
}
