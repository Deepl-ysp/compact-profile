/**
 * Runtime parser: text → AST → evaluated object.
 *
 * 运行时解析器：文本 → AST → 求值对象。
 */

import { types } from "./constants.js";
import {
  EncodeOutputType,
  EncodeArrayResult,
  EncodeResult,
} from "./types.js";
import { AstNode, AstRoot, AstObject, AstArray, AstConditional, AstProp, AstBranch, BinaryType } from "./ast.js";

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

export function buildAST(text: unknown, diag?: ParseDiagnostics): AstRoot {
  const s = String(text ?? "").trim();
  if (!s) return [];

  const fields = splitTopLevel(s, ",");
  const out: AstRoot = [];
  /** First duplicate key at root scope; "" = none. / 根作用域首个重复键；空串表示无。 */
  let firstDuplicate = "";

  for (const field of fields) {
    const eq = findTopLevelAssign(field);
    if (eq === -1) {
      out.push({ _: astValue(field.trim(), diag) });
      continue;
    }
    const key = field.slice(0, eq).trim();
    const val = field.slice(eq + 1).trim();
    if (key && out.some((entry) => Object.prototype.hasOwnProperty.call(entry, key))) {
      if (!firstDuplicate) firstDuplicate = key;
    }
    out.push({ [key]: astValue(val, diag) });
  }

  if (firstDuplicate) diag?.duplicateKeys.push(firstDuplicate);
  return out;
}

/** Duplicate-key diagnostics collected while parsing one scope. / 解析单个作用域时收集的重复键诊断。 */
export interface ParseDiagnostics {
  /** First duplicated key per scope (empty string = none). / 每个作用域首个重复键（空串表示无）。 */
  duplicateKeys: string[];
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
export function astValue(text: unknown, diag?: ParseDiagnostics): AstNode {
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
    return astObject(s, diag);
  }

  if (s[0] === "[" && s.endsWith("]")) {
    return astArray(s, diag);
  }

  if (/^if\b/.test(s)) {
    return astConditional(s, diag);
  }

  const tern = findTernary(s);
  if (tern) {
    const cond = s.slice(0, tern.q).trim();
    const tru = s.slice(tern.q + 1, tern.c).trim();
    const fal = s.slice(tern.c + 1).trim();
    return {
      type: types.Ternary,
      value: s,
      condition: astValue(cond, diag),
      consequent: astValue(tru, diag),
      alternate: astValue(fal, diag),
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
      left: astValue(left, diag),
      right: astValue(right, diag),
    };
  }

  if (s.startsWith("-")) {
    return {
      type: types.UnaryMinus,
      value: s,
      operand: astValue(s.slice(1).trim(), diag),
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

/**
 * Parse `{k=v, ...}`. Entries without `=` use an inferred auto key, or `_i` when none.
 * Duplicate keys inside one scope are recorded in `diag` (last value still wins).
 *
 * 解析 `{k=v, ...}`。无 `=` 的用 autoKey 推断，推不出用 `_i`。
 * 同一作用域内的重复键会记入 diag（运行时仍是后者覆盖前者）。
 */
function astObject(text: string, diag?: ParseDiagnostics): AstObject {
  const body = text.slice(1, -1);
  const fields = splitTopLevel(body, ",");
  const properties: AstProp[] = [];
  /** First duplicate key found in this scope; "" = none. / 本作用域首个重复键；空串表示无。 */
  let firstDuplicate = "";

  for (let i = 0; i < fields.length; i++) {
    const raw = fields[i].trim();
    if (!raw) continue;
    const eq = findTopLevelAssign(raw);
    let key: string;
    let valText: string;
    if (eq === -1) {
      key = autoKey(raw) ?? `_${i}`;
      valText = raw;
    } else {
      key = raw.slice(0, eq).trim();
      valText = raw.slice(eq + 1).trim();
    }
    if (properties.some((p) => p.key === key)) {
      if (!firstDuplicate) firstDuplicate = key;
    }
    properties.push({ key, value: astValue(valText, diag) });
  }

  if (firstDuplicate) diag?.duplicateKeys.push(firstDuplicate);

  return { type: types.Object, value: text, properties };
}

/** Parse `[a, b, ...]`. / 解析 `[a, b, ...]`。 */
function astArray(text: string, diag?: ParseDiagnostics): AstArray {
  const inner =
    text[0] === "[" && text.endsWith("]") ? text.slice(1, -1) : text;
  const items = splitTopLevel(inner, ",").map((it) =>
    astValue(it.trim(), diag),
  );
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
function astConditional(text: string, diag?: ParseDiagnostics): AstConditional {
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
      condition: h.cond ? astValue(h.cond, diag) : null,
      value: astValue(body, diag),
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
export function evaluateAST(ast: AstRoot): Record<string, unknown> {
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
 * Parse text into a JS object (with evaluation). Duplicate keys within one
 * scope throw. See `CompactProfile.parse` docs for full behavior.
 *
 * 把文本解析并求值为 JS 对象。同一作用域重复键会抛错。完整行为见
 * `CompactProfile.parse` 的文档。
 */
export function parse(
  text: string,
  type: EncodeOutputType = "Object",
): EncodeResult | EncodeArrayResult {
  const diag: ParseDiagnostics = { duplicateKeys: [] };
  const ast = buildAST(text, diag);
  if (diag.duplicateKeys.length > 0) {
    throw new Error(
      `CompactProfile: duplicate key "${diag.duplicateKeys[0]}" in the same scope`,
    );
  }
  const result = evaluateAST(ast);
  if (type === types.Array) {
    return Object.entries(result).map(([k, v]) => ({ [k]: v }));
  }
  return result;
}
