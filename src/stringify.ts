import { DecodeOptions, EncodeObjectResult } from "./types.js";

/**
 * Stringify an object (or array) into text.
 *
 * 把对象（或数组）**序列化**为文本。
 *
 * ```ts
 * stringify({ a: 1, b: 'x' });                      // "a=1,b='x'"
 * stringify({ a: 1, b: { c: 2 } }, true);           // formatted, indent 2
 * stringify({ a: 1 }, { format: true, indent: 4 }); // indent 4
 * ```
 *
 * Limit: non-object input (null / undefined / number) returns "".
 *
 * 边界：非对象输入（null / undefined / number）返回空字符串。
 */
export function stringify<R extends string = string>(
  obj: unknown,
  options: DecodeOptions | boolean = {},
): R {
  const opts: DecodeOptions =
    typeof options === "boolean" ? { format: options } : options;
  const format = opts.format === true;
  const indentSize = typeof opts.indent === "number" ? opts.indent : 2;
  const pad = (n: number): string => " ".repeat(n);

  const escapeString = (str: string): string => {
    let out = "";
    for (const ch of String(str)) {
      switch (ch) {
        case "\\":
          out += "\\\\";
          break;
        case "'":
          out += "\\'";
          break;
        case "\n":
          out += "\\n";
          break;
        case "\t":
          out += "\\t";
          break;
        case "\r":
          out += "\\r";
          break;
        case "\b":
          out += "\\b";
          break;
        case "\f":
          out += "\\f";
          break;
        case "\0":
          out += "\\0";
          break;
        default:
          out += ch;
      }
    }
    return out;
  };

  const quote = (s: string): string => `'${escapeString(s)}'`;

  const encodeValue = (v: unknown, depth: number): string => {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "string") return quote(v);

    if (Array.isArray(v)) {
      const parts = v.map((it) => encodeValue(it, depth + 1));
      if (!format) return `[${parts.join(",")}]`;
      if (parts.length === 0) return "[]";
      const inner = pad(indentSize * (depth + 1));
      const outer = pad(indentSize * depth);
      return `[\n${parts.map((p) => inner + p).join(",\n")}\n${outer}]`;
    }

    const record = v as Record<string, unknown>;
    const keys = Object.keys(record);
    const parts = keys.map((k) => `${k}=${encodeValue(record[k], depth + 1)}`);
    if (!format) return `{${parts.join(",")}}`;
    if (parts.length === 0) return "{}";
    const inner = pad(indentSize * (depth + 1));
    const outer = pad(indentSize * depth);
    return `{\n${parts.map((p) => inner + p).join(",\n")}\n${outer}}`;
  };

  let entries: Array<[string, unknown]>;
  if (Array.isArray(obj)) {
    entries = [];
    for (const item of obj) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const rec = item as Record<string, unknown>;
        for (const k of Object.keys(rec)) entries.push([k, rec[k]]);
      }
    }
  } else if (obj && typeof obj === "object") {
    entries = Object.keys(obj).map(
      (k) => [k, (obj as Record<string, unknown>)[k]] as [string, unknown],
    );
  } else {
    return "" as R;
  }

  const out = entries.map(([k, v]) => `${k}=${encodeValue(v, 0)}`).join(format ? ",\n" : ",");
  return out as R;
}

/**
 * Template tag: interpolate JS values → text → parse.
 *
 * Interpolation rules:
 * - number / boolean → `String(v)`
 * - string → `String(v)`, **unquoted** (read as a reference)
 * - Array → `[a,b,c]` (brackets included; don't write `[]` in the template)
 * - object → `{k=v,k=v}` (braces included; don't write `{}`)
 * - null / undefined → `"null"` / `"undefined"`
 *
 * ```ts
 * const host = "localhost";
 * encodetags`host='${host}',port=8080`; // { host: "localhost", port: 8080 }
 * ```
 *
 * Limit: return type is always EncodeObjectResult (runtime concatenation,
 * no compile-time inference).
 *
 * 模板标签：JS 值插值 → 文本 → parse（解析）。
 *
 * 插值规则：
 * - number / boolean → `String(v)`
 * - string → `String(v)`，不加引号（会被当引用）
 * - Array → `[a,b,c]`（自带括号，模板里不要再写 `[]`）
 * - object → `{k=v,k=v}`（自带大括号，模板里不要再写 `{}`）
 * - null / undefined → `"null"` / `"undefined"`
 *
 * 边界：返回类型固定为 EncodeObjectResult（运行时拼接，不做编译期推导）。
 */
import { parse } from "./parser.js";

export function encodetags(
  strings: TemplateStringsArray,
  ...values: unknown[]
): EncodeObjectResult {
  {
    const raw = strings.raw;
    let text = "";

    for (let i = 0; i < raw.length; i++) {
      text += raw[i];
      if (i < values.length) {
        const v = values[i];
        if (v == null) {
          text += String(v);
        } else if (Array.isArray(v)) {
          const items = v.map((x) =>
            typeof x === "string" ? `'${x}'` : String(x),
          );
          text += `[${items.join(",")}]`;
        } else if (typeof v === "object") {
          text += `{${stringify(v)}}`;
        } else {
          text += String(v);
        }
      }
    }

    return parse(text) as EncodeObjectResult;
  }
}
