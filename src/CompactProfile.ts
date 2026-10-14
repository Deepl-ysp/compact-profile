/**
 * CompactProfile — a compact configuration description language.
 * Bidirectional text ↔ JS object conversion with literal inference
 * and external type injection.
 *
 * Limit: compile-time inference hits TS2589 on long strings. Past ~1500
 * chars, use `const text: string = \`...\`` + hand-written interface +
 * `encode<Config>(text)`.
 *
 * CompactProfile —— 紧凑配置描述语言。
 * 文本 ↔ JS 对象双向转换，支持字面量推导和外部类型注入。
 *
 * 边界：编译期推导对长字符串会爆 TS2589。超过 ~1500 字符请用
 * `const text: string = \`...\`` + 手写 interface + `encode<Config>(text)`。
 */

/** Trim both ends. / 去字符串两端空白。 */
type Trim<S extends string> = S extends ` ${infer R}`
  ? Trim<R>
  : S extends `\n${infer R}`
    ? Trim<R>
    : S extends `\t${infer R}`
      ? Trim<R>
      : S extends `\r${infer R}`
        ? Trim<R>
        : S extends `${infer L} `
          ? Trim<L>
          : S extends `${infer L}\n`
            ? Trim<L>
            : S extends `${infer L}\t`
              ? Trim<L>
              : S extends `${infer L}\r`
                ? Trim<L>
                : S;

/** Wide `string` → `never`; excludes wide strings in overload params. / 宽 string → never，用于重载参数排除宽 string。 */
type NarrowString<S extends string> = string extends S ? never : S;

/** Whether quotes/brackets are present; picks fast vs. slow split. / 是否含引号/括号，决定走快速还是慢速切分。 */
type HasStructural<S extends string> = string extends S
  ? false
  : S extends `${string}'${string}`
    ? true
    : S extends `${string}"${string}`
      ? true
      : S extends `${string}(${string}`
        ? true
        : S extends `${string})${string}`
          ? true
          : S extends `${string}{${string}`
            ? true
            : S extends `${string}}${string}`
              ? true
              : S extends `${string}[${string}`
                ? true
                : S extends `${string}]${string}`
                  ? true
                  : false;

/**
 * Fast path: no quotes or brackets — split on top-level commas.
 * Consumes 8 fields per level to cut recursion depth to N/8, avoiding TS2589.
 *
 * 快速通道：无引号无括号，按顶层逗号切分。
 * 每层吃 8 个字段，把递归深度降到 N/8，规避 TS2589。
 */
type SplitFast<
  S extends string,
  Acc extends string[] = [],
> = string extends S
  ? Acc
  : S extends `${infer A},${infer B},${infer C},${infer D},${infer E},${infer F},${infer G},${infer H},${infer Rest}`
    ? SplitFast<
        Rest,
        [
          ...Acc,
          Trim<A>,
          Trim<B>,
          Trim<C>,
          Trim<D>,
          Trim<E>,
          Trim<F>,
          Trim<G>,
          Trim<H>,
        ]
      >
    : S extends `${infer A},${infer B},${infer C},${infer D},${infer E},${infer F},${infer G}`
      ? [...Acc, Trim<A>, Trim<B>, Trim<C>, Trim<D>, Trim<E>, Trim<F>, Trim<G>]
      : S extends `${infer A},${infer B},${infer C},${infer D},${infer E},${infer F}`
        ? [...Acc, Trim<A>, Trim<B>, Trim<C>, Trim<D>, Trim<E>, Trim<F>]
        : S extends `${infer A},${infer B},${infer C},${infer D},${infer E}`
          ? [...Acc, Trim<A>, Trim<B>, Trim<C>, Trim<D>, Trim<E>]
          : S extends `${infer A},${infer B},${infer C},${infer D}`
            ? [...Acc, Trim<A>, Trim<B>, Trim<C>, Trim<D>]
            : S extends `${infer A},${infer B},${infer C}`
              ? [...Acc, Trim<A>, Trim<B>, Trim<C>]
              : S extends `${infer A},${infer B}`
                ? [...Acc, Trim<A>, Trim<B>]
                : Trim<S> extends ""
                  ? Acc
                  : [...Acc, Trim<S>];

/**
 * Slow path: character-by-character scan tracking quotes and brackets.
 * The wide-`string` guard on the first line stops `SplitSlow<string>`
 * from recursing forever.
 *
 * 慢速通道：逐字符扫描，跟踪引号与括号。
 * 第一行的宽 string 守卫防止 `SplitSlow<string>` 无限递归。
 */
type SplitSlow<
  S extends string,
  Depth extends readonly unknown[] = [],
  Cur extends string = "",
  Out extends string[] = [],
  InQuote extends "'" | '"' | null = null,
> = string extends S
  ? Out
  : S extends `${infer C}${infer R}`
    ? InQuote extends null
      ? C extends "'" | '"'
        ? SplitSlow<R, Depth, `${Cur}${C}`, Out, C>
        : C extends "(" | "{" | "["
          ? SplitSlow<R, [...Depth, 0], `${Cur}${C}`, Out, null>
          : C extends ")" | "}" | "]"
            ? Depth extends readonly [unknown, ...infer D]
              ? SplitSlow<R, D, `${Cur}${C}`, Out, null>
              : SplitSlow<R, [], `${Cur}${C}`, Out, null>
            : C extends ","
              ? Depth extends readonly []
                ? SplitSlow<R, [], "", [...Out, Trim<Cur>], null>
                : SplitSlow<R, Depth, `${Cur}${C}`, Out, null>
              : SplitSlow<R, Depth, `${Cur}${C}`, Out, null>
      : C extends InQuote
        ? SplitSlow<R, Depth, `${Cur}${C}`, Out, null>
        : SplitSlow<R, Depth, `${Cur}${C}`, Out, InQuote>
    : Trim<Cur> extends ""
      ? Out
      : [...Out, Trim<Cur>];

/** Top-level split dispatch: wide string → []; structural → slow; else fast. / 顶层切分分派：宽 string → []；含结构 → 慢速；否则快速。 */
type SplitTop<S extends string> = string extends S
  ? []
  : HasStructural<S> extends true
    ? SplitSlow<S>
    : SplitFast<S>;

/** Parse value: literals are exact; expressions/references → unknown. / 解析值类型：字面量精确；表达式/引用 → unknown。 */
type ParseValue<V extends string> = Trim<V> extends infer T extends string
  ? T extends `'${infer S}'`
    ? S
    : T extends `"${infer S}"`
      ? S
      : T extends "true"
        ? true
        : T extends "false"
          ? false
          : T extends "null"
            ? null
            : T extends "undefined"
              ? undefined
              : T extends `${infer N extends number}`
                ? N
                : T extends `{${infer B}}`
                  ? ParseFields<SplitTop<B>>
                  : T extends `[${infer B}]`
                    ? ParseArrayBody<B>
                    : unknown
  : never;

/** Parse array body, preserving tuple shape. / 解析数组体，保留 tuple。 */
type ParseArrayBody<B extends string> =
  SplitTop<B> extends infer Fs extends string[]
    ? Fs extends []
      ? []
      : { [I in keyof Fs]: Fs[I] extends string ? ParseValue<Fs[I]> : never }
    : [];

/** Parse `key=value`. / 解析 `key=value`。 */
type ParseField<F extends string> = F extends `${infer K}=${infer V}`
  ? Trim<K> extends infer TK extends string
    ? { [P in TK]: ParseValue<V> }
    : {}
  : {};

/** Field list → intersection type. / 字段列表 → 交叉类型。 */
type ParseFields<Fs extends string[]> = Fs extends [
  infer F extends string,
  ...infer R extends string[],
]
  ? ParseField<F> & ParseFields<R>
  : {};

/** Object type → union of `{k:v}`. / 对象类型 → `[{k:v}, ...]` 联合。 */
type ToArrayEntry<T> = {
  [K in keyof T]: { [P in K]: T[K] };
}[keyof T];

/** `encode` output mode. / encode 输出模式。 */
export type EncodeOutputType = "Object" | "Array";

/** Object-mode return type (wide). / Object 模式返回类型（宽）。 */
export type EncodeObjectResult = Record<string, unknown>;

/** Array-mode return type (wide). / Array 模式返回类型（宽）。 */
export type EncodeArrayResult = Array<Record<string, unknown>>;

/** Common return type. / 通用返回类型。 */
export type EncodeResult = EncodeObjectResult | EncodeArrayResult;

/** `decode` options. / decode 选项。 */
export interface DecodeOptions {
  format?: boolean;
  indent?: number;
}

/** Literal-mode return type. / 字面量模式返回类型。 */
type DeriveResult<
  S extends string,
  T extends EncodeOutputType,
> = string extends S
  ? EncodeResult
  : T extends "Array"
    ? Array<ToArrayEntry<ParseFields<SplitTop<S>>>>
    : ParseFields<SplitTop<S>>;

/** Node type constants. / 节点类型常量表。 */
export const types = Object.freeze({
  String: "String",
  Integer: "Integer",
  Float: "Float",
  Boolean: "Boolean",
  Null: "Null",
  Undefined: "Undefined",
  Binary: "Binary",
  Array: "Array",
  Object: "Object",
  Pointer: "Pointer",
  MemberAccess: "MemberAccess",
  FormulaAdd: "Formula Add",
  FormulaSubtract: "Formula Subtract",
  FormulaMultiply: "Formula Multiply",
  FormulaDivide: "Formula Divide",
  FormulaModulo: "Formula Modulo",
  UnaryMinus: "Unary Minus",
  Bitwise: "Expression BitwiseOperation",
  Spaceship: "Expression SpaceshipOperation",
  Comparison: "Expression Comparison",
  Ternary: "Expression TernaryOperation",
  Conditional: "Expression ConditionalOperation",
  Logical: "Expression Logical",
} as const);

/** Type alias of `types`. / types 类型别名。 */
export type CompactProfileTypes = typeof types;

interface AstBase {
  value: string;
}

interface AstString extends AstBase {
  type: typeof types.String;
  raw?: string;
}
interface AstInteger extends AstBase {
  type: typeof types.Integer;
  number: number;
}
interface AstFloat extends AstBase {
  type: typeof types.Float;
  number: number;
}
interface AstBoolean extends AstBase {
  type: typeof types.Boolean;
  boolean: boolean;
}
interface AstNull extends AstBase {
  type: typeof types.Null;
  literal: null;
}
interface AstUndefined extends AstBase {
  type: typeof types.Undefined;
  literal: undefined;
}
interface AstPointer extends AstBase {
  type: typeof types.Pointer;
}
interface AstMemberAccess extends AstBase {
  type: typeof types.MemberAccess;
  parts: string[];
}

interface AstProp {
  key: string;
  value: AstNode;
}
interface AstObject extends AstBase {
  type: typeof types.Object;
  properties: AstProp[];
}
interface AstArray extends AstBase {
  type: typeof types.Array;
  items: AstNode[];
}

type BinaryType =
  | typeof types.Logical
  | typeof types.Bitwise
  | typeof types.Comparison
  | typeof types.Spaceship
  | typeof types.FormulaAdd
  | typeof types.FormulaSubtract
  | typeof types.FormulaMultiply
  | typeof types.FormulaDivide
  | typeof types.FormulaModulo
  | typeof types.Binary;

interface AstBinary extends AstBase {
  type: BinaryType;
  operator: string;
  left: AstNode;
  right: AstNode;
}

interface AstUnaryMinus extends AstBase {
  type: typeof types.UnaryMinus;
  operand: AstNode;
}

interface AstTernary extends AstBase {
  type: typeof types.Ternary;
  condition: AstNode;
  consequent: AstNode;
  alternate: AstNode;
}

interface AstBranch {
  kind: "if" | "elif" | "else";
  condition: AstNode | null;
  value: AstNode;
}
interface AstConditional extends AstBase {
  type: typeof types.Conditional;
  branches: AstBranch[];
}

type AstNode =
  | AstString
  | AstInteger
  | AstFloat
  | AstBoolean
  | AstNull
  | AstUndefined
  | AstPointer
  | AstMemberAccess
  | AstObject
  | AstArray
  | AstBinary
  | AstUnaryMinus
  | AstTernary
  | AstConditional;

/** Root AST: `[{key: node}, ...]`; unnamed entries use key `_`. / 根 AST：`[{key: node}, ...]`，未命名项 key 为 `_`。 */
type AstRoot = Array<Record<string, AstNode>>;

/** Split on `sep` at top level, skipping separators inside quotes/brackets. / 按 sep 顶层切分，跳过引号/括号内的 sep。 */
function splitTopLevel(text: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") depth--;
    else if (ch === sep && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Find top-level `=` (excluding ==, !=, <=, >=, ===). / 找顶层 `=`（排除 ==、!=、<=、>=、===）。 */
function findTopLevelAssign(text: string): number {
  let depth = 0;
  let quote: string | null = null;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") depth--;
    else if (ch === "=" && depth === 0) {
      const prev = text[i - 1];
      const next = text[i + 1];
      if (
        prev === "=" ||
        prev === "!" ||
        prev === "<" ||
        prev === ">" ||
        next === "="
      ) {
        continue;
      }
      return i;
    }
  }
  return -1;
}

/** Find a top-level character such as `?` or `:`. / 找顶层字符（如 `?`、`:`）。 */
function findTopLevelChar(text: string, needle: string): number {
  let depth = 0;
  let quote: string | null = null;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") depth--;
    else if (ch === needle && depth === 0) return i;
  }
  return -1;
}

/** Whether the +/- at index i is unary. / 判断位置 i 的 +/- 是否是一元运算。 */
function isUnaryAt(s: string, i: number): boolean {
  for (let j = i - 1; j >= 0; j--) {
    const c = s[j];
    if (/\s/.test(c)) continue;
    return "+-*/%<>=!&|^~(".includes(c) || c === "," || c === "?";
  }
  return true;
}

/** Index of the `)` matching the `(` at `start`. / 从 `(` 开始找配对 `)` 的下标。 */
function matchingClose(s: string, start: number): number {
  if (s[start] !== "(") return -1;
  let depth = 0;
  let quote: string | null = null;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === quote && s[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Strict quote pairing required; `'x'==='x'` is not misread as a string. / 首尾引号严格配对才算字符串。`'x'==='x'` 不会被误判。 */
function isQuotedString(s: string): boolean {
  const q = s[0];
  if (q !== "'" && q !== '"') return false;
  let i = 1;
  while (i < s.length) {
    if (s[i] === "\\") {
      i += 2;
      continue;
    }
    if (s[i] === q) return i === s.length - 1;
    i++;
  }
  return false;
}

/** Unescape \n \t \r \b \f \0 \\ \' \" \uXXXX \xXX. / 解转义：\n \t \r \b \f \0 \\ \' \" \uXXXX \xXX。 */
function unescape(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      switch (next) {
        case "n":
          out += "\n";
          i++;
          break;
        case "t":
          out += "\t";
          i++;
          break;
        case "r":
          out += "\r";
          i++;
          break;
        case "b":
          out += "\b";
          i++;
          break;
        case "f":
          out += "\f";
          i++;
          break;
        case "0":
          out += "\0";
          i++;
          break;
        case "\\":
          out += "\\";
          i++;
          break;
        case "'":
          out += "'";
          i++;
          break;
        case '"':
          out += '"';
          i++;
          break;
        case "u": {
          const hex = raw.slice(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            out += String.fromCharCode(parseInt(hex, 16));
            i += 5;
          } else {
            out += "\\";
          }
          break;
        }
        case "x": {
          const hex = raw.slice(i + 2, i + 4);
          if (/^[0-9a-fA-F]{2}$/.test(hex)) {
            out += String.fromCharCode(parseInt(hex, 16));
            i += 3;
          } else {
            out += "\\";
          }
          break;
        }
        default:
          out += "\\" + next;
          i++;
      }
    } else {
      out += ch;
    }
  }
  return out;
}

function buildAST(text: unknown): AstRoot {
  const s = String(text ?? "").trim();
  if (!s) return [];

  const fields = splitTopLevel(s, ",");
  const out: AstRoot = [];

  for (const field of fields) {
    const eq = findTopLevelAssign(field);
    if (eq === -1) {
      out.push({ _: astValue(field.trim()) });
      continue;
    }
    const key = field.slice(0, eq).trim();
    const val = field.slice(eq + 1).trim();
    out.push({ [key]: astValue(val) });
  }
  return out;
}

/**
 * Parse a value.
 * Priority: string → parens → keywords → number → object → array
 *           → conditional → ternary → binary → unary minus → member/pointer.
 *
 * 解析值。
 * 优先级：字符串 → 括号 → 关键字 → 数字 → 对象 → 数组
 *        → 条件式 → 三元 → 二元 → 一元负 → 成员/引用。
 */
function astValue(text: unknown): AstNode {
  const s = String(text ?? "").trim();
  if (!s) {
    return { type: types.String, value: "" };
  }

  if (isQuotedString(s)) {
    const raw = s.slice(1, -1);
    return { type: types.String, value: unescape(raw), raw: s };
  }

  if (s[0] === "(" && matchingClose(s, 0) === s.length - 1) {
    return astValue(s.slice(1, -1));
  }

  if (s === "true" || s === "false") {
    return { type: types.Boolean, value: s, boolean: s === "true" };
  }
  if (s === "null") {
    return { type: types.Null, value: s, literal: null };
  }
  if (s === "undefined") {
    return { type: types.Undefined, value: s, literal: undefined };
  }

  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isInteger(n)
      ? { type: types.Integer, value: s, number: n }
      : { type: types.Float, value: s, number: n };
  }

  if (s[0] === "{" && s.endsWith("}")) {
    return astObject(s);
  }

  if (s[0] === "[" && s.endsWith("]")) {
    return astArray(s);
  }

  if (/^if\b/.test(s)) {
    return astConditional(s);
  }

  const tern = findTernary(s);
  if (tern) {
    const cond = s.slice(0, tern.q).trim();
    const tru = s.slice(tern.q + 1, tern.c).trim();
    const fal = s.slice(tern.c + 1).trim();
    return {
      type: types.Ternary,
      value: s,
      condition: astValue(cond),
      consequent: astValue(tru),
      alternate: astValue(fal),
    };
  }

  const bin = findLowestPrecBinary(s);
  if (bin) {
    const left = s.slice(0, bin.index).trim();
    const right = s.slice(bin.index + bin.op.length).trim();
    return {
      type: binaryTypeFor(bin.op),
      value: s,
      operator: bin.op,
      left: astValue(left),
      right: astValue(right),
    };
  }

  if (s.startsWith("-")) {
    return {
      type: types.UnaryMinus,
      value: s,
      operand: astValue(s.slice(1).trim()),
    };
  }

  if (/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(s)) {
    return { type: types.MemberAccess, value: s, parts: s.split(".") };
  }

  if (/^[A-Za-z_$][\w$]*$/.test(s)) {
    return { type: types.Pointer, value: s };
  }

  return { type: types.Pointer, value: s };
}

/** Parse `{k=v, ...}`. Entries without `=` use an inferred auto key, or `_i` when none. / 解析 `{k=v, ...}`。无 `=` 的用 autoKey 推断，推不出用 `_i`。 */
function astObject(text: string): AstObject {
  const body = text.slice(1, -1);
  const fields = splitTopLevel(body, ",");
  const properties: AstProp[] = [];

  for (let i = 0; i < fields.length; i++) {
    const raw = fields[i].trim();
    if (!raw) continue;
    const eq = findTopLevelAssign(raw);
    if (eq === -1) {
      const key = autoKey(raw) ?? `_${i}`;
      properties.push({ key, value: astValue(raw) });
    } else {
      const key = raw.slice(0, eq).trim();
      const val = raw.slice(eq + 1).trim();
      properties.push({ key, value: astValue(val) });
    }
  }

  return { type: types.Object, value: text, properties };
}

/** Parse `[a, b, ...]`. / 解析 `[a, b, ...]`。 */
function astArray(text: string): AstArray {
  const inner =
    text[0] === "[" && text.endsWith("]") ? text.slice(1, -1) : text;
  const items = splitTopLevel(inner, ",").map((it) => astValue(it.trim()));
  return { type: types.Array, value: text, items };
}

/** Infer an auto key from expression text: last identifier segment, or null. / 从表达式文本推自动键：取最后一个标识符段，推不出返回 null。 */
function autoKey(exprText: string): string | null {
  const s = String(exprText).trim();

  if (/^(null|undefined|true|false)$/.test(s)) return null;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return null;
  if ((s[0] === "'" && s.endsWith("'")) || (s[0] === '"' && s.endsWith('"'))) {
    return null;
  }

  const m = s.match(/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/);
  if (!m) return null;
  const parts = m[0].split(".");
  return parts[parts.length - 1];
}

/**
 * Parse `if(...)... elif(...)... else ...`.
 * `else if(...)` is treated as `elif(...)`, split at the `else` position.
 *
 * 解析 `if(...)... elif(...)... else ...`。
 * `else if(...)` 当作 `elif(...)` 处理，切分点用 `else` 的位置。
 */
function astConditional(text: string): AstConditional {
  const s = text.trim();

  interface Item {
    kind: "if" | "elif" | "else";
    start: number;
    cond: string | null;
    contentStart: number;
  }
  const items: Item[] = [];

  const re = /\b(if|elif|else)\b/g;
  let m: RegExpExecArray | null;

  const skipWs = (from: number): number => {
    let i = from;
    while (i < s.length && /\s/.test(s[i])) i++;
    return i;
  };

  const readParenCond = (
    from: number,
  ): { cond: string | null; after: number } => {
    if (s[from] !== "(") return { cond: null, after: from };
    let depth = 0;
    let end = from;
    for (; end < s.length; end++) {
      if (s[end] === "(") depth++;
      else if (s[end] === ")") {
        depth--;
        if (depth === 0) {
          end++;
          break;
        }
      }
    }
    return { cond: s.slice(from + 1, end - 1).trim(), after: end };
  };

  while ((m = re.exec(s))) {
    const pos = m.index;
    if (pos > 0 && /\w/.test(s[pos - 1])) continue;

    let cursor = skipWs(pos + m[1].length);

    // "else if(...)" → treat as elif, using the `else` position as start.
    // "else if(...)" → 当 elif 处理，start 用 else 的位置
    if (
      m[1] === "else" &&
      s.startsWith("if", cursor) &&
      (cursor + 2 >= s.length || !/[\w$]/.test(s[cursor + 2]))
    ) {
      cursor = skipWs(cursor + 2);
      const { cond, after } = readParenCond(cursor);
      const contentStart = skipWs(after);
      items.push({ kind: "elif", start: pos, cond, contentStart });
      re.lastIndex = cursor;
      continue;
    }

    if (m[1] === "else") {
      items.push({
        kind: "else",
        start: pos,
        cond: null,
        contentStart: skipWs(cursor),
      });
      continue;
    }

    const { cond, after } = readParenCond(cursor);
    items.push({
      kind: m[1] as "if" | "elif",
      start: pos,
      cond,
      contentStart: skipWs(after),
    });
  }

  const branches: AstBranch[] = items.map((h, i) => {
    const end = i + 1 < items.length ? items[i + 1].start : s.length;
    const body = s.slice(h.contentStart, end).trim();
    return {
      kind: h.kind,
      condition: h.cond ? astValue(h.cond) : null,
      value: astValue(body),
    };
  });

  return { type: types.Conditional, value: s, branches };
}

/** Locate top-level `? ... :`. / 找顶层 `? ... :` 的位置。 */
function findTernary(text: string): { q: number; c: number } | null {
  const q = findTopLevelChar(text, "?");
  if (q === -1) return null;
  const rest = text.slice(q + 1);
  const cRel = findTopLevelChar(rest, ":");
  if (cRel === -1) return null;
  return { q, c: q + 1 + cRel };
}

interface BinaryOp {
  op: string;
  prec: number;
}
interface BinaryCandidate {
  op: string;
  prec: number;
  index: number;
}

/** Higher prec = higher priority. / prec 越大优先级越高。 */
const OPS: readonly BinaryOp[] = [
  { op: "||", prec: 1 },
  { op: "&&", prec: 2 },
  { op: "|", prec: 3 },
  { op: "^", prec: 4 },
  { op: "&", prec: 5 },
  { op: "===", prec: 6 },
  { op: "!==", prec: 6 },
  { op: "==", prec: 6 },
  { op: "!=", prec: 6 },
  { op: ">=", prec: 6 },
  { op: "<=", prec: 6 },
  { op: "<=>", prec: 6 },
  { op: ">", prec: 6 },
  { op: "<", prec: 6 },
  { op: ">>>", prec: 7 },
  { op: "<<", prec: 7 },
  { op: ">>", prec: 7 },
  { op: "+", prec: 8 },
  { op: "-", prec: 8 },
  { op: "*", prec: 9 },
  { op: "/", prec: 9 },
  { op: "%", prec: 9 },
];

const OPS_SORTED: readonly BinaryOp[] = [...OPS].sort(
  (a, b) => b.op.length - a.op.length,
);

/** Find the lowest-precedence top-level binary op as root. Ties pick the rightmost (left-assoc). / 找顶层优先级最低的二元运算符作根。同 prec 取最右（左结合）。 */
function findLowestPrecBinary(s: string): BinaryCandidate | null {
  const candidates: BinaryCandidate[] = [];
  let depth = 0;
  let quote: string | null = null;
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    if (quote) {
      if (ch === quote && s[i - 1] !== "\\") quote = null;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      i++;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") {
      depth++;
      i++;
      continue;
    }
    if (ch === ")" || ch === "}" || ch === "]") {
      depth--;
      i++;
      continue;
    }
    if (depth !== 0) {
      i++;
      continue;
    }

    if ((ch === "+" || ch === "-") && isUnaryAt(s, i)) {
      i++;
      continue;
    }

    let matched: BinaryOp | null = null;
    for (const o of OPS_SORTED) {
      if (s.startsWith(o.op, i)) {
        matched = o;
        break;
      }
    }

    if (matched) {
      candidates.push({ op: matched.op, prec: matched.prec, index: i });
      i += matched.op.length;
    } else {
      i++;
    }
  }

  if (candidates.length === 0) return null;

  let best = candidates[0];
  for (const c of candidates) {
    if (c.prec < best.prec || (c.prec === best.prec && c.index > best.index)) {
      best = c;
    }
  }
  return best;
}

/** Operator → node type. / 运算符 → 节点类型。 */
function binaryTypeFor(op: string): BinaryType {
  switch (op) {
    case "||":
    case "&&":
      return types.Logical;
    case "|":
    case "^":
    case "&":
    case "<<":
    case ">>":
    case ">>>":
      return types.Bitwise;
    case "===":
    case "!==":
    case "==":
    case "!=":
    case ">=":
    case "<=":
    case ">":
    case "<":
      return types.Comparison;
    case "<=>":
      return types.Spaceship;
    case "+":
      return types.FormulaAdd;
    case "-":
      return types.FormulaSubtract;
    case "*":
      return types.FormulaMultiply;
    case "/":
      return types.FormulaDivide;
    case "%":
      return types.FormulaModulo;
    default:
      return types.Binary;
  }
}

type Scope = Map<string, unknown>;

/** Resolve a name through the scope chain. / 按作用域链查名字。 */
function lookup(name: string, scopes: Scope[]): unknown {
  for (const s of scopes) if (s.has(name)) return s.get(name);
  return undefined;
}

/** Walk a property chain. / 沿属性链读取。 */
function navigate(value: unknown, parts: string[]): unknown {
  let cur: any = value;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * Sequential evaluation.
 * Limit: no forward references — `a=b,b=2` yields `a: undefined`.
 *
 * 顺序求值。
 * 边界：不支持下向引用——`a=b,b=2` 会得到 `a: undefined`。
 */
function evaluateAST(ast: AstRoot): Record<string, unknown> {
  const evalNode = (node: AstNode, scopes: Scope[]): unknown => {
    switch (node.type) {
      case types.String:
        return node.value;

      case types.Integer:
      case types.Float:
        return node.number;

      case types.Boolean:
        return node.boolean;

      case types.Null:
        return null;

      case types.Undefined:
        return undefined;

      case types.Pointer:
        return lookup(node.value, scopes);

      case types.MemberAccess: {
        const head = lookup(node.parts[0], scopes);
        if (head === undefined) return undefined;
        return navigate(head, node.parts.slice(1));
      }

      // Object eval: fields enter a local scope in order, so later fields
      // can reference earlier ones.
      // 对象求值：内层字段先进 local 作用域，后进字段可以引用先进字段
      case types.Object: {
        const local: Scope = new Map();
        const innerScopes: Scope[] = [local, ...scopes];
        const out: Record<string, unknown> = {};
        for (const p of node.properties) {
          if (p.key == null) continue;
          const v = evalNode(p.value, innerScopes);
          out[p.key] = v;
          local.set(p.key, v);
        }
        return out;
      }

      case types.Array:
        return node.items.map((it) => evalNode(it, scopes));

      case types.Ternary: {
        const cond = evalNode(node.condition, scopes);
        return cond
          ? evalNode(node.consequent, scopes)
          : evalNode(node.alternate, scopes);
      }

      case types.Conditional: {
        for (const b of node.branches) {
          if (b.kind === "else") return evalNode(b.value, scopes);
          if (b.condition && evalNode(b.condition, scopes)) {
            return evalNode(b.value, scopes);
          }
        }
        return undefined;
      }

      // Logical short-circuit: returns the left or right value, no boolean coercion.
      // 逻辑短路：返回左值或右值，不强制转 boolean
      case types.Logical: {
        const l = evalNode(node.left, scopes);
        if (node.operator === "&&") {
          return l ? evalNode(node.right, scopes) : l;
        }
        if (node.operator === "||") {
          return l ? l : evalNode(node.right, scopes);
        }
        return undefined;
      }

      case types.FormulaAdd:
        return (
          (evalNode(node.left, scopes) as any) +
          (evalNode(node.right, scopes) as any)
        );

      case types.FormulaSubtract:
        return (
          (evalNode(node.left, scopes) as number) -
          (evalNode(node.right, scopes) as number)
        );

      case types.FormulaMultiply:
        return (
          (evalNode(node.left, scopes) as number) *
          (evalNode(node.right, scopes) as number)
        );

      case types.FormulaDivide:
        return (
          (evalNode(node.left, scopes) as number) /
          (evalNode(node.right, scopes) as number)
        );

      case types.FormulaModulo:
        return (
          (evalNode(node.left, scopes) as number) %
          (evalNode(node.right, scopes) as number)
        );

      case types.UnaryMinus: {
        const v = evalNode(node.operand, scopes);
        return typeof v === "number" ? -v : -Number(v);
      }

      case types.Bitwise: {
        const l = evalNode(node.left, scopes) as number;
        const r = evalNode(node.right, scopes) as number;
        switch (node.operator) {
          case "|":
            return l | r;
          case "^":
            return l ^ r;
          case "&":
            return l & r;
          case "<<":
            return l << r;
          case ">>":
            return l >> r;
          case ">>>":
            return l >>> r;
        }
        return undefined;
      }

      case types.Comparison: {
        const l = evalNode(node.left, scopes);
        const r = evalNode(node.right, scopes);
        switch (node.operator) {
          case "===":
            return l === r;
          case "!==":
            return l !== r;
          case "==":
            return l == r;
          case "!=":
            return l != r;
          case ">=":
            return (l as number) >= (r as number);
          case "<=":
            return (l as number) <= (r as number);
          case ">":
            return (l as number) > (r as number);
          case "<":
            return (l as number) < (r as number);
        }
        return undefined;
      }

      case types.Spaceship: {
        const l = evalNode(node.left, scopes) as number;
        const r = evalNode(node.right, scopes) as number;
        return l < r ? -1 : l > r ? 1 : 0;
      }

      default:
        return undefined;
    }
  };

  const rootScope: Scope = new Map();
  const out: Record<string, unknown> = {};

  for (const item of ast) {
    for (const [k, v] of Object.entries(item)) {
      if (k === "_") continue;
      const value = evalNode(v, [rootScope]);
      out[k] = value;
      rootScope.set(k, value);
    }
  }
  return out;
}

/**
 * Text → object.
 *
 * ```ts
 * // 1. Literal → exact inference (small configs, full IDE completion)
 * const r1 = encode(`host='x',port=8080`); // { host: "x"; port: 8080 }
 *
 * // 2. Wide string → EncodeResult (large configs, no deep inference)
 * const text: string = `...`;
 * const r2 = encode(text);
 *
 * // 3. Explicit external type (large configs + hand-written interface)
 * interface Config { host: string; port: number }
 * const r3 = encode<Config>(text);
 * ```
 *
 * Limit: literals past ~1500 chars may hit TS2589 — use form 2 or 3.
 *
 * 文本 → 对象，三种用法：
 * 1. 字面量 → 精确推导（小配置，IDE 全字段补全）
 * 2. 宽 string → 退化为 EncodeResult（大配置，不爆栈）
 * 3. 显式外部类型：`encode<Config>(text)`（大配置 + 手写 interface）
 *
 * 边界：字面量超过 ~1500 字符可能爆 TS2589，此时用方式 2/3。
 */
export function encode<
  S extends string,
  T extends EncodeOutputType = "Object",
>(text: NarrowString<S>, type?: T): DeriveResult<S, T>;

export function encode<R extends object = never>(
  text: string,
  type?: EncodeOutputType,
): [R] extends [never] ? EncodeResult : R;

export function encode(
  text: string,
  type: EncodeOutputType = "Object",
): EncodeResult {
  const ast = buildAST(text);
  const result = evaluateAST(ast);
  if (type === types.Array) {
    return Object.entries(result).map(([k, v]) => ({ [k]: v }));
  }
  return result;
}

/**
 * Functional form of `encode<T>(text)`.
 *
 * ```ts
 * const r = encodeAs<Config>(`host='x',port=80`); // r: Config
 * ```
 *
 * 显式外部类型的函数式写法，与 `encode<T>(text)` 等价。
 */
export function encodeAs<R extends object>(
  text: string,
  type: EncodeOutputType = "Object",
): R {
  return encode(text, type) as unknown as R;
}

/**
 * Object → text.
 *
 * ```ts
 * decode({ a: 1, b: 'x' });                      // "a=1,b='x'"
 * decode({ a: 1, b: { c: 2 } }, true);           // formatted, indent 2
 * decode({ a: 1 }, { format: true, indent: 4 }); // indent 4
 * ```
 *
 * Limit: non-object input (null / undefined / number) returns "".
 *
 * 对象 → 文本。
 *
 * 边界：非对象输入（null / undefined / number）返回空字符串。
 */
export function decode(
  obj: EncodeObjectResult | EncodeArrayResult,
  options: DecodeOptions | boolean = {},
): string {
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

  const decodeValue = (v: unknown, depth: number): string => {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "string") return quote(v);

    if (Array.isArray(v)) {
      const parts = v.map((it) => decodeValue(it, depth + 1));
      if (!format) return `[${parts.join(",")}]`;
      if (parts.length === 0) return "[]";
      const inner = pad(indentSize * (depth + 1));
      const outer = pad(indentSize * depth);
      return `[\n${parts.map((p) => inner + p).join(",\n")}\n${outer}]`;
    }

    const record = v as Record<string, unknown>;
    const keys = Object.keys(record);
    const parts = keys.map((k) => `${k}=${decodeValue(record[k], depth + 1)}`);
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
    return "";
  }

  if (!format) {
    return entries.map(([k, v]) => `${k}=${decodeValue(v, 0)}`).join(",");
  }
  return entries.map(([k, v]) => `${k}=${decodeValue(v, 0)}`).join(",\n");
}

/**
 * Template tag: interpolate JS values → text → encode.
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
 * 模板标签：JS 值插值 → 文本 → encode。
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
export function encodetags(
  strings: TemplateStringsArray,
  ...values: unknown[]
): EncodeObjectResult {
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
        text += `{${decode(v as EncodeObjectResult)}}`;
      } else {
        text += String(v);
      }
    }
  }

  return encode(text) as EncodeObjectResult;
}

/**
 * Default export object.
 *
 * `instanceof CompactProfile` only checks `type === "CompactProfile"`;
 * it does not require an actual instance of this class.
 *
 * 默认导出对象。
 * `instanceof CompactProfile` 只检查 `type === "CompactProfile"`，
 * 不要求真的用这个类实例化。
 */
class CompactProfileClass {
  static [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance != null &&
      typeof instance === "object" &&
      (instance as { type?: unknown }).type === "CompactProfile"
    );
  }

  static readonly types = types;
  static readonly encode = encode;
  static readonly encodeAs = encodeAs;
  static readonly decode = decode;
  static readonly encodetags = encodetags;

  readonly type = "CompactProfile";
  readonly [Symbol.toStringTag] = "CompactProfile";
}

const CompactProfile = CompactProfileClass;

export default CompactProfile;
export { CompactProfile, CompactProfile as __CompactProfileClass };