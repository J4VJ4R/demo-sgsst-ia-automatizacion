export type FormulaToken =
  | { type: "number"; value: number }
  | { type: "ident"; value: string }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "lparen" }
  | { type: "rparen" };

type Assoc = "left" | "right";
type OpInfo = { prec: number; assoc: Assoc };

const OPS: Record<string, OpInfo> = {
  "+": { prec: 1, assoc: "left" },
  "-": { prec: 1, assoc: "left" },
  "*": { prec: 2, assoc: "left" },
  "/": { prec: 2, assoc: "left" },
};

export type FormulaValidationResult =
  | { ok: true; variables: string[] }
  | { ok: false; error: string };

export type TokenizeFormulaResult =
  | { ok: true; variables: string[]; tokens: FormulaToken[] }
  | { ok: false; error: string };

export function tokenizeFormula(input: string): TokenizeFormulaResult {
  const src = input.trim();
  if (!src) return { ok: false, error: "La fórmula no puede estar vacía." };

  const tokens: FormulaToken[] = [];
  let i = 0;

  const pushNumber = (raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return false;
    tokens.push({ type: "number", value });
    return true;
  };

  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    if (c === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      tokens.push({ type: "op", value: c });
      i++;
      continue;
    }

    if (c === "." || (c >= "0" && c <= "9")) {
      let j = i + 1;
      while (j < src.length && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) j++;
      const raw = src.slice(i, j);
      if (!pushNumber(raw)) return { ok: false, error: `Número inválido: "${raw}"` };
      i = j;
      continue;
    }

    const isIdentStart = (ch: string) =>
      (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
    const isIdent = (ch: string) =>
      isIdentStart(ch) || (ch >= "0" && ch <= "9");

    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < src.length && isIdent(src[j])) j++;
      tokens.push({ type: "ident", value: src.slice(i, j) });
      i = j;
      continue;
    }

    return { ok: false, error: `Carácter no permitido: "${c}"` };
  }

  const validation = validateTokens(tokens);
  if (!validation.ok) return validation;
  return { ok: true, variables: validation.variables, tokens };
}

function validateTokens(tokens: FormulaToken[]): FormulaValidationResult {
  let balance = 0;
  let prev: FormulaToken | null = null;
  const variables = new Set<string>();

  for (const t of tokens) {
    if (t.type === "lparen") balance++;
    if (t.type === "rparen") balance--;
    if (balance < 0) return { ok: false, error: "Paréntesis desbalanceados." };

    if (t.type === "ident") variables.add(t.value);

    const prevType = prev?.type;
    if (t.type === "op") {
      if (!prev || prevType === "op" || prevType === "lparen") {
        if (t.value !== "-") return { ok: false, error: "Operador en posición inválida." };
      }
    } else if (t.type === "rparen") {
      if (!prev || prevType === "op" || prevType === "lparen") {
        return { ok: false, error: "Paréntesis de cierre en posición inválida." };
      }
    } else if (t.type === "lparen") {
      if (prev && (prevType === "number" || prevType === "ident" || prevType === "rparen")) {
        return { ok: false, error: "Falta un operador antes del paréntesis." };
      }
    } else if (t.type === "number" || t.type === "ident") {
      if (prev && (prevType === "number" || prevType === "ident" || prevType === "rparen")) {
        return { ok: false, error: "Falta un operador entre valores." };
      }
    }

    prev = t;
  }

  if (balance !== 0) return { ok: false, error: "Paréntesis desbalanceados." };
  if (!prev) return { ok: false, error: "La fórmula no puede estar vacía." };
  if (prev.type === "op" || prev.type === "lparen") return { ok: false, error: "La fórmula termina en un operador." };

  return { ok: true, variables: Array.from(variables).sort() };
}

function toRpn(tokens: FormulaToken[]): FormulaToken[] {
  const output: FormulaToken[] = [];
  const stack: FormulaToken[] = [];

  let prev: FormulaToken | null = null;

  for (const t of tokens) {
    if (t.type === "number" || t.type === "ident") {
      output.push(t);
    } else if (t.type === "op") {
      const isUnaryMinus = t.value === "-" && (!prev || prev.type === "op" || prev.type === "lparen");
      if (isUnaryMinus) {
        output.push({ type: "number", value: 0 });
      } else {
        while (stack.length > 0) {
          const top = stack[stack.length - 1];
          if (top.type !== "op") break;
          const o1 = OPS[t.value];
          const o2 = OPS[top.value];
          const shouldPop =
            (o1.assoc === "left" && o1.prec <= o2.prec) || (o1.assoc === "right" && o1.prec < o2.prec);
          if (!shouldPop) break;
          output.push(stack.pop() as FormulaToken);
        }
      }
      stack.push(t);
    } else if (t.type === "lparen") {
      stack.push(t);
    } else if (t.type === "rparen") {
      while (stack.length > 0 && stack[stack.length - 1].type !== "lparen") {
        output.push(stack.pop() as FormulaToken);
      }
      stack.pop();
    }
    prev = t;
  }

  while (stack.length > 0) output.push(stack.pop() as FormulaToken);
  return output;
}

export type FormulaEvalResult = { ok: true; value: number } | { ok: false; error: string };

export function evaluateFormula(input: string, variables: Record<string, number>): FormulaEvalResult {
  const tok = tokenizeFormula(input);
  if (!tok.ok) return { ok: false, error: tok.error };
  const rpn = toRpn(tok.tokens);

  const stack: number[] = [];
  for (const t of rpn) {
    if (t.type === "number") {
      stack.push(t.value);
      continue;
    }
    if (t.type === "ident") {
      const v = variables[t.value];
      if (typeof v !== "number" || !Number.isFinite(v)) {
        return { ok: false, error: `Variable sin valor: ${t.value}` };
      }
      stack.push(v);
      continue;
    }
    if (t.type === "op") {
      const right = stack.pop();
      const left = stack.pop();
      if (typeof right !== "number" || typeof left !== "number") return { ok: false, error: "Fórmula inválida." };
      if (t.value === "+") stack.push(left + right);
      if (t.value === "-") stack.push(left - right);
      if (t.value === "*") stack.push(left * right);
      if (t.value === "/") {
        if (right === 0) return { ok: false, error: "División por cero." };
        stack.push(left / right);
      }
    }
  }

  if (stack.length !== 1) return { ok: false, error: "Fórmula inválida." };
  const value = stack[0];
  if (!Number.isFinite(value)) return { ok: false, error: "Resultado inválido." };
  return { ok: true, value };
}

export function sanitizeVariableKey(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return normalized.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32);
}
