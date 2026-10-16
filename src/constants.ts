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
