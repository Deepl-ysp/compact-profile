const CompactProfile = (() => {
  class _CompactProfile {
    static [Symbol.hasInstance](instance) {
      return instance != null && instance.type === "CompactProfile";
    }

    static encode(text, type = "Object") {
      const ast = _CompactProfile.#buildAST(text);
      const result = _CompactProfile.#evaluateAST(ast);
      if (type === _CompactProfile.types.Array) {
        return Object.entries(result).map(([k, v]) => ({ [k]: v }));
      }
      return result;
    }
    static encodetags = (strings, ...values) => {
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
            text += `{${_CompactProfile.decode(v)}}`;
          } else {
            text += String(v);
          }
        }
      }

      return _CompactProfile.encode(text);
    };

    static decode(obj, options = {}) {
      if (typeof options === "boolean") options = { format: options };
      const format = options.format === true;
      const indentSize =
        typeof options.indent === "number" ? options.indent : 2;
      const pad = (n) => " ".repeat(n);

      const escapeString = (str) => {
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

      const quote = (s) => `'${escapeString(s)}'`;

      const decodeValue = (v, depth) => {
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

        const keys = Object.keys(v);
        const parts = keys.map((k) => `${k}=${decodeValue(v[k], depth + 1)}`);
        if (!format) return `{${parts.join(",")}}`;
        if (parts.length === 0) return "{}";
        const inner = pad(indentSize * (depth + 1));
        const outer = pad(indentSize * depth);
        return `{\n${parts.map((p) => inner + p).join(",\n")}\n${outer}}`;
      };

      let entries;
      if (Array.isArray(obj)) {
        entries = [];
        for (const item of obj) {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            for (const k of Object.keys(item)) entries.push([k, item[k]]);
          }
        }
      } else if (obj && typeof obj === "object") {
        entries = Object.keys(obj).map((k) => [k, obj[k]]);
      } else {
        return "";
      }

      if (!format) {
        return entries.map(([k, v]) => `${k}=${decodeValue(v, 0)}`).join(",");
      }
      return entries.map(([k, v]) => `${k}=${decodeValue(v, 0)}`).join(",\n");
    }

    static #buildAST(text) {
      const s = String(text ?? "").trim();
      if (!s) return [];
      const fields = _CompactProfile.#splitTopLevel(s, ",");
      const out = [];
      for (const field of fields) {
        const eq = _CompactProfile.#findTopLevelAssign(field);
        if (eq === -1) {
          out.push({ _: _CompactProfile.#astValue(field.trim()) });
          continue;
        }
        const key = field.slice(0, eq).trim();
        const val = field.slice(eq + 1).trim();
        out.push({ [key]: _CompactProfile.#astValue(val) });
      }
      return out;
    }

    static #evaluateAST(ast) {
      const T = _CompactProfile.types;

      const lookup = (name, scopes) => {
        for (const s of scopes) if (s.has(name)) return s.get(name);
        return undefined;
      };

      const navigate = (value, parts) => {
        let cur = value;
        for (const p of parts) {
          if (cur == null) return undefined;
          cur = cur[p];
        }
        return cur;
      };

      const evalNode = (node, scopes) => {
        if (node == null) return undefined;
        switch (node.type) {
          case T.String:
            return node.value;
          case T.Integer:
            return node.number;
          case T.Float:
            return node.number;
          case T.Boolean:
            return node.boolean;
          case T.Null:
            return null;
          case T.Undefined:
            return undefined;
          case T.Pointer:
            return lookup(node.value, scopes);
          case T.MemberAccess: {
            const head = lookup(node.parts[0], scopes);
            if (head === undefined) return undefined;
            return navigate(head, node.parts.slice(1));
          }
          case T.Object: {
            const local = new Map();
            const innerScopes = [local, ...scopes];
            const out = {};
            for (const p of node.properties) {
              if (p.key == null) continue;
              const v = evalNode(p.value, innerScopes);
              out[p.key] = v;
              local.set(p.key, v);
            }
            return out;
          }
          case T.Array:
            return node.items.map((it) => evalNode(it, scopes));
          case T.Ternary: {
            const cond = evalNode(node.condition, scopes);
            return cond
              ? evalNode(node.consequent, scopes)
              : evalNode(node.alternate, scopes);
          }
          case T.Conditional: {
            for (const b of node.branches) {
              if (b.kind === "else") return evalNode(b.value, scopes);
              if (evalNode(b.condition, scopes))
                return evalNode(b.value, scopes);
            }
            return undefined;
          }
          case T.Logical: {
            const l = evalNode(node.left, scopes);
            if (node.operator === "&&")
              return l ? evalNode(node.right, scopes) : l;
            if (node.operator === "||")
              return l ? l : evalNode(node.right, scopes);
            return undefined;
          }
          case T.FormulaAdd:
            return evalNode(node.left, scopes) + evalNode(node.right, scopes);
          case T.FormulaSubtract:
            return evalNode(node.left, scopes) - evalNode(node.right, scopes);
          case T.FormulaMultiply:
            return evalNode(node.left, scopes) * evalNode(node.right, scopes);
          case T.FormulaDivide:
            return evalNode(node.left, scopes) / evalNode(node.right, scopes);
          case T.FormulaModulo:
            return evalNode(node.left, scopes) % evalNode(node.right, scopes);
          case T.UnaryMinus: {
            const v = evalNode(node.operand, scopes);
            return typeof v === "number" ? -v : -Number(v);
          }
          case T.Bitwise: {
            const l = evalNode(node.left, scopes);
            const r = evalNode(node.right, scopes);
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
          case T.Comparison: {
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
                return l >= r;
              case "<=":
                return l <= r;
              case ">":
                return l > r;
              case "<":
                return l < r;
            }
            return undefined;
          }
          case T.Spaceship: {
            const l = evalNode(node.left, scopes);
            const r = evalNode(node.right, scopes);
            return l < r ? -1 : l > r ? 1 : 0;
          }
          default:
            return undefined;
        }
      };

      const rootScope = new Map();
      const out = {};
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

    static #ast(type, value, extra = {}) {
      return { type, value: String(value ?? ""), ...extra };
    }

    static #astValue(text) {
      const s = String(text ?? "").trim();
      if (!s) return _CompactProfile.#ast(_CompactProfile.types.String, "");

      if (
        (s[0] === "'" && s.endsWith("'")) ||
        (s[0] === '"' && s.endsWith('"'))
      ) {
        const raw = s.slice(1, -1);
        return _CompactProfile.#ast(
          _CompactProfile.types.String,
          _CompactProfile.#unescape(raw),
          { raw: s },
        );
      }

      if (
        s[0] === "(" &&
        _CompactProfile.#matchingClose(s, 0) === s.length - 1
      ) {
        return _CompactProfile.#astValue(s.slice(1, -1));
      }

      if (s === "true" || s === "false") {
        return _CompactProfile.#ast(_CompactProfile.types.Boolean, s, {
          boolean: s === "true",
        });
      }
      if (s === "null") {
        return _CompactProfile.#ast(_CompactProfile.types.Null, s, {
          literal: null,
        });
      }
      if (s === "undefined") {
        return _CompactProfile.#ast(_CompactProfile.types.Undefined, s, {
          literal: undefined,
        });
      }

      if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) {
        const n = Number(s);
        return _CompactProfile.#ast(
          Number.isInteger(n)
            ? _CompactProfile.types.Integer
            : _CompactProfile.types.Float,
          s,
          { number: n },
        );
      }

      if (s[0] === "{" && s.endsWith("}")) {
        return _CompactProfile.#astObject(s);
      }

      if (s[0] === "[" && s.endsWith("]")) {
        return _CompactProfile.#astArray(s);
      }

      if (/^if\b/.test(s)) {
        return _CompactProfile.#astConditional(s);
      }

      const tern = _CompactProfile.#findTernary(s);
      if (tern) {
        const cond = s.slice(0, tern.q).trim();
        const tru = s.slice(tern.q + 1, tern.c).trim();
        const fal = s.slice(tern.c + 1).trim();
        return _CompactProfile.#ast(_CompactProfile.types.Ternary, s, {
          condition: _CompactProfile.#astValue(cond),
          consequent: _CompactProfile.#astValue(tru),
          alternate: _CompactProfile.#astValue(fal),
        });
      }

      const bin = _CompactProfile.#findLowestPrecBinary(s);
      if (bin) {
        const left = s.slice(0, bin.index).trim();
        const right = s.slice(bin.index + bin.op.length).trim();
        return _CompactProfile.#ast(_CompactProfile.#binaryTypeFor(bin.op), s, {
          operator: bin.op,
          left: _CompactProfile.#astValue(left),
          right: _CompactProfile.#astValue(right),
        });
      }

      if (s.startsWith("-")) {
        return _CompactProfile.#ast(_CompactProfile.types.UnaryMinus, s, {
          operand: _CompactProfile.#astValue(s.slice(1).trim()),
        });
      }

      if (/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(s)) {
        return _CompactProfile.#ast(_CompactProfile.types.MemberAccess, s, {
          parts: s.split("."),
        });
      }

      if (/^[A-Za-z_$][\w$]*$/.test(s)) {
        return _CompactProfile.#ast(_CompactProfile.types.Pointer, s);
      }

      return _CompactProfile.#ast(_CompactProfile.types.Pointer, s);
    }

    static #astObject(text) {
      const body = text.slice(1, -1);
      const fields = _CompactProfile.#splitTopLevel(body, ",");
      const properties = [];

      for (let i = 0; i < fields.length; i++) {
        const raw = fields[i].trim();
        if (!raw) continue;
        const eq = _CompactProfile.#findTopLevelAssign(raw);
        if (eq === -1) {
          const key = _CompactProfile.#autoKey(raw) ?? `_${i}`;
          properties.push({ key, value: _CompactProfile.#astValue(raw) });
        } else {
          const key = raw.slice(0, eq).trim();
          const val = raw.slice(eq + 1).trim();
          properties.push({ key, value: _CompactProfile.#astValue(val) });
        }
      }

      return _CompactProfile.#ast(_CompactProfile.types.Object, text, {
        properties,
      });
    }

    static #astArray(text) {
      const inner =
        text[0] === "[" && text.endsWith("]") ? text.slice(1, -1) : text;
      const items = _CompactProfile
        .#splitTopLevel(inner, ",")
        .map((it) => _CompactProfile.#astValue(it.trim()));
      return _CompactProfile.#ast(_CompactProfile.types.Array, text, { items });
    }

    static #autoKey(exprText) {
      const s = String(exprText).trim();

      if (/^(null|undefined|true|false)$/.test(s)) return null;
      if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return null;
      if (
        (s[0] === "'" && s.endsWith("'")) ||
        (s[0] === '"' && s.endsWith('"'))
      ) {
        return null;
      }

      const m = s.match(/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/);
      if (!m) return null;
      const parts = m[0].split(".");
      return parts[parts.length - 1];
    }
    static #astConditional(text) {
      const s = text.trim();
      const re = /\b(if|elif|else)\b/g;
      const heads = [];
      let m;

      while ((m = re.exec(s))) {
        const pos = m.index;
        if (pos > 0 && /\w/.test(s[pos - 1])) continue;

        let after = pos + m[1].length;
        while (after < s.length && /\s/.test(s[after])) after++;

        let cond = null;
        if (s[after] === "(") {
          let depth = 0;
          let end = after;
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
          cond = s.slice(after + 1, end - 1).trim();
          after = end;
        }

        while (after < s.length && /\s/.test(s[after])) after++;

        heads.push({
          kind: m[1],
          condition: cond,
          start: pos,
          contentStart: after,
        });
      }

      const branches = heads.map((h, i) => {
        const end = i + 1 < heads.length ? heads[i + 1].start : s.length;
        const body = s.slice(h.contentStart, end).trim();
        return {
          kind: h.kind,
          condition: h.condition
            ? _CompactProfile.#astValue(h.condition)
            : null,
          value: _CompactProfile.#astValue(body),
        };
      });

      return _CompactProfile.#ast(_CompactProfile.types.Conditional, s, {
        branches,
      });
    }

    static #findTernary(text) {
      const q = _CompactProfile.#findTopLevelChar(text, "?");
      if (q === -1) return null;
      const rest = text.slice(q + 1);
      const cRel = _CompactProfile.#findTopLevelChar(rest, ":");
      if (cRel === -1) return null;
      return { q, c: q + 1 + cRel };
    }

    static #splitTopLevel(text, sep) {
      const out = [];
      let depth = 0;
      let quote = null;
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

    static #findTopLevelAssign(text) {
      let depth = 0;
      let quote = null;

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
          )
            continue;
          return i;
        }
      }
      return -1;
    }

    static #findTopLevelChar(text, needle) {
      let depth = 0;
      let quote = null;

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

    static #findLowestPrecBinary(s) {
      const OPS = [
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
      const sorted = [...OPS].sort((a, b) => b.op.length - a.op.length);

      const candidates = [];
      let depth = 0;
      let quote = null;
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

        if ((ch === "+" || ch === "-") && _CompactProfile.#isUnaryAt(s, i)) {
          i++;
          continue;
        }

        let matched = null;
        for (const o of sorted) {
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
        if (
          c.prec > best.prec ||
          (c.prec === best.prec && c.index > best.index)
        ) {
          best = c;
        }
      }
      return best;
    }

    static #isUnaryAt(s, i) {
      for (let j = i - 1; j >= 0; j--) {
        const c = s[j];
        if (/\s/.test(c)) continue;
        return "+-*/%<>=!&|^~(".includes(c) || c === "," || c === "?";
      }
      return true;
    }

    static #matchingClose(s, start) {
      if (s[start] !== "(") return -1;
      let depth = 0;
      let quote = null;
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

    static #binaryTypeFor(op) {
      const T = _CompactProfile.types;
      switch (op) {
        case "||":
        case "&&":
          return T.Logical;
        case "|":
        case "^":
        case "&":
        case "<<":
        case ">>":
        case ">>>":
          return T.Bitwise;
        case "===":
        case "!==":
        case "==":
        case "!=":
        case ">=":
        case "<=":
        case ">":
        case "<":
          return T.Comparison;
        case "<=>":
          return T.Spaceship;
        case "+":
          return T.FormulaAdd;
        case "-":
          return T.FormulaSubtract;
        case "*":
          return T.FormulaMultiply;
        case "/":
          return T.FormulaDivide;
        case "%":
          return T.FormulaModulo;
        default:
          return T.Binary;
      }
    }

    static #unescape(raw) {
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
  }

  Object.defineProperty(_CompactProfile, "types", {
    value: {
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
    },
    writable: false,
    enumerable: false,
    configurable: false,
  });

  Object.defineProperties(_CompactProfile.prototype, {
    type: {
      value: "CompactProfile",
      writable: false,
      enumerable: false,
      configurable: false,
    },
    [Symbol.toStringTag]: {
      value: "CompactProfile",
      writable: false,
      enumerable: false,
      configurable: false,
    },
  });

  return Object.freeze({
    types: _CompactProfile.types,
    encode: _CompactProfile.encode.bind(_CompactProfile),
    decode: _CompactProfile.decode.bind(_CompactProfile),
    encodetags: _CompactProfile.encodetags,
  });
})();

export default CompactProfile;
export const types = CompactProfile.types;
export const encode = CompactProfile.encode;
export const decode = CompactProfile.decode;
export const encodetags = CompactProfile.encodetags;
