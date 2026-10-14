/**
 * CompactProfile —— 紧凑配置描述语言
 *
 * 提供文本 ↔ JS 对象的双向转换，支持从字面量字符串编译期推导字段结构。
 *
 * 最低 TypeScript 版本：4.8（依赖 `infer N extends number`）
 */

/* ============================================================
 *  字面量推导辅助类型
 * ============================================================ */

/** 去掉字符串两端的空白字符 */
type Trim<S extends string> =
  S extends ` ${infer R}` ? Trim<R> :
  S extends `\n${infer R}` ? Trim<R> :
  S extends `\t${infer R}` ? Trim<R> :
  S extends `\r${infer R}` ? Trim<R> :
  S extends `${infer L} ` ? Trim<L> :
  S extends `${infer L}\n` ? Trim<L> :
  S extends `${infer L}\t` ? Trim<L> :
  S extends `${infer L}\r` ? Trim<L> :
  S;

/**
 * 按顶层分隔符拆分。
 *
 * 跟踪括号深度与引号状态，保证 `a='x,y',b=2` 不会被错误拆分。
 */
type SplitTop<
  S extends string,
  Depth extends readonly unknown[] = [],
  Cur extends string = "",
  Out extends string[] = [],
  InQuote extends "'" | '"' | null = null
> = S extends `${infer C}${infer R}`
  ? InQuote extends null
    ? C extends "'" | '"'
      ? SplitTop<R, Depth, `${Cur}${C}`, Out, C>
      : C extends "(" | "{" | "["
        ? SplitTop<R, [...Depth, 0], `${Cur}${C}`, Out, null>
        : C extends ")" | "}" | "]"
          ? Depth extends readonly [unknown, ...infer D]
            ? SplitTop<R, D, `${Cur}${C}`, Out, null>
            : SplitTop<R, [], `${Cur}${C}`, Out, null>
          : C extends ","
            ? Depth extends readonly []
              ? SplitTop<R, [], "", [...Out, Trim<Cur>], null>
              : SplitTop<R, Depth, `${Cur}${C}`, Out, null>
            : SplitTop<R, Depth, `${Cur}${C}`, Out, null>
    : C extends InQuote
      ? SplitTop<R, Depth, `${Cur}${C}`, Out, null>
      : SplitTop<R, Depth, `${Cur}${C}`, Out, InQuote>
  : Trim<Cur> extends ""
    ? Out
    : [...Out, Trim<Cur>];

/**
 * 解析单个值的类型。
 *
 * - 字符串字面量 → 字面量字符串类型
 * - `true` / `false` → `true` / `false`
 * - `null` / `undefined` → `null` / `undefined`
 * - 数字字面量 → 字面量数字类型
 * - `{...}` → 递归解析对象
 * - `[...]` → 递归解析数组
 * - 其它（引用、表达式、条件）→ `unknown`
 */
type ParseValue<V extends string> =
  Trim<V> extends infer T extends string
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

/** 解析数组体，保留 tuple 结构 */
type ParseArrayBody<B extends string> =
  SplitTop<B> extends infer Fs extends string[]
    ? Fs extends []
      ? []
      : { [I in keyof Fs]: Fs[I] extends string ? ParseValue<Fs[I]> : never }
    : [];

/** 解析单个字段 `key=value`，自动键不推导（返回空对象） */
type ParseField<F extends string> =
  F extends `${infer K}=${infer V}`
    ? Trim<K> extends infer TK extends string
      ? { [P in TK]: ParseValue<V> }
      : {}
    : {};

/** 合并字段列表为交叉类型 */
type ParseFields<Fs extends string[]> =
  Fs extends [infer F extends string, ...infer R extends string[]]
    ? ParseField<F> & ParseFields<R>
    : {};

/** 把推导出的对象类型转成 `[{k:v}, ...]` 联合 */
type ToArrayEntry<T> = {
  [K in keyof T]: { [P in K]: T[K] };
}[keyof T];

/* ============================================================
 *  基础类型
 * ============================================================ */

/** `encode` 的输出封装形式 */
export type EncodeOutputType = "Object" | "Array";

/** `encode` 默认（Object 模式）的返回类型 */
export type EncodeObjectResult = Record<string, unknown>;

/** `encode` 数组模式的返回类型 */
export type EncodeArrayResult = Array<Record<string, unknown>>;

/** `encode` 的返回类型联合 */
export type EncodeResult = EncodeObjectResult | EncodeArrayResult;

/** `decode` 的可选参数 */
export interface DecodeOptions {
  /** 是否格式化输出，默认 `false` */
  format?: boolean;
  /** 缩进空格数，仅 `format: true` 时生效，默认 `2` */
  indent?: number;
}

/* ============================================================
 *  类型常量
 * ============================================================ */

/** 节点类型常量表 */
export interface CompactProfileTypes {
  readonly String: "String";
  readonly Integer: "Integer";
  readonly Float: "Float";
  readonly Boolean: "Boolean";
  readonly Null: "Null";
  readonly Undefined: "Undefined";
  readonly Binary: "Binary";
  readonly Array: "Array";
  readonly Object: "Object";
  readonly Pointer: "Pointer";
  readonly MemberAccess: "MemberAccess";
  readonly FormulaAdd: "Formula Add";
  readonly FormulaSubtract: "Formula Subtract";
  readonly FormulaMultiply: "Formula Multiply";
  readonly FormulaDivide: "Formula Divide";
  readonly FormulaModulo: "Formula Modulo";
  readonly UnaryMinus: "Unary Minus";
  readonly Bitwise: "Expression BitwiseOperation";
  readonly Spaceship: "Expression SpaceshipOperation";
  readonly Comparison: "Expression Comparison";
  readonly Ternary: "Expression TernaryOperation";
  readonly Conditional: "Expression ConditionalOperation";
  readonly Logical: "Expression Logical";
}

/** 节点类型常量 */
export const types: CompactProfileTypes;

/* ============================================================
 *  encode —— 字面量推导版本
 * ============================================================ */

/**
 * 把输入字符串解析并求值为 JS 对象。
 *
 * 编译期从**字符串字面量**推导字段名和值类型：
 *
 * - 字符串、数字、布尔、`null`、`undefined` → 对应字面量类型
 * - `{...}` / `[...]` → 递归推导
 * - 引用、表达式、三元、条件语句 → `unknown`
 *
 * 传入非字面量（`string` 变量）时退化为 {@link EncodeObjectResult} /
 * {@link EncodeArrayResult}。
 *
 * @param text 字段串，最外层不需要 `{}`
 * @param type 输出封装形式，默认 `"Object"`
 *
 * @example
 * ```ts
 * const r = encode(`host='localhost',port=8080,debug=true`);
 * // { host: "localhost"; port: 8080; debug: true }
 *
 * const r2 = encode(`point={x=1,y=2}`, types.Array);
 * // Array<{ point: { x: 1; y: 2 } }>
 * ```
 */
export function encode<
  S extends string,
  T extends EncodeOutputType = "Object"
>(
  text: S,
  type?: T
): string extends S
  ? T extends "Array"
    ? EncodeArrayResult
    : EncodeObjectResult
  : T extends "Array"
    ? Array<ToArrayEntry<ParseFields<SplitTop<S>>>>
    : ParseFields<SplitTop<S>>;

/* ============================================================
 *  decode
 * ============================================================ */

/**
 * 把对象或数组序列化为文本。
 *
 * @param obj 待序列化的值
 * @param options 格式化选项，也可以直接传 `boolean`
 *
 * @example
 * ```ts
 * decode({ a: 1, b: 'x' });
 * // "a=1,b='x'"
 *
 * decode({ a: 1, b: { c: 2 } }, { format: true });
 * // a=1,
 * // b={
 * //   c=2
 * // }
 * ```
 */
export function decode(
  obj: EncodeObjectResult | EncodeArrayResult,
  options?: DecodeOptions | boolean
): string;

/* ============================================================
 *  encodetags
 * ============================================================ */

/**
 * 模板字符串标签。把 JS 值插值到文本中，再调用 {@link encode}。
 *
 * 插值规则：
 * - `number` / `boolean`：`String(v)` 直接拼接
 * - `string`：`String(v)`，**不加引号**（会被当引用处理）
 * - `Array`：拼接为 `[a,b,c]`
 * - `object`：拼接为 `{k=v,k=v}`
 * - `null` / `undefined`：拼接为 `"null"` / `"undefined"`
 *
 * 由于拼接结果在运行时才确定，返回类型固定为 {@link EncodeObjectResult}。
 *
 * @example
 * ```ts
 * const host = 'localhost';
 * encodetags`host='${host}',port=8080`;
 * // { host: 'localhost', port: 8080 }
 * ```
 */
export function encodetags(
  strings: TemplateStringsArray,
  ...values: unknown[]
): EncodeObjectResult;


declare const CompactProfile: {
  readonly types: CompactProfileTypes;
  readonly encode: typeof encode;
  readonly decode: typeof decode;
  readonly encodetags: typeof encodetags;
};
 
export default CompactProfile;