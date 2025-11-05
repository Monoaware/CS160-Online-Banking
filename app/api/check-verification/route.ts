import { Buffer } from "buffer";
import { getAuthUserFromRequest } from "../../../lib/auth";
import { getPrisma } from "../../lib/prisma";

// Toggle OCR debug (true while testing, false otherwise)
const ENABLE_OCR_DEBUG = true;

type AnyObj = Record<string, unknown>;

function collectStrings(obj: unknown, out: string[]) {
  if (typeof obj === "string") out.push(obj);
  else if (Array.isArray(obj)) {
    for (const v of obj) collectStrings(v, out);
  } else if (obj && typeof obj === "object") {
    for (const k of Object.keys(obj as Record<string, unknown>)) {
      collectStrings((obj as Record<string, unknown>)[k], out);
    }
  }
}

function normalizeOcrSpaceResult(resp: AnyObj): string {
  const parsedResults = resp["ParsedResults"];
  if (Array.isArray(parsedResults) && parsedResults.length > 0) {
    const first = parsedResults[0] as Record<string, unknown> | undefined;
    const parsedText =
      first && typeof first["ParsedText"] === "string"
        ? String(first["ParsedText"])
        : "";
    return parsedText;
  }
  const topText = resp["ParsedText"];
  return typeof topText === "string" ? topText : "";
}

function extractCheckId(ocrJson: AnyObj): string | null {
  const toStr = (v: unknown) =>
    v === null || v === undefined
      ? null
      : typeof v === "string" || typeof v === "number"
        ? String(v)
        : null;

  const routing = toStr(
    ocrJson["routing_number"] ?? ocrJson["routing"] ?? ocrJson["aba"],
  );
  const account = toStr(ocrJson["account_number"] ?? ocrJson["account"]);
  const check = toStr(
    ocrJson["check_number"] ?? ocrJson["check_no"] ?? ocrJson["cheque_number"],
  );
  if (routing && account && check) return `${routing}_${account}_${check}`;

  const parts: string[] = [];
  collectStrings(ocrJson, parts);
  const allText = parts.join(" ");
  const routingMatch = allText.match(/(\d{9})/);
  if (!routingMatch) return null;
  const routingNum = routingMatch[1];

  const digitGroups = Array.from(allText.matchAll(/(\d{4,})/g)).map(
    (m) => m[1],
  );
  const filtered = digitGroups.filter((g) => g !== routingNum);
  if (filtered.length < 2) return null;
  const accountNum = filtered[0];
  const checkNum = filtered[1];
  return `${routingNum}_${accountNum}_${checkNum}`;
}

function extractAmount(ocrJson: AnyObj): string | null {
  const toStr = (v: unknown) =>
    v === null || v === undefined
      ? null
      : typeof v === "string" || typeof v === "number"
        ? String(v)
        : null;

  const structured =
    toStr(ocrJson["amount"]) ??
    toStr(ocrJson["amount_numeric"]) ??
    toStr(ocrJson["legal_amount"]) ??
    toStr(ocrJson["written_amount"]);
  if (structured) return structured;

  const parts: string[] = [];
  collectStrings(ocrJson, parts);
  const allText = parts.join(" ");

  const moneyWithDollar = allText.match(
    /(?:\$|USD\s?)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2}))/i,
  );
  if (moneyWithDollar) return moneyWithDollar[1].replace(/,/g, ".");

  const plainMoney = allText.match(/([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/);
  if (plainMoney) return plainMoney[1].replace(/,/g, ".");

  const digitGroups = allText
    .replace(/[^\d]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const candidates = digitGroups.filter((g) => g.length >= 4 && g.length <= 7);
  if (candidates.length === 1) {
    const g = candidates[0];
    const dollars = g.slice(0, -2) || "0";
    const cents = g.slice(-2);
    return `${Number(dollars)}.${cents}`;
  }
  if (candidates.length > 1) {
    const best = candidates.sort((a, b) => b.length - a.length)[0];
    const dollars = best.slice(0, -2) || "0";
    const cents = best.slice(-2);
    return `${Number(dollars)}.${cents}`;
  }

  return null;
}

function detectEndorsement(ocrJson: AnyObj): boolean {
  if (ocrJson["endorsement"] === true) return true;
  if (ocrJson["signature_present"] === true) return true;
  if (ocrJson["endorsement_image"]) return true;

  const parts: string[] = [];
  collectStrings(ocrJson, parts);
  const allText = parts.join(" ").toLowerCase();
  return /endorse|endorsement|signed by|signature/i.test(allText);
}

async function callOcrSpace(
  base64Image: string,
  apiUrl: string,
  apiKey: string,
): Promise<AnyObj> {
  const fd = new FormData();
  fd.append("base64Image", `data:image/jpeg;base64,${base64Image}`);
  fd.append("language", "eng");
  fd.append("isOverlayRequired", "false");

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { apikey: apiKey },
    body: fd as unknown as BodyInit,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OCR service error ${res.status}: ${txt}`);
  }

  const jsonUnknown = (await res.json().catch(() => ({}))) as unknown;
  return jsonUnknown && typeof jsonUnknown === "object"
    ? (jsonUnknown as AnyObj)
    : {};
}

/**
 * @deprecated Keep for reference only. Use callOpenAIVisionCombined instead.
 * Throwing to prevent accidental use.
 */
async function callOpenAIVision(_: string, __: string): Promise<AnyObj> {
  throw new Error(
    "callOpenAIVision is deprecated. Use callOpenAIVisionCombined(frontBase64, backBase64, apiKey).",
  );
}

async function callOpenAIVisionCombined(
  frontBase64: string,
  backBase64: string,
  apiKey: string,
): Promise<AnyObj> {
  const endpoint = "https://api.openai.com/v1/responses";
  const modelName = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";
  const payload = {
    model: modelName,
    temperature: 0,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `
You will be given TWO images: the FIRST is the FRONT of a bank check, the SECOND is the BACK.
Return a single valid JSON object with exactly these keys:
{
  "front": {
    "amount": "<string decimal or null>",
    "routing_number": "<9-digit string or null>",
    "account_number": "<string or null>",
    "check_number": "<string or null>",
    "raw_text": "<transcribed text from the front>"
  },
  "back": {
    "endorsement_present": <true|false>,
    "raw_text": "<transcribed text from the back>"
  },
  "combined": {
    "amount": "<string decimal or null>",
    "check_id": "<routing_account_check or null>",
    "notes": "<optional short notes or null>"
  }
}
Respond ONLY with valid JSON that matches the schema above. If you cannot find a field, return null for it. Do not add any other fields or commentary.
`,
          },
          {
            type: "input_image",
            image_url: `data:image/jpeg;base64,${frontBase64}`,
          },
          {
            type: "input_image",
            image_url: `data:image/jpeg;base64,${backBase64}`,
          },
        ],
      },
    ],
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI vision error ${res.status}: ${txt}`);
  }

  const json = await res.json().catch(() => ({}));
  try {
    // avoid 'any' by safely extracting array props from unknown JSON
    const getArrayProp = (obj: unknown, key: string): unknown[] => {
      if (!obj || typeof obj !== "object") return [];
      const val = (obj as Record<string, unknown>)[key];
      return Array.isArray(val) ? val : [];
    };

    const outputs: unknown[] = [
      ...getArrayProp(json, "output"),
      ...getArrayProp(json, "choices"),
    ];
    const candidateTexts: string[] = [];

    for (const o of outputs) {
      let content: unknown = null;
      if (o && typeof o === "object") {
        const rec = o as Record<string, unknown>;
        const msg = rec["message"];
        content =
          rec["content"] ??
          (msg && typeof msg === "object"
            ? (msg as Record<string, unknown>)["content"]
            : null);
      }

      if (Array.isArray(content)) {
        for (const c of content) {
          if (
            c &&
            typeof c === "object" &&
            typeof (c as Record<string, unknown>)["text"] === "string"
          ) {
            candidateTexts.push(String((c as Record<string, unknown>)["text"]));
          }
        }
      } else if (typeof content === "string") {
        candidateTexts.push(content);
      }
    }

    candidateTexts.push(JSON.stringify(json));

    for (const t of candidateTexts) {
      const jsMatch = t.match(/\{[\s\S]*\}/);
      if (jsMatch) {
        try {
          const parsed = JSON.parse(jsMatch[0]);
          if (parsed && typeof parsed === "object") return parsed as AnyObj;
        } catch {
          /* ignore parse errors */
        }
      }
    }
  } catch {
    /* fallthrough */
  }
  return typeof json === "object" && json !== null ? (json as AnyObj) : {};
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUserFromRequest(request);
    if (!auth.ok) {
      return new Response(
        JSON.stringify(auth.body || { message: "Unauthorized" }),
        {
          status: auth.status ?? 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const form = await request.formData();
    const front = form.get("front") as File | null;
    const back = form.get("back") as File | null;

    if (!front || !back) {
      return new Response(
        JSON.stringify({
          error: "Both 'front' and 'back' images are required.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const frontBuf = Buffer.from(await front.arrayBuffer());
    const backBuf = Buffer.from(await back.arrayBuffer());
    const frontBase64 = frontBuf.toString("base64");
    const backBase64 = backBuf.toString("base64");

    let frontResp: AnyObj = {};
    let backResp: AnyObj = {};
    let combinedResp: AnyObj | null = null;

    const openaiKey = process.env.OPENAI_API_KEY;
    const ocrApiUrl = process.env.CHECK_OCR_API_URL;
    const ocrApiKey = process.env.CHECK_OCR_API_KEY;

    try {
      if (openaiKey) {
        combinedResp = await callOpenAIVisionCombined(
          frontBase64,
          backBase64,
          openaiKey,
        );
        frontResp =
          combinedResp && typeof combinedResp["front"] === "object"
            ? (combinedResp["front"] as AnyObj)
            : {};
        backResp =
          combinedResp && typeof combinedResp["back"] === "object"
            ? (combinedResp["back"] as AnyObj)
            : {};
      } else {
        if (!ocrApiUrl || !ocrApiKey) {
          return new Response(
            JSON.stringify({ error: "OCR service not configured." }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        frontResp = await callOcrSpace(frontBase64, ocrApiUrl, ocrApiKey);
        backResp = await callOcrSpace(backBase64, ocrApiUrl, ocrApiKey);
      }
    } catch (e: unknown) {
      console.error("Vision/OCR call failed:", e);
      return new Response(
        JSON.stringify({ error: "OCR/vision service error" }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (ENABLE_OCR_DEBUG) {
      console.log(
        "---- FRONT OCR JSON ----\n",
        JSON.stringify(frontResp, null, 2),
      );
      console.log(
        "---- BACK OCR JSON ----\n",
        JSON.stringify(backResp, null, 2),
      );
      try {
        const fs = await import("fs");
        fs.writeFileSync?.(
          "/tmp/front_ocr.json",
          JSON.stringify(frontResp, null, 2),
        );
        fs.writeFileSync?.(
          "/tmp/back_ocr.json",
          JSON.stringify(backResp, null, 2),
        );
        if (combinedResp)
          fs.writeFileSync?.(
            "/tmp/combined_ocr.json",
            JSON.stringify(combinedResp, null, 2),
          );
      } catch {
        /* ignore write errors */
      }
    }

    const combinedText = (() => {
      const frontRaw =
        typeof frontResp["raw_text"] === "string"
          ? String(frontResp["raw_text"])
          : normalizeOcrSpaceResult(frontResp);
      const backRaw =
        typeof backResp["raw_text"] === "string"
          ? String(backResp["raw_text"])
          : normalizeOcrSpaceResult(backResp);
      return `${frontRaw}\n${backRaw}`;
    })();

    const ocrJson: AnyObj = {
      parsed_text: combinedText,
      front: frontResp,
      back: backResp,
      combined: combinedResp ?? {},
    };

    const checkId =
      combinedResp &&
      typeof combinedResp["combined"] === "object" &&
      typeof (combinedResp["combined"] as AnyObj)["check_id"] === "string"
        ? String((combinedResp["combined"] as AnyObj)["check_id"])
        : extractCheckId(ocrJson);

    if (!checkId) {
      return new Response(
        JSON.stringify({ error: "Could not extract check ID from images." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const amountString = (() => {
      const tryStr = (r: AnyObj) =>
        typeof r["amount"] === "string" ? String(r["amount"]) : null;
      const tryCombined = (c: AnyObj | null) =>
        c &&
        typeof c["combined"] === "object" &&
        typeof (c["combined"] as AnyObj)["amount"] === "string"
          ? String((c["combined"] as AnyObj)["amount"])
          : null;
      return (
        tryStr(frontResp) ??
        tryStr(backResp) ??
        tryCombined(combinedResp) ??
        extractAmount(ocrJson)
      );
    })();

    const endorsementPresent = (() => {
      const tryBool = (r: AnyObj) =>
        r &&
        (r["endorsement_present"] === true ||
          r["endorsement_present"] === "true");
      return (
        tryBool(backResp) ??
        tryBool(frontResp) ??
        detectEndorsement(backResp) ??
        detectEndorsement(ocrJson)
      );
    })();

    let amountCents: number | null = null;
    if (amountString) {
      const parsed = Number(String(amountString).replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) amountCents = Math.round(parsed * 100);
      else {
        console.warn("Unable to parse amount from OCR:", amountString);
        amountCents = null;
      }
    }

    const prisma = getPrisma();
    let appUserId: number | null = null;
    if (auth.supabaseUser?.id) {
      const maybe = await prisma.user.findUnique({
        where: { auth_user_id: auth.supabaseUser.id },
      });
      if (
        maybe &&
        typeof (maybe as Record<string, unknown>)["id"] === "number"
      ) {
        appUserId = (maybe as unknown as { id: number }).id;
      }
    }

    const destAccount = appUserId
      ? await prisma.internalAccount.findFirst({
          where: { user_id: appUserId, is_active: true },
        })
      : null;

    if (destAccount && amountCents !== null) {
      const internalKey = process.env.INTERNAL_API_KEY;
      const userAuthHeader = request.headers.get("authorization") ?? "";
      const authHeader = internalKey ? `Bearer ${internalKey}` : userAuthHeader;

      try {
        const idempotencyKey = `check-id-${String(checkId).replace(/[^a-zA-Z0-9-_]/g, "-")}`;
        const depositResp = await fetch(
          `${process.env.APP_BASE_URL ?? ""}/api/transactions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
              "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify({
              requested_transaction_type: "deposit",
              transaction_direction: "inbound",
              destination_account_number: destAccount.account_number,
              requested_amount: amountCents,
              description: `Check deposit for check_id=${checkId}`,
              check_number: checkId,
            }),
          },
        );

        if (!depositResp.ok) {
          console.error(
            "Deposit forward failed:",
            depositResp.status,
            await depositResp.text(),
          );
        } else {
          const depositJsonUnknown = (await depositResp
            .json()
            .catch(() => ({}))) as unknown;
          if (depositJsonUnknown && typeof depositJsonUnknown === "object") {
            const depositJson = depositJsonUnknown as Record<string, unknown>;
            const id = depositJson["id"];
            if (typeof id === "number")
              console.info("Deposit created, transaction id:", id);
          }
        }
      } catch (err: unknown) {
        console.error("Failed to forward deposit:", err);
      }
    } else {
      console.warn(
        "No destination account or amount; skipping deposit forward.",
      );
    }

    const devDebug = ENABLE_OCR_DEBUG
      ? {
          ocr_front: frontResp,
          ocr_back: backResp,
          parsed_text: combinedText,
          combined: combinedResp,
        }
      : undefined;

    return new Response(
      JSON.stringify({
        message: "Check processed",
        check_id: checkId,
        amount: amountString ?? null,
        endorsement_present: endorsementPresent,
        ...(devDebug ? { debug: devDebug } : {}),
      }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    console.error("POST /api/check-verification error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
