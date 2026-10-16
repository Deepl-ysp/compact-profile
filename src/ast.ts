import { types } from "./constants.js";

interface AstBase {
  value: string;
}

export interface AstString extends AstBase {
  type: typeof types.String;
  raw?: string;
}

export interface AstInteger extends AstBase {
  type: typeof types.Integer;
  number: number;
}

export interface AstFloat extends AstBase {
  type: typeof types.Float;
  number: number;
}

export interface AstBoolean extends AstBase {
  type: typeof types.Boolean;
  boolean: boolean;
}

export interface AstNull extends AstBase {
  type: typeof types.Null;
  literal: null;
}

export interface AstUndefined extends AstBase {
  type: typeof types.Undefined;
  literal: undefined;
}

export interface AstPointer extends AstBase {
  type: typeof types.Pointer;
}

export interface AstMemberAccess extends AstBase {
  type: typeof types.MemberAccess;
  parts: string[];
}

export interface AstProp {
  key: string;
  value: AstNode;
}

export interface AstObject extends AstBase {
  type: typeof types.Object;
  properties: AstProp[];
}

export interface AstArray extends AstBase {
  type: typeof types.Array;
  items: AstNode[];
}

export type BinaryType =
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

export interface AstBinary extends AstBase {
  type: BinaryType;
  operator: string;
  left: AstNode;
  right: AstNode;
}

export interface AstUnaryMinus extends AstBase {
  type: typeof types.UnaryMinus;
  operand: AstNode;
}

export interface AstTernary extends AstBase {
  type: typeof types.Ternary;
  condition: AstNode;
  consequent: AstNode;
  alternate: AstNode;
}

export interface AstBranch {
  kind: "if" | "elif" | "else";
  condition: AstNode | null;
  value: AstNode;
}

export interface AstConditional extends AstBase {
  type: typeof types.Conditional;
  branches: AstBranch[];
}

export type AstNode =
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
export type AstRoot = Array<Record<string, AstNode>>;
