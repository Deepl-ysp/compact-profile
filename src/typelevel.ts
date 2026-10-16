/**
 * Compile-time (type-level) parser: literal text → inferred object type.
 * Pure type-level programming; no runtime output.
 *
 * 编译期（类型级）解析器：字面量文本 → 推导对象类型。纯类型编程，无运行时代码。
 */

import { EncodeOutputType, EncodeResult, DuplicateKeyError } from "./types.js";

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
export type NarrowString<S extends string> = string extends S ? never : S;

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

/**
 * Scan every `{...}` object literal in the source (including values of
 * fields and array elements) for duplicate keys within one scope. Returns
 * the first offender, or `never`. Mirrors the runtime check, which throws
 * on duplicates at ANY nesting depth.
 *
 * 扫描源码中每一层 `{...}` 对象字面量（含字段值、数组元素），检测同一作用域
 * 内的重复键，返回首个重复键名或 `never`。与运行时行为对齐——运行时在任意
 * 嵌套层级的重复键都会抛错。
 */
type AnyScopeDuplicate<S extends string> = HasStructural<S> extends false
  ? never
  : S extends `${string}{${infer B}}${string}`
    ? [FindDuplicateKey<SplitTop<B>>] extends [never]
      ? AnyScopeDuplicate<B>
      : FindDuplicateKey<SplitTop<B>>
    : never;

/** True when no scope (root or nested) has duplicate keys. / 任意作用域均无重复键时为 true。 */
type AllScopesUnique<S extends string> = [AnyScopeDuplicate<S>] extends [never]
  ? true
  : false;

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

/** Linear scan: is T a member of tuple L? / 线性扫描：T 是否在元组 L 中。 */
type InList<T extends string, L extends readonly string[]> =
  L extends [infer H extends string, ...infer R extends readonly string[]]
    ? T extends H
      ? true
      : InList<T, R>
    : false;

/**
 * Detect duplicate top-level keys within one scope, e.g. `a=1,a=2`.
 * Returns the first repeated key, or `never` when all keys are unique.
 * Keeps compile-time inference consistent with runtime semantics (last
 * value wins), where a naive intersection would produce `1 & 2`.
 *
 * 检测同一作用域内的重复顶层键，如 `a=1,a=2`。
 * 返回首个重复的键名；全部唯一时返回 `never`。
 * 与运行时语义保持一致（后者覆盖前者），避免交叉类型推导出 `1 & 2`。
 */
type FindDuplicateKey<
  Fs extends readonly string[],
  Seen extends readonly string[] = [],
> = Fs extends [infer F extends string, ...infer R extends readonly string[]]
  ? Trim<F> extends `${infer K}=${string}`
    ? Trim<K> extends infer TK extends string
      ? TK extends ""
        ? FindDuplicateKey<R, Seen>
        : InList<TK, Seen> extends true
          ? TK
          : FindDuplicateKey<R, [...Seen, TK]>
      : never
    : FindDuplicateKey<R, Seen>
  : never;

/** True when the field list has no duplicate keys. / 字段列表无重复键时为 true。 */
type HasNoDuplicateKeys<S extends string> = [
  FindDuplicateKey<SplitTop<S>>,
] extends [never]
  ? true
  : false;

/**
 * Literal-mode return type. Duplicate keys in ANY scope — top-level
 * (`a=1,a=2`) or nested (`x={a=1,a=2}`) — yield `DuplicateKeyError<"a">`
 * instead of an unsatisfiable intersection, so compile-time inference
 * stays consistent with the runtime, which throws on such input.
 *
 * 字面量模式返回类型。任意作用域的重复键——顶层（`a=1,a=2`）或嵌套
 * （`x={a=1,a=2}`）——不再推导出不可满足的交叉类型，而是给出
 * `DuplicateKeyError<"a">` 提示，与运行时的抛错行为保持一致。
 */
export type DeriveResult<
  S extends string,
  T extends EncodeOutputType,
> = string extends S
  ? EncodeResult
  : AllScopesUnique<S> extends false
    ? DuplicateKeyError<`${AnyScopeDuplicate<S>}` & string>
    : HasNoDuplicateKeys<S> extends false
      ? DuplicateKeyError<`${FindDuplicateKey<SplitTop<S>>}` & string>
      : T extends "Array"
        ? Array<ToArrayEntry<ParseFields<SplitTop<S>>>>
        : ParseFields<SplitTop<S>>;
