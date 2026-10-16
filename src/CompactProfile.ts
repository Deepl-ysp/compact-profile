/**
 * CompactProfile — a compact configuration description language.
 * Bidirectional text ↔ JS object conversion with literal inference
 * and external type injection.
 *
 * Limit: compile-time inference hits TS2589 on long strings. Past ~1500
 * chars, use `const text: string = \`...\`` + hand-written interface +
 * `parse<Config>(text)`.
 *
 * CompactProfile —— 紧凑配置描述语言。
 * 文本 ↔ JS 对象双向转换，支持字面量推导和外部类型注入。
 *
 * 边界：编译期推导对长字符串会爆 TS2589。超过 ~1500 字符请用
 * `const text: string = \`...\`` + 手写 interface + `parse<Config>(text)`。
 *
 * Module map / 模块结构：
 * - types.ts      public type contracts / 公共类型契约
 * - constants.ts  node type constants / 节点类型常量表
 * - ast.ts        AST node shapes / AST 节点结构
 * - typelevel.ts  compile-time inference / 编译期类型推导
 * - parser.ts     runtime parse + evaluate / 运行时解析与求值
 * - stringify.ts  object → text / 序列化
 */

import { types } from "./constants.js";
import {
  EncodeOutputType,
  EncodeObjectResult,
  EncodeArrayResult,
  EncodeResult,
} from "./types.js";
import { NarrowString, DeriveResult } from "./typelevel.js";
import { parse as parseImpl } from "./parser.js";
import { stringify } from "./stringify.js";

export { types };
export type { CompactProfileTypes } from "./constants.js";
export type {
  EncodeOutputType,
  EncodeObjectResult,
  EncodeArrayResult,
  EncodeResult,
  DecodeOptions,
  DuplicateKeyError,
} from "./types.js";
export { stringify };

/**
 * Parse text into a JS object (with evaluation).
 *
 * 把文本**解析**并求值为 JS 对象。三种用法：
 * 1. 字面量 → 精确推导（小配置，IDE 全字段补全）
 * 2. 宽 string → 退化为 EncodeResult（大配置，不爆栈）
 * 3. 显式外部类型：`parse<Config>(text)`（大配置 + 手写 interface）
 *
 * Duplicate keys within one scope (e.g. `a=1,a=2`) throw at runtime;
 * compile-time literal inference surfaces them as `DuplicateKeyError<"a">`.
 *
 * 同一作用域内键重复（如 `a=1,a=2`）时运行时会抛出错误；编译期字面量推导
 * 会以 `DuplicateKeyError<"a">` 形式提示。
 *
 * Limit: literals past ~1500 chars may hit TS2589 — use form 2 or 3.
 *
 * 边界：字面量超过 ~1500 字符可能爆 TS2589，此时用方式 2/3。
 */
export function parse<
  S extends string,
  T extends EncodeOutputType = "Object",
>(text: NarrowString<S>, type?: T): DeriveResult<S, T>;

export function parse<R extends object = never>(
  text: string,
  type?: EncodeOutputType,
): [R] extends [never] ? EncodeResult : R;

export function parse(
  text: string,
  type: EncodeOutputType = "Object",
): EncodeResult | EncodeArrayResult {
  return parseImpl(text, type);
}

/**
 * Functional form of `parse<T>(text)`.
 *
 * ```ts
 * const r = parseAs<Config>(`host='x',port=80`); // r: Config
 * ```
 *
 * 显式外部类型的函数式写法，与 `parse<T>(text)` 等价。
 */
export function parseAs<R extends object>(
  text: string,
  type: EncodeOutputType = "Object",
): R {
  return parse(text, type) as unknown as R;
}

import { encodetags } from "./stringify.js";

export { encodetags };

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
  static readonly parse = parse;
  static readonly parseAs = parseAs;
  static readonly stringify = stringify;
  static readonly encodetags = encodetags;

  readonly type = "CompactProfile";
  readonly [Symbol.toStringTag] = "CompactProfile";
}

const CompactProfile = CompactProfileClass;

export default CompactProfile;
