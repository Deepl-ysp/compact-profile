/** Public type contracts. / 公共类型契约。 */

/** Output mode of `parse`. / parse 的输出模式。 */
export type EncodeOutputType = "Object" | "Array";

/** Object-mode return type (wide). / Object 模式返回类型（宽）。 */
export type EncodeObjectResult = Record<string, unknown>;

/** Array-mode return type (wide). / Array 模式返回类型（宽）。 */
export type EncodeArrayResult = Array<Record<string, unknown>>;

/** Common return type. / 通用返回类型。 */
export type EncodeResult = EncodeObjectResult;

/** `stringify` options. / stringify 选项。 */
export interface DecodeOptions {
  format?: boolean;
  indent?: number;
}

/** Marker surfaced in the inferred type when a scope has duplicate keys. / 作用域内出现重复键时，在推导结果里留下的错误标记。 */
export interface DuplicateKeyError<Key extends string> {
  readonly __compactProfileError: "Duplicate key";
  readonly key: Key;
}
